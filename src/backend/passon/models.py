"""Who works with whom, and what their handover says.

Identity itself lives in Drive (and Messages): people log in with those
accounts and we never store a password. What this app stores is what those
services do not know -- who reports to whom, who is a manager, and the
handover sheet itself, which until now only existed in the browser's memory
and was lost on every page reload.
"""

import uuid

from django.db import models


class Collaborator(models.Model):
    """One person. Managers are collaborators too, not a separate table.

    A manager is someone who has a team, not a different kind of record: they
    have their own handover when they leave, can be someone else's report, and
    own their own documents. Keeping them in one table is also what the
    interface already assumes -- a single list of collaborators, each with a
    role and a manager.
    """

    class Role(models.TextChoices):
        MANAGER = "manager", "Manager"
        EMPLOYEE = "employee", "Employé"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    # The user id Drive reports at login. Null until this person logs in for
    # the first time: a manager can add a collaborator who has no Drive
    # account yet, and that row is matched to its Drive identity by email on
    # first login.
    external_id = models.CharField(
        max_length=255, unique=True, null=True, blank=True, db_index=True
    )
    email = models.EmailField(unique=True)
    first_name = models.CharField(max_length=255)
    last_name = models.CharField(max_length=255)
    job_title = models.CharField(max_length=255, blank=True)
    team = models.CharField(max_length=255, blank=True)

    role = models.CharField(max_length=20, choices=Role.choices, default=Role.EMPLOYEE)

    # Nullable by necessity: someone has to be at the top of the hierarchy.
    # SET_NULL rather than CASCADE -- a manager leaving must not delete the
    # team, which is precisely the situation this application exists for.
    manager = models.ForeignKey(
        "self",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="team_members",
    )

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["last_name", "first_name"]

    def __str__(self):
        return f"{self.first_name} {self.last_name} <{self.email}>"

    @property
    def full_name(self):
        return f"{self.first_name} {self.last_name}".strip()


class Handover(models.Model):
    """The handover sheet of one collaborator: AI-generated, then edited.

    One per person, hence OneToOne. `sections` holds the six structured lists
    the interface shows (actions, décisions, deadlines, blocages, contacts,
    documents) as JSON rather than six tables: their shape is still moving,
    they are always read and written together, and the documents in them are
    references to items living in Drive/Messages, not rows of ours.
    """

    collaborator = models.OneToOneField(
        Collaborator, on_delete=models.CASCADE, related_name="handover"
    )
    text = models.TextField(blank=True)
    sections = models.JSONField(default=dict, blank=True)

    # Set by the collaborator themselves; any later edit clears it again, so
    # "validé" always means "validated in its current state".
    validated = models.BooleanField(default=False)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        state = "validé" if self.validated else "non validé"
        return f"Passation de {self.collaborator.full_name} ({state})"
