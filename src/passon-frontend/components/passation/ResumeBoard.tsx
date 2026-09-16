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
import { passation as demoPassation } from "@/lib/mock-data";
import type { Passation, SourceTag } from "@/lib/types";
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
 * The Résumé, read from the logged-in person's own documents and mails.
 *
 * Only that section is real. Points de blocage, documents prioritaires and
 * contacts clés still come from `mock-data.ts`, which is why the card below is
 * the demo fixture with its `resume` and its source counts replaced rather
 * than a `Passation` built from scratch: pretending the rest is real would
 * hide which parts are actually wired.
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
export function ResumeBoard() {
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
      setHandover(await saveHandover(collaboratorId, generated));
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

  // The real counts of what was read, in place of the fixture's.
  const mails = items.filter((item) => item.kind === "mail").length;
  const documents = items.length - mails;
  const sourceTags: SourceTag[] = [];
  if (mails) sourceTags.push({ kind: "email", count: mails });
  if (documents) sourceTags.push({ kind: "drive", count: documents });

  const passation: Passation = {
    ...demoPassation,
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
        resumeGenerating={generating}
      />
    </>
  );
}
