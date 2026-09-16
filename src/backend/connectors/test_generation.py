import json

from django.test import SimpleTestCase

from connectors import generation


ITEMS = [
    {
        "id": "docs:d1",
        "title": "Note de service",
        "author": "Amélie Rousseau",
        "date": "2026-09-10",
        "content": "Le dossier doit être transmis avant le 30 septembre.",
        "source": {"resource_url": "http://docs.test/d1"},
    },
    {
        "id": "drive:f1",
        "title": "Dossier CAT NAT",
        "author": "Karim Belhadj",
        "date": "2026-09-11",
        "content": "x" * 700,
        "source": {"resource_url": "http://drive.test/f1"},
    },
]


class EnrichIdsTests(SimpleTestCase):
    def setUp(self):
        self.by_id = {item["id"]: item for item in ITEMS}

    def test_resolves_real_ids(self):
        result = generation._enrich_ids(["docs:d1"], self.by_id)
        self.assertEqual(result, [{
            "id": "docs:d1",
            "title": "Note de service",
            "url": "http://docs.test/d1",
        }])

    def test_drops_hallucinated_ids(self):
        result = generation._enrich_ids(["docs:d1", "docs:does-not-exist"], self.by_id)
        self.assertEqual([entry["id"] for entry in result], ["docs:d1"])

    def test_non_list_input_returns_empty(self):
        self.assertEqual(generation._enrich_ids(None, self.by_id), [])
        self.assertEqual(generation._enrich_ids("docs:d1", self.by_id), [])


class EnrichEvidenceIdsTests(SimpleTestCase):
    def setUp(self):
        self.by_id = {item["id"]: item for item in ITEMS}

    def test_resolves_real_ids_with_full_preview_fields(self):
        result = generation._enrich_evidence_ids(["docs:d1"], self.by_id)
        self.assertEqual(result, [{
            "id": "docs:d1",
            "title": "Note de service",
            "url": "http://docs.test/d1",
            "author": "Amélie Rousseau",
            "date": "2026-09-10",
            "content": "Le dossier doit être transmis avant le 30 septembre.",
        }])

    def test_truncates_long_content_with_marker(self):
        result = generation._enrich_evidence_ids(["drive:f1"], self.by_id)
        content = result[0]["content"]
        self.assertEqual(len(content), generation.EVIDENCE_PREVIEW_CHARS + len(generation.TRUNCATION_MARKER))
        self.assertTrue(content.endswith(generation.TRUNCATION_MARKER))

    def test_drops_hallucinated_ids(self):
        result = generation._enrich_evidence_ids(["docs:d1", "docs:does-not-exist"], self.by_id)
        self.assertEqual([entry["id"] for entry in result], ["docs:d1"])

    def test_non_list_input_returns_empty(self):
        self.assertEqual(generation._enrich_evidence_ids(None, self.by_id), [])


class EnrichBulletsTests(SimpleTestCase):
    def setUp(self):
        self.by_id = {item["id"]: item for item in ITEMS}

    def test_resolves_evidence_ids_into_evidence(self):
        bullets = [{"label": "Relire le dossier", "evidence_ids": ["docs:d1"]}]
        result = generation._enrich_bullets(bullets, self.by_id)
        self.assertEqual(result[0]["label"], "Relire le dossier")
        self.assertEqual(result[0]["evidence"][0]["id"], "docs:d1")
        self.assertEqual(result[0]["evidence"][0]["content"], "Le dossier doit être transmis avant le 30 septembre.")

    def test_drops_hallucinated_evidence_id_keeps_label(self):
        bullets = [{"label": "Relire le dossier", "evidence_ids": ["docs:invented"]}]
        result = generation._enrich_bullets(bullets, self.by_id)
        self.assertEqual(result[0]["label"], "Relire le dossier")
        self.assertEqual(result[0]["evidence"], [])

    def test_missing_evidence_ids_does_not_crash(self):
        bullets = [{"label": "Relire le dossier"}]
        result = generation._enrich_bullets(bullets, self.by_id)
        self.assertEqual(result[0]["evidence"], [])

    def test_deadline_date_field_is_preserved(self):
        bullets = [{"label": "Échéance", "date": "2026-10-01", "evidence_ids": ["drive:f1"]}]
        result = generation._enrich_bullets(bullets, self.by_id)
        self.assertEqual(result[0]["date"], "2026-10-01")
        self.assertEqual(result[0]["evidence"][0]["id"], "drive:f1")

    def test_non_dict_bullet_is_skipped(self):
        result = generation._enrich_bullets(["not a dict"], self.by_id)
        self.assertEqual(result, [])

    def test_non_list_input_returns_empty(self):
        self.assertEqual(generation._enrich_bullets(None, self.by_id), [])


class FakeMessage:
    def __init__(self, content):
        self.content = content


class FakeChoice:
    def __init__(self, content):
        self.message = FakeMessage(content)


class FakeResponse:
    def __init__(self, content):
        self.choices = [FakeChoice(content)]


class FakeCompletions:
    def __init__(self, content):
        self._content = content

    def create(self, **kwargs):
        return FakeResponse(self._content)


class FakeChat:
    def __init__(self, content):
        self.completions = FakeCompletions(content)


class FakeGroqClient:
    def __init__(self, payload):
        self.chat = FakeChat(json.dumps(payload))


class GenerateDossierTests(SimpleTestCase):
    def test_enriches_documents_and_per_bullet_evidence(self):
        payload = {
            "text": "Résumé.",
            "actions": [{"label": "Relire le dossier", "evidence_ids": ["docs:d1"]}],
            "decisions": [],
            "deadlines": [{"label": "Échéance", "date": None, "evidence_ids": ["drive:f1", "docs:invented"]}],
            "blockers": [{"label": "Blocage", "evidence_ids": ["docs:invented"]}],
            "documents": ["docs:d1", "docs:invented"],
        }
        client = FakeGroqClient(payload)

        summary = generation.generate_dossier(ITEMS, client=client)

        self.assertEqual(summary["documents"], [{
            "id": "docs:d1", "title": "Note de service", "url": "http://docs.test/d1",
        }])
        self.assertEqual(summary["actions"][0]["evidence"][0]["id"], "docs:d1")
        self.assertEqual(
            summary["actions"][0]["evidence"][0]["content"],
            "Le dossier doit être transmis avant le 30 septembre.",
        )
        self.assertEqual(len(summary["deadlines"][0]["evidence"]), 1)
        self.assertEqual(summary["deadlines"][0]["evidence"][0]["id"], "drive:f1")
        self.assertEqual(summary["deadlines"][0]["date"], None)
        self.assertEqual(summary["blockers"][0]["label"], "Blocage")
        self.assertEqual(summary["blockers"][0]["evidence"], [])

    def test_raises_on_empty_items(self):
        with self.assertRaises(ValueError):
            generation.generate_dossier([], client=FakeGroqClient({}))
