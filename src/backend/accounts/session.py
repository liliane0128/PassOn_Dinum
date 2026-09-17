"""Keys under which a logged-in user's data lives in our Django session.

They sit in their own module so connectors/views.py can read the stored
credentials without importing the accounts views.
"""

# Per-service session cookie obtained when the user logged in. Only services
# listed here can be read on a logged-in user's behalf; Docs has no entry
# because nothing logs into it yet.
CREDENTIAL_KEYS = {
    "drive": "drive_session",
}

# The identity the login service reported, as returned to the frontend.
USER_KEY = "user"
