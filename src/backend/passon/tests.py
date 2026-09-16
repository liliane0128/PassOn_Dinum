"""What the schema has to make possible, expressed as the features it serves.

Each test here corresponds to something the interface does, so that a later
change to the models fails against the feature it would break rather than
against an abstract constraint.
"""

from django.db import IntegrityError
from django.test import TestCase

from .models import Collaborator, Handover


def make(email, **kwargs):
    kwargs.setdefault("first_name", "Prénom")
    kwargs.setdefault("last_name", "Nom")
    return Collaborator.objects.create(email=email, **kwargs)


class CollaboratorTests(TestCase):
    def test_a_manager_can_add_a_collaborator_who_has_no_drive_account_yet(self):
        """The add form in the manager view: no Drive id exists at that point."""
        manager = make("chef@example.test", role=Collaborator.Role.MANAGER)
        added = make("nouveau@example.test", manager=manager)
        self.assertIsNone(added.external_id)
        self.assertEqual(added.role, Collaborator.Role.EMPLOYEE)

    def test_several_collaborators_can_await_their_first_login(self):
        """external_id is unique, and NULL must not count as a duplicate."""
        make("un@example.test")
        make("deux@example.test")
        self.assertEqual(Collaborator.objects.filter(external_id=None).count(), 2)

    def test_the_drive_id_is_claimed_on_first_login(self):
        person = make("connu@example.test")
        person.external_id = "drive-user-1"
        person.save()
        self.assertEqual(Collaborator.objects.get(external_id="drive-user-1"), person)

    def test_two_people_cannot_share_one_drive_identity(self):
        make("premier@example.test", external_id="drive-user-1")
        with self.assertRaises(IntegrityError):
            make("second@example.test", external_id="drive-user-1")

    def test_a_manager_sees_their_team(self):
        manager = make("chef@example.test", role=Collaborator.Role.MANAGER)
        make("a@example.test", manager=manager)
        make("b@example.test", manager=manager)
        make("ailleurs@example.test")
        self.assertEqual(manager.team_members.count(), 2)

    def test_someone_is_at_the_top_of_the_hierarchy(self):
        top = make("direction@example.test", role=Collaborator.Role.MANAGER)
        self.assertIsNone(top.manager)

    def test_a_manager_is_a_collaborator_too_and_can_have_a_manager(self):
        """A manager going away is the whole point of the product, so they
        need a handover and a manager of their own."""
        director = make("direction@example.test", role=Collaborator.Role.MANAGER)
        manager = make("chef@example.test", role=Collaborator.Role.MANAGER, manager=director)
        Handover.objects.create(collaborator=manager, text="En cours...")
        self.assertEqual(manager.handover.text, "En cours...")
        self.assertEqual(director.team_members.get(), manager)

    def test_removing_a_manager_keeps_their_team(self):
        """Deleting a manager must not delete the people who reported to them."""
        manager = make("chef@example.test", role=Collaborator.Role.MANAGER)
        member = make("membre@example.test", manager=manager)
        manager.delete()
        member.refresh_from_db()
        self.assertIsNone(member.manager)


class HandoverTests(TestCase):
    def setUp(self):
        self.person = make("employe@example.test")

    def test_a_handover_survives_the_page_reload_that_used_to_lose_it(self):
        Handover.objects.create(
            collaborator=self.person,
            text="Résumé généré",
            sections={"actions": [{"label": "Relancer le prestataire"}]},
        )
        stored = Handover.objects.get(collaborator=self.person)
        self.assertEqual(stored.sections["actions"][0]["label"], "Relancer le prestataire")

    def test_it_starts_unvalidated(self):
        handover = Handover.objects.create(collaborator=self.person)
        self.assertFalse(handover.validated)

    def test_one_handover_per_person(self):
        Handover.objects.create(collaborator=self.person)
        with self.assertRaises(IntegrityError):
            Handover.objects.create(collaborator=self.person)

    def test_it_holds_document_references_from_drive_and_messages(self):
        """The generated summary cites items by the backend's own id."""
        Handover.objects.create(
            collaborator=self.person,
            sections={"documents": [{"id": "drive:2a1617c3", "title": "test.txt", "url": "http://…"}]},
        )
        documents = self.person.handover.sections["documents"]
        self.assertEqual(documents[0]["id"], "drive:2a1617c3")

    def test_removing_someone_removes_their_handover(self):
        Handover.objects.create(collaborator=self.person)
        self.person.delete()
        self.assertEqual(Handover.objects.count(), 0)
