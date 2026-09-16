# passon — who works with whom, and what their handover says
# passon — qui travaille avec qui, et ce que dit sa passation

*[English](#english) · [Français](#français)*

---

## English

### What this app is for

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

### Why one table for people, not Manager + User

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

### Fields worth explaining

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

### What is deliberately not here

- **No `Content` table.** Items are fetched live from Drive and Messages by
  `connectors/` and already carry their real ids and URLs. Storing copies would
  mean owning a cache with no invalidation story — when to re-sync, what to do
  about deleted files. The references a handover actually cites live in
  `sections`.
- **No record of shares.** Sending a handover by mail goes out through
  Messages (`…/handover/send/`) and is not recorded here. A small
  `HandoverShare(handover, recipient, sent_at)` would cover "sent to X on Y"
  the day that trace is wanted; nothing depends on it today.
- **No passwords, no `AUTH_USER_MODEL`.** Keycloak owns authentication. The
  default `auth.User` stays as the admin login; this app holds domain data.

### What reads and writes these tables

- **Logging in** resolves the Drive identity to a `Collaborator`, creating the
  row on a first login and claiming by email one a manager created earlier
  (`accounts/collaborators.py`). The role is never touched there: it is ours to
  decide, so a promotion survives every subsequent login.
- **`/api/auth/login/` and `/api/auth/me/`** return that person's `accountRole`
  and, for a manager, their team. The interface routes on those values — it no
  longer decides anything from mock data.
- **`/api/collaborators/`** lets a manager search, attach and detach team
  members; **`/api/collaborators/<id>/handover/`** reads, edits and validates a
  sheet; **`…/handover/send/`** mails it.
- **`manage.py set_role <email> manager|employee`** is how a manager account
  comes to exist, since nothing in the interface grants a role.

What is still open: a collaborator with no manager is invisible to every team
view (removal detaches rather than deletes), and nothing lists those people
except the Django admin.

### Demo data

The upstream services hold what the handover is generated from, so a wiped
Drive or Messages leaves the app with nothing to summarize.
`manage.py seed_demo` rebuilds that material — see
[`demo_data/README.md`](demo_data/README.md).

### Tests

```sh
python manage.py test passon
```

They are written per feature rather than per constraint — "a manager can add a
collaborator who has no Drive account yet", "removing a manager keeps their
team" — so that a later change to the models fails against the thing it would
break.

---

## Français

### À quoi sert cette application Django

L'identité vit dans **Drive** (et Messages) : on se connecte avec ces comptes, et
aucun mot de passe n'est stocké ici — voir [`../accounts/README.md`](../accounts/README.md).
Cette application stocke les deux choses que ces services ignorent :

- **qui rend compte à qui**, et qui est manager, ce qui détermine de qui on a le
  droit de lire la passation ;
- **la passation elle-même**, qui ne vivait auparavant que dans la mémoire du
  navigateur (`SummaryContext`) et disparaissait à chaque rechargement.

```
Collaborator ──manager──> Collaborator        (auto-référence, nullable)
     │
     └──handover──> Handover                  (au plus une par personne)
```

### Pourquoi une seule table de personnes, plutôt que Manager + User

Un manager est une personne, pas une autre espèce d'enregistrement. Il prend des
congés, il part, il rend compte à quelqu'un — ce qui est précisément le sujet de
ce produit. Le séparer dans sa propre table voudrait dire qu'un manager ne peut
pas avoir de passation, ne peut pas posséder de documents et ne peut pas avoir de
manager ; et cela rendrait le sommet de la hiérarchie impossible à représenter,
puisque la clé étrangère ne pourrait jamais être nulle.

Cela correspond aussi à l'interface, qui a toujours eu une seule liste de
collaborateurs avec un `role` et un `managerId`.

La table s'appelle `Collaborator` et non `User` parce que `django.contrib.auth` a
déjà un `User` — celui-là sert à la connexion à l'admin et n'a rien à voir avec
les personnes du produit.

### Des champs qui méritent une explication

**`external_id` est nullable.** Il contient l'identifiant que Drive renvoie à la
connexion, et reste `NULL` tant que la personne ne s'est pas connectée une
première fois. Un manager peut ajouter un collaborateur qui n'a pas encore de
compte Drive ; sa fiche est rattachée à son identité Drive par l'email à sa
première connexion. Rendre ce champ obligatoire rendrait la fonction « ajouter un
collaborateur » impossible. Il reste unique, et plusieurs fiches peuvent attendre
leur première connexion, SQL ne considérant pas deux NULL comme des doublons.

**`manager` utilise `SET_NULL`, pas `CASCADE`.** Le départ d'un manager ne doit
pas supprimer son équipe — c'est exactement la situation que l'application existe
pour traiter. Pour la même raison, retirer quelqu'un d'une équipe le détache
(`manager = NULL`) plutôt que de le supprimer : quitter une équipe n'est pas
quitter l'organisation, et supprimer la ligne emporterait sa passation, son poste
et son rattachement à Drive. Supprimer un collaborateur pour de bon supprime bien
sa passation, mais rien dans l'interface ne le fait aujourd'hui.

**`sections` est du JSON.** Ce champ contient les six listes structurées
qu'affiche l'interface (actions, décisions, échéances, blocages, contacts,
documents). Elles sont toujours lues et écrites ensemble, leur forme bouge
encore, et les documents qu'elles citent sont des références à des éléments qui
vivent dans Drive et Messages (`{"id": "drive:<uuid>", "title": ..., "url": ...}`),
pas des lignes à nous. Six tables achèteraient une intégrité dont nous n'avons pas
besoin et qu'il faudrait remodeler à chaque évolution de l'invite.

### Ce qui n'y est délibérément pas

- **Pas de table `Content`.** Les éléments sont lus en direct dans Drive et
  Messages par `connectors/` et portent déjà leurs vrais identifiants et URL. En
  stocker des copies reviendrait à tenir un cache sans stratégie d'invalidation —
  quand resynchroniser, que faire des fichiers supprimés. Les références qu'une
  passation cite vraiment vivent dans `sections`. *(Une exception assumée existe
  depuis : `CollaboratorItem`, la photo qui permet à un manager de voir les
  documents d'un collaborateur ; voir `item_views.py`.)*
- **Pas de trace des envois.** L'envoi d'une passation par mail passe par
  Messages (`…/handover/send/`) et n'est pas enregistré ici. Un petit
  `HandoverShare(handover, recipient, sent_at)` couvrirait « envoyé à X le Y » le
  jour où cette trace sera voulue ; rien n'en dépend aujourd'hui.
- **Pas de mots de passe, pas d'`AUTH_USER_MODEL`.** Keycloak gère
  l'authentification. Le `auth.User` par défaut reste la connexion à l'admin ;
  cette application porte les données métier.

### Qui lit et écrit ces tables

- **La connexion** relie l'identité Drive à un `Collaborator` : elle crée la
  fiche à la première connexion, ou reprend celle qu'un manager avait créée, par
  l'email (`accounts/collaborators.py`). Le rôle n'y est jamais touché : il nous
  appartient, donc une nomination survit à toutes les connexions suivantes.
- **`/api/auth/login/` et `/api/auth/me/`** renvoient l'`accountRole` de la
  personne et, pour un manager, son équipe. L'interface s'oriente sur ces
  valeurs — elle ne décide plus rien à partir de données mockées.
- **`/api/collaborators/`** permet à un manager de chercher, rattacher et
  détacher des membres ; **`/api/collaborators/<id>/handover/`** lit, modifie et
  valide une passation ; **`…/handover/send/`** l'envoie par mail.
- **`manage.py set_role <email> manager|employee`** est ce qui crée un compte
  manager, puisque rien dans l'interface n'attribue de rôle.

Reste ouvert : un collaborateur sans manager n'apparaît dans aucune vue d'équipe
(le retrait détache au lieu de supprimer), et rien ne liste ces personnes en
dehors de l'admin Django.

### Données de démonstration

Ce sont les services de La Suite qui détiennent la matière à résumer : un Drive
ou un Messages effacé laisse l'application sans rien à résumer.
`manage.py seed_demo` reconstitue cette matière — voir
[`demo_data/README.md`](demo_data/README.md).

### Tests

```sh
python manage.py test passon
```

Ils sont écrits par fonctionnalité plutôt que par contrainte — « un manager peut
ajouter un collaborateur qui n'a pas encore de compte Drive », « retirer un
manager conserve son équipe » — pour qu'une modification ultérieure des modèles
échoue sur ce qu'elle casserait.
