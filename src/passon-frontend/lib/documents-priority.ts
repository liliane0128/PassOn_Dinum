import type { Bullet, Handover, Item } from "./handover";
import type { DocumentAssocie } from "./types";

/**
 * Orders the documents of a handover by how urgent they are.
 *
 * The rule, in one sentence: a deadline outranks everything, and context only
 * breaks ties. A document cited by a single bullet can matter more than one
 * cited three times -- what makes it urgent is having a date, not being
 * mentioned often.
 *
 * A date is only ever taken from the sheet, never invented from the document's
 * text alone. A document is dated when:
 *
 *   1. a deadline bullet cites it directly (`evidence`), or
 *   2. a deadline bullet's date is written in the document's own text.
 *
 * The second rule is what ties "dossier-adap-accessibilite.md" to the 31st of
 * October: the model cited the préfecture's mail as the source of that
 * deadline -- that is where the fact was stated -- while the date itself
 * appears in the document the deadline is about. A date found in a document
 * *without* a matching deadline is deliberately ignored: a meeting date and a
 * due date read exactly the same, and guessing would rank a document urgent
 * for having mentioned last week's meeting.
 *
 * Everything here is computed from what is already stored. The generator is
 * not asked to rank anything.
 */

/**
 * How many documents the card shows. The ranking puts the urgent ones first,
 * so a cap keeps the section readable on an account with a large Drive: the
 * ones cut off are, by construction, the least pressing.
 */
export const MAX_PRIORITY_DOCUMENTS = 5;

const MONTHS = [
  "janvier",
  "février",
  "mars",
  "avril",
  "mai",
  "juin",
  "juillet",
  "août",
  "septembre",
  "octobre",
  "novembre",
  "décembre",
];

/** The ways a given ISO date can be written in a French document. */
function writtenForms(iso: string): string[] {
  const match = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return [];
  const [, year, month, day] = match;
  const dayNumber = Number(day);
  const monthName = MONTHS[Number(month) - 1];
  if (!monthName) return [];

  const dayForms = dayNumber === 1 ? ["1er", "1", "01"] : [String(dayNumber), day];
  const forms: string[] = [iso, `${day}/${month}/${year}`, `${dayNumber}/${Number(month)}/${year}`];
  for (const d of dayForms) {
    forms.push(`${d} ${monthName} ${year}`, `${d} ${monthName}`);
    // "aout" and "fevrier" are written unaccented often enough to matter.
    const plain = monthName.normalize("NFD").replace(/[̀-ͯ]/g, "");
    if (plain !== monthName) forms.push(`${d} ${plain} ${year}`, `${d} ${plain}`);
  }
  return forms;
}

function mentions(text: string, iso: string): boolean {
  const haystack = text.toLowerCase();
  return writtenForms(iso).some((form) => haystack.includes(form.toLowerCase()));
}

function cites(bullet: Bullet, documentId: string): boolean {
  return (bullet.evidence ?? []).some((source) => source.id === documentId);
}

function frenchDate(iso: string | undefined | null): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function shortDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

interface Scored {
  document: DocumentAssocie;
  /** The deadline this document is tied to, if any. */
  deadline: string | null;
  /** Blocker beats action beats decision; ties broken by how many cite it. */
  weight: number;
  citations: number;
  updated: number;
}

export function rankDocuments(
  handover: Handover | null,
  items: Item[],
  ownerFallback: string,
  today: Date = new Date()
): DocumentAssocie[] {
  if (!handover?.documents?.length) return [];

  const deadlines = handover.deadlines ?? [];
  const blockers = handover.blockers ?? [];
  const actions = handover.actions ?? [];
  const decisions = handover.decisions ?? [];
  const startOfToday = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate()
  ).getTime();

  const scored: Scored[] = handover.documents.map((document, index) => {
    const item = items.find(
      (candidate) => candidate.refId === document.id || candidate.id === document.id
    );
    const text = `${item?.title ?? ""} ${item?.preview ?? ""}`;

    // 1. A deadline that cites this document, or whose date it carries.
    //
    // The two are not equally sure, and the label says which it was. A date
    // written in a document proves the document mentions that day, not that
    // the document is what the deadline is about -- and one date can appear
    // in several documents at once, as "30 septembre" does here.
    let deadline: string | null = null;
    let cited = false;
    for (const bullet of deadlines) {
      if (!bullet.date) continue;
      const direct = cites(bullet, document.id);
      if (direct || mentions(text, bullet.date)) {
        if (!deadline || bullet.date < deadline) {
          deadline = bullet.date;
          cited = direct;
        }
      }
    }

    // 2. Context, which only ever separates documents of equal urgency.
    let weight = 0;
    let citations = 0;
    for (const [bullets, value] of [
      [blockers, 3],
      [actions, 2],
      [decisions, 1],
    ] as const) {
      for (const bullet of bullets) {
        if (cites(bullet, document.id)) {
          weight = Math.max(weight, value);
          citations += 1;
        }
      }
    }

    const reasons: string[] = [];
    if (deadline) {
      const due = new Date(deadline).getTime();
      const when = shortDate(deadline);
      if (due < startOfToday) {
        reasons.push(`Échéance dépassée (${when})`);
      } else {
        reasons.push(cited ? `Échéance ${when}` : `Mentionne l'échéance du ${when}`);
      }
    }
    if (weight === 3) reasons.push("lié à un blocage");
    else if (weight === 2) reasons.push("lié à une action");
    else if (weight === 1) reasons.push("lié à une décision");

    return {
      document: {
        id: document.id || `document-${index}`,
        name: document.title || item?.title || "Document",
        date: frenchDate(item?.date),
        proprietaire: item?.subtitle || ownerFallback,
        url: document.url || item?.url || undefined,
        priorityLabel: reasons.join(" · ") || undefined,
      },
      deadline,
      weight,
      citations,
      updated: item?.date ? new Date(item.date).getTime() || 0 : 0,
    };
  });

  scored.sort((a, b) => {
    // Dated first, soonest (and overdue) at the top.
    if (a.deadline && b.deadline) {
      if (a.deadline !== b.deadline) return a.deadline < b.deadline ? -1 : 1;
    } else if (a.deadline) return -1;
    else if (b.deadline) return 1;

    if (a.weight !== b.weight) return b.weight - a.weight;
    if (a.citations !== b.citations) return b.citations - a.citations;
    return b.updated - a.updated;
  });

  return scored.map((entry) => entry.document);
}
