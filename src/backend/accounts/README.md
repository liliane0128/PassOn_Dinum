# Accounts — logging in through the Suite Numérique services
# Comptes — se connecter via les services de La Suite

*[English](#english) · [Français](#français)*

---

## English

### What this does

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

That second login is skipped entirely when the deployment does not read mail
(`DINUM_ENABLED_SERVICES`, see
[connectors](../connectors/README.md#which-services-are-read-dinum_enabled_services)):
opening a Messages session that nothing will ever read would only cost a second
OIDC walk on every login. `services.messages` then comes back `false`, exactly
as it does for an account Messages has never heard of.

The check is not a yes/no question we can ask these services, because Drive does not
verify passwords itself — it delegates to **Keycloak** (OIDC), and the Keycloak
client Drive uses has direct access grants disabled. So `oidc_login.py` walks
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

### Routes

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

### For the frontend

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

### Running it against a real Drive

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

### Two things that will bite whoever touches this next

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

### Tests

```sh
python manage.py test accounts
```

The flow is tested against a fake transport rather than a running Drive, so the
endings that look like success but are not — the re-rendered login form, the
premature session cookie — are covered; a live instance cannot be made to
produce those on demand.

---

## Français

### Ce que fait cette application

Pass'on n'a pas de comptes à lui. On se connecte avec l'email et le mot de passe
déjà utilisés pour **Drive**, nous demandons à l'instance Drive locale si la
combinaison est bonne, et si oui la personne est connectée à notre application.
Rien n'est stocké ici d'un utilisateur : ni compte, ni mot de passe, ni même une
copie.

Les mêmes identifiants sont ensuite essayés sur **Messages**, qui fait tourner
son propre Keycloak avec sa propre liste d'utilisateurs. Cette tentative est au
mieux : elle ne bloque jamais la connexion. Quelqu'un qui n'existe que dans Drive
se connecte quand même, et n'a simplement pas ses mails dans sa passation ; le
champ `services` de la réponse dit lesquels ont répondu, pour que l'interface
puisse expliquer un résultat partiel au lieu d'en montrer moins sans rien dire.

Cette seconde connexion est purement et simplement sautée lorsque le
déploiement ne lit pas le mail (`DINUM_ENABLED_SERVICES`, voir
[connectors](../connectors/README.md#quels-services-sont-lus--dinum_enabled_services))
: ouvrir une session Messages que rien n'ira lire ne coûterait qu'un parcours
OIDC de plus à chaque connexion. `services.messages` revient alors à `false`,
exactement comme pour un compte que Messages ne connaît pas.

La vérification n'est pas une question oui/non que l'on puisse poser à ces
services : Drive ne vérifie pas les mots de passe lui-même, il délègue à
**Keycloak** (OIDC), et le client Keycloak qu'il utilise a les « direct access
grants » désactivés. `oidc_login.py` parcourt donc la même chaîne de redirections
qu'un navigateur :

```
POST /api/auth/login/ {email, password}
        |
        v
  GET  <drive>/api/v1.0/authenticate/    -> 302 vers Keycloak
  GET  <keycloak>/realms/drive/...       -> le formulaire de connexion HTML
  POST <action du formulaire>            -> 302 vers le callback de Drive
  GET  <drive>/api/v1.0/callback/...     -> pose le cookie drive_sessionid
  GET  <drive>/api/v1.0/users/me/        -> confirme et dit qui c'est
        |
        v
  notre session : {drive_session: <cookie>, user: {id, email, full_name}}
```

L'effet utile est dans la dernière case. Ce que produit ce parcours est une vraie
session Drive, c'est-à-dire exactement l'identifiant dont `connectors/` a besoin
pour lire les fichiers de cette personne. **Se connecter et pouvoir lire ses
documents sont la même opération** : `connectors/views.py` retombe sur le cookie
stocké, si bien qu'un appelant connecté n'a pas à fournir `X-Drive-Session`.

L'identité affichée dans l'interface est celle que Drive rapporte, jamais une que
nous inventerions.

### Routes

| Route | Méthode | Réponses |
| --- | --- | --- |
| `/api/auth/login/` | POST | `200 {"user": {...}, "services": {"drive": true, "messages": false}}`, ou `401 {"error": "invalid_credentials"}` |
| `/api/auth/logout/` | POST | `200 {}` — toujours |
| `/api/auth/me/` | GET | `200 {"user": {...}, "services": {...}}` ou `401 {"error": "not_authenticated"}` |

`services` indique pour quels services la session détient un identifiant. C'est
Drive qui décide de la connexion ; un `false` pour Messages signifie que le
compte n'existe pas dans son Keycloak, ou que Messages ne tourne pas.

La connexion répond aussi `400 invalid_request` pour un corps malformé,
`502 drive_unreachable` / `unexpected_response` quand Drive est injoignable ou se
comporte autrement que prévu, et `504 drive_timeout`.

La déconnexion ne ferme que notre session. Celle de Drive est laissée telle
quelle : nous ne l'avons pas créée dans le navigateur de la personne, et d'autres
onglets s'en servent peut-être.

### Côté frontend

La session vit dans un cookie : les deux routes POST demandent donc un jeton
CSRF, selon le mécanisme standard de Django.

1. `GET /api/auth/me/` au démarrage. Cet appel restaure la session après un
   rechargement **et** pose le cookie `csrftoken`.
2. Renvoyer la valeur de ce cookie dans l'en-tête `X-CSRFToken` sur
   `POST /api/auth/login/` et `POST /api/auth/logout/`.
3. Utiliser `credentials: "same-origin"` sur chaque appel, pour que les cookies
   circulent.

Cela fonctionne parce que nginx place l'appli et l'API sur une seule origine
(voir `src/server/README.md`). Sans l'en-tête CSRF, les POST répondent `403`.

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

Le frontend est branché sur ces routes : `src/frontend/src/api/auth.js` fait les
appels et `src/frontend/src/context/AuthContext.jsx` tient la session.

La réponse porte le rôle. Drive n'en a aucune notion : chaque connexion relie
donc l'identité Drive à une ligne de notre propre base (`collaborators.py`,
`passon.Collaborator`) et renvoie l'`accountRole` de la personne, son manager et
— pour un manager — son équipe. Une première connexion crée la fiche en tant
qu'employé ; `manage.py set_role <email> manager` nomme quelqu'un manager, et le
rôle n'est jamais écrasé par une connexion ultérieure.

Une fiche créée par un manager avant que la personne se soit connectée n'a pas
d'`external_id` ; la première connexion la reprend par l'email, si bien que le
poste et le rattachement saisis à l'avance sont conservés.

### Le faire tourner face à un vrai Drive

Drive doit tourner localement, et `src/backend/.env` doit pointer dessus :

```sh
DRIVE_URL=http://host.docker.internal:8071   # depuis Docker
# DRIVE_URL=http://localhost:8071            # Django lancé directement
DINUM_USE_MOCK=false
```

Se connecter avec un utilisateur du realm Keycloak de Drive —
`drive@drive.world` / `drive`, `paige.turner@library.book` / `pass` (voir
`drive/docker/auth/realm.json`).

**Pour avoir aussi les mails**, la même adresse et le même mot de passe doivent
exister dans le Keycloak de Messages (`messages/src/keycloak/realm.json`,
initialisé avec `user1@example.local` … `user3@example.local` — aucun recouvrement
avec ceux de Drive). Créez le compte là-bas avec les mêmes identifiants et une
seule connexion couvre les deux ; sinon `services.messages` reste `false` et la
passation ne contient aucun mail.

Les sessions sont stockées dans postgres : les migrations doivent donc avoir été
appliquées. Le point d'entrée du conteneur s'en charge à chaque démarrage, quelle
que soit la façon de lancer le projet (`make up` ou `make run` sélectionnent des
services du même `docker-compose.yml`, donc la même base).

#### Mode mock

Avec `DINUM_USE_MOCK=true`, `mock_accounts.py` prend le relais et Drive n'est
jamais contacté — mêmes comptes de démonstration et mêmes mots de passe, pour que
l'interface se comporte à l'identique. Un mauvais mot de passe est toujours
refusé : un mode mock où n'importe quel mot de passe passerait serait un piège le
jour où le drapeau resterait activé quelque part où il ne devrait pas.

### Deux choses qui piégeront la prochaine personne

**Chaque service construit son `redirect_uri` à partir de l'en-tête `Host` que
nous envoyons.** Joindre Drive en `host.docker.internal:8071` depuis un conteneur
lui fait donc fabriquer un `redirect_uri` en
`http://host.docker.internal:8071/...`, qui ne figure pas parmi les URI
enregistrées du client, et Keycloak répond *« Invalid parameter: redirect_uri »*.
Chaque requête part donc vers l'hôte de `DRIVE_URL` tout en annonçant
`DINUM_PUBLIC_HOST` (`localhost` par défaut) dans son en-tête `Host`. Il en va de
même pour Messages, d'où une seule fonction pour les deux. Sur une machine où
Django tourne hors Docker, les deux sont `localhost` et rien de tout cela n'a
d'effet.

**Ni un 200 ni un cookie de session ne prouvent que la connexion a réussi.** Un
mauvais mot de passe fait répondre `200` à Keycloak, avec le formulaire réaffiché,
et Drive pose un cookie `drive_sessionid` dès le *début* du parcours pour y garder
l'état OIDC : le cookie existe donc avant qu'un mot de passe ait été vérifié. Le
succès n'est confirmé que par `/api/v1.0/users/me/` répondant 200.
`/api/v1.0/items/` ne peut pas servir à cela : il répond `200` avec une liste vide
à un appelant anonyme, et accepterait donc une connexion ratée. C'est exactement
ce que vérifie `drive_client.login()` dans `connectors/`, ce qui mériterait d'être
revu.

### Tests

```sh
python manage.py test accounts
```

Le parcours est testé face à un transport factice plutôt qu'à un Drive qui
tourne : les fins qui ressemblent à un succès sans en être un — le formulaire
réaffiché, le cookie de session prématuré — sont ainsi couvertes, une instance
réelle ne pouvant pas les produire sur commande.
