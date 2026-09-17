# Connectors — reading Docs and Drive
# Connecteurs — lire Docs et Drive

*[English](#english) · [Français](#français)*

---

## English

### About this project

Pass‘on Dinum is an internal "business continuity" tool: given a colleague's
name, it gathers what they were working on -- their documents and files --
from the internal apps of the Suite Numérique (Docs, Drive), so someone
covering for them doesn't have to go hunting across separate logins. See the [frontend](../../frontend/README.md) for the interface it feeds.

This `connectors/` module is the backend piece that makes that possible: it
talks to each of the three upstream services' own APIs, normalizes their very
different data shapes into one common format, and (optionally) asks an LLM to
turn that into a readable handover dossier with clickable links back to every
source.

### How it fits together

```
docs_client.py / drive_client.py
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

`mock_clients.py` / `mock_data.py` are drop-in replacements for the
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
   - To hit the real Docs/Drive, set `DINUM_USE_MOCK=false` and point
     `DOCS_URL`/`DRIVE_URL` at wherever those are running (start those two
     projects separately -- they are not part of this repo).
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

Docs also supports `/api/docs/documents/`, including its detail route.
Responses use `{"service": "docs", "data": ...}`. The data is the existing
connector result, without changing its schema.

Each call uses the caller's upstream session, supplied by the header above or
its cookie. For Drive there is a third source: the session stored when the
user logged in through `/api/auth/login/`, which walks its OIDC flow and keeps
the resulting cookie server-side (see `../accounts/README.md`). A logged-in
caller therefore needs no `X-Drive-Session` of its own. Docs has no login
flow, so it still requires one explicitly.

The order is header, then session, then cookie, and the last position matters.
Cookies are not scoped by port: Drive on `localhost:8071` and this app on
`localhost:8090` share one jar, so whichever account a browser last used
upstream sends its cookie here too. Reading it before the session meant a
page could be built from a colleague's account — and a handover generated
from it stored under the caller's name. An explicit header still overrides
everything, which is what manual calls use.

Links leaving these routes are rewritten to the public host before they are
returned: items carry URLs built from `DRIVE_URL` and friends, which is how
*this process* reaches the services (`host.docker.internal` inside a
container), and that name means nothing in a browser. `DINUM_PUBLIC_HOST`
(default `localhost`) is substituted, ports and paths untouched. Docs uses
`docs_sessionid` and Drive uses `drive_sessionid`. No shared account or
automatic demo login is used by the Django API. Log into each upstream app
first. The existing Docs `login()` helper remains unchanged and available for
manual local scripts; it is not exposed as a web login endpoint.

Example after setting DRIVE_SESSION locally to your session value:

```sh
curl -H "X-Drive-Session: $DRIVE_SESSION" http://localhost:8000/api/drive/items/
```

Note on `.env`'s `DOCS_URL`/`DRIVE_URL` defaults: they point at
`host.docker.internal`, which only resolves from *inside* a Docker container
(used when running via `docker compose up`). Running `manage.py runserver`
directly on the host instead, set them to `localhost` (e.g.
`DOCS_URL=http://localhost:8071`) or requests will fail to connect.

Docs and Drive lists return the first page only. Query parameters are
rejected with 400 instead of silently
ignored. Pagination, unified login, writes, and frontend integration are not
implemented here.

Errors use `{"service": "...", "error": "..."}`. Missing credentials return
401; upstream 400/401/403/404/429 are preserved; timeouts return 504 and other
upstream failures return 502. Credentials and upstream bodies are not included
in errors. Requests have a timeout, do not follow redirects, and responses are
private/no-store. Only GET is supported.

### Which services are read: `DINUM_ENABLED_SERVICES`

A deployment does not have to read both. `DINUM_ENABLED_SERVICES` (default
`docs,drive`) lists the ones it does, and everything in this module follows
it:

| Where | With a service left out |
| --- | --- |
| `/api/<service>/items/` | `404 {"error": "service_disabled"}` |
| `/api/extraction/items/` | its items are absent; no credential is asked for it, and it never appears in `errors` |
| `/api/dossier/` | the model is given the other service's items only |
| Mock mode | that service's fixture is left out too, so the demo matches |

Docs is what this is for in practice: it is often not deployed, and a
deployment that only runs Drive should not have to answer for it. Leaving a
service out is a configuration change rather than a code change -- its client,
its routes and its tests all stay where they are and are simply not called.

A service left out is not an error and not a failure: it is absent. That is
the difference from a service that is down, which does land in `errors`, and
from a caller with no credential for it, which is a fact about the caller
rather than a decision about the product.

> [!NOTE]
> A third service, **Messages**, was read here until it was removed in full:
> `messages_client.py`, the `/api/messages/…` routes, the session login opened
> there and the mail items they produced are all gone. A handover now rests on
> documents alone. The history is in git if it ever has to come back.

### Mock mode

Set `DINUM_USE_MOCK=true` to serve static demo data (`connectors/mock_data.py`)
instead of calling the upstream services -- useful when Docs and Drive
aren't running locally. In mock mode, `/api/<service>/items/` and
`/api/extraction/items/` don't require a credential. See `mock_clients.py`
for the swap-in clients (same `list_items`/`get_item` signature as the real
ones).

### Normalized extraction API

`GET /api/extraction/items/` merges docs and drive into one list of
LLM-ready items, each with real body content (not just metadata) and a
`source` block for traceability:

```json
{
  "id": "docs:b8eb2e3a-1a76-4026-af30-91da9eb7cb80",
  "title": "...", "author": "...", "author_email": "...", "date": "...",
  "content": "...",
  "source": {
    "type": "docs", "resource_id": "b8eb2e3a-...",
    "resource_url": "http://.../documents/b8eb2e3a-.../",
    "content_url": "http://.../documents/b8eb2e3a-.../content/"
  }
}
```

`author` is the display name and `author_email` the address beside it -- a
mail's sender, a document's creator. They are kept apart because `author` is
what the model reads (`generation._trimmed()`), while the address is what makes
a contact reachable; folding one into the other would change the prompt's
input.

Docs carries a creator's address when it has one. Drive does not: its item listing
names a creator, with an id, and no address anywhere. So this route resolves
them, once per listing, through Drive's own user search
(`drive_client.list_users`). That search matches on the *address*, which means
a creator's name is not a usable query -- a domain is. A domain search comes
back with everyone in it, each carrying the id the creator block already has,
so the match is by id and never by name.

Which domains get asked is `_directory_domains`: the caller's own first, then
those of the collaborator rows login has created. The caller's domain alone is
not enough -- a document shared across two organisations has an owner in
neither the caller's domain nor any guessable one -- and asking about people
this application already knows is a narrower question than searching Drive at
large. The list is capped (`MAX_DIRECTORY_DOMAINS`), since each domain is one
request.

Two consequences worth knowing. A creator in none of those domains keeps an
empty `author_email`, deliberately: this puts an address on the people the
caller and this application already know, it is not a way to walk a directory.
And the search is best-effort -- if it fails, the items still come back,
owners and all, just without addresses.

Send `X-Docs-Session` and/or `X-Drive-Session` (or their cookies) -- at least
one is required, but not both: a service with no credential is skipped, not
treated as an error. A service whose
credential *was* given but whose upstream call failed gets an entry in
`errors` (same codes as above) instead of failing the whole request, so a
partial result still comes back. See `extraction.py`'s module docstring for
where each source's `content` actually comes from and why `content_url` can
differ from `resource_url` (or be `null` for a Drive folder). In mock mode
(`DINUM_USE_MOCK=true`) this returns both services' mock data with no
credential needed, same as the per-service item routes.

This endpoint always fetches real content, which costs one extra upstream
request per item on top of the initial list call -- fine for local/dev-sized
data, not
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
d'un collègue, il rassemble ce sur quoi il travaillait — ses documents, ses
fichiers — dans les applications internes de La Suite numérique (Docs, Drive),
pour que la personne qui le remplace n'ait pas à fouiller des connexions
séparées. Voir le [frontend](../../frontend/README.md) pour l'interface qu'il alimente.

Ce module `connectors/` est la pièce du backend qui rend cela possible : il parle
aux API propres à chacun des trois services amont, normalise leurs formats de
données très différents en un format commun, et (facultativement) demande à un
LLM d'en faire une fiche de passation lisible, avec des liens cliquables vers
chaque source.

### Comment les pièces s'assemblent

```
docs_client.py / drive_client.py
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
   - Pour viser les vrais Docs / Drive, mettre `DINUM_USE_MOCK=false` et
     pointer `DOCS_URL` / `DRIVE_URL` là où ils tournent (ces deux projets se
     lancent séparément — ils ne font pas partie de ce dépôt).
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

Docs accepte aussi `/api/docs/documents/`, route de détail comprise. Les
réponses ont la forme
`{"service": "docs", "data": ...}`, où `data` est le résultat du connecteur, sans
modification de son schéma.

Chaque appel utilise la session amont de l'appelant, fournie par l'en-tête
ci-dessus ou par son cookie. Pour Drive il existe une troisième
source : les sessions conservées lors de la connexion par `/api/auth/login/`, qui
parcourt le flux OIDC de chaque service et en garde les cookies côté serveur
(voir `../accounts/README.md`). Un appelant connecté n'a donc pas besoin de son
propre `X-Drive-Session`. Docs n'a pas de flux de
connexion : il en exige donc toujours un explicitement.

L'ordre est l'en-tête, puis la session, puis le cookie — et cette dernière
place compte. Les cookies ne sont pas cloisonnés par port : Drive sur
`localhost:8071` et cette application sur `localhost:8090` partagent le même
bocal, si bien que le navigateur envoie ici le cookie du dernier compte utilisé
en amont. Le lire avant la session permettait de construire une page à partir
du compte d'un collègue — et d'enregistrer sous le nom de l'appelant une
passation générée depuis celui-ci. Un en-tête explicite reste prioritaire sur
tout, ce dont se servent les appels manuels.

Les liens qui sortent de ces routes sont réécrits vers l'hôte public avant
d'être renvoyés : les éléments portent des URL construites à partir de
`DRIVE_URL` et consorts, c'est-à-dire la façon dont *ce processus-ci* joint les
services (`host.docker.internal` dans un conteneur), un nom qui ne veut rien dire
dans un navigateur. `DINUM_PUBLIC_HOST` (`localhost` par défaut) y est substitué,
ports et chemins inchangés. Docs utilise `docs_sessionid` et Drive
`drive_sessionid`. L'API Django n'utilise aucun compte partagé ni connexion de
démonstration automatique : il faut se connecter d'abord à chaque application
amont. La fonction `login()` existante de Docs reste inchangée et disponible
pour des scripts locaux manuels ; elle n'est pas exposée comme point d'entrée
web.

Exemple, après avoir placé votre valeur de session dans `DRIVE_SESSION` :

```sh
curl -H "X-Drive-Session: $DRIVE_SESSION" http://localhost:8000/api/drive/items/
```

À noter sur les valeurs par défaut de `DOCS_URL` / `DRIVE_URL`
dans `.env` : elles pointent vers `host.docker.internal`, qui ne se résout que
depuis l'*intérieur* d'un conteneur Docker (le cas quand on lance
`docker compose up`). En lançant `manage.py runserver` directement sur la
machine, il faut les mettre sur `localhost` (par exemple
`DOCS_URL=http://localhost:8071`), faute de quoi les requêtes échoueront à se
connecter.

Les listes de Docs et de Drive ne renvoient que la première page. Les
paramètres de requête sont refusés par un 400 plutôt qu'ignorés en silence. La pagination, une connexion unifiée, les
écritures et l'intégration au frontend ne sont pas traitées ici.

Les erreurs ont la forme `{"service": "...", "error": "..."}`. Un identifiant
manquant donne un 401 ; les 400/401/403/404/429 amont sont conservés ; les
dépassements de délai donnent un 504 et les autres échecs amont un 502. Ni les
identifiants ni les corps de réponse amont ne figurent dans les erreurs. Les
requêtes ont un délai maximal, ne suivent pas les redirections, et les réponses
sont `private` / `no-store`. Seul GET est accepté.

### Quels services sont lus : `DINUM_ENABLED_SERVICES`

Un déploiement n'est pas tenu de lire les deux services.
`DINUM_ENABLED_SERVICES` (par défaut `docs,drive`) énumère ceux qu'il lit, et
tout ce module s'y conforme :

| Où | Quand un service est retiré |
| --- | --- |
| `/api/<service>/items/` | `404 {"error": "service_disabled"}` |
| `/api/extraction/items/` | ses éléments sont absents ; aucun identifiant ne lui est demandé, et il n'apparaît jamais dans `errors` |
| `/api/dossier/` | le modèle ne reçoit que les éléments de l'autre service |
| Mode mock | sa fixture est retirée aussi, pour que la démonstration corresponde |

C'est pour Docs que cela sert en pratique : il n'est souvent pas déployé, et un
déploiement qui ne fait tourner que Drive n'a pas à répondre de lui. Retirer un
service est un changement de configuration et non de code : son client, ses
routes et ses tests restent en place et ne sont simplement plus appelés.

Un service retiré n'est ni une erreur ni une panne : il est absent. C'est la
différence avec un service en panne, qui figure bien dans `errors`, et avec un
appelant sans identifiant pour lui, qui est un fait sur l'appelant et non une
décision sur le produit.

> [!NOTE]
> Un troisième service, **Messages**, était lu ici jusqu'à son retrait complet :
> `messages_client.py`, les routes `/api/messages/…`, la session ouverte à la
> connexion et les mails qu'elles produisaient ont tous disparu. Une passation
> repose désormais sur les seuls documents. L'historique est dans git s'il
> fallait un jour revenir en arrière.

### Mode mock

`DINUM_USE_MOCK=true` sert des données de démonstration statiques
(`connectors/mock_data.py`) au lieu d'appeler les services amont — pratique quand
Docs et Drive ne tournent pas en local. Dans ce mode,
`/api/<service>/items/` et `/api/extraction/items/` n'exigent aucun identifiant.
Voir `mock_clients.py` pour les clients de remplacement (mêmes signatures
`list_items` / `get_item` que les vrais).

### L'API d'extraction normalisée

`GET /api/extraction/items/` fusionne Docs et Drive en une seule liste
d'éléments prêts pour le LLM, chacun avec son vrai contenu (pas seulement ses
métadonnées) et un bloc `source` pour la traçabilité :

```json
{
  "id": "docs:b8eb2e3a-1a76-4026-af30-91da9eb7cb80",
  "title": "...", "author": "...", "author_email": "...", "date": "...",
  "content": "...",
  "source": {
    "type": "docs", "resource_id": "b8eb2e3a-...",
    "resource_url": "http://.../documents/b8eb2e3a-.../",
    "content_url": "http://.../documents/b8eb2e3a-.../content/"
  }
}
```

`author` porte le nom affiché et `author_email` l'adresse qui l'accompagne —
l'expéditeur d'un mail, le créateur d'un document. Les deux restent séparés
parce qu'`author` est ce que lit le modèle (`generation._trimmed()`), tandis que
l'adresse est ce qui rend un contact joignable : les confondre modifierait
l'entrée de l'invite.

Docs fournit l'adresse du créateur quand il en a une. Drive, non :
sa liste d'éléments nomme un créateur, avec un identifiant, et aucune adresse
nulle part. Cette route les résout donc, une fois par listing, via la recherche
d'utilisateurs de Drive (`drive_client.list_users`). Cette recherche porte sur
l'*adresse* : le nom d'un créateur n'est pas une requête utilisable, un domaine
si. Une recherche par domaine renvoie tout le monde dans ce domaine, chacun
avec l'identifiant que le bloc `creator` porte déjà — le rapprochement se fait
donc par identifiant, jamais par nom.

Quels domaines sont interrogés, c'est `_directory_domains` : celui de
l'appelant d'abord, puis ceux des lignes `Collaborator` créées par la
connexion. Le seul domaine de l'appelant ne suffit pas — un document partagé
entre deux organisations a un propriétaire qui n'est ni dans ce domaine ni
dans un domaine devinable — et interroger les personnes que cette application
connaît déjà est une question plus étroite que fouiller Drive en entier. La
liste est plafonnée (`MAX_DIRECTORY_DOMAINS`), chaque domaine coûtant une
requête.

Deux conséquences à connaître. Un créateur qui n'est dans aucun de ces
domaines garde un `author_email` vide, volontairement : il s'agit de mettre
une adresse sur les personnes que l'appelant et cette application connaissent
déjà, pas de parcourir un annuaire. Et la recherche est au mieux : si elle
échoue, les éléments reviennent quand même, propriétaires compris, simplement
sans adresse.

Envoyer `X-Docs-Session` et/ou `X-Drive-Session` (ou leurs cookies) : au moins
un est exigé, mais pas les deux — un service sans identifiant est ignoré, ce
n'est pas une erreur. Un
service dont l'identifiant *a* été fourni mais dont l'appel amont a échoué obtient
une entrée dans `errors` (mêmes codes que ci-dessus) au lieu de faire échouer
toute la requête, si bien qu'un résultat partiel revient quand même. Voir la
docstring de module d'`extraction.py` pour savoir d'où vient réellement le
`content` de chaque source et pourquoi `content_url` peut différer de
`resource_url` (ou être `null` pour un dossier Drive). En mode mock
(`DINUM_USE_MOCK=true`), cette route renvoie les données factices des deux
services sans aucun identifiant, comme les routes par service.

Cette route récupère toujours le contenu réel, ce qui coûte une requête amont
supplémentaire par élément en plus de l'appel de liste initial — acceptable à
l'échelle d'un poste de développement, à ne pas pointer vers un gros compte
sans pagination.

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
