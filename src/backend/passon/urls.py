from django.urls import path

from . import avatar_views, handover_views, item_views, send_views, views

urlpatterns = [
    path("", views.team),
    path("search/", views.search),
    path("<uuid:collaborator_id>/", views.team_member),
    path("<uuid:collaborator_id>/items/", item_views.items),
    path("<uuid:collaborator_id>/avatar/", avatar_views.avatar),
    path("<uuid:collaborator_id>/handover/", handover_views.handover),
    path("<uuid:collaborator_id>/handover/validate/", handover_views.validate),
    path("<uuid:collaborator_id>/handover/send/", send_views.send),
]
