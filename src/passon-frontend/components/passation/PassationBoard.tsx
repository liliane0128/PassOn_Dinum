"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { FilePlus2, LoaderCircle, Plus, RefreshCw, TriangleAlert } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import {
  errorMessage,
  fetchHandover,
  fetchItems,
  generateDossier,
  saveHandover,
  type Handover,
  type Item,
} from "@/lib/handover";
import { contactsFromItems } from "@/lib/contacts-from-items";
import { rankDocuments } from "@/lib/documents-priority";
import { passation as demoPassation } from "@/lib/mock-data";
import type { AttentionPoint, Contact, Passation, SourceTag } from "@/lib/types";
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
export function PassationBoard() {
  const { session } = useAuth();
  const user = session?.user;

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
      const generated = await generateDossier();
      // The model is not asked for contacts, so they are computed here from
      // the mails and saved in the same call: one write, and the section is
      // filled at the same moment as the rest.
      setHandover(
        await saveHandover(collaboratorId, {
          ...generated,
          contacts: contactsFromItems(itemsRef.current, user?.email),
        })
      );
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

  /** Called when the résumé's editor is closed, so an edit is not lost. */
  async function handleResumeCommit(text: string) {
    if (!user?.id) return;
    try {
      setHandover(await saveHandover(user.id, { text }));
    } catch {
      setError("Votre modification du résumé n'a pas pu être enregistrée.");
    }
  }

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

  if (loading) {
    return (
      <div className="flex items-center gap-3 text-sm text-gray-500">
        <LoaderCircle className="h-4 w-4 animate-spin text-brand-600" />
        Chargement de votre passation…
      </div>
    );
  }

  const resume = handover?.text.trim() ?? "";
  const hasResume = resume.length > 0;

  // The real counts of what was read, in place of the fixture's. "mail" and
  // "doc" are the two values `item_views.py` emits in `type`.
  const mailCount = items.filter((item) => item.type === "mail").length;
  const documentCount = items.length - mailCount;
  const sourceTags: SourceTag[] = [];
  if (mailCount) sourceTags.push({ kind: "email", count: mailCount });
  if (documentCount) sourceTags.push({ kind: "drive", count: documentCount });

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

  const documents = rankDocuments(
    handover,
    items,
    user?.full_name || user?.email || "moi"
  );

  const passation: Passation = {
    ...demoPassation,
    attentionPoints,
    contacts,
    contactsTotal: contacts.length,
    documents,
    documentsTotal: documents.length,
    title: `Passation — ${user?.full_name || user?.email || "moi"}`,
    lastUpdated: handover ? frenchDateTime(handover.updatedAt) : "—",
    completude: completeness(handover),
    resume: handover?.text ?? "",
    sourceTags,
    sourcesCount: items.length,
  };

  return (
    <>
      <section className="mb-8 flex items-start gap-4">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-brand-50">
          <FilePlus2 className="h-6 w-6 text-brand-600" />
        </span>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">
            Préparer une passation
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            L&rsquo;agent PassOn lit vos documents et vos mails, et en compose
            le résumé de votre passation.
          </p>

          <button
            type="button"
            onClick={() => user?.id && void generate(user.id)}
            disabled={generating}
            className="mt-4 flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white shadow-card transition-colors hover:bg-brand-700 disabled:opacity-70"
          >
            {generating ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : hasResume ? (
              <RefreshCw className="h-4 w-4" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            {generating
              ? "Lecture de vos documents et mails…"
              : hasResume
                ? "Régénérer le résumé"
                : "Générer le résumé"}
          </button>

          {generating && (
            <p className="mt-2 text-xs text-gray-400">
              Cela prend une trentaine de secondes : chaque document et chaque
              mail est lu avant d&rsquo;être résumé.
            </p>
          )}

          {error && (
            <p
              role="alert"
              className="mt-3 flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800"
            >
              <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
              {error}
            </p>
          )}

          {!hasResume && !generating && error && (
            <p className="mt-3 text-sm text-gray-500">
              Le résumé est vide : relancez une génération quand la cause
              ci-dessus est levée.
            </p>
          )}
        </div>
      </section>

      <h2 className="mb-4 text-lg font-semibold text-gray-900">
        Mes passations
      </h2>

      <PassationCard
        key={handover?.updatedAt ?? "empty"}
        passation={passation}
        onResumeCommit={handleResumeCommit}
        onBlockersCommit={handleBlockersCommit}
        onContactsCommit={handleContactsCommit}
        generating={generating}
      />
    </>
  );
}
