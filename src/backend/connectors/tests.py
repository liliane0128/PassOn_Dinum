import json
from unittest.mock import patch
import requests
from django.test import SimpleTestCase


def upstream(data, status=200):
    response = requests.Response()
    response.status_code = status
    response._content = json.dumps(data).encode()
    return response


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
