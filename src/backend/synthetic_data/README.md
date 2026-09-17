# Synthetic handover dataset · Jeu de données synthétique

*[English](#english) · [Français](#français)*

---

## English

Synthetic workspace for Camille Faure (instructrice urbanisme, mairie de
Sainte-Radegonde, leaves her post in two weeks; her manager is Nathalie
Prigent, cheffe du service urbanisme), built to evaluate the handover
pipeline (`connectors/extraction.py` + `connectors/generation.py`) against a
**known ground truth**, without using any real employee data.

Rewritten (2026-09) to match a product pivot agreed with the sponsor: fewer,
denser work streams (4 instead of 6), each project now carries a `priority`
level and a `type` (`"personal"` vs `"collective"`) to test dossier
prioritization/classification, `contacts` is meant to be shown to the
manager specifically, and one project (`pc-rateau`) is deliberately
low-contact/single-stakeholder to contrast against the others' cross-service
`"collective"` footprint. The previous scenario (Sophie Vasseur, mairie de
Verneuil-sur-Aveyron, catastrophe naturelle) is still in git history if
needed.

This is a separate, purpose-built evaluation dataset -- it does not replace
or modify `connectors/mock_data.py` (the small fixture used for local UI
demos), which is left untouched.

### Hard rule: ground truth never reaches the LLM

- `ground_truth.json` and `evaluation/` are for scoring only. Never pass
  their contents into `extraction.normalize_items()` or
  `generation.generate_dossier()`.
- `workspace/` is the only thing the pipeline is allowed to see -- it's
  meant to stand in for what Sophie actually has across Docs/Drive/Messages.

### Layout

```
synthetic_data/
    ground_truth.json          # per-project decisions/actions/deadlines/
                                # blockers/contacts/key_documents, each fact
                                # tagged with the workspace item id(s) that
                                # support it (evidence_ids)
    workspace/
        docs.json               # doc-NNN items, shaped like docs_client's
                                 # real payloads (id/title/creator/
                                 # created_at/updated_at/excerpt)
        drive.json               # drive-NNN items, shaped like drive_client's
                                 # (id/title/type/mimetype/creator/
                                 # created_at/updated_at/description)
        messages.json            # mail-NNN items, shaped like messages_client's
                                 # (id/subject/sender/sent_at/textBody)
    evaluation/
        expected_projects.json  # workspace item id -> project id (or null
                                 # for noise/routine items) -- for scoring
                                 # project identification & noise filtering
    load.py                     # reads workspace/*.json, returns the three
                                 # raw lists normalize_items() expects
```

### Design notes (why some items look the way they do)

- IDs (`doc-001`, `drive-001`, `mail-001`, ...) are stable and stay the same
  as `id` after `extraction.normalize_items()` prefixes them
  (`docs:doc-001`, etc.) -- this is what lets the LLM's output cite evidence
  by id.
- Facts are deliberately **not** collected into one summary document --
  they're spread across sources the way a real workspace would scatter them,
  and some facts appear in more than one place.
- A few items are intentionally stale (e.g. an early promise that a later
  message contradicts) to test whether the pipeline prefers the latest
  information over an outdated one.
- Closed projects and routine/administrative noise are included on purpose
  -- the pipeline should recognize a closed project as closed and not
  surface routine noise as a handover priority.

### Known gap (as of this rewrite)

A real run against this dataset (`results/full_run.json`) shows
`generation.py`'s current prompt does **not** reliably exclude the noise
items: the coffee-machine-outage and badge-renewal reminders (`mail-020`,
`mail-021`) showed up as `deadlines` and in the summary `text`. The
project-level facts (decisions/actions/blockers/deadlines, the closed
project, the personal-vs-collective split) all came out correctly -- only
the routine-noise exclusion is weak. `SYSTEM_PROMPT` has no explicit
instruction to drop routine administrative noise; it only asks the model to
avoid inventing facts, which these items don't do (they're real, just not
handover-relevant). Left as-is on purpose so it stays a live test the
prompt can be checked against, rather than quietly cherry-picking a run that
happened to look clean.

### Running it

```sh
python manage.py run_synthetic_dossier
```
(management command lives at
`connectors/management/commands/run_synthetic_dossier.py`)

---

## Français

Espace de travail synthétique pour Camille Faure (instructrice urbanisme,
mairie de Sainte-Radegonde, qui quitte son poste dans deux semaines ; sa
manager est Nathalie Prigent, cheffe du service urbanisme), construit pour
évaluer la chaîne de passation (`connectors/extraction.py` +
`connectors/generation.py`) face à une **vérité terrain connue**, sans
utiliser la moindre donnée réelle d'un agent.

Réécrit (09/2026) suite à un pivot produit validé avec le commanditaire :
moins de chantiers mais plus denses (4 au lieu de 6), chaque projet porte
désormais une `priority` et un `type` (`"personal"` vs `"collective"`) pour
tester la priorisation/classification des dossiers, `contacts` est pensé
pour être montré surtout au manager, et un projet (`pc-rateau`) est
volontairement peu collectif (un seul contact) pour contraster avec le
profil transversal des autres. L'ancien scénario (Sophie Vasseur, mairie de
Verneuil-sur-Aveyron, catastrophe naturelle) reste consultable dans
l'historique git si besoin.

C'est un jeu d'évaluation à part, construit pour cet usage : il ne remplace ni ne
modifie `connectors/mock_data.py` (le petit jeu utilisé pour les démonstrations
locales de l'interface), laissé intact.

### Règle absolue : la vérité terrain n'atteint jamais le LLM

- `ground_truth.json` et `evaluation/` servent uniquement à noter. Ne jamais
  passer leur contenu à `extraction.normalize_items()` ni à
  `generation.generate_dossier()`.
- `workspace/` est la seule chose que la chaîne a le droit de voir : il tient
  lieu de ce que Sophie possède réellement dans Docs, Drive et Messages.

### Organisation

```
synthetic_data/
    ground_truth.json          # par projet : décisions / actions / échéances /
                                # blocages / contacts / documents clés, chaque
                                # fait étant rattaché aux identifiants d'éléments
                                # qui l'étayent (evidence_ids)
    workspace/
        docs.json               # éléments doc-NNN, à la forme des réponses
                                 # réelles de docs_client (id/title/creator/
                                 # created_at/updated_at/excerpt)
        drive.json               # éléments drive-NNN, à la forme de drive_client
                                 # (id/title/type/mimetype/creator/
                                 # created_at/updated_at/description)
        messages.json            # éléments mail-NNN, à la forme de
                                 # messages_client (id/subject/sender/
                                 # sent_at/textBody)
    evaluation/
        expected_projects.json  # identifiant d'élément -> identifiant de projet
                                 # (ou null pour le bruit et la routine) — pour
                                 # noter l'identification des projets et le
                                 # filtrage du bruit
    load.py                     # lit workspace/*.json et renvoie les trois
                                 # listes brutes qu'attend normalize_items()
```

### Notes de conception (pourquoi certains éléments sont ainsi)

- Les identifiants (`doc-001`, `drive-001`, `mail-001`, ...) sont stables et
  restent le `id` après le préfixage par `extraction.normalize_items()`
  (`docs:doc-001`, etc.) : c'est ce qui permet à la sortie du LLM de citer ses
  preuves par identifiant.
- Les faits ne sont **pas** rassemblés dans un document unique : ils sont
  dispersés entre les sources comme le ferait un vrai espace de travail, et
  certains apparaissent à plusieurs endroits.
- Quelques éléments sont volontairement périmés (une promesse initiale
  contredite par un message ultérieur, par exemple) pour vérifier que la chaîne
  préfère l'information la plus récente.
- Des projets clos et du bruit administratif de routine sont inclus exprès : la
  chaîne doit reconnaître qu'un projet clos l'est, et ne pas remonter la routine
  comme une priorité de passation.

### Lacune connue (au moment de cette réécriture)

Une exécution réelle sur ce jeu de données (`results/full_run.json`) montre
que le prompt actuel de `generation.py` **n'exclut pas fiablement** le bruit :
le rappel de panne de machine à café et celui de renouvellement de badge
(`mail-020`, `mail-021`) sont ressortis en tant que `deadlines` et dans le
`text` du résumé. Les faits au niveau des projets (décisions/actions/
blocages/échéances, le projet clos, la répartition personnel/collectif) sont
en revanche tous sortis correctement -- seule l'exclusion du bruit de routine
est faible. `SYSTEM_PROMPT` n'a aucune consigne explicite d'écarter le bruit
administratif de routine ; il demande seulement de ne pas inventer de faits,
ce que ces éléments ne font pas (ils sont réels, juste hors-sujet pour la
passation). Laissé tel quel volontairement, pour que ça reste un vrai test
du prompt plutôt qu'un run choisi parce qu'il avait l'air propre.

### Lancer l'évaluation

```sh
python manage.py run_synthetic_dossier
```
(la commande vit dans
`connectors/management/commands/run_synthetic_dossier.py`)
