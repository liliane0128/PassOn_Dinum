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

### The second site (:8091) — homepage and new dashboard

The project is migrating to a new frontend (`src/passon-frontend`, Next.js),
and that migration is happening step by step. So nginx serves a **second,
independent site** on :8091 rather than taking anything away from :8090: the
old application keeps working exactly as it did while the new one is built
beside it.

```
browser ---> nginx (:8091) ---> /           the homepage (static, src/server/html)
                           \--> /dashboard  host:3001  (Next.js, prefix stripped)
                            \-> /login      host:3001  (same path on both sides)
                             \> /_next/     host:3001  (its assets and hot reload)
                              \> /equipe    host:3001
                               \> /api/     web:8000   (Django, same as :8090)
```

`/api/` is proxied here as well, and that is not a convenience. The session
lives in a cookie and Django checks the browser's `Origin` against its own host
before accepting a POST, so the app and the API have to share an origin. Served
from another one, the login would need CORS *and* an entry in
`CSRF_TRUSTED_ORIGINS`, and the cookie would still be dropped by a browser that
blocks third-party cookies.

The homepage is a hand-written page with no build step, laid out like the
ui-kit's `Hero`, whose single button points at `/dashboard`.

That button is the reason for the proxy, and the path is passed through
unchanged: the app serves `/dashboard` at `/dashboard`. The prefix used to be
stripped, which made the app's own `/` the dashboard while `/` here is the
homepage — one URL with two meanings, and a `<Link href="/">` in the interface
landed on the landing page instead of the dashboard. The app's other route and
its assets live at the root, which is why `/login`, `/equipe` and `/_next/` are
proxied as they are. Run on its own, the app redirects `/` to `/dashboard`, so
:3001 still works.

The Next app is **not containerised yet**: it runs on the host, and nginx
reaches it through `host.docker.internal`, which `docker-compose.yml` maps to
the host gateway. So :8091 serves the homepage on its own, and the button leads
somewhere only while that dev server is running:

```sh
cd src/passon-frontend && npm install && npm run dev -- -p 3001
```

Without it, the homepage still loads and `/dashboard` answers `502`.

### Files

| File | Role |
| --- | --- |
| `conf.d/default.conf` | the nginx site: what is served, what is proxied |
| `html/` | the homepage served on :8091 — one HTML file, its CSS and its images |
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

- **Docs and Messages are still on their own origins.** The connectors API asks
  for `X-Docs-Session` / `X-Messages-Session` headers because those services'
  cookies do not cross ports. Drive no longer needs one — logging in stores its
  session server-side (`src/backend/accounts/README.md`) — but the same is not
  yet done for the other two. nginx could alternatively proxy them under this
  origin, which changes the API's authentication contract, so it has not been
  done unilaterally.
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

### Le second site (:8091) — page d'accueil et nouveau tableau de bord

Le projet migre vers un nouveau frontend (`src/passon-frontend`, en Next.js), et
cette migration se fait par étapes. nginx sert donc un **second site
indépendant** sur :8091, plutôt que de retirer quoi que ce soit à :8090 :
l'ancienne application continue de fonctionner à l'identique pendant que la
nouvelle se construit à côté.

```
navigateur ---> nginx (:8091) ---> /           la page d'accueil (statique, src/server/html)
                              \--> /dashboard  host:3001  (Next.js, préfixe retiré)
                               \-> /login      host:3001  (même chemin des deux côtés)
                                \> /_next/     host:3001  (ses fichiers et le rechargement à chaud)
                                 \> /equipe    host:3001
                                  \> /api/     web:8000   (Django, comme sur :8090)
```

`/api/` est relayé ici aussi, et ce n'est pas un confort. La session tient dans
un cookie, et Django compare l'en-tête `Origin` du navigateur à son propre hôte
avant d'accepter un POST : l'application et l'API doivent donc partager une
origine. Servie depuis une autre, la connexion demanderait CORS *et* une entrée
dans `CSRF_TRUSTED_ORIGINS`, et le cookie serait de toute façon écarté par un
navigateur qui bloque les cookies tiers.

La page d'accueil est écrite à la main, sans étape de compilation, sur la
structure du `Hero` du ui-kit, et son unique bouton pointe vers `/dashboard`.

C'est ce bouton qui justifie le relais, et le chemin est transmis tel quel :
l'application sert `/dashboard` sur `/dashboard`. Le préfixe était auparavant
retiré, si bien que le `/` de l'application était le tableau de bord alors que
le `/` d'ici est la page d'accueil — une même URL pour deux choses, et un
`<Link href="/">` de l'interface menait à la page d'accueil au lieu du tableau
de bord. Son autre route et ses fichiers vivent à la racine, d'où le relais de
`/login`, `/equipe` et `/_next/` tels quels. Lancée seule, l'application redirige
`/` vers `/dashboard`, et :3001 reste donc utilisable.

L'application Next **n'est pas encore conteneurisée** : elle tourne sur la
machine, et nginx la joint par `host.docker.internal`, que `docker-compose.yml`
fait pointer vers la passerelle de l'hôte. Le :8091 sert donc la page d'accueil
tout seul, mais le bouton ne mène quelque part que si ce serveur de
développement tourne :

```sh
cd src/passon-frontend && npm install && npm run dev -- -p 3001
```

Sans lui, la page d'accueil s'affiche toujours et `/dashboard` répond `502`.

### Fichiers

| Fichier | Rôle |
| --- | --- |
| `conf.d/default.conf` | le site nginx : ce qui est servi, ce qui est relayé |
| `html/` | la page d'accueil servie sur :8091 — un fichier HTML, son CSS et ses images |
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

- **Docs et Messages restent sur leurs propres origines.** L'API des connecteurs
  réclame les en-têtes `X-Docs-Session` / `X-Messages-Session` parce que les
  cookies de ces services ne franchissent pas les ports. Drive n'en a plus
  besoin — la connexion conserve sa session côté serveur
  (`src/backend/accounts/README.md`) — mais ce n'est pas encore le cas des deux
  autres. nginx pourrait aussi les relayer sous cette origine, ce qui modifierait
  le contrat d'authentification de l'API : cela n'a donc pas été décidé seul.
- **Django tourne toujours avec `runserver`**, le serveur de développement. nginx
  n'y change rien ; un vrai déploiement mettrait gunicorn (ou équivalent)
  derrière lui et servirait les fichiers statiques collectés depuis le disque
  plutôt que de relayer `/static/`.
- **Pas de TLS.** Tout est en HTTP simple sur localhost.
