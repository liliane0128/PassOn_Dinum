import io
import json
from unittest.mock import patch
from urllib.error import HTTPError, URLError
from django.test import SimpleTestCase
from .views import NoRedirects


class BridgeTests(SimpleTestCase):
    def test_authentication_required(self):
        with patch('integrations.views.build_opener') as opener:
            self.assertEqual(self.client.get('/api/docs/documents/').status_code, 401)
            opener.assert_not_called()

    @patch('integrations.views.build_opener')
    def test_cookie_query_and_response(self, opener):
        opener.return_value.open.return_value = io.BytesIO(json.dumps({'results': [{'id': 'a'}]}).encode())
        self.client.cookies['drive_sessionid'] = 'drive-user'
        self.client.cookies['docs_sessionid'] = 'other-secret'
        response = self.client.get('/api/drive/items/?page=2&tag=a&tag=b')
        req = opener.return_value.open.call_args.args[0]
        self.assertEqual(req.get_header('Cookie'), 'drive_sessionid=drive-user')
        self.assertTrue(req.full_url.endswith('/api/v1.0/items/?page=2&tag=a&tag=b'))
        self.assertEqual(response.json(), {'results': [{'id': 'a'}]})
        self.assertEqual(response['Cache-Control'], 'private, no-store')

    @patch('integrations.views.build_opener')
    def test_upstream_errors(self, opener):
        for failure, status in [(URLError('refused'), 502), (TimeoutError(), 504), (URLError(TimeoutError()), 504), (HTTPError('http://example', 401, 'unauthorized', {}, None), 401), (HTTPError('http://example', 302, 'redirect', {}, None), 502)]:
            with self.subTest(status=status, failure=type(failure)):
                opener.return_value.open.side_effect = failure
                response = self.client.get('/api/docs/me/', HTTP_X_DOCS_SESSION='session')
                self.assertEqual(response.status_code, status)

    @patch('integrations.views.build_opener')
    def test_invalid_json(self, opener):
        opener.return_value.open.return_value = io.BytesIO(b'<html>Login</html>')
        self.assertEqual(self.client.get('/api/docs/me/', HTTP_X_DOCS_SESSION='session').status_code, 502)

    @patch('integrations.views.build_opener')
    def test_invalid_credentials_and_method(self, opener):
        self.assertEqual(self.client.get('/api/docs/me/', HTTP_X_DOCS_SESSION='bad;cookie=x').status_code, 400)
        self.assertEqual(self.client.post('/api/drive/items/').status_code, 405)
        opener.assert_not_called()

    def test_redirects_disabled(self):
        self.assertIsNone(NoRedirects().redirect_request(None, None, 302, '', {}, 'http://other'))
