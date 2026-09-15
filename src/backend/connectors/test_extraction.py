from unittest.mock import patch

from django.test import SimpleTestCase

from connectors import extraction


class NormalizeDocsTests(SimpleTestCase):
    def test_falls_back_to_excerpt_without_session(self):
        item = {"id": "d1", "title": "T", "creator": "uuid-1", "updated_at": "2020", "excerpt": "preview text"}
        result = extraction.normalize_items([item], [], [])
        self.assertEqual(result[0]["content"], "preview text")

    @patch("connectors.docs_client.get_content")
    def test_fetches_real_content_with_session(self, get_content):
        get_content.return_value = "real document text"
        item = {"id": "d1", "title": "T", "creator": "uuid-1", "updated_at": "2020", "excerpt": None}
        result = extraction.normalize_items([item], [], [], docs_session=object())
        self.assertEqual(result[0]["content"], "real document text")
        get_content.assert_called_once()

    @patch("connectors.docs_client.get_content")
    def test_keeps_metadata_fallback_on_fetch_error(self, get_content):
        import requests
        get_content.side_effect = requests.ConnectionError("boom")
        item = {"id": "d1", "title": "T", "creator": "uuid-1", "updated_at": "2020", "excerpt": "preview text"}
        result = extraction.normalize_items([item], [], [], docs_session=object())
        self.assertEqual(result[0]["content"], "preview text")


class NormalizeDriveTests(SimpleTestCase):
    @patch("connectors.drive_client.download_item")
    def test_skips_binary_files(self, download_item):
        item = {
            "id": "f1", "title": "photo.png", "type": "file",
            "mimetype": "image/png", "description": "a photo",
        }
        result = extraction.normalize_items([], [item], [], drive_session=object())
        self.assertEqual(result[0]["content"], "a photo")
        download_item.assert_not_called()

    @patch("connectors.drive_client.download_item")
    def test_fetches_text_file_content(self, download_item):
        download_item.return_value = b"hello world"
        item = {
            "id": "f1", "title": "notes.txt", "type": "file",
            "mimetype": "text/plain", "description": None,
        }
        result = extraction.normalize_items([], [item], [], drive_session=object())
        self.assertEqual(result[0]["content"], "hello world")

    @patch("connectors.drive_client.download_item")
    def test_skips_folders(self, download_item):
        item = {"id": "d1", "title": "My folder", "type": "folder", "mimetype": None, "description": None}
        result = extraction.normalize_items([], [item], [], drive_session=object())
        self.assertEqual(result[0]["content"], "")
        download_item.assert_not_called()


class NormalizeMessagesTests(SimpleTestCase):
    def test_extracts_text_from_html_body(self):
        item = {
            "id": "m1", "subject": "Hi", "sender": {"name": "Bob"}, "created_at": "2020",
            "htmlBody": [{"content": "<p>Hello <b>world</b></p>"}],
        }
        result = extraction.normalize_items([], [], [item])
        self.assertEqual(result[0]["content"], "Hello world")

    def test_prefers_text_body_over_html_body(self):
        item = {
            "id": "m1", "subject": "Hi", "created_at": "2020",
            "textBody": [{"content": "plain text version"}],
            "htmlBody": [{"content": "<p>html version</p>"}],
        }
        result = extraction.normalize_items([], [], [item])
        self.assertEqual(result[0]["content"], "plain text version")

    def test_falls_back_to_snippet_when_bodyless(self):
        item = {"id": "m1", "subject": "Hi", "created_at": "2020", "snippet": "preview"}
        result = extraction.normalize_items([], [], [item])
        self.assertEqual(result[0]["content"], "preview")

    def test_empty_when_no_body_and_no_snippet(self):
        item = {"id": "m1", "subject": "Hi", "created_at": "2020"}
        result = extraction.normalize_items([], [], [item])
        self.assertEqual(result[0]["content"], "")


class SourceBlockTests(SimpleTestCase):
    """Lock in the global id / source provenance schema."""

    def test_docs_id_and_source(self):
        item = {"id": "d1", "title": "T", "creator": "uuid-1", "updated_at": "2020"}
        result = extraction.normalize_items([item], [], [], docs_base_url="http://docs.test")
        self.assertEqual(result[0]["id"], "docs:d1")
        self.assertEqual(result[0]["source"], {
            "type": "docs",
            "resource_id": "d1",
            "resource_url": "http://docs.test/api/v1.0/documents/d1/",
            "content_url": "http://docs.test/api/v1.0/documents/d1/content/",
        })

    def test_drive_file_has_distinct_content_url(self):
        item = {"id": "f1", "title": "notes.txt", "type": "file", "mimetype": "text/plain"}
        result = extraction.normalize_items([], [item], [], drive_base_url="http://drive.test")
        self.assertEqual(result[0]["id"], "drive:f1")
        self.assertEqual(result[0]["source"]["resource_url"], "http://drive.test/api/v1.0/items/f1/")
        self.assertEqual(result[0]["source"]["content_url"], "http://drive.test/api/v1.0/items/f1/download/")

    def test_drive_folder_has_no_content_url(self):
        item = {"id": "fold1", "title": "My folder", "type": "folder"}
        result = extraction.normalize_items([], [item], [], drive_base_url="http://drive.test")
        self.assertIsNone(result[0]["source"]["content_url"])

    def test_messages_content_url_equals_resource_url(self):
        item = {"id": "m1", "subject": "Hi", "created_at": "2020"}
        result = extraction.normalize_items([], [], [item], messages_base_url="http://mail.test")
        self.assertEqual(result[0]["id"], "messages:m1")
        source = result[0]["source"]
        self.assertEqual(source["resource_url"], source["content_url"])
        self.assertEqual(source["resource_url"], "http://mail.test/api/v1.0/messages/m1/")

    def test_ids_stay_distinct_across_sources_with_same_raw_id(self):
        # Different upstream services could coincidentally reuse the same
        # raw id; the global id must not collide.
        shared_raw_id = "same-uuid"
        docs_item = {"id": shared_raw_id, "title": "Doc"}
        drive_item = {"id": shared_raw_id, "title": "File", "type": "file"}
        result = extraction.normalize_items([docs_item], [drive_item], [])
        ids = [r["id"] for r in result]
        self.assertEqual(len(ids), len(set(ids)))
