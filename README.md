<p align="center">
  <em>Built for the DINUM × 42 hackathon · Projet réalisé dans le cadre du hackathon DINUM × 42</em>
</p>

<p align="center">
  <a href="https://github.com/liliane0128/PassOn_Dinum/stargazers/">
    <img src="https://img.shields.io/github/stars/liliane0128/PassOn_Dinum" alt="Stars" />
  </a>
  <a href="https://github.com/liliane0128/PassOn_Dinum/blob/main/LICENSE">
    <img alt="MIT License" src="https://img.shields.io/github/license/liliane0128/PassOn_Dinum" />
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

# PassOn: Handover Assistant

---

## English

**PassOn reads a colleague's Docs and Drive to generate a structured handover sheet — powered by an LLM.**

> [!IMPORTANT]
> PassOn is an independent project built **on top of** La Suite numérique. It is
> not affiliated with, endorsed by, or an official product of DINUM or La Suite
> numérique. The La Suite logo appears in the application to mark that
> integration; it belongs to La Suite numérique, not to this project.

### Why use PassOn ❓

* 📋 Pulls documents and files from Docs and Drive automatically
* 🤖 Extracts structured handover sections via LLM
* 🔑 Login with your existing Drive account — no separate account needed
* 🗂️ Résumé lives in a shared Docs file — the agent validates it, the manager can still correct it


### Getting started 🔧

**Prerequisites:** Docker, Docker Compose, GNU Make.

```bash
make up
```

Builds and starts nginx + the frontend + Django + Postgres. Everything is on
**http://localhost:8090**.

Everything is on that one port. The landing page is a static file served from
disk; every other path is proxied, the application to its own container and
`/api/` to Django, so the app and the API share one origin — which is what the
session cookie and Django's CSRF check require.

| URL | Served by |
|-----|-----------|
| `http://localhost:8090/` | the landing page, a static file |
| `http://localhost:8090/dashboard` | the application: generate a handover |
| `http://localhost:8090/gerer-ma-passation` | the handover itself |
| `http://localhost:8090/equipe` | the manager's team view |
| `http://localhost:8090/login` | the login page |
| `http://localhost:8090/api/…` | Django |

The landing page's button asks `/api/auth/me/` who is logged in and goes to the
application or to the login page accordingly; the application redirects to
`/login` on its own if it is opened without a session.

Nothing has to be started by hand: `make up` builds and runs the frontend
alongside nginx, Django and Postgres. For interface work, `npm run dev -- -p
3001` inside `src/frontend` serves it on :3001 — but `/api/` is not proxied
there, so logging in only works through :8090.

On first run, copy the env templates:

```bash
cp template.env .env
cp src/backend/.env.example src/backend/.env
```

By default `DINUM_USE_MOCK=true` — the app runs on demo data without Docs or Drive.

### Login

PassOn has no accounts of its own. Log in with your **Drive** credentials:

```
POST /api/auth/login/   {"email": "...", "password": "..."}
```

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

Frontend dev server, for interface work (hot reload):

```bash
cd src/frontend && npm install && npm run dev -- -p 3001
# → http://localhost:3001 — no /api there, so logging in needs :8090
```

### Running alongside upstream services 🔌

PassOn reads real data from **Docs** and **Drive**. Each is an independent Docker Compose stack. These are each project's own defaults, as published by their compose files:

| Service | API | Frontend | Keycloak |
|---------|-----|----------|----------|
| Drive | http://localhost:8071 | http://localhost:3000 | localhost:8083 (8080 direct) |
| Docs | http://localhost:8071 | http://localhost:3000 | — |

> [!WARNING]
> **Docs and Drive both default to 8071**, and both serve a frontend on 3000.
> Running the two together means moving one of them and setting `DOCS_URL` or
> `DRIVE_URL` accordingly — otherwise calls meant for one land on the other.
> Only Drive is needed for login and for generating a handover.

> [!NOTE]
> Drive's Keycloak occupies **8080**, which is why PassOn serves on 8090.

> [!TIP]
> **[docs/deploiement.md](docs/deploiement.md)** covers this end to end: start-up
> order, creating a working account in Drive's Keycloak, and a table mapping each
> failure message to its cause. Most of it is not guessable.

```bash
# Docs
cd /path/to/docs && make bootstrap FLUSH_ARGS='--no-input' && make run

# Drive
cd /path/to/drive && make bootstrap && make demo && make run
```

Default credentials, and the session cookie each service issues:

| Service | Username | Password | Cookie |
|---------|----------|----------|--------|
| Docs | `impress` | `impress` | `docs_sessionid` |
| Drive | `drive` | `drive` | `drive_sessionid` |

> [!WARNING]
> Set `DINUM_USE_MOCK=false` and `DRIVE_URL` in `src/backend/.env` before connecting to a real Drive instance.
> See [the accounts doc](src/backend/accounts/README.md) for the CSRF handshake and Keycloak quirks.

### Database 🗄️

One Postgres instance, shared by both stacks (`make up` and `make run`).

| Table | What |
|-------|------|
| `Collaborator` | One row per person — role, team, reporting line |
| `Handover` | Handover sheet: free text + six structured sections, validated or not |
| `CollaboratorItem` | Snapshot of someone's documents and files, so their manager can read them |

To seed demo data in Drive:

```bash
docker compose exec web python manage.py seed_demo --email ... --password ...
```

It uploads five documents to that person's Drive, written so every section of
the generated handover has something to find. See
[demo_data](src/backend/passon/demo_data/README.md).

### Contributing 🙌

PRs are welcome — open an issue to discuss anything substantial first.

Per-area documentation: [connectors](src/backend/connectors/README.md) (upstream
clients and the LLM pipeline), [accounts](src/backend/accounts/README.md) (login),
[schema](src/backend/passon/README.md) (collaborators and handovers),
[server](src/server/README.md) (nginx and the single-origin setup),
[frontend](src/frontend/README.md).

Every document here is bilingual: an English half, then a French one. When you
change one, change the other in the same commit — a translation left behind is
worse than none, because it is believed.

### License 📝

Released under the [MIT License](LICENSE).

The MIT licence covers this project's own code. It does not extend to the La
Suite numérique name or logo, nor to any French State emblem, which remain the
property of their holders and are used here only to identify the services
PassOn connects to.

---

## Français

**PassOn lit les Docs et le Drive d'un collègue pour générer une fiche de passation structurée, à l'aide d'un LLM.**

> [!IMPORTANT]
> PassOn est un projet indépendant, construit **par-dessus** La Suite numérique.
> Il n'est ni affilié à la DINUM ou à La Suite numérique, ni approuvé par elles,
> ni un produit officiel. Le logo de La Suite apparaît dans l'application pour
> signaler cette intégration ; il appartient à La Suite numérique, pas à ce
> projet.

### À quoi ça sert ❓

* 📋 Récupère automatiquement documents et fichiers depuis Docs et Drive
* 🤖 En extrait des rubriques de passation structurées via un LLM
* 🔑 Connexion avec le compte Drive existant — aucun compte supplémentaire
* 🗂️ Le résumé vit dans un Docs partagé — l'agent le valide, le manager peut encore le corriger

### Démarrer 🔧

**Prérequis :** Docker, Docker Compose, GNU Make.

```bash
make up
```

Construit et démarre nginx + le frontend + Django + Postgres. Tout est sur
**http://localhost:8090**.

Tout est sur ce port. La page d'accueil est un fichier statique servi depuis le
disque ; tout le reste est relayé, l'application vers son propre conteneur et
`/api/` vers Django, si bien que l'application et l'API partagent une origine —
condition du cookie de session et de la vérification CSRF de Django.

| URL | Servi par |
|-----|-----------|
| `http://localhost:8090/` | la page d'accueil, un fichier statique |
| `http://localhost:8090/dashboard` | l'application : lancer une passation |
| `http://localhost:8090/gerer-ma-passation` | la passation elle-même |
| `http://localhost:8090/equipe` | la vue d'équipe du manager |
| `http://localhost:8090/login` | la page de connexion |
| `http://localhost:8090/api/…` | Django |

Le bouton de la page d'accueil demande à `/api/auth/me/` qui est connecté et
mène à l'application ou à la page de connexion selon la réponse ; l'application
renvoie d'elle-même vers `/login` si elle est ouverte sans session.

Rien n'est à lancer à la main : `make up` construit et démarre le frontend en
même temps que nginx, Django et Postgres. Pour travailler sur l'interface,
`npm run dev -- -p 3001` dans `src/frontend` le sert sur :3001 — mais `/api/`
n'y est pas relayé, et la connexion ne fonctionne donc que par :8090.

Au premier lancement, copier les fichiers d'exemple :

```bash
cp template.env .env
cp src/backend/.env.example src/backend/.env
```

Par défaut `DINUM_USE_MOCK=true` : l'application tourne sur des données de démonstration, sans Docs ni Drive.

### Connexion

PassOn n'a pas de comptes à lui. On se connecte avec ses identifiants **Drive** :

```
POST /api/auth/login/   {"email": "...", "password": "..."}
```

Les rôles, eux, sont les nôtres et non ceux de Drive :
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

Serveur de développement du frontend, pour travailler sur l'interface
(rechargement à chaud) :

```bash
cd src/frontend && npm install && npm run dev -- -p 3001
# → http://localhost:3001 — pas d'/api dessus, la connexion passe par :8090
```

### Fonctionner à côté des services de La Suite 🔌

PassOn lit de vraies données dans **Docs** et **Drive**. Chacun est une pile Docker Compose indépendante. Voici les ports par défaut de chaque projet, tels que publiés par leurs fichiers compose :

| Service | API | Interface | Keycloak |
|---------|-----|-----------|----------|
| Drive | http://localhost:8071 | http://localhost:3000 | localhost:8083 (8080 en direct) |
| Docs | http://localhost:8071 | http://localhost:3000 | — |

> [!WARNING]
> **Docs et Drive utilisent tous deux 8071** par défaut, et servent tous deux une
> interface sur 3000. Les faire tourner ensemble suppose d'en déplacer un et
> d'ajuster `DOCS_URL` ou `DRIVE_URL` — sinon les appels destinés à l'un
> arrivent sur l'autre. Seul Drive est nécessaire pour se connecter et générer
> une passation.

> [!NOTE]
> Le Keycloak de Drive occupe **8080** : c'est pourquoi PassOn est servi sur 8090.

> [!TIP]
> **[docs/deploiement.md](docs/deploiement.md)** détaille tout cela : ordre de
> démarrage, création d'un compte qui fonctionne dans le Keycloak de Drive, et un
> tableau reliant chaque message d'erreur à sa cause. L'essentiel ne se devine
> pas.

```bash
# Docs
cd /chemin/vers/docs && make bootstrap FLUSH_ARGS='--no-input' && make run

# Drive
cd /chemin/vers/drive && make bootstrap && make demo && make run
```

Identifiants par défaut, et cookie de session posé par chaque service :

| Service | Identifiant | Mot de passe | Cookie |
|---------|-------------|--------------|--------|
| Docs | `impress` | `impress` | `docs_sessionid` |
| Drive | `drive` | `drive` | `drive_sessionid` |

> [!WARNING]
> Mettre `DINUM_USE_MOCK=false` et renseigner `DRIVE_URL` dans `src/backend/.env` avant de se connecter à une vraie instance Drive.
> Voir [la documentation des comptes](src/backend/accounts/README.md) pour la poignée de main CSRF et les particularités de Keycloak.

### Base de données 🗄️

Une seule instance Postgres, partagée par les deux façons de lancer le projet (`make up` et `make run`).

| Table | Contenu |
|-------|---------|
| `Collaborator` | une ligne par personne — rôle, équipe, rattachement hiérarchique |
| `Handover` | la passation : texte libre + six rubriques structurées, validée ou non |
| `CollaboratorItem` | photo des documents et fichiers d'une personne, pour que son manager les lise |

Pour déposer les données de démonstration dans Drive :

```bash
docker compose exec web python manage.py seed_demo --email ... --password ...
```

La commande dépose cinq documents dans le Drive de la personne, écrits pour que
chaque rubrique de la passation générée ait de quoi se remplir. Voir
[demo_data](src/backend/passon/demo_data/README.md).

### Contribuer 🙌

Les PR sont bienvenues — ouvrez une issue d'abord pour tout changement conséquent.

Documentation par domaine : [connectors](src/backend/connectors/README.md) (les
clients des services et la chaîne LLM), [accounts](src/backend/accounts/README.md)
(la connexion), [schéma](src/backend/passon/README.md) (collaborateurs et
passations), [serveur](src/server/README.md) (nginx et l'origine unique),
[frontend](src/frontend/README.md).

Tous les documents de ce dépôt sont bilingues : une moitié en anglais, puis une
moitié en français. Quand vous modifiez l'une, modifiez l'autre dans le même
commit — une traduction laissée en arrière est pire que pas de traduction, parce
qu'on la croit.

### Licence 📝

Publié sous [licence MIT](LICENSE).

La licence MIT couvre le code de ce projet. Elle ne s'étend ni au nom ni au logo
de La Suite numérique, ni à aucun emblème de l'État français : ils restent la
propriété de leurs titulaires et ne sont utilisés ici que pour désigner les
services auxquels PassOn se connecte.

---

## Gov ❤️ open source

PassOn is part of the **La Suite Numérique** ecosystem, a joint initiative led by [DINUM](https://www.numerique.gouv.fr/dinum/).

PassOn s'inscrit dans l'écosystème de **La Suite Numérique**, initiative portée par la [DINUM](https://www.numerique.gouv.fr/dinum/).
