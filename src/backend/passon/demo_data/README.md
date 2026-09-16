# Demo dataset

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

## What the data is

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

## Everything is invented

No real person, address or case. The names are fictional and the `@…gouv.fr`
addresses are plausible-looking inventions, present because a handover with no
external correspondents would not exercise the contacts section.
