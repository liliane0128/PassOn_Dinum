"""Static demo data returned when DINUM_USE_MOCK is enabled.

Shaped to match the real field names each upstream service actually returns
(checked against their serializers), trimmed to what a handover dossier
needs: title, who created it, and when.

Set DINUM_MOCK_DATASET (in .env) to serve synthetic_data/workspace/*.json
instead of the small fixture below:
- "synthetic_handover" -- all 13 items, four projects (Camille Faure,
  mairie de Sainte-Radegonde). /api/dossier/ completes fine on a free Groq
  tier with this dataset's size.
- "synthetic_handover_pmr" -- only the "accessibilite-pmr" project (the
  urgent/collective one, 5 items), for a quick spot check on a single
  project instead of the full dataset.
See synthetic_data/README.md for what's in the dataset and why. Falls back
to this file's fixture if the dataset/mapping can't be read (e.g. deleted),
so a bad env value degrades instead of crashing the server.
"""

import json
import os
from pathlib import Path

MOCK_DOCS = [
    {
        "id": "d1111111-1111-1111-1111-111111111111",
        "title": "Q3 project roadmap",
        "excerpt": "Roadmap discussed in the last planning meeting.",
        "creator": "Amélie Rousseau",
        "created_at": "2026-09-01T09:00:00Z",
        "updated_at": "2026-09-10T14:30:00Z",
        "is_favorite": True,
    },
    {
        "id": "d2222222-2222-2222-2222-222222222222",
        "title": "Onboarding checklist",
        "excerpt": "Steps for a new team member's first two weeks.",
        "creator": "Karim Belhadj",
        "created_at": "2026-08-20T10:15:00Z",
        "updated_at": "2026-09-05T11:00:00Z",
        "is_favorite": False,
    },
    {
        "id": "d3333333-3333-3333-3333-333333333333",
        "title": "Design system audit notes",
        "excerpt": "Findings from reviewing the shared UI component library.",
        "creator": "Sofia Martins",
        "created_at": "2026-09-08T16:45:00Z",
        "updated_at": "2026-09-12T09:20:00Z",
        "is_favorite": False,
    },
]

MOCK_DRIVE_ITEMS = [
    {
        "id": "f1111111-1111-1111-1111-111111111111",
        "title": "Annual report 2026.pdf",
        "type": "file",
        "mimetype": "application/pdf",
        "size": 2456789,
        "creator": {"full_name": "Karim Belhadj"},
        "created_at": "2026-08-15T09:00:00Z",
        "updated_at": "2026-09-01T10:00:00Z",
        "is_favorite": False,
        "description": "Finalized annual report for the board meeting.",
    },
    {
        "id": "f2222222-2222-2222-2222-222222222222",
        "title": "Design assets",
        "type": "folder",
        "mimetype": None,
        "size": None,
        "creator": {"full_name": "Sofia Martins"},
        "created_at": "2026-07-30T14:00:00Z",
        "updated_at": "2026-09-11T13:00:00Z",
        "is_favorite": True,
        "description": "Shared folder for logos, icons, and mockups.",
    },
    {
        "id": "f3333333-3333-3333-3333-333333333333",
        "title": "Budget Q3.xlsx",
        "type": "file",
        "mimetype": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "size": 84210,
        "creator": {"full_name": "Amélie Rousseau"},
        "created_at": "2026-09-02T08:30:00Z",
        "updated_at": "2026-09-09T17:45:00Z",
        "is_favorite": False,
        "description": "Working budget tracker for Q3 spending.",
    },
]

_DATASET = os.getenv("DINUM_MOCK_DATASET")

if _DATASET in ("synthetic_handover", "synthetic_handover_pmr"):
    _synthetic_dir = Path(__file__).resolve().parent.parent / "synthetic_data"
    try:
        with open(_synthetic_dir / "workspace" / "docs.json", encoding="utf-8") as _f:
            MOCK_DOCS = json.load(_f)
        with open(_synthetic_dir / "workspace" / "drive.json", encoding="utf-8") as _f:
            MOCK_DRIVE_ITEMS = json.load(_f)

        if _DATASET == "synthetic_handover_pmr":
            with open(_synthetic_dir / "evaluation" / "expected_projects.json", encoding="utf-8") as _f:
                _project_of = json.load(_f)
            _keep = {item_id for item_id, project in _project_of.items() if project == "accessibilite-pmr"}
            MOCK_DOCS = [item for item in MOCK_DOCS if item["id"] in _keep]
            MOCK_DRIVE_ITEMS = [item for item in MOCK_DRIVE_ITEMS if item["id"] in _keep]
    except (OSError, ValueError, KeyError):
        pass  # dataset missing or malformed -- keep the fixture above

BY_SERVICE = {"docs": MOCK_DOCS, "drive": MOCK_DRIVE_ITEMS}
