
from django.db import models
import uuid

class Manager(models.Model):
	"""
	Models for a manager user on the backend database
	"""
	id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
	external_id = models.CharField(max_length=255, unique=True, db_index=True)
	name = models.CharField(max_length=255)

class User(models.Model):
	"""
	Models for a simple user on the backend database
	"""
	id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
	external_id = models.CharField(max_length=255, unique=True, db_index=True)
	manager = models.ForeignKey(Manager, on_delete=models.CASCADE, related_name="users") # Reference to his manager
	name = models.CharField(max_length=255)

class Content(models.Model):
	"""
	Models for the file on the backend database
	"""
	class ContentType(models.TextChoices):
		"""
		Enume who store every content type available
		"""
		FILE = "file", "File"
		MAIL = "mail", "Mail"
		DOC = "doc", "Document"

	id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
	external_id = models.CharField(max_length=255, unique=True, db_index=True)
	user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="contents")
	type = models.CharField(
		max_length=50,
		choices=ContentType.choices,
		default=ContentType.FILE,
	)
	reference_id = models.CharField(max_length=255, unique=True, db_index=True) # The ID from Drive/Messages/Docs
