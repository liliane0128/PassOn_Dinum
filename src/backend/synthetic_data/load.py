"""Load the synthetic workspace as the three raw lists
connectors.extraction.normalize_items() expects.

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
    """Return (raw_docs, raw_drive, raw_messages) for normalize_items()."""
    return (
        _load("docs.json"),
        _load("drive.json"),
        _load("messages.json"),
    )
