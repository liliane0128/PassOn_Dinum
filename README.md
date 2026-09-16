<p align="center">
  <a href="https://github.com/liliane0128/Relais_Dinum">
    <img alt="Pass'on" src="src/frontend/src/assets/suite-logo.svg" width="120" />
  </a>
</p>

<p align="center">
  <a href="https://github.com/liliane0128/Relais_Dinum/stargazers/">
    <img src="https://img.shields.io/github/stars/liliane0128/Relais_Dinum" alt="Stars" />
  </a>
  <a href="https://github.com/liliane0128/Relais_Dinum/blob/main/LICENSE">
    <img alt="MIT License" src="https://img.shields.io/github/license/liliane0128/Relais_Dinum" />
  </a>
</p>

<p align="center">
  <a href="#english">English</a> · <a href="#français">Français</a>
</p>

<p align="center">
  <a href="src/backend/connectors/README.md">Connectors</a> ·
  <a href="src/backend/accounts/README.md">Accounts</a> ·
  <a href="src/backend/passon/README.md">Schema</a> ·
  <a href="docs/deploiement.md">Deployment</a>
</p>

# Pass'on: Handover Assistant

---

## English

**Pass'on reads a colleague's Docs, Drive and Messages to generate a structured handover sheet — powered by an LLM.**

### Why use Pass'on ❓

* 📋 Pulls documents, files and emails from the three La Suite services automatically
* 🤖 Extracts six structured handover sections via LLM (needs `GROQ_API_KEY`)
* 🔑 Login with your existing Drive account — no separate account needed
* 🛡️ Runs on mock data without any upstream service for quick local testing
* 🗄️ Stores collaborators and handover sheets in a local Postgres database

### Getting started 🔧

**Prerequisites:** Docker, Docker Compose, GNU Make.

```bash
make up
```

Builds and starts nginx + Django + Postgres. The full app is on **http://localhost:8090**.

| URL | Served by |
|-----|-----------|
| `/`, `/manager`, `/moi` | React frontend |
| `/api/…` | Django backend |
| `/admin/`, `/static/` | Django admin |

On first run, copy the env templates:

```bash
cp template.env .env
cp src/backend/.env.example src/backend/.env
```

By default `DINUM_USE_MOCK=true` — the app runs on demo data without Docs, Drive or Messages.

### Login

Pass'on has no accounts of its own. Log in with your **Drive** credentials:

```
POST /api/auth/login/   {"email": "...", "password": "..."}
```

The same credentials are then tried against Messages, so one login can cover both.
Roles are ours rather than Drive's: `manage.py set_role <email> manager` is how a
manager account comes to exist.

### Useful commands

```bash
make up      # build and start the full stack
make down    # stop everything
make logs    # follow logs

make run     # backend only (Django on http://localhost:8000)
make stop    # stop backend stack
make build   # rebuild images
```

Frontend dev server (hot reload, `/api` proxied to :8090):

```bash
cd src/frontend && npm install && npm run dev
# → http://localhost:5173
```

### Running alongside upstream services 🔌

Pass'on reads real data from **Docs**, **Drive** and **Messages**. Each is an independent Docker Compose stack. These are each project's own defaults, as published by their compose files:

| Service | API | Frontend | Keycloak |
|---------|-----|----------|----------|
| Drive | http://localhost:8071 | http://localhost:3000 | localhost:8083 (8080 direct) |
| Messages | http://localhost:8901 | http://localhost:8900 | localhost:8902 |
| Docs | http://localhost:8071 | http://localhost:3000 | — |

> [!WARNING]
> **Docs and Drive both default to 8071**, and both serve a frontend on 3000.
> Running the two together means moving one of them and setting `DOCS_URL` or
> `DRIVE_URL` accordingly — otherwise calls meant for one land on the other.
> Only Drive and Messages are needed for login and for generating a handover.

> [!NOTE]
> Drive's Keycloak occupies **8080**, which is why Pass'on serves on 8090.

> [!TIP]
> **[docs/deploiement.md](docs/deploiement.md)** covers this end to end: start-up
> order, creating an account that works in both Keycloaks (Messages disables
> registration and refuses to create a user whose email domain is not
> "autojoin"), and a table mapping each failure message to its cause. Most of it
> is not guessable.

```bash
# Docs
cd /path/to/docs && make bootstrap FLUSH_ARGS='--no-input' && make run

# Drive
cd /path/to/drive && make bootstrap && make demo && make run

# Messages
cd /path/to/messages && make bootstrap
# then seed demo mail:
docker compose exec -e DJANGO_CONFIGURATION=E2E backend-dev-light \
    python manage.py e2e_demo
```

Default credentials, and the session cookie each service issues:

| Service | Username | Password | Cookie |
|---------|----------|----------|--------|
| Docs | `impress` | `impress` | `docs_sessionid` |
| Drive | `drive` | `drive` | `drive_sessionid` |
| Messages | `user1@example.local` | `user1` | `st_messages_sessionid` |

> [!WARNING]
> Set `DINUM_USE_MOCK=false` and `DRIVE_URL` in `src/backend/.env` before connecting to a real Drive instance.
> See [the accounts doc](src/backend/accounts/README.md) for the CSRF handshake and Keycloak quirks.

### Database 🗄️

One Postgres instance, shared by both stacks (`make up` and `make run`).

| Table | What |
|-------|------|
| `Collaborator` | One row per person — role, team, reporting line |
| `Handover` | Handover sheet: free text + six structured sections, validated or not |
| `CollaboratorItem` | Snapshot of someone's documents and mail, so their manager can read them |

To seed demo data in Drive and Messages:

```bash
docker compose exec web python manage.py seed_demo --email ... --password ...
```

It uploads five documents to that person's Drive and delivers six mails to their
mailbox, written so every section of the generated handover has something to find.
See [demo_data](src/backend/passon/demo_data/README.md).

### Contributing 🙌

PRs are welcome — open an issue to discuss anything substantial first.

Per-area documentation: [connectors](src/backend/connectors/README.md) (upstream
clients and the LLM pipeline), [accounts](src/backend/accounts/README.md) (login),
[schema](src/backend/passon/README.md) (collaborators and handovers),
[server](src/server/README.md) (nginx and the single-origin setup),
[frontend](src/frontend/DOCUMENTATION.md).

Every document here is bilingual: an English half, then a French one. When you
change one, change the other in the same commit — a translation left behind is
worse than none, because it is believed.

### License 📝

Released under the [MIT License](LICENSE).

---

## Français

**Pass'on lit les Docs, le Drive et les Messages d'un collègue pour générer une fiche de passation structurée, à l'aide d'un LLM.**

### À quoi ça sert ❓

* 📋 Récupère automatiquement documents, fichiers et mails des trois services de La Suite
* 🤖 En extrait six rubriques de passation via un LLM (nécessite `GROQ_API_KEY`)
* 🔑 Connexion avec le compte Drive existant — aucun compte supplémentaire
* 🛡️ Fonctionne sur des données de démonstration, sans aucun service externe
* 🗄️ Stocke collaborateurs et passations dans une base Postgres locale

### Démarrer 🔧

**Prérequis :** Docker, Docker Compose, GNU Make.

```bash
make up
```

Construit et démarre nginx + Django + Postgres. L'application complète est sur **http://localhost:8090**.

| URL | Servi par |
|-----|-----------|
| `/`, `/manager`, `/moi` | le frontend React |
| `/api/…` | le backend Django |
| `/admin/`, `/static/` | l'admin Django |

Au premier lancement, copier les fichiers d'exemple :

```bash
cp template.env .env
cp src/backend/.env.example src/backend/.env
```

Par défaut `DINUM_USE_MOCK=true` : l'application tourne sur des données de démonstration, sans Docs, Drive ni Messages.

### Connexion

Pass'on n'a pas de comptes à lui. On se connecte avec ses identifiants **Drive** :

```
POST /api/auth/login/   {"email": "...", "password": "..."}
```

Les mêmes identifiants sont ensuite essayés sur Messages, pour qu'une seule
connexion couvre les deux. Les rôles, eux, sont les nôtres et non ceux de Drive :
`manage.py set_role <email> manager` est ce qui crée un compte manager.

### Commandes utiles

```bash
make up      # construit et démarre la pile complète
make down    # arrête tout
make logs    # suit les journaux

make run     # backend seul (Django sur http://localhost:8000)
make stop    # arrête la pile backend
make build   # reconstruit les images
```

Serveur de développement du frontend (rechargement à chaud, `/api` relayé vers :8090) :

```bash
cd src/frontend && npm install && npm run dev
# → http://localhost:5173
```

### Fonctionner à côté des services de La Suite 🔌

Pass'on lit de vraies données dans **Docs**, **Drive** et **Messages**. Chacun est une pile Docker Compose indépendante. Voici les ports par défaut de chaque projet, tels que publiés par leurs fichiers compose :

| Service | API | Interface | Keycloak |
|---------|-----|-----------|----------|
| Drive | http://localhost:8071 | http://localhost:3000 | localhost:8083 (8080 en direct) |
| Messages | http://localhost:8901 | http://localhost:8900 | localhost:8902 |
| Docs | http://localhost:8071 | http://localhost:3000 | — |

> [!WARNING]
> **Docs et Drive utilisent tous deux 8071** par défaut, et servent tous deux une
> interface sur 3000. Les faire tourner ensemble suppose d'en déplacer un et
> d'ajuster `DOCS_URL` ou `DRIVE_URL` — sinon les appels destinés à l'un
> arrivent sur l'autre. Seuls Drive et Messages sont nécessaires pour se
> connecter et générer une passation.

> [!NOTE]
> Le Keycloak de Drive occupe **8080** : c'est pourquoi Pass'on est servi sur 8090.

> [!TIP]
> **[docs/deploiement.md](docs/deploiement.md)** détaille tout cela : ordre de
> démarrage, création d'un compte qui fonctionne dans les deux Keycloak
> (Messages désactive l'inscription et refuse de créer un utilisateur dont le
> domaine d'adresse n'est pas « autojoin »), et un tableau reliant chaque message
> d'erreur à sa cause. L'essentiel ne se devine pas.

```bash
# Docs
cd /chemin/vers/docs && make bootstrap FLUSH_ARGS='--no-input' && make run

# Drive
cd /chemin/vers/drive && make bootstrap && make demo && make run

# Messages
cd /chemin/vers/messages && make bootstrap
# puis charger les mails de démonstration :
docker compose exec -e DJANGO_CONFIGURATION=E2E backend-dev-light \
    python manage.py e2e_demo
```

Identifiants par défaut, et cookie de session posé par chaque service :

| Service | Identifiant | Mot de passe | Cookie |
|---------|-------------|--------------|--------|
| Docs | `impress` | `impress` | `docs_sessionid` |
| Drive | `drive` | `drive` | `drive_sessionid` |
| Messages | `user1@example.local` | `user1` | `st_messages_sessionid` |

> [!WARNING]
> Mettre `DINUM_USE_MOCK=false` et renseigner `DRIVE_URL` dans `src/backend/.env` avant de se connecter à une vraie instance Drive.
> Voir [la documentation des comptes](src/backend/accounts/README.md) pour la poignée de main CSRF et les particularités de Keycloak.

### Base de données 🗄️

Une seule instance Postgres, partagée par les deux façons de lancer le projet (`make up` et `make run`).

| Table | Contenu |
|-------|---------|
| `Collaborator` | une ligne par personne — rôle, équipe, rattachement hiérarchique |
| `Handover` | la passation : texte libre + six rubriques structurées, validée ou non |
| `CollaboratorItem` | photo des documents et mails d'une personne, pour que son manager les lise |

Pour déposer les données de démonstration dans Drive et Messages :

```bash
docker compose exec web python manage.py seed_demo --email ... --password ...
```

La commande dépose cinq documents dans le Drive de la personne et six mails dans
sa boîte, écrits pour que chaque rubrique de la passation générée ait de quoi se
remplir. Voir [demo_data](src/backend/passon/demo_data/README.md).

### Contribuer 🙌

Les PR sont bienvenues — ouvrez une issue d'abord pour tout changement conséquent.

Documentation par domaine : [connectors](src/backend/connectors/README.md) (les
clients des services et la chaîne LLM), [accounts](src/backend/accounts/README.md)
(la connexion), [schéma](src/backend/passon/README.md) (collaborateurs et
passations), [serveur](src/server/README.md) (nginx et l'origine unique),
[frontend](src/frontend/DOCUMENTATION.md).

Tous les documents de ce dépôt sont bilingues : une moitié en anglais, puis une
moitié en français. Quand vous modifiez l'une, modifiez l'autre dans le même
commit — une traduction laissée en arrière est pire que pas de traduction, parce
qu'on la croit.

### Licence 📝

Publié sous [licence MIT](LICENSE).

---

## Gov ❤️ open source

Pass'on is part of the **La Suite Numérique** ecosystem, a joint initiative led by [DINUM](https://www.numerique.gouv.fr/dinum/).

Pass'on s'inscrit dans l'écosystème de **La Suite Numérique**, initiative portée par la [DINUM](https://www.numerique.gouv.fr/dinum/).
