"""
Step 2 of the handover pipeline: turn the normalized items produced by
extraction.normalize_items() into a Markdown handover dossier with a single
LLM call.

Uses the Groq API (groq SDK, OpenAI-compatible chat.completions interface).

Each bullet in the output must carry a clickable Markdown link back to its
source, built from the item's `source.resource_url` (verbatim) so the reader
can jump straight to the original document/file/email. `source.content_url`
is deliberately not used for links: for Docs it points at a raw
base64-encoded CRDT blob endpoint, not a page a human can open.
"""

import json

from django.conf import settings
from django.core.exceptions import ImproperlyConfigured

from groq import Groq

SYSTEM_PROMPT = """\
You are an assistant that writes a handover dossier for a colleague who is \
away, from raw items (documents, files, emails) automatically extracted from \
several internal tools.

You are given a JSON list of items, each with the fields: id, title, author, \
date, content, and source (an object with fields type -- "docs" | "drive" | \
"messages" --, resource_id, resource_url, content_url).

Sort the content of these items into the following 6 categories, in this \
order, only placing an item in a category if its content clearly fits there \
(do not force a classification):

1. Ongoing actions -- tasks or actions not yet completed.
2. Key decisions -- decisions that were made and affect the work.
3. Deadlines -- dates or deadlines to respect.
4. Blockers -- problems or blockers preventing progress.
5. Key contacts -- important people involved in this handover and their role.
6. Important documents -- documents, files, or emails that matter most.

Output format: a Markdown document, with one level-2 heading (##) per \
category, in the order above. Under each heading, a bulleted list. Each \
bullet must:
- be a short, clear sentence;
- end with a clickable Markdown link to the source, formatted as \
([source](URL)), using EXACTLY the item's "source.resource_url" value -- \
never invent a URL, never alter the ones provided, never use \
"source.content_url" instead, and only cite items that actually appear in \
the given list.

If no information matches a category, still write the heading followed by a \
single bullet "No items identified." (with no link).

Reply with only the Markdown document: no introduction, no conclusion, no \
surrounding code block.
"""


def build_user_message(items):
    """Serialize the normalized items as the JSON input for the prompt."""
    return (
        "Here are the items to sort (JSON format):\n\n"
        + json.dumps(items, ensure_ascii=False, indent=2)
    )


def _get_client():
    if not settings.GROQ_API_KEY:
        raise ImproperlyConfigured("GROQ_API_KEY not set.")
    return Groq(api_key=settings.GROQ_API_KEY)


def generate_dossier(items, client=None):
    """Call Groq once and return the handover dossier as a Markdown string."""
    if not items:
        raise ValueError("No items to summarize.")

    client = client or _get_client()
    response = client.chat.completions.create(
        model=settings.GROQ_MODEL,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": build_user_message(items)},
        ],
    )

    content = response.choices[0].message.content
    if not content:
        raise RuntimeError("Groq response does not contain an answer.")

    return content
