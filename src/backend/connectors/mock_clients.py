"""Mock stand-ins for docs_client/drive_client.

Same list_items(session, base_url=...) / get_item(session, item_id, base_url=...)
signature as the real clients, so views.py can swap them in without any
special-casing. No network calls, no docker services required.
"""

import requests

from .mock_data import BY_SERVICE


def _not_found(item_id):
    response = requests.Response()
    response.status_code = 404
    response._content = b'{"detail": "Not found."}'
    raise requests.HTTPError(f"No mock item with id {item_id}", response=response)


class _MockService:
    def __init__(self, service):
        self._service = service

    def list_items(self, session, base_url=None):
        return BY_SERVICE[self._service]

    def get_item(self, session, item_id, base_url=None):
        for item in BY_SERVICE[self._service]:
            if item["id"] == item_id:
                return item
        _not_found(item_id)


docs_mock = _MockService("docs")
drive_mock = _MockService("drive")
