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
`--skip-mails` do one side only.

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
et `--skip-mails` ne traitent qu'un côté.

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
