"use client";

import { useEffect, useState } from "react";
import { Loader2, RotateCcw } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { Header } from "@/components/Header";
import { Sidebar } from "@/components/Sidebar";
import { PassationCard } from "@/components/passation/PassationCard";
import { passation } from "@/lib/mock-data";

type GenerationState = "generating" | "ready";

// Just two lines, the first held longer than the second -- reads like a
// glimpse of a longer status loop caught and cut off mid-way, rather than a
// clean progression, which a longer/even sequence would look like. Stands
// in for real progress once there's an actual generation call to report on.
const FIRST_STEP = "Analyse de vos Docs…";
const SECOND_STEP = "Rédaction de la fiche de passation…";
const FIRST_STEP_DURATION_MS = 1300;
const SECOND_STEP_DURATION_MS = 900;
const GENERATION_DELAY_MS = FIRST_STEP_DURATION_MS + SECOND_STEP_DURATION_MS;

// Matches the homepage's fade-out duration (see app/page.tsx's
// PAGE_TRANSITION_MS), so arriving here (from that page, faded out) fades
// back in at the same pace rather than a hard cut.
const PAGE_TRANSITION_MS = 250;

export default function GererMaPassationPage() {
  // Set by the homepage once its own checklist has already played out the
  // wait -- skips this page's, so it isn't shown twice in a row. Direct
  // visits (a bookmark, "Régénérer") still get it.
  const prewarmed = useSearchParams().get("prewarmed") === "1";
  const [state, setState] = useState<GenerationState>(
    prewarmed ? "ready" : "generating",
  );
  const [step, setStep] = useState(FIRST_STEP);
  const [visible, setVisible] = useState(false);

  // Starts at opacity-0 and flips right after the first paint -- doing it
  // in the same render as the initial state would never actually
  // transition, since there'd be nothing painted at 0 yet to animate from.
  useEffect(() => {
    const frame = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (state !== "generating") return;
    setStep(FIRST_STEP);
    const toSecondStep = setTimeout(
      () => setStep(SECOND_STEP),
      FIRST_STEP_DURATION_MS,
    );
    const doneTimeout = setTimeout(() => setState("ready"), GENERATION_DELAY_MS);
    return () => {
      clearTimeout(toSecondStep);
      clearTimeout(doneTimeout);
    };
  }, [state]);

  return (
    <div className="flex h-screen flex-col">
      <Header />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />

        <main className="flex flex-1 flex-col overflow-hidden bg-[#f5f6f8] px-8 py-8">
          <div
            className={`mx-auto flex w-full max-w-5xl min-h-0 flex-1 flex-col transition-opacity ease-out ${
              visible ? "opacity-100" : "opacity-0"
            }`}
            style={{ transitionDuration: `${PAGE_TRANSITION_MS}ms` }}
          >
            {state === "generating" ? (
              <div className="flex flex-1 flex-col items-center justify-center text-center">
                <Loader2 className="h-7 w-7 animate-spin text-brand-600" />
                <p className="mt-3 text-sm text-gray-500">{step}</p>
              </div>
            ) : (
              <>
                <div className="mb-4 flex shrink-0 justify-end">
                  <button
                    onClick={() => setState("generating")}
                    className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    Régénérer
                  </button>
                </div>
                <div className="min-h-0 flex-1">
                  <PassationCard passation={passation} />
                </div>
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
