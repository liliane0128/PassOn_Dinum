# Demo dataset · Jeu de données de démonstration

*[English](#english) · [Français](#français)*

---

## English

The handover only means something with material to summarize, and that material
lives in **Drive** and **Messages**, not in our database — so it does not
survive wiping either of those stacks. This folder holds it, and
`manage.py seed_demo` puts it back.

```sh
python manage.py seed_demo --email you@example.test --password ...
```

Everything is written **as that person**, through the same APIs their own
client uses: the documents are uploaded to their Drive, the mails delivered to
their mailbox through Messages' inbound MTA endpoint. The result is
indistinguishable from files they uploaded and mail they received — same
parsing, same threading, same indexing.

Re-running is safe: a document whose title is already in the Drive, and a mail
whose subject is already in the mailbox, are skipped. `--skip-drive` and
`--skip-mails` do one side only. On a deployment that does not read
mail (`DINUM_ENABLED_SERVICES`), the mails are still delivered but never read,
so `--skip-mails` is the option that matches; the `shared/` documents below
are written for exactly that case.

The account must already exist in **both** services' Keycloaks with the same
password, and its email domain must be autojoin-enabled in Messages — see
[`../../accounts/README.md`](../../accounts/README.md), which covers both.

### What the data is

A French local-government caseload: an agent leaving on 1 October, mid-way
through a subsidy campaign, an accessibility programme and a stack of citizen
requests.

| File | Feeds |
| --- | --- |
| `documents/note-passation-subventions-2026.md` | decisions (plafond à 12 000 €), actions, the Ateliers du Faubourg blocker |
| `documents/compte-rendu-comite-technique-2026-09-10.md` | decisions, the departure itself, deadlines |
| `documents/dossier-adap-accessibilite.md` | blockers (ascenseur, DETR refusée), deadline of 31 October |
| `documents/suivi-demandes-citoyens-septembre.csv` | a table of dated, per-request deadlines |
| `documents/procedure-instruction-permis.md` | context and pitfalls, few extractable facts by design |
| `mails/01-abf.eml` | blocker (avis suspendu) + a decision on materials |
| `mails/02-juridique.eml` | blocker (vice de procédure) + deadline |
| `mails/03-prefecture.eml` | hard deadline (31 October, no extension) + action |
| `mails/04-entreprise.eml` | blocker (rupture fournisseur) + action |
| `mails/05-adjointe.eml` | decisions from an elected official + two deadlines |
| `mails/06-sofia.eml` | blocker (trésorier) + a pending action |

They are written so each of the six sections of the generated handover has
something to find — a summary that comes back with empty sections on this data
means the pipeline is broken, not that the data is thin.

### Three people who share files: `shared/`

`seed_demo` fills one account. The `shared/` folder fills a *team*, and is put
in place by two commands run in order:

```sh
python manage.py seed_profiles      # the people
python manage.py seed_shared_docs   # what they share
```

`seed_profiles` creates three demo profiles -- names, addresses, passwords,
job titles, reporting lines and optional pictures, all editable in the
`PROFILES` block at the top of the file. Each gets an account in Drive's
Keycloak, registered through the realm's own registration form, and a
`Collaborator` row here for what Drive does not know (role, team, manager).

`seed_shared_docs` then uploads the four documents below to their owner's
Drive and shares them, read-only, with the colleagues named in its
`SHARED_DOCUMENTS` block. Passwords are not repeated there: they are read from
`seed_profiles.PROFILES`, which stays the one place to edit them.

| File | Owner | Shared with | Feeds |
| --- | --- | --- | --- |
| `shared/note-cadrage-service-urbanisme.md` | Camille Ferrand | Bastien, Inès | decisions (plafond, instruction internalisée), blockers, the 31 December deadline |
| `shared/dossier-permis-tanneurs.md` | Bastien Morel | Camille | blockers (ABF suspendu, étude de sol manquante), a commission date |
| `shared/subventions-associations-2026.md` | Inès Royer | Camille, Bastien | blockers (comptes certifiés), deadlines, pending actions |
| `shared/plan-charge-2026.md` | Camille Ferrand | Inès | the workload split, a frozen recruitment, decisions |
| `shared/travaux-groupe-scolaire.md` | Camille Ferrand | Bastien, Inès | blockers (asbestos found, contractor in receivership), a subsidy that lapses, three deadlines |
| `shared/marche-entretien-voirie.md` | Inès Royer | Camille, Bastien | blockers (a pre-contractual injunction, frozen appropriations, the current contract ending), decisions |

Ownership is what makes them worth having. A document someone else owns gives
the handover two things it cannot get from a solo account: a **key contact**,
since `contactsFromItems()` counts document owners as well as mail senders --
which matters as mail is on its way out of the product -- and more **points de
blocage**, because these four documents are written around real obstacles
rather than around a single person's to-do list.

To put the same material in a **real** account -- the one you log in with
yourself -- add it as a recipient:

```sh
python manage.py seed_shared_docs --share-with you@your-domain.example
```

Repeatable, and it needs no password for that account: sharing only ever uses
the owner's session, so the command grants an access and never opens a session
of yours. The documents then appear in that Drive like any shared dossier, and
the handover generated from it gains their blockers and their owners as
contacts.

Re-running either command is safe. A profile whose Drive account already works
is left alone (its password is not reset, which would lock out whoever is using
it), a document already in its owner's Drive is not uploaded twice, and an
access that already exists is left as it is.

### Everything is invented

No real person, address or case. The names are fictional, and the external
correspondents are there because a handover with no outside contact would not
exercise the contacts section.

Their addresses sit under `.gouv.example`. `.example` is reserved by RFC 2606
and can never resolve, so nothing here can be mistaken for — or accidentally
sent to — a real administration. Earlier versions used real domains
(`abf.culture.gouv.fr`, `eure.gouv.fr`), which made invented correspondence
look as though it came from an actual ministry or préfecture.

---

## Français

Une passation n'a de sens que s'il y a matière à résumer, et cette matière vit
dans **Drive** et **Messages**, pas dans notre base — elle ne survit donc pas à
l'effacement de l'une ou l'autre de ces piles. Ce dossier la conserve, et
`manage.py seed_demo` la remet en place.

```sh
python manage.py seed_demo --email vous@example.test --password ...
```

Tout est écrit **au nom de cette personne**, via les mêmes API que son propre
client : les documents sont déposés dans son Drive, les mails livrés dans sa
boîte par le point d'entrée MTA de Messages. Le résultat est indiscernable de
fichiers qu'elle aurait déposés et de mails qu'elle aurait reçus — même analyse,
même mise en fil de discussion, même indexation.

Relancer la commande ne risque rien : un document dont le titre est déjà dans le
Drive, un mail dont l'objet est déjà dans la boîte, sont ignorés. `--skip-drive`
et `--skip-mails` ne traitent qu'un côté. Sur un déploiement qui ne lit pas le mail
(`DINUM_ENABLED_SERVICES`), les mails sont toujours livrés mais jamais lus :
`--skip-mails` est alors l'option qui correspond, et les documents de
`shared/` ci-dessous sont écrits précisément pour ce cas.

Le compte doit exister dans les Keycloak des **deux** services avec le même mot
de passe, et le domaine de son adresse doit être « autojoin » côté Messages —
voir [`../../accounts/README.md`](../../accounts/README.md), qui couvre les deux
points.

### Ce que contiennent les données

Un dossier de collectivité territoriale : un agent qui part le 1er octobre, au
milieu d'une campagne de subventions, d'un programme d'accessibilité et d'une
pile de demandes citoyennes.

| Fichier | Alimente |
| --- | --- |
| `documents/note-passation-subventions-2026.md` | décisions (plafond à 12 000 €), actions, blocage des Ateliers du Faubourg |
| `documents/compte-rendu-comite-technique-2026-09-10.md` | décisions, le départ lui-même, échéances |
| `documents/dossier-adap-accessibilite.md` | blocages (ascenseur, DETR refusée), échéance du 31 octobre |
| `documents/suivi-demandes-citoyens-septembre.csv` | un tableau d'échéances datées, demande par demande |
| `documents/procedure-instruction-permis.md` | du contexte et des pièges, volontairement peu de faits extractibles |
| `mails/01-abf.eml` | blocage (avis suspendu) + une décision sur les matériaux |
| `mails/02-juridique.eml` | blocage (vice de procédure) + échéance |
| `mails/03-prefecture.eml` | échéance ferme (31 octobre, sans prorogation) + action |
| `mails/04-entreprise.eml` | blocage (rupture fournisseur) + action |
| `mails/05-adjointe.eml` | décisions d'une élue + deux échéances |
| `mails/06-sofia.eml` | blocage (trésorier) + une action en attente |

Ils sont écrits pour que chacune des six rubriques de la passation générée ait de
quoi se remplir : un résumé qui revient avec des rubriques vides sur ces
données-là signale une chaîne cassée, pas des données trop maigres.

### Trois personnes qui se partagent des fichiers : `shared/`

`seed_demo` remplit un compte. Le dossier `shared/` remplit une *équipe*, et se
met en place avec deux commandes, dans cet ordre :

```sh
python manage.py seed_profiles      # les personnes
python manage.py seed_shared_docs   # ce qu'elles se partagent
```

`seed_profiles` crée trois profils de démonstration — noms, adresses, mots de
passe, intitulés de poste, lignes hiérarchiques et photos facultatives, tous
modifiables dans le bloc `PROFILES` en tête de fichier. Chacun reçoit un compte
dans le Keycloak de Drive, créé via le formulaire d'inscription du royaume
lui-même, et une ligne `Collaborator` ici pour ce que Drive ignore (rôle,
équipe, responsable).

`seed_shared_docs` dépose ensuite les quatre documents ci-dessous dans le Drive
de leur propriétaire et les partage, en lecture seule, avec les collègues
nommés dans son bloc `SHARED_DOCUMENTS`. Les mots de passe n'y sont pas répétés
: ils sont lus dans `seed_profiles.PROFILES`, qui reste le seul endroit à
modifier.

| Fichier | Propriétaire | Partagé avec | Alimente |
| --- | --- | --- | --- |
| `shared/note-cadrage-service-urbanisme.md` | Camille Ferrand | Bastien, Inès | décisions (plafond, instruction internalisée), blocages, échéance du 31 décembre |
| `shared/dossier-permis-tanneurs.md` | Bastien Morel | Camille | blocages (avis ABF suspendu, étude de sol manquante), date de commission |
| `shared/subventions-associations-2026.md` | Inès Royer | Camille, Bastien | blocages (comptes certifiés), échéances, actions en attente |
| `shared/plan-charge-2026.md` | Camille Ferrand | Inès | la répartition de la charge, un recrutement gelé, des décisions |
| `shared/travaux-groupe-scolaire.md` | Camille Ferrand | Bastien, Inès | blocages (amiante découverte, entreprise en redressement), une subvention qui tombe, trois échéances |
| `shared/marche-entretien-voirie.md` | Inès Royer | Camille, Bastien | blocages (référé précontractuel, crédits gelés, fin du marché en cours), décisions |

C'est la propriété qui fait leur intérêt. Un document appartenant à quelqu'un
d'autre apporte à la passation deux choses qu'un compte isolé ne peut pas
donner : un **contact clé**, puisque `contactsFromItems()` compte les
propriétaires de documents autant que les expéditeurs de mails — ce qui compte
d'autant plus que le mail est appelé à quitter le produit — et davantage de
**points de blocage**, parce que ces quatre documents sont écrits autour
d'obstacles réels plutôt qu'autour de la liste de tâches d'une seule personne.

Pour mettre la même matière dans un **vrai** compte — celui avec lequel on se
connecte soi-même — il suffit de l'ajouter comme destinataire :

```sh
python manage.py seed_shared_docs --share-with vous@votre-domaine.example
```

L'option est répétable et ne demande aucun mot de passe pour ce compte : le
partage n'utilise jamais que la session du propriétaire, la commande accorde
un accès sans jamais ouvrir de session à votre nom. Les documents apparaissent
alors dans ce Drive comme n'importe quel dossier partagé, et la passation
générée y gagne leurs blocages et leurs propriétaires comme contacts.

Relancer l'une ou l'autre commande ne risque rien : un profil dont le compte
Drive fonctionne déjà est laissé tel quel (son mot de passe n'est pas
réinitialisé, ce qui mettrait dehors la personne qui s'en sert), un document
déjà présent dans le Drive de son propriétaire n'est pas déposé deux fois, et
un accès déjà accordé est laissé en place.

### Tout est inventé

Aucune personne, adresse ou affaire réelle. Les noms sont fictifs, et les
correspondants extérieurs sont là parce qu'une passation sans aucun contact hors
de la collectivité n'exercerait pas la rubrique des contacts.

Leurs adresses sont en `.gouv.example`. Le domaine `.example` est réservé par la
RFC 2606 et ne peut jamais se résoudre : rien ici ne peut donc être pris pour une
administration réelle, ni lui être envoyé par mégarde. Les versions précédentes
utilisaient de vrais domaines (`abf.culture.gouv.fr`, `eure.gouv.fr`), ce qui
donnait à une correspondance inventée l'apparence d'un vrai ministère ou d'une
vraie préfecture.
