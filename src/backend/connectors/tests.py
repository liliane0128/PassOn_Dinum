import json, requests
from unittest import mock
from unittest.mock import patch

from accounts.session import CREDENTIAL_KEYS
from django.test import Client, TestCase, SimpleTestCase, override_settings

def upstream(data, status=200):
    response = requests.Response()
    response.status_code = status
    response._content = json.dumps(data).encode()
    return response


@override_settings(DINUM_USE_MOCK=False)
class ConnectorAPITests(SimpleTestCase):
    @patch('requests.sessions.Session.send')
    def test_all_connectors(self, send):
        cases = [
            ('docs', 'HTTP_X_DOCS_SESSION', [upstream({'results': [{'title': 'Doc'}]})], [{'title': 'Doc'}], 'documents/'),
            ('drive', 'HTTP_X_DRIVE_SESSION', [upstream({'results': [{'title': 'File'}]})], [{'title': 'File'}], 'items/?is_creator_me=true'),
            ('messages', 'HTTP_X_MESSAGES_SESSION', [upstream([{'id': 'mailbox-1'}]), upstream({'results': [{'id': 'thread-1'}]}), upstream([{'id': 'msg-1', 'subject': 'Hi'}])], [{'id': 'msg-1', 'subject': 'Hi'}], 'messages/?thread_id=thread-1'),
        ]
        for service, header, responses, data, suffix in cases:
            with self.subTest(service=service):
                send.reset_mock()
                send.side_effect = responses
                result = self.client.get(f'/api/{service}/items/', **{header: 'user-session'})
                self.assertEqual(result.status_code, 200)
                self.assertEqual(result.json(), {'service': service, 'data': data})
                self.assertTrue(send.call_args.args[0].url.endswith(suffix))
                self.assertEqual(send.call_args.kwargs['timeout'], 10)
                self.assertFalse(send.call_args.kwargs['allow_redirects'])
                self.assertEqual(result['Cache-Control'], 'private, no-store')

    @patch('requests.sessions.Session.send')
    def test_messages_fans_out_across_mailboxes(self, send):
        # A user can have more than one mailbox (personal + shared); an
        # earlier version only ever looked at mailboxes[0] and silently
        # dropped everything else. list_items() now walks every mailbox.
        send.side_effect = [
            upstream([{'id': 'mailbox-1'}, {'id': 'mailbox-2'}]),
            upstream({'results': [{'id': 'thread-1'}]}),
            upstream([{'id': 'msg-1', 'subject': 'From mailbox 1'}]),
            upstream({'results': [{'id': 'thread-2'}]}),
            upstream([{'id': 'msg-2', 'subject': 'From mailbox 2'}]),
        ]
        result = self.client.get('/api/messages/items/', HTTP_X_MESSAGES_SESSION='session')
        self.assertEqual(result.status_code, 200)
        self.assertEqual(
            result.json(),
            {'service': 'messages', 'data': [
                {'id': 'msg-1', 'subject': 'From mailbox 1'},
                {'id': 'msg-2', 'subject': 'From mailbox 2'},
            ]},
        )

    @patch('requests.sessions.Session.send')
    def test_detail_routes_and_aliases(self, send):
        send.return_value = upstream({'id': 'detail'})
        identifier = '12345678-1234-1234-1234-123456789abc'
        for service, resource, header in [('docs', 'documents', 'HTTP_X_DOCS_SESSION'), ('drive', 'items', 'HTTP_X_DRIVE_SESSION'), ('messages', 'messages', 'HTTP_X_MESSAGES_SESSION')]:
            result = self.client.get(f'/api/{service}/{resource}/{identifier}/', **{header: 'session'})
            self.assertEqual(result.status_code, 200)
            self.assertTrue(send.call_args.args[0].url.endswith(f'/{resource}/{identifier}/'))

    @patch('requests.sessions.Session.send')
    def test_credentials_isolated_and_required(self, send):
        send.return_value = upstream({'results': []})
        self.client.cookies['docs_sessionid'] = 'docs-user'
        self.assertEqual(self.client.get('/api/drive/items/').status_code, 401)
        send.assert_not_called()
        self.client.get('/api/drive/items/', HTTP_X_DRIVE_SESSION='drive-user')
        self.assertEqual(send.call_args.args[0].headers['Cookie'], 'drive_sessionid=drive-user')
        self.client.get('/api/docs/items/')
        self.assertEqual(send.call_args.args[0].headers['Cookie'], 'docs_sessionid=docs-user')

    @patch('requests.sessions.Session.send')
    def test_validation(self, send):
        self.assertEqual(self.client.post('/api/docs/items/').status_code, 405)
        self.assertEqual(self.client.get('/api/docs/items/', HTTP_X_DOCS_SESSION='a;b').status_code, 400)
        self.assertEqual(self.client.get('/api/docs/items/?page=2', HTTP_X_DOCS_SESSION='session').status_code, 400)
        self.assertEqual(self.client.get('/api/docs/items/not-a-uuid/', HTTP_X_DOCS_SESSION='session').status_code, 404)
        send.assert_not_called()

    @patch('requests.sessions.Session.send')
    def test_errors(self, send):
        for status in (401, 403, 404, 429, 500, 302):
            send.return_value = upstream({'secret': 'not-for-client'}, status)
            result = self.client.get('/api/drive/items/', HTTP_X_DRIVE_SESSION='session')
            self.assertEqual(result.status_code, status if status in (401, 403, 404, 429) else 502)
            self.assertNotIn('not-for-client', result.content.decode())
        for exc, status in [(requests.Timeout(), 504), (requests.ConnectionError(), 502)]:
            send.side_effect = exc
            self.assertEqual(self.client.get('/api/docs/items/', HTTP_X_DOCS_SESSION='session').status_code, status)

    @patch('requests.sessions.Session.send')
    def test_no_mailboxes_and_invalid_json(self, send):
        # An account with zero mailboxes has zero messages -- that's a
        # legitimate empty result now that list_items() fans out across
        # every mailbox instead of requiring at least one to exist.
        send.return_value = upstream([])
        result = self.client.get('/api/messages/items/', HTTP_X_MESSAGES_SESSION='session')
        self.assertEqual(result.status_code, 200)
        self.assertEqual(result.json(), {'service': 'messages', 'data': []})
        send.return_value = upstream({})
        self.assertEqual(self.client.get('/api/docs/items/', HTTP_X_DOCS_SESSION='session').status_code, 502)
        send.return_value._content = b'not json'
        self.assertEqual(self.client.get('/api/docs/items/', HTTP_X_DOCS_SESSION='session').status_code, 502)


@override_settings(DINUM_USE_MOCK=False)
class ExtractionViewTests(SimpleTestCase):
    def test_requires_at_least_one_credential(self):
        result = self.client.get('/api/extraction/items/')
        self.assertEqual(result.status_code, 401)

    def test_rejects_invalid_session(self):
        result = self.client.get('/api/extraction/items/', HTTP_X_DOCS_SESSION='a;b')
        self.assertEqual(result.status_code, 400)

    def test_rejects_query_parameters(self):
        result = self.client.get('/api/extraction/items/?page=2', HTTP_X_MESSAGES_SESSION='session')
        self.assertEqual(result.status_code, 400)

    @patch('connectors.extraction.normalize_items')
    @patch('connectors.docs_client.list_items')
    def test_skips_services_with_no_credential(self, list_items, normalize_items):
        list_items.return_value = [{'id': 'd1'}]
        normalize_items.return_value = [{'id': 'docs:d1', 'title': 'Doc'}]
        result = self.client.get('/api/extraction/items/', HTTP_X_DOCS_SESSION='session')
        self.assertEqual(result.status_code, 200)
        self.assertEqual(result.json(), {'items': [{'id': 'docs:d1', 'title': 'Doc'}], 'errors': {}})
        list_items.assert_called_once()

    @patch('connectors.extraction.normalize_items')
    @patch('connectors.drive_client.list_items')
    @patch('connectors.docs_client.list_items')
    def test_merges_multiple_services(self, docs_list, drive_list, normalize_items):
        docs_list.return_value = [{'id': 'd1'}]
        drive_list.return_value = [{'id': 'f1'}]
        normalize_items.side_effect = [
            [{'id': 'docs:d1', 'title': 'Doc'}],
            [{'id': 'drive:f1', 'title': 'File'}],
        ]
        result = self.client.get(
            '/api/extraction/items/', HTTP_X_DOCS_SESSION='s1', HTTP_X_DRIVE_SESSION='s2',
        )
        self.assertEqual(result.status_code, 200)
        self.assertEqual(result.json()['items'], [
            {'id': 'docs:d1', 'title': 'Doc'},
            {'id': 'drive:f1', 'title': 'File'},
        ])
        self.assertEqual(result.json()['errors'], {})

    @patch('connectors.messages_client.list_items')
    def test_records_error_without_failing_whole_request(self, list_items):
        list_items.side_effect = requests.Timeout()
        result = self.client.get('/api/extraction/items/', HTTP_X_MESSAGES_SESSION='session')
        self.assertEqual(result.status_code, 200)
        self.assertEqual(result.json(), {'items': [], 'errors': {'messages': 'upstream_timeout'}})


class DossierFailurePathTests(TestCase):
    """One upstream failing must not take the whole request down with it.

    Storing the session of a *failed* fetch left a None in the map, and
    closing them afterwards raised AttributeError -- so any upstream error
    surfaced as a 500 that said nothing, and the interface reported it as the
    AI having failed.
    """

    @override_settings(DINUM_USE_MOCK=False)
    def test_an_upstream_error_is_reported_not_crashed(self):
        from django.http import JsonResponse

        client = Client()
        session = client.session
        session[CREDENTIAL_KEYS["drive"]] = "drive-cookie"
        session.save()

        refusal = JsonResponse(
            {"service": "drive", "error": "upstream_unavailable"}, status=502
        )
        with mock.patch(
            "connectors.views._fetch_raw_items", return_value=(None, None, refusal)
        ):
            response = client.get("/api/dossier/")

        self.assertEqual(response.status_code, 502)
        self.assertEqual(json.loads(response.content)["error"], "upstream_unavailable")
