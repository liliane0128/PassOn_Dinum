from django.urls import path

from . import handover_views, views

urlpatterns = [
    path("", views.team),
    path("<uuid:collaborator_id>/", views.team_member),
    path("<uuid:collaborator_id>/handover/", handover_views.handover),
    path("<uuid:collaborator_id>/handover/validate/", handover_views.validate),
]
