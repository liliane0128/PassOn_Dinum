# Deploying Pass'on alongside Drive and Messages
# Déployer Pass'on à côté de Drive et Messages

*[English](#english) · [Français](#français)*

---

## English

Pass'on stores neither accounts nor documents: it connects to **Drive** and
**Messages** with the credentials of whoever is using it. Running it therefore
requires those two services alongside, and above all an account that exists in
both. That is where every pitfall is, and this document lists them in the order
you meet them.

Everything below describes a **local development** install, the one the team
uses. Nothing here is a production configuration.

---

### 1. What runs, and on which port

| Port | Service | Project |
| --- | --- | --- |
| **8090** | **Pass'on** — everything: landing page, application and API, behind nginx | this repository |
| 3001 | The frontend (Next.js), inside its own container; reached by nginx, not published | this repository |
| 8000 | The Pass'on API alone, on 127.0.0.1 (curl, tests) | this repository |
| 3000 | Drive — interface | `drive` |
| 8071 | Drive — API | `drive` |
| 8083 | Drive — Keycloak, login pages | `drive` |
| 8080 | Drive — Keycloak directly | `drive` |
| 8900 | Messages — interface | `messages` |
| 8901 | Messages — API | `messages` |
| 8902 | Messages — Keycloak | `messages` |

> **Pass'on is on 8090 and not on 8080** because Drive's Keycloak already
> occupies 8080. The two cannot start together otherwise.

Drive also exposes MinIO (9000/9001), mailcatcher (1081), Collabora (9980),
OnlyOffice (9981) and its databases (6433/6434). Messages exposes its database on
8912.

---

### 2. Starting the three projects

The three repositories sit side by side (`~/hackathon/drive`,
`~/hackathon/messages`, `~/hackathon/PassOn_Dinum`). The order matters: Pass'on
queries the other two as soon as someone logs in.

```bash
# 1. Drive — first time only
cd ~/hackathon/drive
make bootstrap            # images, database, Keycloak realm, lasuite network

# then on every start
make run-backend          # API + Keycloak + storage, without the interface
make run                  # the same plus the interface on :3000

# 2. Messages — first time only
cd ~/hackathon/messages
make bootstrap
make superuser            # also creates the autojoin domain example.local

# then
make start                # backend, worker, frontend, Keycloak

# 3. Pass'on
cd ~/hackathon/PassOn_Dinum
make up                   # postgres + Django + nginx  ->  http://localhost:8090
```

`make run` on the Drive side builds a Next.js interface: the first load of
`:3000` takes about fifteen seconds, which is not a hang.

On the Pass'on side, `make up` starts everything; `make run` starts only postgres
and Django, for working on the API alone. **If `:8090` does not answer, it is
usually because nginx is not running** — that is, `make run` was used instead of
`make up`.

---

### 3. Configuring Pass'on

A single file: `src/backend/.env`, created from `.env.example` on the first
`make up`. What matters:

```sh
DRIVE_URL=http://host.docker.internal:8071
MESSAGES_URL=http://host.docker.internal:8901
MESSAGES_SESSION_COOKIE=st_messages_sessionid
DINUM_USE_MOCK=false          # true = demo data, no service required
DINUM_MOCK_DATASET=           # in mock mode: empty = the small built-in set,
                              # "synthetic_handover_catnat" = a full project
GROQ_API_KEY=...              # free key: https://console.groq.com/keys
GROQ_MODEL=openai/gpt-oss-20b
```

Three things to know:

- **`host.docker.internal`, not `localhost`.** Django runs in a container, where
  `localhost` means the container itself. For a Django started directly on the
  machine, use `localhost`.
- **`GROQ_MODEL`: `20b` is enough on small volumes, `120b` copes better.** Groq's
  free ceiling is 8 000 tokens per minute, request *and* answer included: too
  large a request is refused (413), and one that barely fits leaves too little
  room for the JSON, which comes back truncated and invalid. The default `20b`
  manages on a dozen items; it failed every time when the prompt was twice as
  large. On repeated failures, switch to `120b` or lower `MAX_CONTENT_CHARS`
  (`connectors/generation.py`).
- **`DOCS_URL` points at 8071, like Drive.** Docs is not deployed here; if you
  ever add it, move one of the two ports, otherwise Docs calls will land on
  Drive.

`DINUM_USE_MOCK=true` lets the whole application run without Drive or Messages,
on fictional data: useful for working on the interface.

---

### 4. Accounts: the part that trips people up

Pass'on has Drive check the password, then tries Messages with the same
credentials. **Each service has its own Keycloak, with its own accounts**: an
account created in one does not exist in the other.

For a single login to give access to documents *and* mails, the same email and
the same password must therefore exist on both sides.

#### On the Drive side

Self-registration is enabled: `http://localhost:3000` → log in →
**Register**.

#### On the Messages side

Two obstacles, in this order:

**a. Registration is disabled by default.** To enable it once and for all:

```bash
docker exec st-messages-keycloak-1 /opt/keycloak/bin/kcadm.sh config credentials \
  --server http://localhost:8802 --realm master \
  --client bootstrap-admin --secret BootstrapAdminClientSecretForDev

docker exec st-messages-keycloak-1 /opt/keycloak/bin/kcadm.sh update realms/messages \
  -s registrationAllowed=true -s resetPasswordAllowed=true
```

Use the `bootstrap-admin` client, not `admin`/`admin`: that account is "not fully
set up" and its password is refused until it has been changed in the console.

Then: `http://localhost:8900` → log in → **Register**.

**b. Messages refuses to create the local user.** It runs with
`OIDC_CREATE_USER=False`: a successful Keycloak authentication is not enough, the
**domain of the address** must be declared "autojoin". Otherwise the login fails
silently — a redirect to a page identical to the successful one, and
`/api/v1.0/users/me/` answering 401.

Once per domain:

```bash
cd ~/hackathon/messages
docker compose exec backend-dev-light python manage.py shell -c \
  "from core.models import MailDomain; MailDomain.objects.get_or_create(\
  name='mydomain.fr', defaults={'oidc_autojoin': True, 'identity_sync': True})"
```

`example.local` is already declared by `make superuser`. An address in
`@example.local` therefore needs nothing more.

#### Checking

Log in at `http://localhost:8090`. The login response contains:

```json
{"user": {...}, "services": {"drive": true, "messages": true}}
```

`messages: false` means the account does not exist in the Messages Keycloak, or
that the domain is not autojoin: the person is logged in all the same, they will
simply have no mails in their handover.

---

### 5. Giving it something to summarize

A handover is generated from real documents and real mails. A fresh account has
neither, and generation then answers `no_data_to_summarize` — that is not a
failure.

```bash
cd ~/hackathon/PassOn_Dinum
docker compose exec web python manage.py seed_demo \
  --email you@mydomain.fr --password '...'
```

This command puts five documents in the person's Drive and six mails in their
mailbox, written so that every section of the handover has something to fill it.
Details in
[`src/backend/passon/demo_data/README.md`](../src/backend/passon/demo_data/README.md).

### 6. Creating a manager

The role only exists on our side; Drive knows nothing about it:

```bash
docker compose exec web python manage.py set_role you@mydomain.fr manager
```

The person does not need to have logged in already: the record is created without
a Drive identifier, and their first login attaches it to their account by email.

---

### 7. Common failures, and what they mean

| Symptom | Cause |
| --- | --- |
| `:8090` does not answer | nginx is not running — `make up`, not `make run` |
| Login refused with the right credentials | account missing from Drive's Keycloak |
| `services.messages: false` | account missing from the Messages Keycloak, or domain not autojoin |
| `no_data_to_summarize` | no document and no mail on this account — `seed_demo` |
| `llm_not_configured` | `GROQ_API_KEY` is empty |
| Generation failing every other time | Groq's 8 000 tokens/minute ceiling: one generation per minute |
| Empty directory when searching | the Drive session has expired — log in again; the full address can still be typed |
| A collaborator's documents empty in the manager view | they have not logged in since those documents were uploaded: their documents are collected at *their* login |

---

### 8. Why the code addresses the services the way it does

Three quirks come up everywhere and each cost a debugging session. They are
documented next to the code concerned, and summarized here so they can be
recognized.

**The host announced matters as much as the host reached.** Drive and Messages
build their `redirect_uri` from the `Host` header they receive. Reached at
`host.docker.internal`, they produce a URL Keycloak never registered and refuse
the login ("Invalid parameter: redirect_uri"). Requests are therefore sent to the
reachable host **while announcing** `DINUM_PUBLIC_HOST` (`localhost` by default).
See [`src/backend/accounts/README.md`](../src/backend/accounts/README.md).

**nginx must pass `Host` along with its port.** Django compares the browser's
`Origin` header with its own host to check CSRF: without the port, every login is
refused with a 403. `curl` sends no `Origin` and therefore never reveals this
problem. See [`src/server/README.md`](../src/server/README.md).

**Messages sets no CSRF cookie.** It runs with `CSRF_USE_SESSIONS`: the token is
returned by `/api/v1.0/users/me/`, and any write without that token is refused.

---

## Français

Pass‘on ne stocke ni compte ni document : il se connecte à **Drive** et à
**Messages**, avec les identifiants de la personne qui l'utilise. Le faire
tourner demande donc ces deux services à côté, et surtout un compte qui existe
dans les deux. C'est là que se trouvent tous les pièges, et ce document les
liste dans l'ordre où on les rencontre.

Tout ce qui suit décrit une installation **locale de développement**, celle
qu'utilise l'équipe. Rien ici n'est une configuration de production.

---

### 1. Ce qui tourne, et sur quel port

| Port | Service | Projet |
| --- | --- | --- |
| **8090** | **Pass‘on** — tout : page d'accueil, application et API, derrière nginx | ce dépôt |
| 3001 | Le frontend (Next.js), dans son propre conteneur ; joint par nginx, non publié | ce dépôt |
| 8000 | API Pass‘on seule, sur 127.0.0.1 (curl, tests) | ce dépôt |
| 3000 | Drive — interface | `drive` |
| 8071 | Drive — API | `drive` |
| 8083 | Drive — Keycloak, pages de connexion | `drive` |
| 8080 | Drive — Keycloak en direct | `drive` |
| 8900 | Messages — interface | `messages` |
| 8901 | Messages — API | `messages` |
| 8902 | Messages — Keycloak | `messages` |

> **Pass‘on est sur 8090 et pas sur 8080** parce que le Keycloak de Drive
> occupe déjà 8080. Les deux ne peuvent pas démarrer ensemble autrement.

Drive expose aussi MinIO (9000/9001), mailcatcher (1081), Collabora (9980),
OnlyOffice (9981) et ses bases (6433/6434). Messages expose sa base sur 8912.

---

### 2. Démarrer les trois projets

Les trois dépôts sont voisins (`~/hackathon/drive`, `~/hackathon/messages`,
`~/hackathon/PassOn_Dinum`). L'ordre a son importance : Pass‘on interroge les
deux autres dès la connexion.

```bash
# 1. Drive — la première fois seulement
cd ~/hackathon/drive
make bootstrap            # images, base, realm Keycloak, réseau lasuite

# puis à chaque démarrage
make run-backend          # API + Keycloak + stockage, sans l'interface
make run                  # idem + l'interface sur :3000

# 2. Messages — la première fois seulement
cd ~/hackathon/messages
make bootstrap
make superuser            # crée aussi le domaine autojoin example.local

# puis
make start                # backend, worker, frontend, Keycloak

# 3. Pass‘on
cd ~/hackathon/PassOn_Dinum
make up                   # postgres + Django + nginx  ->  http://localhost:8090
```

`make run` côté Drive compile une interface Next.js : le premier chargement de
`:3000` prend une quinzaine de secondes, ce n'est pas un blocage.

Côté Pass‘on, `make up` lance tout ; `make run` ne lance que postgres et
Django, pour travailler sur l'API seule. **Si `:8090` ne répond pas, c'est
généralement que nginx n'est pas démarré** — donc que `make run` a été lancé à
la place de `make up`.

---

### 3. Configurer Pass‘on

Un seul fichier : `src/backend/.env`, créé depuis `.env.example` au premier
`make up`. Ce qui compte :

```sh
DRIVE_URL=http://host.docker.internal:8071
MESSAGES_URL=http://host.docker.internal:8901
MESSAGES_SESSION_COOKIE=st_messages_sessionid
DINUM_USE_MOCK=false          # true = données de démo, aucun service requis
DINUM_MOCK_DATASET=           # en mode mock : vide = petit jeu intégré,
                              # "synthetic_handover_catnat" = projet complet
GROQ_API_KEY=...              # clé gratuite : https://console.groq.com/keys
GROQ_MODEL=openai/gpt-oss-20b
```

Trois choses à savoir :

- **`host.docker.internal`, pas `localhost`.** Django tourne dans un conteneur,
  où `localhost` désigne le conteneur lui-même. Pour un Django lancé
  directement sur la machine, mettre `localhost`.
- **`GROQ_MODEL` : `20b` suffit sur de petits volumes, `120b` tient mieux la
  charge.** Le plafond gratuit de Groq est de 8 000 jetons par minute, requête
  *et* réponse comprises : une demande trop grosse est refusée (413), et une
  demande qui passe de justesse laisse trop peu de place au JSON, qui revient
  tronqué et invalide. Le `20b` par défaut y arrive sur une dizaine
  d'éléments ; il échouait systématiquement quand l'invite était deux fois plus
  grosse. En cas d'échec répété, passez au `120b` ou réduisez
  `MAX_CONTENT_CHARS` (`connectors/generation.py`).
- **`DOCS_URL` pointe sur 8071, comme Drive.** Docs n'est pas déployé ici ;
  si vous l'ajoutez un jour, déplacez l'un des deux ports, sinon les appels
  Docs arriveront sur Drive.

`DINUM_USE_MOCK=true` permet de faire tourner l'application entière sans Drive
ni Messages, avec des données fictives : utile pour travailler sur l'interface.

---

### 4. Les comptes : le point qui coince

Pass‘on vérifie le mot de passe auprès de Drive, puis tente Messages avec les
mêmes identifiants. **Chaque service a son propre Keycloak, avec ses propres
comptes** : un compte créé dans l'un n'existe pas dans l'autre.

Pour qu'une seule connexion donne accès aux documents *et* aux mails, il faut
donc le même email et le même mot de passe des deux côtés.

### Côté Drive

L'inscription libre est activée : `http://localhost:3000` → se connecter →
**Register**.

### Côté Messages

Deux obstacles, dans cet ordre :

**a. L'inscription est désactivée par défaut.** Pour l'activer une fois pour
toutes :

```bash
docker exec st-messages-keycloak-1 /opt/keycloak/bin/kcadm.sh config credentials \
  --server http://localhost:8802 --realm master \
  --client bootstrap-admin --secret BootstrapAdminClientSecretForDev

docker exec st-messages-keycloak-1 /opt/keycloak/bin/kcadm.sh update realms/messages \
  -s registrationAllowed=true -s resetPasswordAllowed=true
```

Utiliser le client `bootstrap-admin`, pas `admin`/`admin` : ce compte est
« not fully set up » et son mot de passe est refusé tant qu'il n'a pas été
changé dans la console.

Ensuite : `http://localhost:8900` → se connecter → **Register**.

**b. Messages refuse de créer l'utilisateur local.** Il tourne avec
`OIDC_CREATE_USER=False` : une authentification Keycloak réussie ne suffit pas,
il faut que **le domaine de l'adresse** soit déclaré « autojoin ». Sinon la
connexion échoue en silence — redirection vers une page identique à celle du
succès, et `/api/v1.0/users/me/` répond 401.

Une fois par domaine :

```bash
cd ~/hackathon/messages
docker compose exec backend-dev-light python manage.py shell -c \
  "from core.models import MailDomain; MailDomain.objects.get_or_create(\
  name='mondomaine.fr', defaults={'oidc_autojoin': True, 'identity_sync': True})"
```

`example.local` est déjà déclaré par `make superuser`. Une adresse en
`@example.local` ne demande donc rien de plus.

### Vérifier

Connectez-vous sur `http://localhost:8090`. La réponse de connexion contient :

```json
{"user": {...}, "services": {"drive": true, "messages": true}}
```

`messages: false` signifie que le compte n'existe pas dans le Keycloak de
Messages, ou que le domaine n'est pas autojoin : la personne est bien connectée,
elle n'aura simplement pas ses mails dans sa passation.

---

### 5. Donner de la matière à résumer

Une passation se génère à partir de vrais documents et de vrais mails. Un
compte neuf n'a ni l'un ni l'autre, et la génération répond alors
`no_data_to_summarize` — ce n'est pas une panne.

```bash
cd ~/hackathon/PassOn_Dinum
docker compose exec web python manage.py seed_demo \
  --email vous@mondomaine.fr --password '...'
```

Cette commande dépose cinq documents dans le Drive de la personne et six mails
dans sa boîte, écrits pour que chaque section du résumé ait de quoi se
remplir. Détail dans
[`src/backend/passon/demo_data/README.md`](../src/backend/passon/demo_data/README.md).

### 6. Créer un manager

Le rôle n'existe que chez nous, Drive n'en sait rien :

```bash
docker compose exec web python manage.py set_role vous@mondomaine.fr manager
```

La personne n'a pas besoin d'être déjà connectée : la fiche est créée sans
identifiant Drive, et sa première connexion la rattache à son compte par
l'email.

---

### 7. Pannes fréquentes, et ce qu'elles veulent dire

| Symptôme | Cause |
| --- | --- |
| `:8090` ne répond pas | nginx n'est pas lancé — `make up`, pas `make run` |
| Connexion refusée avec les bons identifiants | compte absent du Keycloak de Drive |
| `services.messages: false` | compte absent du Keycloak de Messages, ou domaine non autojoin |
| `no_data_to_summarize` | ni document ni mail sur ce compte — `seed_demo` |
| `llm_not_configured` | `GROQ_API_KEY` vide |
| Génération en échec une fois sur deux | plafond Groq de 8 000 jetons/minute : une génération par minute |
| Annuaire vide à la recherche | session Drive expirée — se reconnecter ; l'adresse complète reste saisissable |
| Documents d'un collaborateur vides côté manager | il ne s'est pas connecté depuis leur dépôt : ses documents sont relevés à *sa* connexion |

---

### 8. Pourquoi le code s'adresse aux services comme il le fait

Trois particularités reviennent partout et ont chacune coûté une séance de
débogage. Elles sont documentées près du code concerné, résumées ici pour
qu'on les reconnaisse.

**L'hôte annoncé compte autant que l'hôte joint.** Drive et Messages
construisent leur `redirect_uri` à partir de l'en-tête `Host` reçu. Joints en
`host.docker.internal`, ils fabriquent une URL que Keycloak n'a jamais
enregistrée et refusent la connexion (« Invalid parameter: redirect_uri »).
Les requêtes sont donc envoyées à l'hôte joignable **en annonçant**
`DINUM_PUBLIC_HOST` (`localhost` par défaut). Voir
[`src/backend/accounts/README.md`](../src/backend/accounts/README.md).

**nginx doit transmettre `Host` avec son port.** Django compare l'en-tête
`Origin` du navigateur à son propre hôte pour vérifier le CSRF : sans le port,
toute connexion est refusée en 403. `curl` n'envoie pas d'`Origin` et ne
révèle donc jamais ce problème. Voir
[`src/server/README.md`](../src/server/README.md).

**Messages ne pose pas de cookie CSRF.** Il tourne avec `CSRF_USE_SESSIONS` :
le jeton est renvoyé par `/api/v1.0/users/me/`, et toute écriture sans ce
jeton est refusée.
