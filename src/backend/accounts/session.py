"""Keys under which a logged-in user's data lives in our Django session.

They sit in their own module so connectors/views.py can read the stored Drive
credential without importing the accounts views.
"""

# The Drive session cookie obtained when the user logged in.
CREDENTIAL_KEY = "drive_session"

# The identity Drive reported for that user, as returned to the frontend.
USER_KEY = "user"
