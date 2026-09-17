from unittest.mock import MagicMock, patch

from django.test import SimpleTestCase

from connectors import drive_client, extraction


class NormalizeDocsTests(SimpleTestCase):
    def test_falls_back_to_excerpt_without_session(self):
        item = {"id": "d1", "title": "T", "creator": "uuid-1", "updated_at": "2020", "excerpt": "preview text"}
        result = extraction.normalize_items([item], [])
        self.assertEqual(result[0]["content"], "preview text")

    @patch("connectors.docs_client.get_content")
    def test_fetches_real_content_with_session(self, get_content):
        get_content.return_value = "real document text"
        item = {"id": "d1", "title": "T", "creator": "uuid-1", "updated_at": "2020", "excerpt": None}
        result = extraction.normalize_items([item], [], docs_session=object())
        self.assertEqual(result[0]["content"], "real document text")
        get_content.assert_called_once()

    @patch("connectors.docs_client.get_content")
    def test_keeps_metadata_fallback_on_fetch_error(self, get_content):
        import requests
        get_content.side_effect = requests.ConnectionError("boom")
        item = {"id": "d1", "title": "T", "creator": "uuid-1", "updated_at": "2020", "excerpt": "preview text"}
        result = extraction.normalize_items([item], [], docs_session=object())
        self.assertEqual(result[0]["content"], "preview text")


class NormalizeDriveTests(SimpleTestCase):
    @patch("connectors.drive_client.download_item")
    def test_skips_binary_files(self, download_item):
        item = {
            "id": "f1", "title": "photo.png", "type": "file",
            "mimetype": "image/png", "description": "a photo",
        }
        result = extraction.normalize_items([], [item], drive_session=object())
        self.assertEqual(result[0]["content"], "a photo")
        download_item.assert_not_called()

    @patch("connectors.drive_client.download_item")
    def test_fetches_text_file_content(self, download_item):
        download_item.return_value = b"hello world"
        item = {
            "id": "f1", "title": "notes.txt", "type": "file",
            "mimetype": "text/plain", "description": None,
        }
        result = extraction.normalize_items([], [item], drive_session=object())
        self.assertEqual(result[0]["content"], "hello world")

    @patch("connectors.drive_client.download_item")
    def test_skips_folders(self, download_item):
        item = {"id": "d1", "title": "My folder", "type": "folder", "mimetype": None, "description": None}
        result = extraction.normalize_items([], [item], drive_session=object())
        self.assertEqual(result[0]["content"], "")
        download_item.assert_not_called()


class DriveAuthorEmailTests(SimpleTestCase):
    """Drive publishes a creator's name and id, never an address."""

    ITEM = {
        "id": "f1", "title": "note.md", "type": "file", "mimetype": "text/plain",
        "creator": {"id": "u-1", "full_name": "Inès Royer"},
    }

    def test_no_address_without_a_directory(self):
        result = extraction.normalize_items([], [self.ITEM])
        self.assertEqual(result[0]["author"], "Inès Royer")
        self.assertEqual(result[0]["author_email"], "")

    def test_directory_puts_an_address_on_the_owner(self):
        result = extraction.normalize_items(
            [], [self.ITEM], drive_directory={"u-1": "ines.royer@test.example"}
        )
        self.assertEqual(result[0]["author_email"], "ines.royer@test.example")

    def test_unknown_creator_is_left_alone(self):
        result = extraction.normalize_items(
            [], [self.ITEM], drive_directory={"u-2": "someone.else@test.example"}
        )
        self.assertEqual(result[0]["author_email"], "")

    def test_payload_address_wins_over_the_directory(self):
        item = dict(self.ITEM, creator={"id": "u-1", "full_name": "I", "email": "own@test.example"})
        result = extraction.normalize_items(
            [], [item], drive_directory={"u-1": "stale@test.example"}
        )
        self.assertEqual(result[0]["author_email"], "own@test.example")


class DriveUserSearchTests(SimpleTestCase):
    def test_short_queries_are_not_sent(self):
        session = MagicMock()
        self.assertEqual(drive_client.list_users(session, "gouv"), [])
        session.get.assert_not_called()

    def test_search_returns_the_directory(self):
        session = MagicMock()
        session.get.return_value.json.return_value = [{"id": "u-1", "email": "a@test.example"}]
        people = drive_client.list_users(session, "test.example", base_url="http://drive.test")
        self.assertEqual(people[0]["email"], "a@test.example")
        session.get.assert_called_once_with(
            "http://drive.test/api/v1.0/users/", params={"q": "test.example"}
        )


class SourceBlockTests(SimpleTestCase):
    """Lock in the global id / source provenance schema."""

    def test_docs_id_and_source(self):
        item = {"id": "d1", "title": "T", "creator": "uuid-1", "updated_at": "2020"}
        result = extraction.normalize_items([item], [], docs_base_url="http://docs.test")
        self.assertEqual(result[0]["id"], "docs:d1")
        self.assertEqual(result[0]["source"], {
            "type": "docs",
            "resource_id": "d1",
            "resource_url": "http://docs.test/api/v1.0/documents/d1/",
            "content_url": "http://docs.test/api/v1.0/documents/d1/content/",
        })

    def test_drive_file_has_distinct_content_url(self):
        item = {"id": "f1", "title": "notes.txt", "type": "file", "mimetype": "text/plain"}
        result = extraction.normalize_items([], [item], drive_base_url="http://drive.test")
        self.assertEqual(result[0]["id"], "drive:f1")
        self.assertEqual(result[0]["source"]["resource_url"], "http://drive.test/api/v1.0/items/f1/")
        self.assertEqual(result[0]["source"]["content_url"], "http://drive.test/api/v1.0/items/f1/download/")

    def test_drive_folder_has_no_content_url(self):
        item = {"id": "fold1", "title": "My folder", "type": "folder"}
        result = extraction.normalize_items([], [item], drive_base_url="http://drive.test")
        self.assertIsNone(result[0]["source"]["content_url"])

    def test_ids_stay_distinct_across_sources_with_same_raw_id(self):
        # Different upstream services could coincidentally reuse the same
        # raw id; the global id must not collide.
        shared_raw_id = "same-uuid"
        docs_item = {"id": shared_raw_id, "title": "Doc"}
        drive_item = {"id": shared_raw_id, "title": "File", "type": "file"}
        result = extraction.normalize_items([docs_item], [drive_item])
        ids = [r["id"] for r in result]
        self.assertEqual(len(ids), len(set(ids)))
