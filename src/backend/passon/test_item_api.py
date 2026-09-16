"""A collaborator's documents, seen by them and by their manager.

Drive answers only for the session it is given, and we hold only the one of
whoever logged in -- so a manager reads a snapshot taken while their
collaborator was themselves connected. These tests pin down that arrangement,
including the part that matters most: never passing stale data off as live.
"""

from unittest import mock

from django.test import Client, TestCase

from accounts.session import USER_KEY

from .models import Collaborator, CollaboratorItem

UPSTREAM_ITEMS = {
    "items": [
        {
            "id": "drive:abc",
            "title": "note.txt",
            "author": "Emp Loye",
            "date": "2026-09-15T10:00:00Z",
            "content": "Contenu du fichier",
            "source": {"type": "drive", "resource_url": "http://localhost:8071/x/"},
        },
        {
            "id": "messages:def",
            "title": "Re: dossier",
            "author": "Quelqu'un",
            "date": "2026-09-14T09:00:00Z",
            "content": "Bonjour",
            "source": {"type": "messages", "resource_url": "http://localhost:8901/y/"},
        },
    ],
    "errors": {},
}


class ItemApiTests(TestCase):
    def setUp(self):
        self.manager = Collaborator.objects.create(
            email="chef@example.test", first_name="Chef", last_name="Fe",
            role=Collaborator.Role.MANAGER,
        )
        self.employee = Collaborator.objects.create(
            email="employe@example.test", first_name="Emp", last_name="Loye",
            manager=self.manager,
        )
        self.stranger = Collaborator.objects.create(
            email="etranger@example.test", first_name="Et", last_name="Ranger",
        )

    def client_for(self, person):
        client = Client()
        session = client.session
        session[USER_KEY] = {"id": str(person.id), "email": person.email}
        session.save()
        return client

    def fetch_own(self, person, payload=UPSTREAM_ITEMS):
        """Their own page load: the services are asked, the snapshot refreshed."""
        from django.http import JsonResponse

        with mock.patch(
            "connectors.views.extraction_items", return_value=JsonResponse(payload)
        ):
            return self.client_for(person).get(f"/api/collaborators/{person.id}/items/")

    def test_a_manager_sees_nothing_before_their_collaborator_has_connected(self):
        """And says so: an empty list with no timestamp means "never
        synchronised", not "this person has no documents"."""
        response = self.client_for(self.manager).get(
            f"/api/collaborators/{self.employee.id}/items/"
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["items"], [])
        self.assertIsNone(response.json()["fetchedAt"])

    def test_loading_your_own_page_snapshots_your_items(self):
        response = self.fetch_own(self.employee)
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.json()["isOwn"])
        self.assertEqual(CollaboratorItem.objects.filter(collaborator=self.employee).count(), 2)

    def test_the_manager_then_sees_them(self):
        self.fetch_own(self.employee)
        body = self.client_for(self.manager).get(
            f"/api/collaborators/{self.employee.id}/items/"
        ).json()

        self.assertEqual({item["title"] for item in body["items"]}, {"note.txt", "Re: dossier"})
        self.assertFalse(body["isOwn"])
        # The snapshot's age is reported, so the interface can show it.
        self.assertIsNotNone(body["fetchedAt"])

    def test_mails_and_documents_keep_their_kind_and_their_link(self):
        self.fetch_own(self.employee)
        body = self.client_for(self.manager).get(
            f"/api/collaborators/{self.employee.id}/items/"
        ).json()
        by_title = {item["title"]: item for item in body["items"]}
        self.assertEqual(by_title["Re: dossier"]["type"], "mail")
        self.assertEqual(by_title["note.txt"]["type"], "doc")
        self.assertEqual(by_title["note.txt"]["url"], "http://localhost:8071/x/")
        # The reference the generated handover cites is preserved.
        self.assertEqual(by_title["note.txt"]["refId"], "drive:abc")

    def test_an_item_that_disappeared_upstream_disappears_here(self):
        """Otherwise a manager keeps being shown files that no longer exist."""
        self.fetch_own(self.employee)
        reduced = {"items": UPSTREAM_ITEMS["items"][:1], "errors": {}}
        self.fetch_own(self.employee, payload=reduced)

        titles = [item.title for item in CollaboratorItem.objects.filter(collaborator=self.employee)]
        self.assertEqual(titles, ["note.txt"])

    def test_a_refresh_replaces_rather_than_duplicates(self):
        self.fetch_own(self.employee)
        self.fetch_own(self.employee)
        self.assertEqual(CollaboratorItem.objects.filter(collaborator=self.employee).count(), 2)

    def test_someone_else_s_documents_are_not_readable(self):
        response = self.client_for(self.manager).get(
            f"/api/collaborators/{self.stranger.id}/items/"
        )
        self.assertEqual(response.status_code, 404)

    def test_a_collaborator_cannot_read_their_manager_s_documents(self):
        response = self.client_for(self.employee).get(
            f"/api/collaborators/{self.manager.id}/items/"
        )
        self.assertEqual(response.status_code, 404)

    def test_a_visitor_who_is_not_logged_in_sees_nothing(self):
        response = Client().get(f"/api/collaborators/{self.employee.id}/items/")
        self.assertEqual(response.status_code, 401)

    def test_an_upstream_failure_is_passed_through_untouched(self):
        from django.http import JsonResponse

        with mock.patch(
            "connectors.views.extraction_items",
            return_value=JsonResponse({"error": "authentication_required"}, status=401),
        ):
            response = self.client_for(self.employee).get(
                f"/api/collaborators/{self.employee.id}/items/"
            )
        self.assertEqual(response.status_code, 401)
