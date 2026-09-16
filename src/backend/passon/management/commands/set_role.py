"""Promote someone to manager, or put them back to employee.

Roles are ours to decide -- Drive has no notion of them -- and nothing in the
interface can set one yet, so this is how a manager account comes to exist.

    python manage.py set_role fbenech@student.42lehavre.fr manager
    python manage.py set_role someone@example.test employee --manager fbenech@student.42lehavre.fr

The person does not have to have logged in yet: the row is created if needed,
with no external_id, and their Drive identity is attached to it on first login.
"""

from django.core.management.base import BaseCommand, CommandError

from passon.models import Collaborator


class Command(BaseCommand):
    help = "Set a collaborator's role, creating them if they do not exist yet."

    def add_arguments(self, parser):
        parser.add_argument("email")
        parser.add_argument("role", choices=[r.value for r in Collaborator.Role])
        parser.add_argument(
            "--manager",
            help="Email of this person's manager (optional).",
        )

    def handle(self, *args, **options):
        email = options["email"].strip().lower()
        collaborator, created = Collaborator.objects.get_or_create(
            email=email,
            defaults={
                # Placeholders until Drive reports the real ones at first login.
                "first_name": email.split("@")[0],
                "last_name": "",
            },
        )
        collaborator.role = options["role"]

        if options["manager"]:
            manager_email = options["manager"].strip().lower()
            try:
                collaborator.manager = Collaborator.objects.get(email__iexact=manager_email)
            except Collaborator.DoesNotExist as error:
                raise CommandError(f"No collaborator with email {manager_email}") from error

        collaborator.save()

        state = "created" if created else "updated"
        pending = " (awaiting first login)" if not collaborator.external_id else ""
        self.stdout.write(
            self.style.SUCCESS(
                f"{state}: {collaborator.email} is now {collaborator.role}{pending}"
            )
        )
