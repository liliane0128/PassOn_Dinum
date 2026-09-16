# passon — who works with whom, and what their handover says

## What this app is for

Identity lives in **Drive** (and Messages): people log in with those accounts,
and no password is ever stored here — see [`../accounts/README.md`](../accounts/README.md).
This app stores the two things those services do not know:

- **who reports to whom**, and who is a manager, which is what decides whose
  handover someone is allowed to see;
- **the handover sheet itself**, which until now lived only in the browser's
  memory (`SummaryContext`) and was lost on every page reload.

```
Collaborator ──manager──> Collaborator        (self reference, nullable)
     │
     └──handover──> Handover                  (one each, at most)
```

## Why one table for people, not Manager + User

A manager is a person, not a different kind of record. They take holidays,
they leave, they report to someone — which is precisely what this product is
about. Splitting them into their own table would mean a manager could not have
a handover, could not own documents, and could not have a manager of their own,
and it would make the top of the hierarchy impossible to represent since the
foreign key could never be null.

It also matches the interface, which has always had one list of collaborators
with a `role` and a `managerId` (`src/frontend/src/data/mockData.js`).

The table is called `Collaborator`, not `User`, because `django.contrib.auth`
already has a `User` — that one backs the admin login and has nothing to do
with the people in the product.

## Fields worth explaining

**`external_id` is nullable.** It holds the user id Drive reports at login, and
it stays `NULL` until that person logs in for the first time. A manager can add
a collaborator who has no Drive account yet; that row is matched to its Drive
identity by email on first login. Making this field required would make the
"add a collaborator" feature impossible. It is still unique, and several rows
may await their first login, since SQL does not treat NULLs as duplicates.

**`manager` uses `SET_NULL`, not `CASCADE`.** A manager leaving must not delete
their team — that is the exact situation the application exists to handle. For
the same reason, removing someone from a team detaches them (`manager = NULL`)
rather than deleting them: leaving a team is not leaving the organisation, and
deleting the row would take their handover, job title and Drive link with it.
Deleting a collaborator outright does cascade to their handover, but nothing in
the interface does that today.

**`sections` is JSON.** It holds the six structured lists the interface shows
(actions, décisions, deadlines, blocages, contacts, documents). They are always
read and written together, their shape is still moving, and the documents in
them are references to items that live in Drive and Messages
(`{"id": "drive:<uuid>", "title": ..., "url": ...}`), not rows of ours. Six
tables would buy integrity we do not need yet and would have to be reshaped
every time the prompt changes.

## What is deliberately not here

- **No `Content` table.** Items are fetched live from Drive and Messages by
  `connectors/` and already carry their real ids and URLs. Storing copies would
  mean owning a cache with no invalidation story — when to re-sync, what to do
  about deleted files. The references a handover actually cites live in
  `sections`.
- **No record of shares.** `sendMail()` in the manager view currently only
  raises a toast; nothing is sent. When it becomes real, a small
  `HandoverShare(handover, recipient, sent_at)` covers "sent to X on Y", and
  there will be no data to migrate.
- **No passwords, no `AUTH_USER_MODEL`.** Keycloak owns authentication. The
  default `auth.User` stays as the admin login; this app holds domain data.

## Not wired up yet

The tables exist and are migrated, but nothing writes to them: logging in does
not yet create a `Collaborator`, and the interface still reads roles and teams
from its mock data through `toAppUser()` in
`src/frontend/src/context/AuthContext.jsx`. The next step is to `get_or_create`
the collaborator on login (matching `external_id`, falling back to `email`) and
return `role` and `manager` from `/api/auth/me/`.

## Demo data

The upstream services hold what the handover is generated from, so a wiped
Drive or Messages leaves the app with nothing to summarize.
`manage.py seed_demo` rebuilds that material — see
[`demo_data/README.md`](demo_data/README.md).

## Tests

```sh
python manage.py test passon
```

They are written per feature rather than per constraint — "a manager can add a
collaborator who has no Drive account yet", "removing a manager keeps their
team" — so that a later change to the models fails against the thing it would
break.
