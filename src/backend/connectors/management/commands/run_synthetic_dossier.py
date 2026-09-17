"""Run the synthetic handover workspace (synthetic_data/) through the real
extraction + generation pipeline and print the result.

Ground truth is never touched here -- only synthetic_data/load.py's
load_workspace(), which reads workspace/*.json only. See
synthetic_data/README.md.
"""

import json
import sys
from pathlib import Path

from django.core.management.base import BaseCommand

SYNTHETIC_DATA_DIR = Path(__file__).resolve().parents[3] / "synthetic_data"
sys.path.insert(0, str(SYNTHETIC_DATA_DIR))


class Command(BaseCommand):
    help = "Run the synthetic handover dataset through extraction + generation."

    def add_arguments(self, parser):
        parser.add_argument(
            "--out", type=str, default=None,
            help="Write the JSON result to this file instead of stdout.",
        )
        parser.add_argument(
            "--project", type=str, default=None,
            help=(
                "Only send items belonging to this project id (per "
                "evaluation/expected_projects.json) to the LLM -- for spot-"
                "checking one work stream's quality without hitting a low "
                "TPM rate limit on the full 60-item dataset. NOT a "
                "substitute for a real project-identification test (that "
                "needs the mixed, unfiltered set)."
            ),
        )

    def handle(self, *args, **options):
        from load import load_workspace

        from connectors import extraction, generation

        raw_docs, raw_drive = load_workspace()

        if options["project"]:
            project_id = options["project"]
            with open(SYNTHETIC_DATA_DIR / "evaluation" / "expected_projects.json", encoding="utf-8") as f:
                expected = json.load(f)
            keep_ids = {item_id for item_id, proj in expected.items() if proj == project_id}
            raw_docs = [i for i in raw_docs if i["id"] in keep_ids]
            raw_drive = [i for i in raw_drive if i["id"] in keep_ids]
            if not keep_ids:
                self.stderr.write(self.style.ERROR(f"No items found for project '{project_id}'"))
                return

        items = extraction.normalize_items(raw_docs, raw_drive)
        self.stderr.write(self.style.NOTICE(
            f"{len(items)} normalized items "
            f"({len(raw_docs)} docs, {len(raw_drive)} drive)"
        ))

        result = generation.generate_dossier(items)
        output = json.dumps(result, ensure_ascii=False, indent=2)

        if options["out"]:
            Path(options["out"]).write_text(output, encoding="utf-8")
            self.stderr.write(self.style.SUCCESS(f"Written to {options['out']}"))
        else:
            self.stdout.write(output)
