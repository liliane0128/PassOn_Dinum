"use client";

import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import { Check, Plus, TriangleAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import { Header } from "@/components/Header";
import { Sidebar } from "@/components/Sidebar";
import { RequireSession } from "@/components/RequireSession";
import { useAuth } from "@/context/AuthContext";
import { errorMessage } from "@/lib/handover";
import { runGeneration } from "@/lib/generate-passation";
import { PASSATION_PATH } from "@/lib/routes";
import { DEMO_MODE, buildDemoHandover } from "@/lib/demo-data";
import { withMinDuration, MIN_GENERATION_DURATION_MS } from "@/lib/with-min-duration";

type GenerationState = "idle" | "generating";

// lil's four-step checklist, played against the real call rather than a
// timer: the steps advance on their own but stop one short, and the last one
// only completes when the generation actually returns. Sized off the shared
// floor (lib/with-min-duration.ts) rather than a constant of its own, so the
// four steps split it evenly instead of the first three flashing by and the
// last one carrying whatever time is left over.
const STEPS = [
  "Lecture de vos sources",
  "Repérage des dossiers actifs",
  "Extraction des informations clés",
  "Compilation du dossier de passation",
];
const STEP_DURATION_MS = MIN_GENERATION_DURATION_MS / STEPS.length;

// Matches the fade/scale-in on gerer-ma-passation, so the cut between the
// two happens at the same (fully faded) point rather than as a jump.
const PAGE_TRANSITION_MS = 280;

function StepDot({
  index,
  label,
  isActive,
  isDone,
  visible,
}: {
  index: number;
  label: string;
  isActive: boolean;
  isDone: boolean;
  visible: boolean;
}) {
  return (
    <div
      style={{ transitionDelay: visible ? `${index * 120}ms` : "0ms" }}
      className={`flex w-[112px] shrink-0 flex-col items-center gap-2.5 text-center transition-all duration-500 ease-out ${
        visible ? "translate-y-0 opacity-100" : "-translate-y-1 opacity-0"
      }`}
    >
      <span
        className={`relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full border transition-colors duration-300 ease-out ${
          isDone
            ? "border-emerald-500 bg-emerald-500"
            : isActive
              ? "border-transparent bg-white"
              : "border-gray-300 bg-white"
        }`}
      >
        {/* Pending: a faint step number, present until this step is reached. */}
        <span
          className={`absolute text-xs font-medium text-gray-400 transition-all duration-200 ease-out ${
            isActive || isDone ? "scale-50 opacity-0" : "scale-100 opacity-100"
          }`}
        >
          {index + 1}
        </span>

        {/* Active: a hollow dashed ring that spins, rather than a filled
            circle -- reads as a classic, unobtrusive loading spinner. A
            slowed-down spin (default animate-spin is 1s/turn, too frantic
            for a ring that's supposed to read as calm background progress). */}
        <span
          style={{ animationDuration: "2.2s" }}
          className={`absolute inset-0 rounded-full border-2 border-dashed border-gray-300 transition-opacity duration-200 ease-out ${
            isActive ? "animate-spin opacity-100" : "opacity-0"
          }`}
        />

        {/* Done: a checkmark that pops in with a slight spring overshoot,
            rather than just cross-fading in flatly. */}
        <Check
          className={`absolute h-4 w-4 text-white ${isDone ? "step-check-pop" : "scale-0 opacity-0"}`}
        />
      </span>

      <span
        className={`text-sm leading-tight transition-colors duration-300 ease-out ${
          isActive ? "font-semibold text-gray-900" : "text-gray-400"
        }`}
      >
        {label}
      </span>
    </div>
  );
}

function StepLine({ filled, visible }: { filled: boolean; visible: boolean }) {
  return (
    <div
      className={`mt-[18px] h-px flex-1 self-start overflow-hidden bg-gray-200 transition-opacity duration-300 ease-out ${
        visible ? "opacity-100" : "opacity-0"
      }`}
    >
      <div
        className={`h-full w-full bg-emerald-500 ${filled ? "step-line-fill" : "scale-x-0"}`}
        style={filled ? { animationDuration: `${STEP_DURATION_MS}ms` } : undefined}
      />
    </div>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const { session } = useAuth();
  const user = session?.user;

  const [state, setState] = useState<GenerationState>("idle");
  const [completedCount, setCompletedCount] = useState(0);
  const [leaving, setLeaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const running = useRef(false);

  // Every click runs a fresh pass, so the checklist always plays. That also
  // means it overwrites the stored sheet, edits and validation included, and
  // spends one of the free tier's ~one-a-minute generations: chosen
  // deliberately for a demo where the animation matters more than the
  // previous contents.

  const leaveFor = useCallback(
    (href: string) => {
      setLeaving(true);
      setTimeout(() => router.push(href), PAGE_TRANSITION_MS);
    },
    [router]
  );

  async function handleClick() {
    if (!user?.id || running.current) return;
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
      // Demo mode: no fetch, no PATCH, no dependency on Django or Groq --
      // just the checklist above, held open for MIN_GENERATION_DURATION_MS
      // (see lib/with-min-duration.ts) so it reads as a real pass rather than
      // a jump-cut. gerer-ma-passation picks the fixture back up on its own
      // once this redirects there (lib/demo-data.ts), so nothing from this
      // call needs to be kept.
      const pass = DEMO_MODE
        ? Promise.resolve(buildDemoHandover(user.id))
        : runGeneration(user.id, user.email, user.full_name);
      await withMinDuration(pass, MIN_GENERATION_DURATION_MS);
      setCompletedCount(STEPS.length);
      // A beat so the last checkmark reads before the page changes.
      setTimeout(() => leaveFor(PASSATION_PATH), 300);
    } catch (caught) {
      setError(errorMessage(caught));
      setState("idle");
      setCompletedCount(0);
    } finally {
      clearInterval(interval);
      running.current = false;
    }
  }


  return (
    <RequireSession>
      <div className="flex h-screen flex-col">
        <Header />
        <div className="flex flex-1 overflow-hidden">
          <Sidebar />

          <main className="flex-1 overflow-y-auto bg-[#f5f6f8]">
            <div
              className={`flex h-full flex-col items-center justify-center px-8 text-center transition-all ease-[cubic-bezier(0.4,0,1,1)] ${
                leaving ? "scale-[0.97] opacity-0" : "scale-100 opacity-100"
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
                Sur le départ&nbsp;?
                <br />
                Passez le relais en un clic.
              </h1>
              <p className="mt-2 max-w-lg text-sm text-gray-500">
                Vos Docs et vos Fichiers seront lus et analysés pour générer
                automatiquement une fiche de passation structurée, prête à
                relire.
              </p>

              <button
                type="button"
                onClick={handleClick}
                disabled={state === "generating"}
                className="mt-6 flex items-center gap-2 rounded-lg bg-brand-600 px-5 py-3 text-base font-semibold text-white shadow-card transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-70"
              >
                <Plus className="h-5 w-5" />
                Générer ma passation
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

              {/* Space for the progress bar is reserved even at rest (no
                  conditional render), just invisible -- so revealing it
                  doesn't grow the block and shift the rest of the page.

                  The dots and the lines between them are siblings in one
                  flat row (not lines nested inside each dot's own wrapper),
                  so every dot lines up on an even grid and every gap is the
                  same width. Each line segment fills in sync with the dot
                  right before it, over that step's own duration, so
                  progress reads as one continuous wave moving left to right
                  rather than the line snapping green only once its dot is
                  already done. */}
              <div
                className="mt-14 flex w-full max-w-xl items-start"
                aria-hidden={state !== "generating"}
              >
                {STEPS.map((label, index) => {
                  const isDone = state === "generating" && index < completedCount;
                  const isActive = state === "generating" && index === completedCount;
                  const lineFilled = state === "generating" && index <= completedCount;
                  const visible = state === "generating";

                  return (
                    <Fragment key={label}>
                      {index > 0 && <StepLine filled={lineFilled} visible={visible} />}
                      <StepDot
                        index={index}
                        label={label}
                        isActive={isActive}
                        isDone={isDone}
                        visible={visible}
                      />
                    </Fragment>
                  );
                })}
              </div>
            </div>
          </main>
        </div>
      </div>
    </RequireSession>
  );
}
