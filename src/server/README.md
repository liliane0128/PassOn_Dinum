# Server (nginx) · Le serveur (nginx)

*[English](#english) · [Français](#français)*

---

## English

### What this is for

The project is two separate programs: a React app built by Vite
(`src/frontend`) and a Django API (`src/backend`). Run on their own they sit on
two different ports, which means the browser treats them as two different
origins — the frontend would need CORS headers to call the API, session cookies
would not be shared, and every API URL would have to be configured per
environment.

nginx removes that problem by putting both behind one origin. It serves the
compiled frontend from disk and forwards everything Django owns to the `web`
container, so the browser only ever talks to **http://localhost:8090** and the
frontend can call `/api/...` as a plain relative URL.

```
browser ---> nginx (:8090) ---> /           static files (React build)
                           \--> /api/       web:8000  (Django)
                            \-> /admin/     web:8000
                             \> /static/    web:8000  (admin CSS/JS)
```

### One site, three kinds of content

The landing page, the application and the API share :8090, which is what lets
the browser hold a session at all: Django checks the `Origin` header against
its own host before accepting a POST, so an application served from another
origin would need CORS *and* an entry in `CSRF_TRUSTED_ORIGINS`, and the cookie
would still be dropped by a browser blocking third-party cookies.

```
browser ---> nginx (:8090) ---> /             the landing page (static, src/server/html)
                           \--> /dashboard    passon_frontend:3001  (Next.js)
                            \-> /gerer-ma-passation, /login, /equipe, /_next/, /logo/
                             \> /api/         web:8000  (Django)
```

The frontend is a container of its own (`frontend` in `docker-compose.yml`,
built from `src/frontend/Dockerfile`), so nginx reaches it by service name on
the compose network. It used to run on the host, reached through
`host.docker.internal`, and had to be started by hand; `make up` now brings it
up with everything else.

The paths are passed through unchanged — the app serves `/dashboard` at
`/dashboard`. Stripping the prefix would give one URL two meanings, since `/`
here is the landing page, and a `<Link href="/">` inside the app would land on
it instead of the dashboard.

### Files

| File | Role |
| --- | --- |
| `conf.d/default.conf` | the nginx site: what is served, what is proxied |
| `html/` | the landing page served at `/` — one HTML file, its CSS, fonts and images |
| `Dockerfile` | two stages — build the React app with Node, then serve it with nginx |

The stack itself is wired up in the repository root: `docker-compose.yml`
(services `web` and `nginx`) and `Makefile` (`make up` / `down` / `logs`).

### Running it

From the repository root, `make up`. See the [root README](../../README.md).

The frontend is compiled **into the image** (`npm run build` in the Dockerfile's
first stage), so frontend changes only appear after another `make up`, which
rebuilds it. For day-to-day frontend work, run the Vite dev server directly
(`cd src/frontend && npm run dev`) and keep hot reload.

### Decisions worth knowing

- **`try_files $uri $uri/ /index.html`** — React Router owns the routes
  (`/`, `/manager`, `/moi`). Without this fallback, nginx would look for a file
  called `manager` on disk and return 404 whenever someone refreshes the page
  or pastes a URL. Sending `index.html` instead lets the app boot and resolve
  the route itself.
- **`proxy_read_timeout 300s` on `/api/`** — `/api/dossier/` lists items from
  three upstream services and then waits on an LLM call. nginx's 60s default
  would cut that off and return 504.
- **`proxy_set_header Host $http_host`, never `$host`** — `$host` drops the
  port, and Django compares the browser's `Origin` header
  (`http://localhost:8090`) against its own host when checking CSRF on a POST.
  Without the port that check fails with *"Origin checking failed"* and every
  login is rejected with a 403 before the credentials are even read. `curl`
  sends no `Origin` header, so it never reveals this — testing a POST route
  from the terminal alone will happily pass while the app is broken. Use
  `curl -H "Origin: http://localhost:8090"` to reproduce what a browser does.
  `ALLOWED_HOSTS` is unaffected either way: Django strips the port before
  validating the host.
- **`expires 1y` on `/assets/`, not `add_header Cache-Control`** — Vite writes
  content-hashed filenames there, so they can be cached hard. A location-level
  `add_header` would drop the `X-Frame-Options` and `X-Robots-Tag` headers
  inherited from the server block; `expires` does not. `/index.html` is
  explicitly not cached, otherwise a rebuilt app would keep asking for the
  previous build's hashed filenames.
- **Port 8090, not the more obvious 8080** — Drive's Keycloak publishes on
  8080, and the login flow needs Drive running (see
  `src/backend/accounts/README.md`), so the two would collide on any machine
  where both are up.
- **Django is published on 127.0.0.1:8000 as well** — `make run` serves the API
  without nginx for backend-only work, and curl and the tests use that port.
  The browser still goes through :8090, which is the only place the app and the
  API share an origin; anything that needs a session cookie has to use it.
- **One postgres, one compose file** — Django moved off SQLite, and sessions
  (so, logins) live in the database. There is a single definition at the
  repository root and a single named volume, so `make up` and `make run` are
  two service selections over the same database rather than two stacks with
  rival copies of the data.
- **Only the database credentials are set in `environment:` for `web`** —
  everything else stays in `src/backend/.env`, which `settings.py` loads
  through the bind mount. Compose-level variables take priority over that file
  and would silently blank out anything it defines (`GROQ_API_KEY:
  ${GROQ_API_KEY:-}` being the obvious trap); the `POSTGRES_*` keys are safe
  because that file has no entry for them.

### Not done here

- **Docs is still on its own origin.** The connectors API asks for an
  `X-Docs-Session` header because that service's cookies do not cross ports.
  Drive no longer needs one — logging in stores its session server-side
  (`src/backend/accounts/README.md`) — but the same is not yet done for Docs.
  nginx could alternatively proxy it under this origin, which changes the
  API's authentication contract, so it has not been done unilaterally.
- **Django still runs through `runserver`**, the development server. nginx does
  not change that; a real deployment would put gunicorn (or similar) behind it
  and serve collected static files from disk rather than proxying `/static/`.
- **No TLS.** Everything is plain HTTP on localhost.

---

## Français

### À quoi il sert

Le projet, ce sont deux programmes distincts : une application React compilée
par Vite (`src/frontend`) et une API Django (`src/backend`). Lancés chacun de
leur côté, ils occupent deux ports différents, ce que le navigateur traite comme
deux origines : le frontend aurait besoin d'en-têtes CORS pour appeler l'API, les
cookies de session ne seraient pas partagés, et chaque URL d'API devrait être
configurée par environnement.

nginx supprime le problème en plaçant les deux derrière une seule origine. Il
sert le frontend compilé depuis le disque et transmet au conteneur `web` tout ce
qui appartient à Django : le navigateur ne parle donc qu'à
**http://localhost:8090**, et le frontend appelle `/api/...` en URL relative.

```
navigateur ---> nginx (:8090) ---> /           fichiers statiques (build React)
                              \--> /api/       web:8000  (Django)
                               \-> /admin/     web:8000
                                \> /static/    web:8000  (CSS/JS de l'admin)
```

### Un seul site, trois sortes de contenu

La page d'accueil, l'application et l'API partagent le :8090, et c'est ce qui
permet au navigateur de tenir une session : Django compare l'en-tête `Origin` à
son propre hôte avant d'accepter un POST, si bien qu'une application servie
depuis une autre origine demanderait CORS *et* une entrée dans
`CSRF_TRUSTED_ORIGINS`, et que le cookie serait de toute façon écarté par un
navigateur qui bloque les cookies tiers.

```
navigateur ---> nginx (:8090) ---> /             la page d'accueil (statique, src/server/html)
                              \--> /dashboard    passon_frontend:3001  (Next.js)
                               \-> /gerer-ma-passation, /login, /equipe, /_next/, /logo/
                                \> /api/         web:8000  (Django)
```

Le frontend a désormais son propre conteneur (service `frontend` dans
`docker-compose.yml`, construit depuis `src/frontend/Dockerfile`) : nginx le
joint par son nom de service sur le réseau Compose. Il tournait auparavant sur
la machine, joint par `host.docker.internal`, et devait être lancé à la main ;
`make up` le démarre maintenant avec le reste.

Les chemins sont transmis tels quels — l'application sert `/dashboard` sur
`/dashboard`. Retirer le préfixe donnerait deux sens à une même URL, puisque le
`/` d'ici est la page d'accueil, et un `<Link href="/">` dans l'application y
mènerait au lieu du tableau de bord.

### Fichiers

| Fichier | Rôle |
| --- | --- |
| `conf.d/default.conf` | le site nginx : ce qui est servi, ce qui est relayé |
| `html/` | la page d'accueil servie sur `/` — un fichier HTML, son CSS, ses polices et ses images |
| `Dockerfile` | deux étapes — compiler l'appli React avec Node, puis la servir avec nginx |

La pile elle-même est décrite à la racine du dépôt : `docker-compose.yml`
(services `web` et `nginx`) et `Makefile` (`make up` / `down` / `logs`).

### Le lancer

Depuis la racine du dépôt, `make up`. Voir le [README racine](../../README.md).

Le frontend est compilé **dans l'image** (`npm run build` à la première étape du
Dockerfile) : une modification du front n'apparaît donc qu'après un nouveau
`make up`, qui la recompile. Pour travailler sur l'interface au quotidien, lancer
directement le serveur Vite (`cd src/frontend && npm run dev`) et garder le
rechargement à chaud.

### Décisions à connaître

- **`try_files $uri $uri/ /index.html`** — c'est React Router qui gère les routes
  (`/`, `/manager`, `/moi`). Sans ce repli, nginx chercherait un fichier nommé
  `manager` sur le disque et renverrait 404 à chaque rafraîchissement ou URL
  collée. Renvoyer `index.html` laisse l'appli démarrer et résoudre la route
  elle-même.
- **`proxy_read_timeout 300s` sur `/api/`** — `/api/dossier/` liste les éléments
  de trois services puis attend un appel LLM. Le délai par défaut de 60 s de
  nginx couperait la connexion et renverrait 504.
- **`proxy_set_header Host $http_host`, jamais `$host`** — `$host` supprime le
  port, or Django compare l'en-tête `Origin` du navigateur
  (`http://localhost:8090`) à son propre hôte pour vérifier le CSRF sur un POST.
  Sans le port, cette vérification échoue avec *« Origin checking failed »* et
  toute connexion est refusée en 403 avant même que les identifiants soient lus.
  `curl` n'envoie pas d'`Origin` et ne révèle donc jamais le problème : tester
  une route POST depuis le terminal passera sans souci pendant que l'appli est
  cassée. Utiliser `curl -H "Origin: http://localhost:8090"` pour reproduire le
  comportement d'un navigateur. `ALLOWED_HOSTS` n'est pas concerné : Django
  retire le port avant de valider l'hôte.
- **`expires 1y` sur `/assets/`, et non `add_header Cache-Control`** — Vite y
  écrit des noms de fichiers contenant une empreinte du contenu : ils peuvent
  donc être mis en cache longtemps. Un `add_header` au niveau d'un `location`
  ferait perdre les en-têtes `X-Frame-Options` et `X-Robots-Tag` hérités du bloc
  serveur ; `expires` ne les supprime pas. `/index.html` n'est explicitement pas
  mis en cache, sans quoi une appli recompilée continuerait de réclamer les
  fichiers de la version précédente.
- **Le port 8090, et non 8080** — le Keycloak de Drive publie sur 8080, et le
  flux de connexion a besoin de Drive (voir `src/backend/accounts/README.md`) :
  les deux se heurteraient sur toute machine où ils tournent ensemble.
- **Django est aussi publié sur 127.0.0.1:8000** — `make run` sert l'API sans
  nginx pour travailler côté backend, et c'est ce port qu'utilisent curl et les
  tests. Le navigateur, lui, passe toujours par :8090, seul endroit où l'appli et
  l'API partagent une origine ; tout ce qui a besoin d'un cookie de session doit
  passer par là.
- **Un seul postgres, un seul fichier compose** — Django a quitté SQLite, et les
  sessions (donc les connexions) vivent dans la base. Il n'existe qu'une
  définition, à la racine, et un seul volume nommé : `make up` et `make run` sont
  deux sélections de services sur la même base, et non deux piles avec des copies
  concurrentes des données.
- **Seuls les identifiants de la base sont dans `environment:` pour `web`** —
  tout le reste vit dans `src/backend/.env`, que `settings.py` charge via le
  montage. Les variables définies dans compose ont la priorité sur ce fichier et
  videraient en silence ce qu'il définit (`GROQ_API_KEY: ${GROQ_API_KEY:-}` étant
  le piège évident) ; les clés `POSTGRES_*` ne risquent rien, ce fichier n'en
  contenant aucune.

### Ce qui n'est pas fait ici

- **Docs reste sur sa propre origine.** L'API des connecteurs réclame
  l'en-tête `X-Docs-Session` parce que les cookies de ce service ne
  franchissent pas les ports. Drive n'en a plus besoin — la connexion conserve
  sa session côté serveur (`src/backend/accounts/README.md`) — mais ce n'est
  pas encore le cas de Docs. nginx pourrait aussi le relayer sous cette
  origine, ce qui modifierait le contrat d'authentification de l'API : cela
  n'a donc pas été décidé seul.
- **Django tourne toujours avec `runserver`**, le serveur de développement. nginx
  n'y change rien ; un vrai déploiement mettrait gunicorn (ou équivalent)
  derrière lui et servirait les fichiers statiques collectés depuis le disque
  plutôt que de relayer `/static/`.
- **Pas de TLS.** Tout est en HTTP simple sur localhost.
