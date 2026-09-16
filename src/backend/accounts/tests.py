"""Tests for the login backed by the Suite Numérique services.

The OIDC flow itself is exercised against a fake transport rather than running
services: the point is to pin down how this code reacts to each way the flow
can end, including the two that look like success but are not (see
oidc_login's module docstring), which a live instance cannot be made to
produce on demand.
"""

import json
from unittest import mock

import requests
from django.test import Client, TestCase, override_settings

from . import oidc_login
from .session import CREDENTIAL_KEYS, USER_KEY

DRIVE_URL = "http://drive.test:8071"
KEYCLOAK_URL = "http://keycloak.test:8083/realms/drive/protocol/openid-connect/auth?state=x"
LOGIN_FORM = '<html><form id="kc-form-login" action="http://keycloak.test:8083/login-actions/authenticate?code=1" method="post">'
USER_PAYLOAD = {"id": "u-1", "email": "someone@drive.test", "full_name": "Some One"}

def _logs_in_everywhere(service, email, password):
    """Stand-in for a user who exists in both services' Keycloaks."""
    return f"cookie-{service}", USER_PAYLOAD


def _drive_only(service, email, password):
    """The common case: the account exists in Drive but not in Messages."""
    if service != "drive":
        raise oidc_login.LoginFailed("invalid_credentials", 401)
    return "cookie-drive", USER_PAYLOAD


SERVICES = {
    "drive": {"url": DRIVE_URL, "cookie": "drive_sessionid", "header": "X-Drive-Session"},
    "docs": {"url": "http://docs.test", "cookie": "docs_sessionid", "header": "X-Docs-Session"},
    "messages": {"url": "http://messages.test", "cookie": "sessionid", "header": "X-Messages-Session"},
}


def response(status, *, headers=None, text="", json_body=None):
    made = requests.Response()
    made.status_code = status
    made.headers.update(headers or {})
    made.url = DRIVE_URL
    made._content = (json.dumps(json_body) if json_body is not None else text).encode()
    return made


class FakeDrive:
    """Answers the hops of the OIDC chain in order, recording what it was sent."""

    def __init__(self, *responses):
        self.responses = list(responses)
        self.requests = []
        self.cookies = requests.cookies.RequestsCookieJar()

    def request(self, method, url, **kwargs):
        self.requests.append((method, url, kwargs.get("headers", {})))
        return self.responses.pop(0)

    def close(self):
        pass


def flow(*, final_user_status=200, session_cookie="drive-cookie-1"):
    """The happy path: handoff to Keycloak, login form, callback, users/me."""
    fake = FakeDrive(
        response(302, headers={"Location": KEYCLOAK_URL}),
        response(200, text=LOGIN_FORM),
        response(302, headers={"Location": "http://localhost:3000/"}),
        response(final_user_status, json_body=USER_PAYLOAD),
    )
    if session_cookie:
        fake.cookies.set("drive_sessionid", session_cookie)
    return fake


@override_settings(
    DINUM_SERVICES=SERVICES, DINUM_API_TIMEOUT=1, DINUM_PUBLIC_HOST="localhost",
    DINUM_USE_MOCK=False,
)
class DriveAuthTests(TestCase):
    def login(self, fake, email="someone@drive.test", password="pw"):
        with mock.patch("requests.Session", return_value=fake):
            return oidc_login.login("drive", email, password)

    def test_returns_the_drive_cookie_and_drive_s_own_identity(self):
        credential, user = self.login(flow())
        self.assertEqual(credential, "drive-cookie-1")
        self.assertEqual(user, USER_PAYLOAD)

    def test_requests_go_to_the_reachable_host_under_the_public_host_name(self):
        fake = flow()
        self.login(fake)
        method, url, headers = fake.requests[0]
        # Sent to DRIVE_URL's host...
        self.assertTrue(url.startswith("http://drive.test:8071/"), url)
        # ...while claiming the host Keycloak's redirect URIs are registered
        # under. Getting this wrong is what makes Keycloak reject the flow.
        self.assertEqual(headers["Host"], "localhost:8071")

    def test_credentials_are_posted_to_the_form_s_own_action(self):
        fake = flow()
        self.login(fake, password="secret")
        method, url, _ = fake.requests[2]
        self.assertEqual(method, "POST")
        self.assertIn("/login-actions/authenticate", url)

    def test_stops_at_the_redirect_out_to_drive_s_frontend(self):
        """The hop to localhost:3000 must not be followed -- see _follow()."""
        fake = flow()
        self.login(fake)
        self.assertEqual(len(fake.requests), 4)
        self.assertNotIn("3000", " ".join(url for _, url, _ in fake.requests))

    def test_a_rejected_password_is_reported_as_invalid_credentials(self):
        """Keycloak answers 200 and re-renders the form; /users/me/ is what
        actually tells us the login failed."""
        with self.assertRaises(oidc_login.LoginFailed) as caught:
            self.login(flow(final_user_status=401))
        self.assertEqual(caught.exception.code, "invalid_credentials")
        self.assertEqual(caught.exception.status, 401)

    def test_a_session_cookie_without_a_confirmed_identity_is_not_a_login(self):
        """Drive sets drive_sessionid at the start of the flow to hold OIDC
        state, so the cookie alone must never be taken as proof."""
        with self.assertRaises(oidc_login.LoginFailed) as caught:
            self.login(flow(final_user_status=403))
        self.assertEqual(caught.exception.code, "unexpected_response")

    def test_a_missing_login_form_is_not_treated_as_a_login(self):
        fake = FakeDrive(
            response(302, headers={"Location": KEYCLOAK_URL}),
            response(200, text="<html>something else entirely</html>"),
        )
        with self.assertRaises(oidc_login.LoginFailed) as caught:
            self.login(fake)
        self.assertEqual(caught.exception.status, 502)

    def test_an_unreachable_drive_is_reported_as_502(self):
        fake = FakeDrive()
        fake.request = mock.Mock(side_effect=requests.ConnectionError())
        with self.assertRaises(oidc_login.LoginFailed) as caught:
            self.login(fake)
        self.assertEqual(caught.exception.code, "drive_unreachable")
        self.assertEqual(caught.exception.status, 502)

    def test_a_slow_drive_is_reported_as_504(self):
        fake = FakeDrive()
        fake.request = mock.Mock(side_effect=requests.Timeout())
        with self.assertRaises(oidc_login.LoginFailed) as caught:
            self.login(fake)
        self.assertEqual(caught.exception.code, "drive_timeout")
        self.assertEqual(caught.exception.status, 504)


@override_settings(
    DINUM_SERVICES=SERVICES, DINUM_API_TIMEOUT=1, DINUM_PUBLIC_HOST="localhost",
    DINUM_USE_MOCK=False,
)
class LoginViewTests(TestCase):
    def setUp(self):
        self.client = Client(enforce_csrf_checks=True)

    def post_login(self, body, csrf=True):
        headers = {}
        if csrf:
            self.client.get("/api/auth/me/")  # hands out the csrftoken cookie
            headers["HTTP_X_CSRFTOKEN"] = self.client.cookies["csrftoken"].value
        return self.client.post(
            "/api/auth/login/", data=json.dumps(body),
            content_type="application/json", **headers,
        )

    def test_login_stores_the_credential_and_returns_the_user(self):
        with mock.patch.object(oidc_login, "login", side_effect=_logs_in_everywhere):
            response = self.post_login({"email": "someone@drive.test", "password": "pw"})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["user"]["email"], "someone@drive.test")
        self.assertEqual(self.client.session[CREDENTIAL_KEYS["drive"]], "cookie-drive")

    def test_the_password_is_never_stored_in_the_session(self):
        with mock.patch.object(oidc_login, "login", side_effect=_logs_in_everywhere):
            self.post_login({"email": "someone@drive.test", "password": "hunter2"})
        self.assertNotIn("hunter2", json.dumps(dict(self.client.session)))

    def test_the_session_id_changes_on_login(self):
        self.client.get("/api/auth/me/")
        before = self.client.session.session_key
        with mock.patch.object(oidc_login, "login", side_effect=_logs_in_everywhere):
            self.post_login({"email": "someone@drive.test", "password": "pw"})
        self.assertNotEqual(self.client.session.session_key, before)

    def test_bad_credentials_are_passed_through_as_401(self):
        failure = oidc_login.LoginFailed("invalid_credentials", 401)
        with mock.patch.object(oidc_login, "login", side_effect=failure):
            response = self.post_login({"email": "someone@drive.test", "password": "wrong"})
        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.json(), {"error": "invalid_credentials"})
        self.assertNotIn(CREDENTIAL_KEYS["drive"], self.client.session)

    def test_a_malformed_body_is_rejected_before_drive_is_called(self):
        with mock.patch.object(oidc_login, "login") as called:
            response = self.post_login({"email": "someone@drive.test"})
        self.assertEqual(response.status_code, 400)
        called.assert_not_called()

    def test_post_without_a_csrf_token_is_refused(self):
        response = self.post_login({"email": "a@b.c", "password": "pw"}, csrf=False)
        self.assertEqual(response.status_code, 403)

    def test_get_is_not_allowed_on_login(self):
        self.assertEqual(self.client.get("/api/auth/login/").status_code, 405)

    def test_me_reports_401_until_logged_in(self):
        self.assertEqual(self.client.get("/api/auth/me/").status_code, 401)

    def test_logout_clears_the_stored_credential(self):
        with mock.patch.object(oidc_login, "login", side_effect=_logs_in_everywhere):
            self.post_login({"email": "someone@drive.test", "password": "pw"})
        csrf = self.client.cookies["csrftoken"].value
        response = self.client.post("/api/auth/logout/", HTTP_X_CSRFTOKEN=csrf)
        self.assertEqual(response.status_code, 200)
        self.assertNotIn(CREDENTIAL_KEYS["drive"], self.client.session)
        self.assertNotIn(USER_KEY, self.client.session)
        self.assertEqual(self.client.get("/api/auth/me/").status_code, 401)


@override_settings(
    DINUM_SERVICES=SERVICES, DINUM_API_TIMEOUT=1, DINUM_PUBLIC_HOST="localhost",
    DINUM_USE_MOCK=True,
)
class MockModeTests(TestCase):
    def post_login(self, email, password):
        client = Client()
        client.get("/api/auth/me/")
        return client.post(
            "/api/auth/login/", data=json.dumps({"email": email, "password": password}),
            content_type="application/json",
            HTTP_X_CSRFTOKEN=client.cookies["csrftoken"].value,
        )

    def test_a_demo_account_logs_in_without_drive(self):
        with mock.patch.object(oidc_login, "login") as real_login:
            response = self.post_login("drive@drive.world", "drive")
        self.assertEqual(response.status_code, 200)
        real_login.assert_not_called()

    def test_mock_mode_still_rejects_a_wrong_password(self):
        response = self.post_login("drive@drive.world", "whatever")
        self.assertEqual(response.status_code, 401)

    def test_mock_mode_rejects_an_unknown_account(self):
        response = self.post_login("stranger@example.test", "drive")
        self.assertEqual(response.status_code, 401)


@override_settings(
    DINUM_SERVICES=SERVICES, DINUM_API_TIMEOUT=1, DINUM_PUBLIC_HOST="localhost",
    DINUM_USE_MOCK=False,
)
class MessagesLinkTests(TestCase):
    """Messages runs its own Keycloak with its own users, so the same
    credentials may work there or not. Neither outcome may break the login."""

    def post_login(self, side_effect):
        client = Client()
        client.get("/api/auth/me/")
        with mock.patch.object(oidc_login, "login", side_effect=side_effect):
            response = client.post(
                "/api/auth/login/",
                data=json.dumps({"email": "someone@drive.test", "password": "pw"}),
                content_type="application/json",
                HTTP_X_CSRFTOKEN=client.cookies["csrftoken"].value,
            )
        return client, response

    def test_an_account_in_both_services_gets_both_credentials(self):
        client, response = self.post_login(_logs_in_everywhere)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(client.session[CREDENTIAL_KEYS["drive"]], "cookie-drive")
        self.assertEqual(client.session[CREDENTIAL_KEYS["messages"]], "cookie-messages")
        self.assertEqual(response.json()["services"], {"drive": True, "messages": True})

    def test_an_account_missing_from_messages_still_logs_in(self):
        client, response = self.post_login(_drive_only)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(client.session[CREDENTIAL_KEYS["drive"]], "cookie-drive")
        self.assertNotIn(CREDENTIAL_KEYS["messages"], client.session)
        # The interface can then say why the handover has no mail in it.
        self.assertEqual(response.json()["services"], {"drive": True, "messages": False})

    def test_messages_being_down_does_not_break_the_login(self):
        def drive_ok_messages_down(service, email, password):
            if service == "drive":
                return "cookie-drive", USER_PAYLOAD
            raise oidc_login.LoginFailed("messages_unreachable", 502)

        client, response = self.post_login(drive_ok_messages_down)
        self.assertEqual(response.status_code, 200)
        self.assertNotIn(CREDENTIAL_KEYS["messages"], client.session)

    def test_a_failed_drive_login_stores_nothing_at_all(self):
        def nothing_works(service, email, password):
            raise oidc_login.LoginFailed("invalid_credentials", 401)

        client, response = self.post_login(nothing_works)
        self.assertEqual(response.status_code, 401)
        self.assertNotIn(CREDENTIAL_KEYS["drive"], client.session)
        self.assertNotIn(CREDENTIAL_KEYS["messages"], client.session)
