"""Load the synthetic workspace as the raw lists
connectors.extraction.normalize_items() expects.

`workspace/messages.json` is no longer loaded: the Messages connector is gone,
and an item the pipeline cannot read is not part of the workspace. The file
and the ground-truth facts that cite it are still on disk -- see README.md,
which says what that means for a score.

Deliberately does NOT touch ground_truth.json or evaluation/ -- those are
scoring-only and must never reach the LLM. See README.md.
"""

import json
from pathlib import Path

WORKSPACE_DIR = Path(__file__).resolve().parent / "workspace"


def _load(name):
    with open(WORKSPACE_DIR / name, encoding="utf-8") as f:
        return json.load(f)


def load_workspace():
    """Return (raw_docs, raw_drive) for normalize_items()."""
    return (
        _load("docs.json"),
        _load("drive.json"),
    )
