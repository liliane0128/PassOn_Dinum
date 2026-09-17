"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, TriangleAlert } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import {
  errorMessage,
  fetchHandover,
  fetchItems,
  saveHandover,
  validateHandover,
  type Handover,
  type Item,
} from "@/lib/handover";
import { usePassationStatus } from "@/components/PassationStatusProvider";
import { contactsFromItems } from "@/lib/contacts-from-items";
import { runGeneration } from "@/lib/generate-passation";
import { MAX_PRIORITY_DOCUMENTS, rankDocuments } from "@/lib/documents-priority";
import { passation as demoPassation } from "@/lib/mock-data";
import type { AttentionPoint, Contact, Passation, SourceItem } from "@/lib/types";
import { PassationCard } from "./PassationCard";

/** "12 sept. 2026 à 16:24", the format the card's header uses. */
function frenchDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  const day = date.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  const time = date.toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  });
  return `${day} à ${time}`;
}

/**
 * How much of the sheet the pass actually filled, as the share of its six
 * sections that came back with something.
 *
 * A blunt measure, but an honest one, and measured against the stored sheet
 * rather than against what the page happens to display: it says how much the
 * generator found, not how good it is.
 */
function completeness(handover: Handover | null): number {
  if (!handover) return 0;
  const filled = [
    handover.text.trim().length > 0,
    (handover.actions?.length ?? 0) > 0,
    (handover.decisions?.length ?? 0) > 0,
    (handover.deadlines?.length ?? 0) > 0,
    (handover.blockers?.length ?? 0) > 0,
    (handover.documents?.length ?? 0) > 0,
  ].filter(Boolean).length;
  return Math.round((filled / 6) * 100);
}

/**
 * The wired parts of the card, read from the logged-in person's own documents
 * and mails: the résumé and the points de blocage.
 *
 * Every section of the card is wired now,
 * which is why the card below is the demo fixture with the real fields
 * replaced rather than a `Passation` built from scratch: pretending the rest
 * is real would hide which parts are actually wired.
 *
 * An empty résumé generates itself, once. That is the behaviour of the
 * previous frontend: arriving with nothing to read is not a state worth making
 * someone click through. What it must never become is a retry loop -- the
 * pipeline reads every item's content before calling the model, and the free
 * tier allows roughly one pass a minute, so a failure that re-triggers on the
 * next render would burn the quota in seconds. Hence `autoAttempted`: one
 * automatic attempt per person per page load, successful or not, after which
 * only the button generates.
 */
// lil's wait, kept word for word: two lines, the first held a beat longer,
// reading like a glimpse of a longer status loop. Theirs cut to the card
// after 2.2s; here the second line simply stays until the generation
// actually returns.
const FIRST_STEP = "Analyse de vos Docs…";
const SECOND_STEP = "Rédaction de la fiche de passation…";
const FIRST_STEP_DURATION_MS = 1300;

export function PassationBoard() {
  const { session } = useAuth();
  const user = session?.user;
  const { setStatus } = usePassationStatus();
  const [step, setStep] = useState(FIRST_STEP);

  const [handover, setHandover] = useState<Handover | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (collaboratorId: string) => {
    setLoading(true);
    try {
      // The sheet is the point of the page; the items only feed the source
      // counts, so failing to read them must not hide an existing résumé.
      setHandover(await fetchHandover(collaboratorId));
      const answer = await fetchItems(collaboratorId).catch(() => null);
      setItems(answer?.items ?? []);
    } catch {
      setError("Impossible de charger votre passation.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user?.id) void load(user.id);
  }, [user?.id, load]);

  // Read inside `generate`, which must not be rebuilt every time the items
  // change -- the auto-generation effect depends on its identity.
  const itemsRef = useRef<Item[]>([]);
  itemsRef.current = items;

  const generatingRef = useRef(false);
  const autoAttempted = useRef<Set<string>>(new Set());

  const generate = useCallback(async (collaboratorId: string) => {
    // A ref as well as the state flag: two calls landing in the same render
    // would both read `generating === false` and both start a pass.
    if (generatingRef.current) return;
    generatingRef.current = true;
    setGenerating(true);
    setError(null);
    try {
      setHandover(await runGeneration(collaboratorId, user?.email));
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      generatingRef.current = false;
      setGenerating(false);
    }
  }, []);

  // Nothing to show yet -> compose one, once.
  useEffect(() => {
    if (loading || !user?.id || !handover) return;
    if (handover.text.trim()) return;
    if (autoAttempted.current.has(user.id)) return;
    autoAttempted.current.add(user.id);
    void generate(user.id);
  }, [loading, user?.id, handover, generate]);

  useEffect(() => {
    if (!loading && !generating) return;
    setStep(FIRST_STEP);
    const toSecond = setTimeout(() => setStep(SECOND_STEP), FIRST_STEP_DURATION_MS);
    return () => clearTimeout(toSecond);
  }, [loading, generating]);

  /**
   * Validation, stored server-side.
   *
   * Only the owner may validate, and any later edit resets the flag, so the
   * answer is what the shared status is refreshed from -- never the click.
   */
  async function handleValidate() {
    if (!user?.id) return;
    try {
      setHandover(await validateHandover(user.id));
    } catch {
      setError("La validation n'a pas pu être enregistrée.");
    }
  }

  /** Called when the résumé's editor is closed, so an edit is not lost. */
  async function handleResumeCommit(text: string) {
    if (!user?.id) return;
    try {
      setHandover(await saveHandover(user.id, { text }));
    } catch {
      setError("Votre modification du résumé n'a pas pu être enregistrée.");
    }
  }

  useEffect(() => {
    if (!user?.id || !handover) return;
    setStatus(user.id, {
      validated: handover.validated,
      validatedAt: handover.validated
        ? frenchDateTime(handover.updatedAt)
        : undefined,
    });
    // setStatus comes from a provider that rebuilds it on each render; only
    // the sheet's own state should re-run this.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, handover?.validated, handover?.updatedAt]);

  /** Same, for the contacts. */
  async function handleContactsCommit(contacts: Contact[]) {
    if (!user?.id) return;
    const cleaned = contacts
      .filter((contact) => contact.name.trim() || contact.email.trim())
      .map((contact) => ({
        name: contact.name.trim(),
        role: contact.role.trim(),
        email: contact.email.trim(),
      }));
    try {
      setHandover(await saveHandover(user.id, { contacts: cleaned }));
    } catch {
      setError("Vos modifications des contacts n'ont pas pu être enregistrées.");
    }
  }

  /**
   * Same, for the points de blocage. The whole list is sent: the PATCH
   * replaces the section, so an add, an edit and a removal are one and the
   * same call. `evidence` is carried back untouched, which is what keeps a
   * generated point's sources after someone reworded it.
   */
  async function handleBlockersCommit(points: AttentionPoint[]) {
    if (!user?.id) return;
    const blockers = points
      .filter((point) => point.label.trim())
      .map((point) => ({
        label: point.label.trim(),
        evidence: point.evidence ?? [],
      }));
    try {
      setHandover(await saveHandover(user.id, { blockers }));
    } catch {
      setError("Vos modifications des points de blocage n'ont pas pu être enregistrées.");
    }
  }

  // The same centred wait for both cases, so arriving here and regenerating
  // look alike -- and like lil's page, which this is taken from.
  if (loading || generating) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center text-center">
        <Loader2 className="h-7 w-7 animate-spin text-brand-600" />
        <p className="mt-3 text-sm text-gray-500">{step}</p>
      </div>
    );
  }

  // The Sources tab lists what was read. Only the documents can be shown for
  // now: SourceKind is "docs" | "drive", with no category for a mail, and
  // inventing one would change a model this branch just brought in.
  const sources: SourceItem[] = items
    .filter((item) => item.type !== "mail")
    .map((item) => ({
      id: item.refId || item.id,
      kind: "drive" as const,
      name: item.title,
      url: item.url || "",
    }));

  // A stable id per position: the backend stores an ordered list, with no ids
  // of its own, and the card needs one to edit or remove a line.
  const attentionPoints: AttentionPoint[] = (handover?.blockers ?? []).map(
    (blocker, index) => ({
      id: `blocker-${index}`,
      label: blocker.label,
      evidence: blocker.evidence,
    })
  );

  // What was stored, or -- before anything has been stored -- what the mails
  // say. Deriving on the fly means the section is never empty just because a
  // sheet was generated before contacts were kept.
  const storedContacts = handover?.contacts ?? [];
  const contacts: Contact[] = (
    storedContacts.length > 0
      ? storedContacts
      : contactsFromItems(items, user?.email)
  ).map((contact, index) => ({ id: `contact-${index}`, ...contact }));

  const rankedDocuments = rankDocuments(
    handover,
    items,
    user?.full_name || user?.email || "moi"
  );
  // Only the most urgent are listed; the count keeps the real total, so the
  // section's header and its "voir tous" line still say how many there are.
  const documents = rankedDocuments.slice(0, MAX_PRIORITY_DOCUMENTS);

  const passationId = user?.id ?? demoPassation.id;

  const passation: Passation = {
    ...demoPassation,
    id: passationId,
    attentionPoints,
    contacts,
    contactsTotal: contacts.length,
    documents,
    documentsTotal: rankedDocuments.length,
    title: `Passation — ${user?.full_name || user?.email || "moi"}`,
    lastUpdated: handover ? frenchDateTime(handover.updatedAt) : "—",
    completude: completeness(handover),
    resume: handover?.text ?? "",
    sources,
  };

  return (
    <>
      {/* No header block and no generate button of our own: lil's card owns
          that control ("Régénérer", top right), and two buttons doing the
          same thing on one page is one too many. What stays is the reason a
          pass failed -- the card cannot say that -- and the note while one is
          running. */}
      {error && (
        <p
          role="alert"
          className="mb-3 flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800"
        >
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
          {error}
        </p>
      )}

      <PassationCard
        key={handover?.updatedAt ?? "empty"}
        passation={passation}
        onResumeCommit={handleResumeCommit}
        onBlockersCommit={handleBlockersCommit}
        onContactsCommit={handleContactsCommit}
        onValidate={handleValidate}
        onRegenerate={() => user?.id && void generate(user.id)}
      />
    </>
  );
}
