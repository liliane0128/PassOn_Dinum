from django.urls import path
from .views import dossier, extraction_items, items

urlpatterns = [
    path("extraction/items/", extraction_items),
    path("dossier/", dossier),
]
for service, resource in (("docs", "documents"), ("drive", "items")):
    urlpatterns += [
        path(f"{service}/items/", items, {"service": service}),
        path(f"{service}/items/<uuid:item_id>/", items, {"service": service}),
    ]
    if resource != "items":
        urlpatterns += [
            path(f"{service}/{resource}/", items, {"service": service}),
            path(f"{service}/{resource}/<uuid:item_id>/", items, {"service": service}),
        ]
