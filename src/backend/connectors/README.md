# Connectors — reading Docs, Drive and Messages
# Connecteurs — lire Docs, Drive et Messages

*[English](#english) · [Français](#français)*

---

## English

### About this project

Pass‘on Dinum is an internal "business continuity" tool: given a colleague's
name, it gathers what they were working on -- their emails, documents, and
files -- from the different internal apps of the Suite Numérique (Docs,
Drive, Messages), so someone covering for them doesn't have to go hunting
across three separate logins. See the [frontend's
PLAN.md](../../../.save/frontend/PLAN.md) for the full product scope.

This `connectors/` module is the backend piece that makes that possible: it
talks to each of the three upstream services' own APIs, normalizes their very
different data shapes into one common format, and (optionally) asks an LLM to
turn that into a readable handover dossier with clickable links back to every
source.

### How it fits together

```
docs_client.py / drive_client.py / messages_client.py
        |  (login + list_items + get_item, one per service)
        v
   views.py  --  /api/<service>/items/        (raw per-service passthrough)
        |
        v
  extraction.py  --  normalize_items()          (unified id/title/author/
        |                                        date/content/source shape)
        |
        +---> views.py  --  /api/extraction/items/   (merged, partial-auth OK)
        |
        v
  generation.py  --  generate_dossier()          (single LLM call -> JSON)
        |
        v
   views.py  --  /api/dossier/                  (text + the six sections)
```

`mock_clients.py` / `mock_data.py` are drop-in replacements for the three
`*_client.py` files (same `list_items`/`get_item` signature), used when
`DINUM_USE_MOCK=true` so you can run and test the whole pipeline above
without any of the three upstream services actually running.

### Running this

All commands below are run from `src/backend`:

```sh
cd src/backend
```

1. **Create the virtualenv and install dependencies:**
   ```sh
   python3 -m venv venv
   ./venv/bin/pip install -r requirements.txt
   ```
   (Using `./venv/bin/python` / `./venv/bin/pip` directly, as every command
   below does, avoids needing to remember whether you've `source
   venv/bin/activate`d in the current shell.)
2. **Configure**: copy `.env.example` to `.env`, then edit `.env`:
   ```sh
   cp .env.example .env
   ```
   - To just try the pipeline with fake data, leave `DINUM_USE_MOCK=true` (the
     `.env.example` default) and skip straight to step 5 -- no upstream
     services or credentials needed.
   - To hit the real Docs/Drive/Messages, set `DINUM_USE_MOCK=false` and point
     `DOCS_URL`/`DRIVE_URL`/`MESSAGES_URL` at wherever those are running (start
     those three projects separately -- they are not part of this repo).
   - For `/api/dossier/`, set `GROQ_API_KEY` (a free key from
     https://console.groq.com/keys works fine for testing).

   `settings.py` loads `.env` automatically (`load_dotenv()`) -- you do not
   need to `export` these variables yourself. The one exception: if a
   variable of the same name is *already* exported in your shell (from an
   earlier `export DINUM_USE_MOCK=...`, for example), that shell value wins
   over `.env` and silently shadows it. If a setting doesn't seem to be taking
   effect, run `echo $VAR_NAME` to check, or just open a fresh terminal.
3. **Set up the database:**
   ```sh
   ./venv/bin/python manage.py migrate
   ```
4. **Run the checks:**
   ```sh
   ./venv/bin/python manage.py check
   ./venv/bin/python manage.py test connectors
   ```
5. **Run the server:**
   ```sh
   ./venv/bin/python manage.py runserver
   ```
   Or via Docker: `docker compose up --build -d` (reads `.env` through
   Compose's `env_file`/`environment` interpolation).

   **After every edit to `.env`, restart this process** (Ctrl-C, then rerun)
   -- unlike `.py` file changes, which the dev server's autoreloader picks up
   by itself, a running process never re-reads `.env`; it only loads it once,
   at startup.
6. **Try it** (in another terminal, while the server from step 5 is running):
   ```sh
   curl http://localhost:8000/api/docs/items/ -H "X-Docs-Session: mock"
   curl http://localhost:8000/api/dossier/
   ```
   (The `X-*-Session` header value is ignored in mock mode, but the request
   must still supply one -- see "Item routes" below.)

### Item routes: `/api/<service>/items/`

| Service | List | Detail | Session header |
| --- | --- | --- | --- |
| Docs | `/api/docs/items/` | `/api/docs/items/<uuid>/` | `X-Docs-Session` |
| Drive | `/api/drive/items/` | `/api/drive/items/<uuid>/` | `X-Drive-Session` |
| Messages | `/api/messages/items/` | `/api/messages/items/<uuid>/` | `X-Messages-Session` |

Docs also supports `/api/docs/documents/`; Messages supports
`/api/messages/messages/`, including the corresponding detail routes.
Responses use `{"service": "docs", "data": ...}`. The data is the existing
connector result, without changing its schema.

Each call uses the caller's upstream session, supplied by the header above or
its cookie. For Drive and Messages there is a third source: the sessions stored
when the user logged in through `/api/auth/login/`, which walks each service's
OIDC flow and keeps the resulting cookies server-side (see
`../accounts/README.md`). A logged-in caller therefore needs no
`X-Drive-Session` or `X-Messages-Session` of its own. An explicit header or
cookie still takes precedence, so manual calls behave exactly as described here.
Docs has no login flow, so it still requires one explicitly.

Links leaving these routes are rewritten to the public host before they are
returned: items carry URLs built from `DRIVE_URL` and friends, which is how
*this process* reaches the services (`host.docker.internal` inside a
container), and that name means nothing in a browser. `DINUM_PUBLIC_HOST`
(default `localhost`) is substituted, ports and paths untouched. Docs uses `docs_sessionid`, Drive uses `drive_sessionid`, Messages
uses `st_messages_sessionid` (its `SESSION_COOKIE_NAME`; override via
`MESSAGES_SESSION_COOKIE` if a deployment changes it). Headers take precedence
over cookies. No shared account or automatic demo login is used by the Django
API. Log into each upstream app first. The existing Docs and Messages
`login()` helpers remain unchanged and available for manual local scripts;
they are not exposed as web login endpoints.

Example after setting DRIVE_SESSION locally to your session value:

```sh
curl -H "X-Drive-Session: $DRIVE_SESSION" http://localhost:8000/api/drive/items/
```

Note on `.env`'s `DOCS_URL`/`DRIVE_URL`/`MESSAGES_URL` defaults: they point at
`host.docker.internal`, which only resolves from *inside* a Docker container
(used when running via `docker compose up`). Running `manage.py runserver`
directly on the host instead, set them to `localhost` (e.g.
`DOCS_URL=http://localhost:8071`) or requests will fail to connect.

Docs and Drive lists return the first page only. Messages reads every mailbox
the caller has access to (personal plus any shared mailbox), not just the
first one. Query parameters are rejected with 400 instead of silently
ignored. Pagination, unified login, writes, and frontend integration are not
implemented here.

Errors use `{"service": "...", "error": "..."}`. Missing credentials return
401; upstream 400/401/403/404/429 are preserved; timeouts return 504 and other
upstream failures return 502. Credentials and upstream bodies are not included
in errors. Requests have a timeout, do not follow redirects, and responses are
private/no-store. Only GET is supported.

### Mock mode

Set `DINUM_USE_MOCK=true` to serve static demo data (`connectors/mock_data.py`)
instead of calling the upstream services -- useful when Docs/Drive/Messages
aren't running locally. In mock mode, `/api/<service>/items/` and
`/api/extraction/items/` don't require a credential. See `mock_clients.py`
for the swap-in clients (same `list_items`/`get_item` signature as the real
ones).

### Normalized extraction API

`GET /api/extraction/items/` merges docs/drive/messages into one list of
LLM-ready items, each with real body content (not just metadata) and a
`source` block for traceability:

```json
{
  "id": "docs:b8eb2e3a-1a76-4026-af30-91da9eb7cb80",
  "title": "...", "author": "...", "date": "...", "content": "...",
  "source": {
    "type": "docs", "resource_id": "b8eb2e3a-...",
    "resource_url": "http://.../documents/b8eb2e3a-.../",
    "content_url": "http://.../documents/b8eb2e3a-.../content/"
  }
}
```

Send one or more of `X-Docs-Session` / `X-Drive-Session` / `X-Messages-Session`
(or their cookies) -- at least one is required, but not all three: a service
with no credential is skipped, not treated as an error. A service whose
credential *was* given but whose upstream call failed gets an entry in
`errors` (same codes as above) instead of failing the whole request, so a
partial result still comes back. See `extraction.py`'s module docstring for
where each source's `content` actually comes from and why `content_url` can
differ from `resource_url` (or be `null` for a Drive folder). In mock mode
(`DINUM_USE_MOCK=true`) this returns all three services' mock data with no
credential needed, same as the per-service item routes.

This endpoint always fetches real content, which costs one extra upstream
request per docs/drive item on top of the initial list call (Messages'
content is already inline, no extra request per item, but still one request
per mailbox and one per thread) -- fine for local/dev-sized data, not
something to point at a large account without pagination.

### Handover dossier (`/api/dossier/`)

`GET /api/dossier/` pulls each service's item list, normalizes them with
`extraction.normalize_items()` (unified `id/title/author/date/content/source`
shape, `source` being `{type, resource_id, resource_url, content_url}`),
sends them to Groq (`generation.py`, `groq` SDK, model `GROQ_MODEL`, default
`openai/gpt-oss-20b`), and returns the summary as **JSON** -- the shape the
interface stores as a handover (`text` plus the six sections).

The prompt asks the model to sort items into six sections -- ongoing actions,
key decisions, deadlines, blockers, key contacts, important documents. Each
bullet carries an `evidence` array, and `documents` entries a title and a link:
both are filled in here from the trusted input items, never from what the model
wrote, so an invented id is dropped rather than shown. That is what lets the
interface open a bullet and show the text it came from -- a `resource_url` is
often a REST endpoint rather than a page a browser can display.

Uses whichever services the caller has a credential for and skips the others,
the same rule `/api/extraction/items/` follows; at least one is required,
unless `DINUM_USE_MOCK=true`. Demanding all three would make the endpoint
unusable wherever one is simply not deployed, which is the normal case for Docs
today. Also requires `GROQ_API_KEY` for the
LLM call -- without it, the endpoint returns
`500 {"error": "llm_not_configured"}` instead of crashing.

Run `./venv/bin/python manage.py check` and
`./venv/bin/python manage.py test connectors`.

---

## Français

### À propos du projet

Pass'on Dinum est un outil interne de continuité d'activité : à partir du nom
d'un collègue, il rassemble ce sur quoi il travaillait — ses mails, ses
documents, ses fichiers — dans les différentes applications internes de La Suite
numérique (Docs, Drive, Messages), pour que la personne qui le remplace n'ait pas
à fouiller trois connexions séparées. Voir le [PLAN.md du
frontend](../../../.save/frontend/PLAN.md) pour le périmètre complet du produit.

Ce module `connectors/` est la pièce du backend qui rend cela possible : il parle
aux API propres à chacun des trois services amont, normalise leurs formats de
données très différents en un format commun, et (facultativement) demande à un
LLM d'en faire une fiche de passation lisible, avec des liens cliquables vers
chaque source.

### Comment les pièces s'assemblent

```
docs_client.py / drive_client.py / messages_client.py
        |  (login + list_items + get_item, un par service)
        v
   views.py  --  /api/<service>/items/        (renvoi brut, par service)
        |
        v
  extraction.py  --  normalize_items()          (forme unifiée id/title/author/
        |                                        date/content/source)
        |
        +---> views.py  --  /api/extraction/items/   (fusionné, auth partielle OK)
        |
        v
  generation.py  --  generate_dossier()          (un seul appel LLM -> JSON)
        |
        v
   views.py  --  /api/dossier/                  (le texte et les six rubriques)
```

`mock_clients.py` / `mock_data.py` remplacent à l'identique les trois fichiers
`*_client.py` (mêmes signatures `list_items` / `get_item`) quand
`DINUM_USE_MOCK=true`, ce qui permet de faire tourner et de tester toute la
chaîne ci-dessus sans qu'aucun des trois services amont ne tourne réellement.

### Le faire tourner

Toutes les commandes ci-dessous se lancent depuis `src/backend` :

```sh
cd src/backend
```

1. **Créer l'environnement virtuel et installer les dépendances :**
   ```sh
   python3 -m venv venv
   ./venv/bin/pip install -r requirements.txt
   ```
   (Appeler directement `./venv/bin/python` / `./venv/bin/pip`, comme le font
   toutes les commandes suivantes, évite d'avoir à se rappeler si l'on a fait un
   `source venv/bin/activate` dans le terminal courant.)
2. **Configurer** : copier `.env.example` vers `.env`, puis l'éditer :
   ```sh
   cp .env.example .env
   ```
   - Pour simplement essayer la chaîne avec des données factices, laisser
     `DINUM_USE_MOCK=true` (la valeur par défaut de `.env.example`) et passer
     directement à l'étape 5 : aucun service amont ni identifiant n'est
     nécessaire.
   - Pour viser les vrais Docs / Drive / Messages, mettre `DINUM_USE_MOCK=false`
     et pointer `DOCS_URL` / `DRIVE_URL` / `MESSAGES_URL` là où ils tournent
     (ces trois projets se lancent séparément — ils ne font pas partie de ce
     dépôt).
   - Pour `/api/dossier/`, renseigner `GROQ_API_KEY` (une clé gratuite prise sur
     https://console.groq.com/keys suffit pour tester).

   `settings.py` charge `.env` tout seul (`load_dotenv()`) : il n'y a pas besoin
   d'exporter ces variables soi-même. Une seule exception : si une variable du
   même nom est *déjà* exportée dans le terminal (par un `export
   DINUM_USE_MOCK=...` antérieur, par exemple), c'est la valeur du terminal qui
   l'emporte et masque silencieusement `.env`. Si un réglage semble sans effet,
   vérifier avec `echo $NOM_DE_VARIABLE`, ou ouvrir un terminal neuf.
3. **Préparer la base de données :**
   ```sh
   ./venv/bin/python manage.py migrate
   ```
4. **Lancer les vérifications :**
   ```sh
   ./venv/bin/python manage.py check
   ./venv/bin/python manage.py test connectors
   ```
5. **Lancer le serveur :**
   ```sh
   ./venv/bin/python manage.py runserver
   ```
   Ou via Docker : `docker compose up --build -d` (qui lit `.env` par
   l'interpolation `env_file` / `environment` de Compose).

   **Après chaque modification de `.env`, redémarrer ce processus** (Ctrl-C puis
   relance) : contrairement aux changements de fichiers `.py`, que le
   rechargement automatique du serveur de développement détecte, un processus qui
   tourne ne relit jamais `.env` — il ne le charge qu'une fois, au démarrage.
6. **L'essayer** (dans un autre terminal, pendant que tourne le serveur de
   l'étape 5) :
   ```sh
   curl http://localhost:8000/api/docs/items/ -H "X-Docs-Session: mock"
   curl http://localhost:8000/api/dossier/
   ```
   (La valeur de l'en-tête `X-*-Session` est ignorée en mode mock, mais la
   requête doit tout de même en fournir un — voir « Les routes d'éléments »
   ci-dessous.)

### Les routes d'éléments : `/api/<service>/items/`

| Service | Liste | Détail | En-tête de session |
| --- | --- | --- | --- |
| Docs | `/api/docs/items/` | `/api/docs/items/<uuid>/` | `X-Docs-Session` |
| Drive | `/api/drive/items/` | `/api/drive/items/<uuid>/` | `X-Drive-Session` |
| Messages | `/api/messages/items/` | `/api/messages/items/<uuid>/` | `X-Messages-Session` |

Docs accepte aussi `/api/docs/documents/` ; Messages accepte
`/api/messages/messages/`, routes de détail comprises. Les réponses ont la forme
`{"service": "docs", "data": ...}`, où `data` est le résultat du connecteur, sans
modification de son schéma.

Chaque appel utilise la session amont de l'appelant, fournie par l'en-tête
ci-dessus ou par son cookie. Pour Drive et Messages il existe une troisième
source : les sessions conservées lors de la connexion par `/api/auth/login/`, qui
parcourt le flux OIDC de chaque service et en garde les cookies côté serveur
(voir `../accounts/README.md`). Un appelant connecté n'a donc pas besoin de son
propre `X-Drive-Session` ni `X-Messages-Session`. Un en-tête ou un cookie
explicite reste prioritaire, si bien que les appels manuels se comportent
exactement comme décrit ici. Docs n'a pas de flux de connexion : il en exige donc
toujours un explicitement.

Les liens qui sortent de ces routes sont réécrits vers l'hôte public avant
d'être renvoyés : les éléments portent des URL construites à partir de
`DRIVE_URL` et consorts, c'est-à-dire la façon dont *ce processus-ci* joint les
services (`host.docker.internal` dans un conteneur), un nom qui ne veut rien dire
dans un navigateur. `DINUM_PUBLIC_HOST` (`localhost` par défaut) y est substitué,
ports et chemins inchangés. Docs utilise `docs_sessionid`, Drive
`drive_sessionid`, Messages `st_messages_sessionid` (son `SESSION_COOKIE_NAME` ;
à redéfinir via `MESSAGES_SESSION_COOKIE` si un déploiement le change). Les
en-têtes priment sur les cookies. L'API Django n'utilise aucun compte partagé ni
connexion de démonstration automatique : il faut se connecter d'abord à chaque
application amont. Les fonctions `login()` existantes de Docs et Messages restent
inchangées et disponibles pour des scripts locaux manuels ; elles ne sont pas
exposées comme points d'entrée web.

Exemple, après avoir placé votre valeur de session dans `DRIVE_SESSION` :

```sh
curl -H "X-Drive-Session: $DRIVE_SESSION" http://localhost:8000/api/drive/items/
```

À noter sur les valeurs par défaut de `DOCS_URL` / `DRIVE_URL` / `MESSAGES_URL`
dans `.env` : elles pointent vers `host.docker.internal`, qui ne se résout que
depuis l'*intérieur* d'un conteneur Docker (le cas quand on lance
`docker compose up`). En lançant `manage.py runserver` directement sur la
machine, il faut les mettre sur `localhost` (par exemple
`DOCS_URL=http://localhost:8071`), faute de quoi les requêtes échoueront à se
connecter.

Les listes de Docs et de Drive ne renvoient que la première page. Messages lit
toutes les boîtes auxquelles l'appelant a accès (la sienne et les boîtes
partagées), pas seulement la première. Les paramètres de requête sont refusés par
un 400 plutôt qu'ignorés en silence. La pagination, une connexion unifiée, les
écritures et l'intégration au frontend ne sont pas traitées ici.

Les erreurs ont la forme `{"service": "...", "error": "..."}`. Un identifiant
manquant donne un 401 ; les 400/401/403/404/429 amont sont conservés ; les
dépassements de délai donnent un 504 et les autres échecs amont un 502. Ni les
identifiants ni les corps de réponse amont ne figurent dans les erreurs. Les
requêtes ont un délai maximal, ne suivent pas les redirections, et les réponses
sont `private` / `no-store`. Seul GET est accepté.

### Mode mock

`DINUM_USE_MOCK=true` sert des données de démonstration statiques
(`connectors/mock_data.py`) au lieu d'appeler les services amont — pratique quand
Docs, Drive et Messages ne tournent pas en local. Dans ce mode,
`/api/<service>/items/` et `/api/extraction/items/` n'exigent aucun identifiant.
Voir `mock_clients.py` pour les clients de remplacement (mêmes signatures
`list_items` / `get_item` que les vrais).

### L'API d'extraction normalisée

`GET /api/extraction/items/` fusionne Docs, Drive et Messages en une seule liste
d'éléments prêts pour le LLM, chacun avec son vrai contenu (pas seulement ses
métadonnées) et un bloc `source` pour la traçabilité :

```json
{
  "id": "docs:b8eb2e3a-1a76-4026-af30-91da9eb7cb80",
  "title": "...", "author": "...", "date": "...", "content": "...",
  "source": {
    "type": "docs", "resource_id": "b8eb2e3a-...",
    "resource_url": "http://.../documents/b8eb2e3a-.../",
    "content_url": "http://.../documents/b8eb2e3a-.../content/"
  }
}
```

Envoyer un ou plusieurs des en-têtes `X-Docs-Session` / `X-Drive-Session` /
`X-Messages-Session` (ou leurs cookies) : au moins un est exigé, mais pas les
trois — un service sans identifiant est ignoré, ce n'est pas une erreur. Un
service dont l'identifiant *a* été fourni mais dont l'appel amont a échoué obtient
une entrée dans `errors` (mêmes codes que ci-dessus) au lieu de faire échouer
toute la requête, si bien qu'un résultat partiel revient quand même. Voir la
docstring de module d'`extraction.py` pour savoir d'où vient réellement le
`content` de chaque source et pourquoi `content_url` peut différer de
`resource_url` (ou être `null` pour un dossier Drive). En mode mock
(`DINUM_USE_MOCK=true`), cette route renvoie les données factices des trois
services sans aucun identifiant, comme les routes par service.

Cette route récupère toujours le contenu réel, ce qui coûte une requête amont
supplémentaire par élément Docs ou Drive en plus de l'appel de liste initial (le
contenu de Messages est déjà en ligne, donc pas de requête par élément, mais tout
de même une par boîte et une par fil) — acceptable à l'échelle d'un poste de
développement, à ne pas pointer vers un gros compte sans pagination.

### La fiche de passation (`/api/dossier/`)

`GET /api/dossier/` récupère la liste d'éléments de chaque service, les normalise
avec `extraction.normalize_items()` (forme unifiée
`id/title/author/date/content/source`, `source` valant
`{type, resource_id, resource_url, content_url}`), les envoie à Groq
(`generation.py`, SDK `groq`, modèle `GROQ_MODEL`, `openai/gpt-oss-20b` par
défaut) et renvoie le résumé en **JSON** — la forme que l'interface enregistre
comme passation (`text` plus les six rubriques).

L'invite demande au modèle de répartir les éléments en six rubriques : actions en
cours, décisions clés, échéances, blocages, contacts clés, documents importants.
Chaque puce porte un tableau `evidence`, et chaque entrée de `documents` un titre
et un lien : les deux sont remplis ici à partir des éléments d'entrée, de source
sûre, jamais de ce qu'a écrit le modèle — un identifiant inventé est donc écarté
plutôt qu'affiché. C'est ce qui permet à l'interface d'ouvrir une puce et de
montrer le texte dont elle provient : une `resource_url` est souvent un point
d'entrée REST plutôt qu'une page affichable dans un navigateur.

La route se sert des services pour lesquels l'appelant a un identifiant et ignore
les autres, suivant la même règle que `/api/extraction/items/` ; au moins un est
exigé, sauf si `DINUM_USE_MOCK=true`. En exiger trois rendrait la route
inutilisable partout où l'un d'eux n'est simplement pas déployé, ce qui est le
cas courant de Docs aujourd'hui. Elle exige aussi `GROQ_API_KEY` pour l'appel au
LLM : sans cette clé, elle répond `500 {"error": "llm_not_configured"}` au lieu
de planter.

Lancer `./venv/bin/python manage.py check` et
`./venv/bin/python manage.py test connectors`.
