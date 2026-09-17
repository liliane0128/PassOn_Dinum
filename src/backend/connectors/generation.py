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
      "actions": [{"label": "...", "evidence": [EvidenceRef, ...]}],
      "decisions": [{"label": "...", "evidence": [...]}],
      "deadlines": [{"label": "...", "date": "YYYY-MM-DD" | null, "evidence": [...]}],
      "blockers": [{"label": "...", "evidence": [...]}],
      "documents": [{"id": "docs:<id>", "title": "...", "url": "https://..."}]
    }
  where EvidenceRef is {"id", "title", "url", "author", "date", "content"} --
  richer than a "documents" entry on purpose: `url` alone often isn't
  browsable (mock/synthetic ids, or a real item's REST resource_url rather
  than a page), so `content` lets a bullet's evidence be read in place. See
  _enrich_evidence_ids() below.
No "id" per action/decision/deadline/blocker entry and no "contactIds": the
frontend assigns its own `id` (crypto.randomUUID()) when merging an array
into its state, and "contactIds" references the frontend's own collaborator
roster, which this pipeline has no knowledge of -- see extraction.py's
module docstring for why that stays a frontend-only, manually-edited field
for now.

The LLM itself only picks *which* item ids matter for "documents" and, for
every action/decision/deadline/blocker, which id(s) justify that specific
entry ("evidence_ids" in its raw response, renamed and enriched to
"evidence" below) -- title/url/content are then filled in here from the
trusted input `items` list, not from the model's own text, so a hallucinated
title/URL/content can't reach the frontend, and an id that doesn't match a
real input item is dropped rather than shown. See _enrich_ids() (for
"documents") and _enrich_evidence_ids() (for per-bullet "evidence") below;
"text" is deliberately not covered by this, only the four bulleted sections
plus "documents" -- attributing a whole prose paragraph sentence-by-sentence
isn't worth the complexity for what it would add.
"""

import json

from django.conf import settings
from django.core.exceptions import ImproperlyConfigured

from groq import Groq

SYSTEM_PROMPT = """\
You are an assistant that writes a handover summary for a colleague who is \
away, from raw items (documents, files) automatically extracted from \
several internal tools.

You are given a JSON list of items, each with the fields: id, title, author, \
date, content, and source (an object with fields type -- "docs" | "drive" \
--, resource_id, resource_url, content_url).

Respond with a single JSON object with exactly these fields:
- "text": a short prose paragraph (2-4 sentences) summarizing the overall \
handover situation, in French.
- "actions": array of {"label": "...", "evidence_ids": [...]} -- tasks or \
actions not yet completed.
- "decisions": array of {"label": "...", "evidence_ids": [...]} -- decisions \
that have ALREADY been made and affect the work. Do not include something \
that is still pending, conditional on a future event, or not yet final -- \
that belongs under "deadlines" or "blockers" instead if it fits there.
- "deadlines": array of {"label": "...", "date": "YYYY-MM-DD" or null, \
"evidence_ids": [...]} -- dates or deadlines to respect. If a specific date \
is stated or can be computed from the item's content or its "date" field, \
use it. If the deadline is real but its trigger date isn't known yet (e.g. \
"within 10 days of a future publication that hasn't happened"), still \
include it with "date": null and describe the trigger clearly in the label \
-- never invent a date, but never drop a real deadline just because the \
exact date isn't known yet.
- "blockers": array of {"label": "...", "evidence_ids": [...]} -- problems \
or blockers that are ALREADY happening right now, stated in the items. Do \
not include a hypothetical future consequence that hasn't happened (e.g. \
"the dossier might be incomplete by the deadline" is not a blocker unless \
an item actually states it is incomplete today).
- "documents": array of item "id" strings (verbatim, e.g. "docs:b8eb2e3a-...") \
-- the documents and files that matter most for this handover.

Every "label" must be a short, clear sentence, in French. Only include an \
item in a category if its content clearly fits there (do not force a \
classification) -- an empty array is a valid, correct answer for a category \
with nothing to report. Only state what the items actually say: do not \
infer a fact, a risk, or an outcome that isn't stated or directly implied by \
the source content. For "documents", only use "id" values that actually \
appear in the given item list -- never invent one.

"evidence_ids" is an array of item "id" strings (verbatim, same rule as \
"documents": only ids that actually appear in the given item list, never \
invent one) -- the item(s) that justify that specific action/decision/\
deadline/blocker. Every entry in "actions", "decisions", "deadlines" and \
"blockers" must have "evidence_ids" with at least one id; if you can't point \
to a real item that justifies an entry, don't include that entry at all.

Respond with only the JSON object: no introduction, no conclusion, no \
surrounding code block, no markdown.
"""


# Each item's content is capped before it reaches the model. Groq's ceiling
# counts the prompt *and* the answer against the same per-minute budget, so an
# oversized prompt either gets refused outright (413) or leaves too little room
# for the JSON, which then comes back truncated and unparseable. A real Drive
# of a dozen documents blows past it, so without a cap the endpoint works only
# on toy data. The beginning of a document is also where its subject, decisions
# and dates almost always are; what gets cut is the tail.
MAX_CONTENT_CHARS = 320
TRUNCATION_MARKER = "\n[...] (contenu tronqué)"


def _trimmed(item):
    """Shrink one item to what the model actually has to read.

    Drops `source` entirely, on top of the content cap: the model is only
    ever asked to echo an item's `id` back (for "documents" and each bullet's
    "evidence_ids"), never to read or repeat its
    resource_id/resource_url/content_url, and _enrich_ids() looks those up
    afterwards against the untouched `items` generate_dossier() was called
    with -- not against what was sent here. So the two URLs and the
    duplicate id inside `source` cost real
    tokens on every item, in every request, for zero benefit. A 60-item
    workspace's prompt runs close to a free Groq tier's whole per-minute
    budget; this is pure waste to cut before reaching for a lossier one
    (shrinking content further, or splitting into several calls).
    """
    content = item.get("content") or ""
    if len(content) > MAX_CONTENT_CHARS:
        content = content[:MAX_CONTENT_CHARS] + TRUNCATION_MARKER
    return {
        "id": item.get("id"),
        "title": item.get("title"),
        "author": item.get("author"),
        "date": item.get("date"),
        "content": content,
    }


def build_user_message(items):
    """Serialize the normalized items as the JSON input for the prompt.

    Compact separators rather than indentation: the whitespace of a pretty
    dump is billed as tokens like anything else, and the model does not read
    the JSON any better for it.
    """
    return (
        "Here are the items to summarize (JSON format):\n\n"
        + json.dumps(
            [_trimmed(item) for item in items],
            ensure_ascii=False,
            separators=(",", ":"),
        )
    )


def _get_client():
    if not settings.GROQ_API_KEY:
        raise ImproperlyConfigured("GROQ_API_KEY not set.")
    return Groq(api_key=settings.GROQ_API_KEY)


REQUIRED_FIELDS = ("text", "actions", "decisions", "deadlines", "blockers", "documents")


def _enrich_ids(ids, by_id):
    """Turn a list of the model's item ids into self-contained {id, title,
    url} objects, using the trusted `items` the model was given -- not
    anything the model wrote itself, so a hallucinated title/URL can't get
    through. Any id that isn't a real input item (hallucinated, altered, or
    just missing/malformed input) is dropped rather than shown.
    """
    if not isinstance(ids, list):
        return []
    enriched = []
    for item_id in ids:
        item = by_id.get(item_id)
        if item is None:
            continue
        enriched.append({
            "id": item_id,
            "title": item.get("title") or "",
            "url": (item.get("source") or {}).get("resource_url") or "",
        })
    return enriched


BULLET_FIELDS = ("actions", "decisions", "deadlines", "blockers")

# Longer than MAX_CONTENT_CHARS on purpose: this preview never reaches Groq
# (it's attached to the response *after* the model call, straight from the
# trusted `items` generate_dossier() was called with), so it isn't billed
# against the per-minute token budget -- only served once to the frontend as
# ordinary JSON. Generous enough that "see the original text" usually means
# the whole point of a short item (a note, a memo), not just its opening.
EVIDENCE_PREVIEW_CHARS = 600


def _enrich_evidence_ids(ids, by_id):
    """Like _enrich_ids(), but for per-bullet evidence rather than
    "documents": also carries `author`, `date`, and a `content` preview, so a
    bullet's evidence can be read in place instead of only linking out to
    `url` -- which, for mock/synthetic data, or even for a real item's REST
    resource_url, may not be something a person can usefully open in a
    browser. Same anti-hallucination rule: an id that isn't a real input
    item is dropped rather than shown.
    """
    if not isinstance(ids, list):
        return []
    enriched = []
    for item_id in ids:
        item = by_id.get(item_id)
        if item is None:
            continue
        content = item.get("content") or ""
        if len(content) > EVIDENCE_PREVIEW_CHARS:
            content = content[:EVIDENCE_PREVIEW_CHARS] + TRUNCATION_MARKER
        enriched.append({
            "id": item_id,
            "title": item.get("title") or "",
            "url": (item.get("source") or {}).get("resource_url") or "",
            "author": item.get("author") or "",
            "date": item.get("date"),
            "content": content,
        })
    return enriched


def _enrich_bullets(bullets, by_id):
    """Resolve each bullet's raw "evidence_ids" (model output) into
    "evidence" ({id, title, url, author, date, content} objects) via
    _enrich_evidence_ids(). A bullet with no usable evidence_ids (missing,
    malformed, or all-hallucinated) keeps its label but gets an empty list --
    it is not dropped, since the label itself may still be correct.
    """
    if not isinstance(bullets, list):
        return []
    enriched = []
    for bullet in bullets:
        if not isinstance(bullet, dict):
            continue
        bullet = dict(bullet)
        bullet["evidence"] = _enrich_evidence_ids(bullet.pop("evidence_ids", None), by_id)
        enriched.append(bullet)
    return enriched


def generate_dossier(items, client=None):
    """Call Groq once and return the handover summary as a parsed dict."""
    if not items:
        raise ValueError("No items to summarize.")

    client = client or _get_client()
    response = client.chat.completions.create(
        model=settings.GROQ_MODEL,
        response_format={"type": "json_object"},
        # Bounded on purpose: an unbounded request is billed against the
        # per-minute budget at the model's full output size, which alone can
        # exceed the free tier's limit. Wide enough for the six sections.
        max_completion_tokens=3000,
        # The reasoning tokens of gpt-oss models are drawn from the same
        # completion budget as the answer. Left to its own devices the model
        # thinks its way past the limit and the JSON comes back truncated,
        # which Groq rejects outright ("Failed to validate JSON"): roughly two
        # calls in three failed that way. Thinking less produces a valid
        # object nearly every time, and a shorter one -- around 1600
        # completion tokens instead of 2600 -- for the same six sections.
        reasoning_effort="low",
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

    by_id = {item.get("id"): item for item in items}
    summary["documents"] = _enrich_ids(summary["documents"], by_id)
    for field in BULLET_FIELDS:
        summary[field] = _enrich_bullets(summary[field], by_id)

    return summary
