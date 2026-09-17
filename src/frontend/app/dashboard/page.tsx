"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle2, Circle, Loader2, Plus, TriangleAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import { Header } from "@/components/Header";
import { Sidebar } from "@/components/Sidebar";
import { RequireSession } from "@/components/RequireSession";
import { useAuth } from "@/context/AuthContext";
import { errorMessage, fetchHandover } from "@/lib/handover";
import { runGeneration } from "@/lib/generate-passation";
import { PASSATION_PATH } from "@/lib/routes";

type GenerationState = "idle" | "generating";

// lil's four-step checklist, played against the real call rather than a
// timer: the steps advance on their own but stop one short, and the last one
// only completes when the generation actually returns. A pass takes around
// thirty seconds -- every document and mail is read before the model is
// called -- so a fixed 4.4s script would finish long before the work does.
const STEPS = [
  "Analyse de vos Docs",
  "Lecture de vos Fichiers",
  "Extraction des actions et échéances",
  "Rédaction de la fiche de passation",
];
const STEP_DURATION_MS = 1100;

// Matches the fade-in on gerer-ma-passation, so the cut between the two
// happens at the same fully-faded point rather than as a jump.
const PAGE_TRANSITION_MS = 250;

export default function DashboardPage() {
  const router = useRouter();
  const { session } = useAuth();
  const user = session?.user;

  const [state, setState] = useState<GenerationState>("idle");
  const [completedCount, setCompletedCount] = useState(0);
  const [leaving, setLeaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSheet, setHasSheet] = useState<boolean | null>(null);
  const running = useRef(false);

  // Whether a sheet already exists decides what the button does: generating
  // again would spend a rate-limited pass and overwrite whatever was edited.
  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    fetchHandover(user.id)
      .then((sheet) => !cancelled && setHasSheet(sheet.text.trim().length > 0))
      .catch(() => !cancelled && setHasSheet(false));
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const leaveFor = useCallback(
    (href: string) => {
      setLeaving(true);
      setTimeout(() => router.push(href), PAGE_TRANSITION_MS);
    },
    [router]
  );

  async function handleClick() {
    if (!user?.id || running.current) return;
    if (hasSheet) {
      leaveFor(PASSATION_PATH);
      return;
    }

    running.current = true;
    setError(null);
    setState("generating");
    setCompletedCount(0);

    // The checklist walks forward but holds on the last step: it reports the
    // pass, it does not pretend to know how far along it is.
    const interval = setInterval(
      () => setCompletedCount((count) => Math.min(count + 1, STEPS.length - 1)),
      STEP_DURATION_MS
    );

    try {
      await runGeneration(user.id, user.email);
      setCompletedCount(STEPS.length);
      // A beat so the last checkmark reads before the page changes.
      setTimeout(() => leaveFor(`${PASSATION_PATH}?prewarmed=1`), 300);
    } catch (caught) {
      setError(errorMessage(caught));
      setState("idle");
      setCompletedCount(0);
    } finally {
      clearInterval(interval);
      running.current = false;
    }
  }

  const label = hasSheet ? "Voir ma passation" : "Générer ma passation";

  return (
    <RequireSession>
      <div className="flex h-screen flex-col">
        <Header />
        <div className="flex flex-1 overflow-hidden">
          <Sidebar />

          <main className="flex-1 overflow-y-auto bg-[#f5f6f8]">
            {/* pb-16 (rather than plain centering) so the taller block --
                checklist included -- still centers as a whole a bit above
                dead-center, not pushed down by its own added height. Fades
                out just before navigating to gerer-ma-passation, which fades
                in the same way on arrival. */}
            <div
              className={`flex h-full flex-col items-center justify-center px-8 pb-16 text-center transition-opacity ease-out ${
                leaving ? "opacity-0" : "opacity-100"
              }`}
              style={{ transitionDuration: `${PAGE_TRANSITION_MS}ms` }}
            >
              <div className="flex items-center gap-2">
                <img src="/logo/connectors/docs.svg" alt="Docs" className="h-9 w-9" />
                <img
                  src="/logo/connectors/fichiers.svg"
                  alt="Fichiers"
                  className="h-9 w-9"
                />
              </div>

              <h1 className="mt-4 max-w-md text-3xl font-bold text-gray-900">
                Sur le départ&nbsp;? Préparez votre passation.
              </h1>
              <p className="mt-2 max-w-sm text-sm text-gray-500">
                L&rsquo;agent PassOn lit vos Docs et vos Fichiers pour composer
                une fiche de passation structurée, prête à relire.
              </p>

              <button
                type="button"
                onClick={handleClick}
                disabled={state === "generating" || hasSheet === null}
                className="mt-5 flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white shadow-card transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-70"
              >
                <Plus className="h-4 w-4" />
                {label}
              </button>

              {error && (
                <p
                  role="alert"
                  className="mt-4 flex max-w-sm items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-left text-sm text-amber-800"
                >
                  <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                  {error}
                </p>
              )}

              {/* Space for the checklist is reserved even at rest (no
                  conditional render), just invisible -- so revealing it
                  doesn't grow the block and shift the rest of the page. Each
                  line fades/slides in on its own, a beat after the previous
                  one, for a soft cascade rather than all four at once. */}
              <ul
                className="mt-5 flex flex-col gap-2"
                aria-hidden={state !== "generating"}
              >
                {STEPS.map((label, index) => {
                  const isDone = state === "generating" && index < completedCount;
                  const isActive = state === "generating" && index === completedCount;
                  return (
                    <li
                      key={label}
                      style={{
                        transitionDelay:
                          state === "generating" ? `${index * 150}ms` : "0ms",
                      }}
                      className={`flex items-center gap-2 text-left text-sm transition-all duration-500 ease-out ${
                        state === "generating"
                          ? "translate-y-0 opacity-100"
                          : "-translate-y-1 opacity-0"
                      } ${
                        isDone
                          ? "text-gray-900"
                          : isActive
                            ? "text-brand-700"
                            : "text-gray-400"
                      }`}
                    >
                      {isDone ? (
                        <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                      ) : isActive ? (
                        <Loader2 className="h-4 w-4 shrink-0 animate-spin text-brand-600" />
                      ) : (
                        <Circle className="h-4 w-4 shrink-0" />
                      )}
                      {label}
                    </li>
                  );
                })}
              </ul>
            </div>
          </main>
        </div>
      </div>
    </RequireSession>
  );
}
