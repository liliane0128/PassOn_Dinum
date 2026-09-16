from django.contrib import admin

from .models import Collaborator, Handover


@admin.register(Collaborator)
class CollaboratorAdmin(admin.ModelAdmin):
    list_display = ("email", "first_name", "last_name", "role", "manager", "external_id")
    list_filter = ("role", "team")
    search_fields = ("email", "first_name", "last_name")


@admin.register(Handover)
class HandoverAdmin(admin.ModelAdmin):
    list_display = ("collaborator", "validated", "updated_at")
    list_filter = ("validated",)
