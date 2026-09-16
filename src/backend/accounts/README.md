# Accounts — logging in through the Suite Numérique services

## What this does

Pass‘on has no user accounts of its own. Someone logs in with the email and
password they already use for **Drive**, we ask the local Drive instance
whether that combination is right, and if it is, they are logged into our app.
Nothing about a user is stored here: no account, no password, not even a copy
of one.

The same credentials are then tried against **Messages**, which runs its own
Keycloak with its own user list. That attempt is best-effort: it never blocks
the login. A user who exists only in Drive is logged in all the same and simply
gets no mail in their handover, and the `services` field in the response says
which ones answered, so the interface can explain a partial result instead of
silently showing less.

The check is not a yes/no question we can ask these services, because Drive does not
verify passwords itself — it delegates to **Keycloak** (OIDC), and the Keycloak
client Drive uses has direct access grants disabled. So `drive_auth.py` walks
the same redirect chain a browser walks:

```
POST /api/auth/login/ {email, password}
        |
        v
  GET  <drive>/api/v1.0/authenticate/    -> 302 to Keycloak
  GET  <keycloak>/realms/drive/...       -> the HTML login form
  POST <the form's action>               -> 302 back to Drive's callback
  GET  <drive>/api/v1.0/callback/...     -> sets the drive_sessionid cookie
  GET  <drive>/api/v1.0/users/me/        -> confirms it worked, and says who
        |
        v
  our session: {drive_session: <cookie>, user: {id, email, full_name}}
```

The useful side effect is in the last box. What the flow produces is a real
Drive session, which is exactly the credential `connectors/` needs to read that
person's files. **Logging in and being able to read the user's documents are
the same operation**: `connectors/views.py` falls back to the stored cookie, so
a logged-in caller does not have to supply `X-Drive-Session` at all.

The identity shown in the interface is the one Drive reports, never one we
invent.

## Routes

| Route | Method | Answers |
| --- | --- | --- |
| `/api/auth/login/` | POST | `200 {"user": {...}, "services": {"drive": true, "messages": false}}`, or `401 {"error": "invalid_credentials"}` |
| `/api/auth/logout/` | POST | `200 {}` — always |
| `/api/auth/me/` | GET | `200 {"user": {...}, "services": {...}}` or `401 {"error": "not_authenticated"}` |

`services` reports which upstreams this session holds a credential for. Drive
decides the login; a `false` for Messages means the account does not exist in
its Keycloak, or Messages is not running.

Login also answers `400 invalid_request` for a malformed body, `502
drive_unreachable` / `unexpected_response` when Drive cannot be reached or does
not behave as expected, and `504 drive_timeout`.

Logout drops our session only. Drive's own session is left alone: we did not
create it in the user's browser and other tabs may still be using it.

## For the frontend

The session lives in a cookie, so the two POST routes need a CSRF token —
Django's standard mechanism:

1. `GET /api/auth/me/` on startup. It restores the session after a page reload
   **and** sets the `csrftoken` cookie.
2. Send that cookie's value back as the `X-CSRFToken` header on
   `POST /api/auth/login/` and `POST /api/auth/logout/`.
3. Use `credentials: "same-origin"` on every call, so the cookies travel.

This works because nginx puts the app and the API on one origin (see
`src/server/README.md`). Without the CSRF header, POSTs answer `403`.

```js
await fetch("/api/auth/me/", { credentials: "same-origin" });
const csrf = document.cookie.match(/csrftoken=([^;]+)/)[1];
const response = await fetch("/api/auth/login/", {
  method: "POST",
  credentials: "same-origin",
  headers: { "Content-Type": "application/json", "X-CSRFToken": csrf },
  body: JSON.stringify({ email, password }),
});
```

The frontend is wired to these routes: `src/frontend/src/api/auth.js` makes the
calls and `src/frontend/src/context/AuthContext.jsx` holds the session.

The response carries the role. Drive has no notion of one, so every login
resolves the Drive identity to a row in our own database (`collaborators.py`,
`passon.Collaborator`) and returns that person's `accountRole`, their manager,
and — for a manager — their team. A first login creates the row as an employee;
`manage.py set_role <email> manager` promotes someone, and the role is never
overwritten by a later login.

A row a manager created before that person ever logged in has no `external_id`;
the first login claims it by email, so the job title and reporting line set in
advance are kept.

## Running it against a real Drive

Drive must be running locally, and `src/backend/.env` must point at it:

```sh
DRIVE_URL=http://host.docker.internal:8071   # from Docker
# DRIVE_URL=http://localhost:8071            # Django run directly
DINUM_USE_MOCK=false
```

Log in with a user of Drive's Keycloak realm — `drive@drive.world` / `drive`,
`paige.turner@library.book` / `pass` (see `drive/docker/auth/realm.json`).

**For mail as well**, the same address and password must also exist in
Messages' own Keycloak (`messages/src/keycloak/realm.json`, seeded with
`user1@example.local` … `user3@example.local` — no overlap with Drive's). Create
the account there with the same email and password, and one login covers both;
otherwise `services.messages` stays `false` and the handover has no mail in it.

Sessions are stored in postgres, so the migrations must have run. The
container's entrypoint does that on every start, whichever way the project is
launched (`make up` or `make run` — both select services from the single
`docker-compose.yml` at the repository root, so both use the same database).

### Mock mode

With `DINUM_USE_MOCK=true`, `mock_accounts.py` takes over and Drive is never
contacted — the same demo accounts and passwords, so the interface behaves
identically. A wrong password is still rejected: a mock mode where any password
worked would be a trap the day the flag is left on somewhere it should not be.

## Two things that will bite whoever touches this next

**Each service builds its `redirect_uri` from the Host header we send.** Reaching
Drive at `host.docker.internal:8071` from a container therefore makes it hand
Keycloak a `redirect_uri` of `http://host.docker.internal:8071/...`, which is
not among the client's registered URIs, and Keycloak answers *"Invalid
parameter: redirect_uri"*. Every request consequently goes to `DRIVE_URL`'s
host while presenting `DINUM_PUBLIC_HOST` (default `localhost`) in its `Host`
header. The same applies to Messages, which is why one function serves both. On a machine where Django runs outside Docker both are `localhost` and
none of this does anything.

**Neither a 200 nor a session cookie means the login worked.** A wrong password
makes Keycloak answer `200` with the login form rendered again, and Drive sets
a `drive_sessionid` cookie at the *start* of the flow to hold OIDC state, so
the cookie exists before any password has been checked. Success is confirmed
only by `/api/v1.0/users/me/` returning 200. `/api/v1.0/items/` cannot be used
for this — it answers `200` with an empty list to anonymous callers, so it
accepts a failed login. `drive_client.login()` in `connectors/` checks exactly
that and is worth revisiting.

## Tests

```sh
python manage.py test accounts
```

The flow is tested against a fake transport rather than a running Drive, so the
endings that look like success but are not — the re-rendered login form, the
premature session cookie — are covered; a live instance cannot be made to
produce those on demand.
