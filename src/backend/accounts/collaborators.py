"""Tie the identity a service reports at login to a row in our own database.

Drive knows who someone is; it does not know whether they manage anyone. That
part is ours (passon/models.py), so every login resolves the Drive identity to
a Collaborator row -- creating it the first time, and claiming a row a manager
created earlier for someone who had not logged in yet.
"""

from passon.models import Collaborator


def _split_name(full_name, fallback):
    """Drive reports one display name; the interface shows first/last."""
    first, _, last = (full_name or "").strip().partition(" ")
    return (first or fallback), last


def sync_from_login(account):
    """Return the Collaborator for this Drive identity, creating it if needed.

    Matching order matters:

    1. `external_id`, the Drive user id -- stable even if someone's address
       changes at the identity provider.
    2. the email address, which is how a row added by a manager (and therefore
       without an external_id yet) gets claimed on that person's first login.
    3. otherwise a new row, with the default role.

    The role is never touched here: it is ours to decide, not Drive's, so a
    collaborator promoted to manager stays one across logins.
    """
    external_id = str(account.get("id") or "").strip() or None
    email = (account.get("email") or "").strip().lower()

    collaborator = None
    if external_id:
        collaborator = Collaborator.objects.filter(external_id=external_id).first()
    if collaborator is None and email:
        collaborator = Collaborator.objects.filter(email__iexact=email).first()
        if collaborator is not None and external_id and not collaborator.external_id:
            collaborator.external_id = external_id
    if collaborator is None:
        collaborator = Collaborator(email=email, external_id=external_id)

    # Identity fields follow Drive, which is their source of truth -- but an
    # empty value there must not erase what a manager typed when creating the
    # row by hand.
    first_name, last_name = _split_name(account.get("full_name"), email)
    collaborator.first_name = first_name or collaborator.first_name
    collaborator.last_name = last_name or collaborator.last_name
    collaborator.save()
    return collaborator


def as_json(collaborator):
    """The shape the frontend consumes, mirroring its collaborator objects."""
    return {
        "id": str(collaborator.id),
        "email": collaborator.email,
        "firstName": collaborator.first_name,
        "lastName": collaborator.last_name,
        "full_name": collaborator.full_name,
        "jobTitle": collaborator.job_title,
        "team": collaborator.team,
        "accountRole": collaborator.role,
        "managerId": str(collaborator.manager_id) if collaborator.manager_id else None,
        # A URL rather than the image: see passon/avatar_views.py. None when
        # the person has no picture, so the interface falls back to initials.
        "avatarUrl": (
            f"/api/collaborators/{collaborator.id}/avatar/"
            if collaborator.avatar
            else None
        ),
    }
