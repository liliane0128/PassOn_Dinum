# Synthetic handover dataset · Jeu de données synthétique

*[English](#english) · [Français](#français)*

---

## English

Synthetic workspace for Sophie Vasseur (instructrice, service affaires
générales, mairie de Verneuil-sur-Aveyron, leaves her post in three weeks),
built to evaluate the handover pipeline (`connectors/extraction.py` +
`connectors/generation.py`) against a **known ground truth**, without using
any real employee data.

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

### Running it

Once all six work streams are in place:
```sh
python manage.py run_synthetic_dossier
```
(management command lives at
`connectors/management/commands/run_synthetic_dossier.py`)

---

## Français

Espace de travail synthétique pour Sophie Vasseur (instructrice, service affaires
générales, mairie de Verneuil-sur-Aveyron, qui quitte son poste dans trois
semaines), construit pour évaluer la chaîne de passation
(`connectors/extraction.py` + `connectors/generation.py`) face à une **vérité
terrain connue**, sans utiliser la moindre donnée réelle d'un agent.

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

### Lancer l'évaluation

Une fois les six chantiers en place :
```sh
python manage.py run_synthetic_dossier
```
(la commande vit dans
`connectors/management/commands/run_synthetic_dossier.py`)
