# Déployer Pass‘on à côté de Drive et Messages

Pass‘on ne stocke ni compte ni document : il se connecte à **Drive** et à
**Messages**, avec les identifiants de la personne qui l'utilise. Le faire
tourner demande donc ces deux services à côté, et surtout un compte qui existe
dans les deux. C'est là que se trouvent tous les pièges, et ce document les
liste dans l'ordre où on les rencontre.

Tout ce qui suit décrit une installation **locale de développement**, celle
qu'utilise l'équipe. Rien ici n'est une configuration de production.

---

## 1. Ce qui tourne, et sur quel port

| Port | Service | Projet |
| --- | --- | --- |
| **8090** | **Pass‘on** — l'application (nginx + frontend compilé + API) | ce dépôt |
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

## 2. Démarrer les trois projets

Les trois dépôts sont voisins (`~/hackathon/drive`, `~/hackathon/messages`,
`~/hackathon/Relais_Dinum`). L'ordre a son importance : Pass‘on interroge les
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
cd ~/hackathon/Relais_Dinum
make up                   # postgres + Django + nginx  ->  http://localhost:8090
```

`make run` côté Drive compile une interface Next.js : le premier chargement de
`:3000` prend une quinzaine de secondes, ce n'est pas un blocage.

Côté Pass‘on, `make up` lance tout ; `make run` ne lance que postgres et
Django, pour travailler sur l'API seule. **Si `:8090` ne répond pas, c'est
généralement que nginx n'est pas démarré** — donc que `make run` a été lancé à
la place de `make up`.

---

## 3. Configurer Pass‘on

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

## 4. Les comptes : le point qui coince

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

## 5. Donner de la matière à résumer

Une passation se génère à partir de vrais documents et de vrais mails. Un
compte neuf n'a ni l'un ni l'autre, et la génération répond alors
`no_data_to_summarize` — ce n'est pas une panne.

```bash
cd ~/hackathon/Relais_Dinum
docker compose exec web python manage.py seed_demo \
  --email vous@mondomaine.fr --password '...'
```

Cette commande dépose cinq documents dans le Drive de la personne et six mails
dans sa boîte, écrits pour que chaque section du résumé ait de quoi se
remplir. Détail dans
[`src/backend/passon/demo_data/README.md`](../src/backend/passon/demo_data/README.md).

## 6. Créer un manager

Le rôle n'existe que chez nous, Drive n'en sait rien :

```bash
docker compose exec web python manage.py set_role vous@mondomaine.fr manager
```

La personne n'a pas besoin d'être déjà connectée : la fiche est créée sans
identifiant Drive, et sa première connexion la rattache à son compte par
l'email.

---

## 7. Pannes fréquentes, et ce qu'elles veulent dire

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

## 8. Pourquoi le code s'adresse aux services comme il le fait

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
