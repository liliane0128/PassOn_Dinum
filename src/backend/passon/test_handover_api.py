"""The handover sheet as shared state.

It used to live in one browser's memory: what an employee wrote and validated
never reached their manager, and a reload lost it. These tests pin down that
it is now the same sheet on both sides.
"""

import json

from django.test import Client, TestCase

from accounts.session import USER_KEY

from .models import Collaborator, Handover


class HandoverApiTests(TestCase):
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

    def save(self, client, subject, **patch):
        return client.patch(
            f"/api/collaborators/{subject.id}/handover/",
            data=json.dumps(patch), content_type="application/json",
        )

    def test_what_an_employee_validates_is_what_their_manager_sees(self):
        employee = self.client_for(self.employee)
        self.save(employee, self.employee, text="Dossier Verneuil à reprendre")
        employee.post(f"/api/collaborators/{self.employee.id}/handover/validate/")

        seen = self.client_for(self.manager).get(
            f"/api/collaborators/{self.employee.id}/handover/"
        ).json()
        self.assertEqual(seen["text"], "Dossier Verneuil à reprendre")
        self.assertTrue(seen["validated"])

    def test_it_survives_the_reload_that_used_to_lose_it(self):
        self.save(self.client_for(self.employee), self.employee, text="En cours")
        # A brand new client, as a page reload would be.
        again = self.client_for(self.employee).get(
            f"/api/collaborators/{self.employee.id}/handover/"
        ).json()
        self.assertEqual(again["text"], "En cours")

    def test_a_manager_can_correct_their_collaborator_s_sheet(self):
        response = self.save(self.client_for(self.manager), self.employee, text="Corrigé")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(Handover.objects.get(collaborator=self.employee).text, "Corrigé")

    def test_a_correction_puts_the_sheet_back_to_not_validated(self):
        """Otherwise "validé" would claim the employee approved text they have
        never seen."""
        employee = self.client_for(self.employee)
        self.save(employee, self.employee, text="D'origine")
        employee.post(f"/api/collaborators/{self.employee.id}/handover/validate/")

        self.save(self.client_for(self.manager), self.employee, text="Réécrit par le manager")
        self.assertFalse(Handover.objects.get(collaborator=self.employee).validated)

    def test_only_the_collaborator_validates_their_own_sheet(self):
        response = self.client_for(self.manager).post(
            f"/api/collaborators/{self.employee.id}/handover/validate/"
        )
        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.json()["error"], "only_the_owner_can_validate")

    def test_sections_are_stored_alongside_the_text(self):
        client = self.client_for(self.employee)
        self.save(
            client, self.employee,
            actions=[{"id": "1", "label": "Relancer le prestataire"}],
            documents=[{"id": "drive:abc", "title": "note.txt", "url": "http://…"}],
        )
        stored = client.get(f"/api/collaborators/{self.employee.id}/handover/").json()
        self.assertEqual(stored["actions"][0]["label"], "Relancer le prestataire")
        self.assertEqual(stored["documents"][0]["id"], "drive:abc")
        # Sections left out of the patch are untouched.
        self.assertEqual(stored["blockers"], [])

    def test_someone_else_s_sheet_is_not_readable(self):
        response = self.client_for(self.manager).get(
            f"/api/collaborators/{self.stranger.id}/handover/"
        )
        self.assertEqual(response.status_code, 404)

    def test_someone_else_s_sheet_is_not_writable(self):
        response = self.save(self.client_for(self.stranger), self.employee, text="Pas à moi")
        self.assertEqual(response.status_code, 404)
        self.assertFalse(Handover.objects.filter(collaborator=self.employee).exists())

    def test_a_visitor_who_is_not_logged_in_sees_nothing(self):
        response = Client().get(f"/api/collaborators/{self.employee.id}/handover/")
        self.assertEqual(response.status_code, 401)

    def test_a_malformed_patch_is_refused(self):
        response = self.save(self.client_for(self.employee), self.employee, actions="pas une liste")
        self.assertEqual(response.status_code, 400)
