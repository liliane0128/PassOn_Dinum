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
  meant to stand in for what Camille actually has across Docs and Drive.

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
    evaluation/
        expected_projects.json  # workspace item id -> project id (or null
                                 # for noise/routine items) -- for scoring
                                 # project identification & noise filtering
    load.py                     # reads workspace/*.json, returns the raw
                                 # lists normalize_items() expects
```

### Design notes (why some items look the way they do)

- IDs (`doc-001`, `drive-001`, ...) are stable and stay the same
  as `id` after `extraction.normalize_items()` prefixes them
  (`docs:doc-001`, etc.) -- this is what lets the LLM's output cite evidence
  by id.
- Facts are deliberately **not** collected into one summary document --
  they're spread across sources the way a real workspace would scatter them,
  and some facts appear in more than one place.
- A few items are intentionally stale (e.g. an early promise that a later
  document contradicts) to test whether the pipeline prefers the latest
  information over an outdated one.
- Closed projects and routine/administrative noise are included on purpose
  -- the pipeline should recognize a closed project as closed and not
  surface routine noise as a handover priority.

### What mail's removal cost this dataset

This dataset was built when the pipeline still read Messages, and mail was
most of it: **21 of its 34 items**. Those are gone, along with the facts only
they could prove, leaving **13 items (7 docs + 6 Drive)** and a ground truth
pruned to match:

| | Before | Now |
| --- | --- | --- |
| Workspace items | 34 | 13 |
| Ground-truth facts | 24 | 10 (5 of which lost a mail citation) |
| `accessibilite-pmr` subset | 11 items | 5 |

Two consequences. A score from this dataset is **not comparable** with one
from before the pruning -- the questions are not the same questions. And the
scenario is thinner than it was designed to be: several projects now rest on
one or two documents, so it exercises extraction more than it exercises
reasoning across scattered, partly contradictory sources, which was the point
of the original.

The known gap recorded here -- that `SYSTEM_PROMPT` did not reliably exclude
routine administrative noise, demonstrated by a coffee-machine and a badge
reminder surfacing as `deadlines` -- was measured on mail items that no longer
exist, so the stored run it cited (`results/full_run.json`) has been removed
rather than left to look current. The weakness itself is a property of the
prompt, not of those items: it has no instruction to drop routine noise, only
to avoid inventing facts. Re-checking it needs fresh noise items on the
documents side.

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
  lieu de ce que Camille possède réellement dans Docs et Drive.

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
    evaluation/
        expected_projects.json  # identifiant d'élément -> identifiant de projet
                                 # (ou null pour le bruit et la routine) — pour
                                 # noter l'identification des projets et le
                                 # filtrage du bruit
    load.py                     # lit workspace/*.json et renvoie les listes
                                 # brutes qu'attend normalize_items()
```

### Notes de conception (pourquoi certains éléments sont ainsi)

- Les identifiants (`doc-001`, `drive-001`, ...) sont stables et
  restent le `id` après le préfixage par `extraction.normalize_items()`
  (`docs:doc-001`, etc.) : c'est ce qui permet à la sortie du LLM de citer ses
  preuves par identifiant.
- Les faits ne sont **pas** rassemblés dans un document unique : ils sont
  dispersés entre les sources comme le ferait un vrai espace de travail, et
  certains apparaissent à plusieurs endroits.
- Quelques éléments sont volontairement périmés (une promesse initiale
  contredite par un document ultérieur, par exemple) pour vérifier que la
  chaîne préfère l'information la plus récente.
- Des projets clos et du bruit administratif de routine sont inclus exprès : la
  chaîne doit reconnaître qu'un projet clos l'est, et ne pas remonter la routine
  comme une priorité de passation.

### Ce que le retrait du mail a coûté à ce jeu de données

Ce jeu de données a été construit quand la chaîne lisait encore Messages, et
le mail en constituait l'essentiel : **21 éléments sur 34**. Ils ont disparu,
avec les faits qu'eux seuls pouvaient prouver, laissant **13 éléments
(7 docs + 6 Drive)** et une vérité terrain élaguée en conséquence :

| | Avant | Maintenant |
| --- | --- | --- |
| Éléments du workspace | 34 | 13 |
| Faits de la vérité terrain | 24 | 10 (dont 5 ont perdu une citation de mail) |
| Sous-ensemble `accessibilite-pmr` | 11 éléments | 5 |

Deux conséquences. Un score obtenu sur ce jeu de données **n'est pas
comparable** à un score d'avant l'élagage : ce ne sont plus les mêmes
questions. Et le scénario est plus mince qu'il n'a été conçu : plusieurs
projets ne reposent plus que sur un ou deux documents, si bien qu'il exerce
davantage l'extraction que le raisonnement sur des sources dispersées et
partiellement contradictoires, qui était tout l'intérêt de l'original.

La lacune connue consignée ici — `SYSTEM_PROMPT` n'écartait pas fiablement le
bruit administratif de routine, une panne de machine à café et un
renouvellement de badge ressortant en `deadlines` — avait été mesurée sur des
éléments de mail qui n'existent plus ; l'exécution enregistrée qu'elle citait
(`results/full_run.json`) a donc été supprimée plutôt que laissée à passer
pour actuelle. La faiblesse, elle, tient au prompt et non à ces éléments : il
n'a aucune consigne d'écarter la routine, seulement celle de ne pas inventer
de faits. La revérifier demande de nouveaux éléments de bruit côté documents.

### Lancer l'évaluation

```sh
python manage.py run_synthetic_dossier
```
(la commande vit dans
`connectors/management/commands/run_synthetic_dossier.py`)
