# Synthetic handover dataset

Synthetic workspace for Sophie Vasseur (instructrice, service affaires
générales, mairie de Verneuil-sur-Aveyron, leaves her post in three weeks),
built to evaluate the handover pipeline (`connectors/extraction.py` +
`connectors/generation.py`) against a **known ground truth**, without using
any real employee data.

This is a separate, purpose-built evaluation dataset -- it does not replace
or modify `connectors/mock_data.py` (the small fixture used for local UI
demos), which is left untouched.

## Hard rule: ground truth never reaches the LLM

- `ground_truth.json` and `evaluation/` are for scoring only. Never pass
  their contents into `extraction.normalize_items()` or
  `generation.generate_dossier()`.
- `workspace/` is the only thing the pipeline is allowed to see -- it's
  meant to stand in for what Sophie actually has across Docs/Drive/Messages.

## Layout

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

## Design notes (why some items look the way they do)

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

## Running it

Once all six work streams are in place:
```sh
python manage.py run_synthetic_dossier
```
(management command lives at
`connectors/management/commands/run_synthetic_dossier.py`)
