from django.urls import path
from .views import relay

urlpatterns = [
    path("docs/me/", relay, {"service": "docs", "resource": "users/me"}),
    path("docs/documents/", relay, {"service": "docs", "resource": "documents"}),
    path("docs/documents/<uuid:resource_id>/", relay, {"service": "docs", "resource": "documents"}),
    path("drive/me/", relay, {"service": "drive", "resource": "users/me"}),
    path("drive/items/", relay, {"service": "drive", "resource": "items"}),
    path("drive/items/<uuid:resource_id>/", relay, {"service": "drive", "resource": "items"}),
]
