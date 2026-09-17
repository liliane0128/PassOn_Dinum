"use client";

import { Fragment, useEffect, useState } from "react";
import { Check, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { Header } from "@/components/Header";
import { Sidebar } from "@/components/Sidebar";

type GenerationState = "idle" | "generating";

// The 4 steps and ~4.4s total the loading page used to show on its own,
// now played out here as a progress bar before navigating to the result --
// see gerer-ma-passation/page.tsx's "prewarmed" param, which skips its own
// loading state so the wait doesn't happen a second time over there.
const STEPS = [
  "Lecture de vos sources",
  "Repérage des dossiers actifs",
  "Extraction des informations clés",
  "Compilation du dossier de passation",
];
const STEP_DURATION_MS = 1100;

// How long the fade/scale-out plays before the actual navigation fires --
// the matching entrance on the other side (gerer-ma-passation/page.tsx)
// uses the same duration, so the cut from one to the other happens at the
// same (fully faded) point on both ends instead of a hard jump.
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

export default function HomePage() {
  const router = useRouter();
  const [state, setState] = useState<GenerationState>("idle");
  const [completedCount, setCompletedCount] = useState(0);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    if (state !== "generating") return;
    setCompletedCount(0);
    const interval = setInterval(() => {
      setCompletedCount((count) => Math.min(count + 1, STEPS.length));
    }, STEP_DURATION_MS);
    // A beat after the last checkmark lands, rather than the instant it
    // does, so it actually reads before the page changes.
    const fadeTimeout = setTimeout(
      () => setLeaving(true),
      STEPS.length * STEP_DURATION_MS + 300,
    );
    const navigateTimeout = setTimeout(
      () => router.push("/gerer-ma-passation?prewarmed=1"),
      STEPS.length * STEP_DURATION_MS + 300 + PAGE_TRANSITION_MS,
    );
    return () => {
      clearInterval(interval);
      clearTimeout(fadeTimeout);
      clearTimeout(navigateTimeout);
    };
  }, [state, router]);

  return (
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
              onClick={() => setState("generating")}
              disabled={state === "generating"}
              className="mt-6 flex items-center gap-2 rounded-lg bg-brand-600 px-5 py-3 text-base font-semibold text-white shadow-card transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-70"
            >
              <Plus className="h-5 w-5" />
              Générer ma passation
            </button>

            {/* Space for the progress bar is reserved even at rest (no
                conditional render), just invisible -- so revealing it
                doesn't grow the block and shift the rest of the page.

                The dots and the lines between them are siblings in one
                flat row (not lines nested inside each dot's own wrapper),
                so every dot lines up on an even grid and every gap is the
                same width -- nesting them per-dot was what made the first
                dot and its neighbours drift out of alignment before.

                Each line segment fills in sync with the dot right before
                it, over that step's own duration, so progress reads as one
                continuous wave moving left to right rather than the line
                snapping green only once its dot is already done. */}
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
  );
}
