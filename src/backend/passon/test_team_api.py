"""Managing a team through the API.

The point of these endpoints is that a collaborator added by a manager
survives a page reload -- the previous version kept them in the browser only.
"""

import json
from unittest import mock

from django.test import Client, TestCase

from accounts.session import USER_KEY

from .models import Collaborator, Handover


class TeamApiTests(TestCase):
    def setUp(self):
        self.manager = Collaborator.objects.create(
            email="chef@example.test", first_name="Chef", last_name="Fe",
            role=Collaborator.Role.MANAGER, team="Produit",
        )
        self.client = Client()

    def log_in_as(self, collaborator):
        session = self.client.session
        session[USER_KEY] = {"id": str(collaborator.id), "email": collaborator.email}
        session.save()

    def add(self, **payload):
        body = {"firstName": "Jean", "lastName": "Dupont", "email": "jean@example.test"}
        body.update(payload)
        return self.client.post(
            "/api/collaborators/", data=json.dumps(body), content_type="application/json"
        )

    def test_a_manager_adds_someone_and_they_are_still_there_afterwards(self):
        self.log_in_as(self.manager)
        response = self.add(jobTitle="Chargé de mission")
        self.assertEqual(response.status_code, 201)

        # A fresh request, as a page reload would make.
        listed = self.client.get("/api/collaborators/").json()["team"]
        self.assertEqual([m["email"] for m in listed], ["jean@example.test"])
        self.assertEqual(listed[0]["jobTitle"], "Chargé de mission")

    def test_the_new_collaborator_awaits_their_first_login(self):
        """They may have no Drive account yet; the row is claimed by email
        when they eventually log in."""
        self.log_in_as(self.manager)
        self.add()
        added = Collaborator.objects.get(email="jean@example.test")
        self.assertIsNone(added.external_id)
        self.assertEqual(added.manager, self.manager)
        self.assertEqual(added.role, Collaborator.Role.EMPLOYEE)

    def test_the_team_defaults_to_the_manager_s_own(self):
        self.log_in_as(self.manager)
        self.add()
        self.assertEqual(Collaborator.objects.get(email="jean@example.test").team, "Produit")

    def test_someone_who_already_uses_the_app_can_be_put_on_the_team(self):
        """The common case: a colleague logged in before their manager built
        the team. Their row exists, with no manager -- attaching it is the
        expected outcome, not a conflict."""
        known = Collaborator.objects.create(
            email="jean@example.test", first_name="Jean", last_name="Dupont",
            external_id="drive-9",
        )
        self.log_in_as(self.manager)
        response = self.add(jobTitle="Chargé de mission")

        self.assertEqual(response.status_code, 200)
        known.refresh_from_db()
        self.assertEqual(known.manager, self.manager)
        # Their Drive identity is untouched.
        self.assertEqual(known.external_id, "drive-9")
        self.assertEqual(known.first_name, "Jean")
        self.assertEqual(known.job_title, "Chargé de mission")

    def test_adding_someone_twice_changes_nothing(self):
        self.log_in_as(self.manager)
        self.add()
        response = self.add()
        self.assertEqual(response.status_code, 200)
        self.assertEqual(self.manager.team_members.count(), 1)

    def test_someone_on_another_team_is_not_taken_silently(self):
        other = Collaborator.objects.create(
            email="autre@example.test", first_name="A", last_name="U",
            role=Collaborator.Role.MANAGER,
        )
        Collaborator.objects.create(
            email="jean@example.test", first_name="J", last_name="D", manager=other,
        )
        self.log_in_as(self.manager)
        response = self.add()
        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.json()["error"], "collaborator_has_manager")

    def test_a_manager_cannot_add_themselves(self):
        self.log_in_as(self.manager)
        response = self.add(email=self.manager.email)
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()["error"], "cannot_manage_yourself")

    def test_the_hierarchy_cannot_be_closed_into_a_loop(self):
        """Adding one's own manager would make the tree cyclic, and any later
        walk up the chain would never end."""
        boss = Collaborator.objects.create(
            email="direction@example.test", first_name="D", last_name="I",
            role=Collaborator.Role.MANAGER,
        )
        self.manager.manager = boss
        self.manager.save()
        self.log_in_as(self.manager)
        response = self.add(email=boss.email)
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()["error"], "would_create_a_cycle")

    def test_a_malformed_address_is_refused(self):
        self.log_in_as(self.manager)
        self.assertEqual(self.add(email="pas-une-adresse").status_code, 400)

    def test_an_employee_cannot_manage_a_team(self):
        employee = Collaborator.objects.create(
            email="employe@example.test", first_name="E", last_name="M",
        )
        self.log_in_as(employee)
        self.assertEqual(self.add().status_code, 403)

    def test_a_visitor_who_is_not_logged_in_cannot(self):
        self.assertEqual(self.add().status_code, 401)
        self.assertEqual(self.client.get("/api/collaborators/").status_code, 401)

    def test_removing_someone_takes_their_handover_with_them(self):
        self.log_in_as(self.manager)
        self.add()
        member = Collaborator.objects.get(email="jean@example.test")
        Handover.objects.create(collaborator=member, text="En cours")

        response = self.client.delete(f"/api/collaborators/{member.id}/")
        self.assertEqual(response.status_code, 200)
        self.assertFalse(Collaborator.objects.filter(id=member.id).exists())
        self.assertEqual(Handover.objects.count(), 0)

    def test_a_manager_cannot_remove_someone_else_s_collaborator(self):
        other_manager = Collaborator.objects.create(
            email="autre@example.test", first_name="A", last_name="U",
            role=Collaborator.Role.MANAGER,
        )
        theirs = Collaborator.objects.create(
            email="pasamoi@example.test", first_name="P", last_name="M", manager=other_manager,
        )
        self.log_in_as(self.manager)
        response = self.client.delete(f"/api/collaborators/{theirs.id}/")
        self.assertEqual(response.status_code, 404)
        self.assertTrue(Collaborator.objects.filter(id=theirs.id).exists())


class TeamSearchTests(TestCase):
    """Finding who to add, instead of typing an address and hoping.

    Drive's directory is consulted with the manager's own Drive session, so
    these tests stub that call: what matters here is how the two sources are
    merged and what each result is allowed to say.
    """

    def setUp(self):
        self.manager = Collaborator.objects.create(
            email="chef@example.test", first_name="Chef", last_name="Fe",
            role=Collaborator.Role.MANAGER,
        )
        self.client = Client()

    def log_in_as(self, collaborator):
        session = self.client.session
        session[USER_KEY] = {"id": str(collaborator.id), "email": collaborator.email}
        session.save()

    def search(self, query, directory=()):
        with mock.patch("passon.views._drive_directory", return_value=list(directory)):
            return self.client.get(f"/api/collaborators/search/?q={query}")

    def test_someone_with_a_drive_account_is_offered(self):
        self.log_in_as(self.manager)
        results = self.search(
            "jean", directory=[("jean@example.test", "Jean Dupont")]
        ).json()["results"]
        self.assertEqual(results, [
            {"email": "jean@example.test", "fullName": "Jean Dupont", "status": "available"}
        ])

    def test_each_result_says_whether_it_can_be_added(self):
        """So the interface explains instead of letting the click fail."""
        Collaborator.objects.create(
            email="amoi@example.test", first_name="A", last_name="Moi", manager=self.manager,
        )
        other_manager = Collaborator.objects.create(
            email="autre@example.test", first_name="Au", last_name="Tre",
            role=Collaborator.Role.MANAGER,
        )
        Collaborator.objects.create(
            email="ailleurs@example.test", first_name="Ail", last_name="Leurs", manager=other_manager,
        )
        self.log_in_as(self.manager)

        results = self.search("example", directory=[
            ("amoi@example.test", "A Moi"),
            ("ailleurs@example.test", "Ail Leurs"),
            ("chef@example.test", "Chef Fe"),
            ("libre@example.test", "Li Bre"),
        ]).json()["results"]

        by_email = {r["email"]: r["status"] for r in results}
        self.assertEqual(by_email["amoi@example.test"], "on_your_team")
        self.assertEqual(by_email["ailleurs@example.test"], "on_another_team")
        self.assertEqual(by_email["chef@example.test"], "yourself")
        self.assertEqual(by_email["libre@example.test"], "available")

    def test_someone_added_by_hand_is_found_without_a_drive_account(self):
        """They have no Drive account yet, so the directory does not know them,
        but they are ours and must still be findable."""
        Collaborator.objects.create(
            email="sansdrive@example.test", first_name="Sans", last_name="Drive",
        )
        self.log_in_as(self.manager)
        results = self.search("sansdrive", directory=[]).json()["results"]
        self.assertEqual([r["email"] for r in results], ["sansdrive@example.test"])

    def test_the_same_person_is_not_listed_twice(self):
        Collaborator.objects.create(
            email="jean@example.test", first_name="Jean", last_name="Dupont",
        )
        self.log_in_as(self.manager)
        results = self.search("jean", directory=[("jean@example.test", "Jean Dupont")]).json()["results"]
        self.assertEqual(len(results), 1)

    def test_a_one_letter_query_searches_nothing(self):
        """Two characters minimum: a single letter would return the directory."""
        self.log_in_as(self.manager)
        with mock.patch("passon.views._drive_directory") as directory:
            response = self.client.get("/api/collaborators/search/?q=a")
        self.assertEqual(response.json()["results"], [])
        directory.assert_not_called()

    def test_an_employee_cannot_browse_the_directory(self):
        employee = Collaborator.objects.create(
            email="employe@example.test", first_name="E", last_name="M",
        )
        self.log_in_as(employee)
        self.assertEqual(self.search("jean").status_code, 403)

    def test_a_visitor_who_is_not_logged_in_cannot(self):
        self.assertEqual(self.search("jean").status_code, 401)
