"""Managing a team through the API.

The point of these endpoints is that a collaborator added by a manager
survives a page reload -- the previous version kept them in the browser only.
"""

import json

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
