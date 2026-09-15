"""
Step 2 of the handover pipeline: turn the normalized items produced by
extraction.normalize_items() into a structured handover summary with a
single LLM call.

Uses the Groq API (groq SDK, OpenAI-compatible chat.completions interface),
in JSON mode (response_format={"type": "json_object"}).

Output shape matches the frontend's SummaryContext model directly (see
src/frontend/src/context/SummaryContext.jsx / SummaryDetails.jsx):
    {
      "text": "free-text prose summary",
      "actions": [{"label": "..."}],
      "decisions": [{"label": "..."}],
      "deadlines": [{"label": "...", "date": "YYYY-MM-DD" | null}],
      "blockers": [{"label": "..."}],
      "documents": [{"id": "docs:<id>", "title": "...", "url": "https://..."}]
    }
No "id" per action/decision/deadline/blocker entry and no "contactIds": the
frontend assigns its own `id` (crypto.randomUUID()) when merging an array
into its state, and "contactIds" references the frontend's own collaborator
roster, which this pipeline has no knowledge of -- see extraction.py's
module docstring for why that stays a frontend-only, manually-edited field
for now.

The LLM itself only picks *which* item ids matter for "documents" -- title
and url are then filled in here from the trusted input `items` list, not
from the model's own text, so a hallucinated title/URL can't reach the
frontend. See _enrich_documents() below.
"""

import json

from django.conf import settings
from django.core.exceptions import ImproperlyConfigured

from groq import Groq

SYSTEM_PROMPT = """\
You are an assistant that writes a handover summary for a colleague who is \
away, from raw items (documents, files, emails) automatically extracted from \
several internal tools.

You are given a JSON list of items, each with the fields: id, title, author, \
date, content, and source (an object with fields type -- "docs" | "drive" | \
"messages" --, resource_id, resource_url, content_url).

Respond with a single JSON object with exactly these fields:
- "text": a short prose paragraph (2-4 sentences) summarizing the overall \
handover situation, in French.
- "actions": array of {"label": "..."} -- tasks or actions not yet completed.
- "decisions": array of {"label": "..."} -- decisions that have ALREADY been \
made and affect the work. Do not include something that is still pending, \
conditional on a future event, or not yet final -- that belongs under \
"deadlines" or "blockers" instead if it fits there.
- "deadlines": array of {"label": "...", "date": "YYYY-MM-DD" or null} -- \
dates or deadlines to respect. If a specific date is stated or can be \
computed from the item's content or its "date" field, use it. If the \
deadline is real but its trigger date isn't known yet (e.g. "within 10 days \
of a future publication that hasn't happened"), still include it with \
"date": null and describe the trigger clearly in the label -- never invent a \
date, but never drop a real deadline just because the exact date isn't \
known yet.
- "blockers": array of {"label": "..."} -- problems or blockers that are \
ALREADY happening right now, stated in the items. Do not include a \
hypothetical future consequence that hasn't happened (e.g. "the dossier \
might be incomplete by the deadline" is not a blocker unless an item \
actually states it is incomplete today).
- "documents": array of item "id" strings (verbatim, e.g. "docs:b8eb2e3a-...") \
-- the documents, files, or emails that matter most for this handover.

Every "label" must be a short, clear sentence, in French. Only include an \
item in a category if its content clearly fits there (do not force a \
classification) -- an empty array is a valid, correct answer for a category \
with nothing to report. Only state what the items actually say: do not \
infer a fact, a risk, or an outcome that isn't stated or directly implied by \
the source content. For "documents", only use "id" values that actually \
appear in the given item list -- never invent one.

Respond with only the JSON object: no introduction, no conclusion, no \
surrounding code block, no markdown.
"""


def build_user_message(items):
    """Serialize the normalized items as the JSON input for the prompt."""
    return (
        "Here are the items to summarize (JSON format):\n\n"
        + json.dumps(items, ensure_ascii=False, indent=2)
    )


def _get_client():
    if not settings.GROQ_API_KEY:
        raise ImproperlyConfigured("GROQ_API_KEY not set.")
    return Groq(api_key=settings.GROQ_API_KEY)


REQUIRED_FIELDS = ("text", "actions", "decisions", "deadlines", "blockers", "documents")


def _enrich_documents(document_ids, items):
    """Turn the model's list of item ids into self-contained {id, title, url}
    objects, using the trusted `items` the model was given -- not anything
    the model wrote itself, so a hallucinated title/URL can't get through.
    Any id that isn't a real input item (hallucinated or altered) is dropped.
    """
    by_id = {item.get("id"): item for item in items}
    enriched = []
    for doc_id in document_ids:
        item = by_id.get(doc_id)
        if item is None:
            continue
        enriched.append({
            "id": doc_id,
            "title": item.get("title") or "",
            "url": (item.get("source") or {}).get("resource_url") or "",
        })
    return enriched


def generate_dossier(items, client=None):
    """Call Groq once and return the handover summary as a parsed dict."""
    if not items:
        raise ValueError("No items to summarize.")

    client = client or _get_client()
    response = client.chat.completions.create(
        model=settings.GROQ_MODEL,
        response_format={"type": "json_object"},
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": build_user_message(items)},
        ],
    )

    content = response.choices[0].message.content
    if not content:
        raise RuntimeError("Groq response does not contain an answer.")

    try:
        summary = json.loads(content)
    except ValueError as exc:
        raise RuntimeError("Groq response was not valid JSON.") from exc

    if not isinstance(summary, dict) or any(field not in summary for field in REQUIRED_FIELDS):
        raise RuntimeError(
            f"Groq response is missing required fields (expected {REQUIRED_FIELDS})."
        )

    summary["documents"] = _enrich_documents(summary["documents"], items)

    return summary
