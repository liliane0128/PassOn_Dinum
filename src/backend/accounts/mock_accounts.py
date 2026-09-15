"""Stand-in for drive_auth.login() when DINUM_USE_MOCK is on.

The rest of the API already has a mock mode so the app can be run and demoed
without Docs/Drive/Messages (see connectors/mock_clients.py); login needs the
same, otherwise `make up` on its own leaves nobody able to get past the login
screen.

The accounts below are the demo users of Drive's own Keycloak realm
(drive/docker/auth/realm.json), with the same emails and passwords, so the
interface behaves identically whether it is talking to a real Drive or not.
Passwords are compared in full and nothing else is accepted -- a mock mode
that let any password through would be a trap the day the flag is left on
somewhere it shouldn't be.
"""

from . import drive_auth

# email -> (password, Drive-shaped user payload)
ACCOUNTS = {
    "drive@drive.world": ("drive", {"id": "mock-drive", "email": "drive@drive.world", "full_name": "Drive Demo"}),
    "paige.turner@library.book": ("pass", {"id": "mock-paige", "email": "paige.turner@library.book", "full_name": "Paige Turner"}),
    "miles.ahead@roadmap.fwd": ("pass", {"id": "mock-miles", "email": "miles.ahead@roadmap.fwd", "full_name": "Miles Ahead"}),
    "archie.vist@vaulted.docs": ("pass", {"id": "mock-archie", "email": "archie.vist@vaulted.docs", "full_name": "Archie Vist"}),
    "mark.down@plain.text": ("pass", {"id": "mock-mark", "email": "mark.down@plain.text", "full_name": "Mark Down"}),
}

# Value stored where a real Drive session cookie would be. The mock connectors
# ignore the session entirely, so it only has to be non-empty and recognisable
# in a session dump.
MOCK_CREDENTIAL = "mock-drive-session"


def login(email, password):
    """Same contract as drive_auth.login(): (credential, user) or LoginFailed."""
    account = ACCOUNTS.get(email.strip().lower())
    if account is None or account[0] != password:
        raise drive_auth.LoginFailed("invalid_credentials", 401)
    return MOCK_CREDENTIAL, account[1]
