"""Sending a handover by mail.

The button used to do nothing but raise a toast, so "envoyé" meant an empty
inbox. These pin down that something is actually sent, that it carries the
sheet, and that an empty one is refused rather than delivered blank.
"""

import json
from unittest import mock

from django.test import Client, TestCase, override_settings

from accounts.session import CREDENTIAL_KEYS, USER_KEY

from .models import Collaborator, Handover
from .send_views import as_text


# The suite tests the code, not the operator's current choice of services:
# DINUM_ENABLED_SERVICES is read from the environment, and a deployment that
# has dropped mail would otherwise turn every Messages test red.
@override_settings(DINUM_ENABLED_SERVICES={"docs", "drive", "messages"})
class HandoverMailTests(TestCase):
    def setUp(self):
        self.manager = Collaborator.objects.create(
            email="chef@example.test", first_name="Chef", last_name="Fe",
            role=Collaborator.Role.MANAGER,
        )
        self.employee = Collaborator.objects.create(
            email="employe@example.test", first_name="Emp", last_name="Loye",
            manager=self.manager,
        )
        self.handover = Handover.objects.create(
            collaborator=self.employee,
            text="Deux dossiers en cours.",
            sections={
                "actions": [{"label": "Relancer le prestataire"}],
                "deadlines": [{"label": "Commission du 14 octobre"}],
                "documents": [{"id": "drive:abc", "title": "note.txt", "url": "http://drive/x"}],
            },
            validated=True,
        )
        self.client = Client()

    def log_in(self, collaborator, with_messages=True):
        session = self.client.session
        session[USER_KEY] = {"id": str(collaborator.id), "email": collaborator.email}
        if with_messages:
            session[CREDENTIAL_KEYS["messages"]] = "messages-cookie"
        session.save()

    def send(self, subject, to=("destinataire@example.test",)):
        """Sends with Messages stubbed: what matters here is what we ask it."""
        sent = []

        def fake_request(session, service, method, url, **kwargs):
            sent.append((method, url, kwargs.get("json")))
            response = mock.Mock(status_code=200)
            if url.endswith("/users/me/"):
                response.json.return_value = {"csrf_token": "tok"}
            elif url.endswith("/mailboxes/"):
                response.json.return_value = [{"id": "mailbox-1"}]
            else:
                response.json.return_value = {"id": "draft-1"}
            return response

        with mock.patch("accounts.oidc_login.service_request", side_effect=fake_request):
            response = self.client.post(
                f"/api/collaborators/{subject.id}/handover/send/",
                data=json.dumps({"to": list(to)}), content_type="application/json",
            )
        return response, sent

    def test_the_mail_carries_the_sheet(self):
        self.log_in(self.manager)
        response, sent = self.send(self.employee)
        self.assertEqual(response.status_code, 200)

        drafted = next(body for method, url, body in sent if url.endswith("/draft/"))
        self.assertEqual(drafted["to"], ["destinataire@example.test"])
        self.assertIn("Emp Loye", drafted["subject"])
        self.assertIn("Deux dossiers en cours.", drafted["draftBody"])
        self.assertIn("Relancer le prestataire", drafted["draftBody"])
        self.assertIn("http://drive/x", drafted["draftBody"])

    def test_the_body_is_sent_too_not_just_drafted(self):
        """A draft nobody sends is exactly the empty mail this replaces."""
        self.log_in(self.manager)
        _, sent = self.send(self.employee)
        posted = next(body for method, url, body in sent if url.endswith("/send/"))
        self.assertEqual(posted["messageId"], "draft-1")
        self.assertIn("Deux dossiers en cours.", posted["textBody"])

    def test_an_empty_sheet_is_refused_rather_than_sent_blank(self):
        Handover.objects.filter(collaborator=self.employee).update(text="", sections={})
        self.log_in(self.manager)
        response, sent = self.send(self.employee)
        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.json()["error"], "empty_handover")
        self.assertEqual(sent, [])

    def test_a_collaborator_can_send_their_own(self):
        self.log_in(self.employee)
        response, _ = self.send(self.employee)
        self.assertEqual(response.status_code, 200)

    def test_someone_else_s_sheet_cannot_be_sent(self):
        stranger = Collaborator.objects.create(
            email="etranger@example.test", first_name="Et", last_name="Ranger",
        )
        self.log_in(stranger)
        response, _ = self.send(self.employee)
        self.assertEqual(response.status_code, 404)

    def test_without_a_messages_session_it_says_so(self):
        self.log_in(self.manager, with_messages=False)
        response, _ = self.send(self.employee)
        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.json()["error"], "messages_not_connected")

    @override_settings(DINUM_ENABLED_SERVICES={"docs", "drive"})
    def test_a_deployment_without_mail_refuses_before_composing(self):
        """Not "you are not connected": this deployment does not do mail."""
        self.log_in(self.manager)
        response, sent = self.send(self.employee)
        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.json()["error"], "messages_disabled")
        self.assertEqual(sent, [])

    def test_an_address_that_is_not_one_is_refused(self):
        self.log_in(self.manager)
        response, sent = self.send(self.employee, to=["pas-une-adresse"])
        self.assertEqual(response.status_code, 400)
        self.assertEqual(sent, [])

    def test_the_text_says_whether_the_sheet_was_validated(self):
        self.assertIn("validée par le collaborateur", as_text(self.employee, self.handover))
        self.handover.validated = False
        self.assertIn("non validée", as_text(self.employee, self.handover))
