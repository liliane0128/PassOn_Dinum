"""Drive client with the same list_items/get_item interface as Docs."""
import os

BASE_URL = os.getenv("DRIVE_URL", "http://localhost:8072")


def list_items(session, base_url=BASE_URL):
    response = session.get(f"{base_url.rstrip('/')}/api/v1.0/items/")
    response.raise_for_status()
    return response.json()["results"]


def get_item(session, item_id, base_url=BASE_URL):
    response = session.get(f"{base_url.rstrip('/')}/api/v1.0/items/{item_id}/")
    response.raise_for_status()
    return response.json()
