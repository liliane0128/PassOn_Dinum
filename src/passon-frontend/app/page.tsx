"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Circle, Loader2, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { Header } from "@/components/Header";
import { Sidebar } from "@/components/Sidebar";

type GenerationState = "idle" | "generating";

// The 4 steps and ~4.4s total the loading page used to show on its own,
// now played out here as a checklist before navigating to the result --
// see gerer-ma-passation/page.tsx's "prewarmed" param, which skips its own
// loading state so the wait doesn't happen a second time over there.
const STEPS = [
  "Analyse de vos Docs",
  "Lecture de vos Fichiers",
  "Extraction des actions et échéances",
  "Rédaction de la fiche de passation",
];
const STEP_DURATION_MS = 1100;

// How long the fade-out plays before the actual navigation fires -- the
// matching fade-in on the other side (gerer-ma-passation/page.tsx) uses the
// same duration, so the cut from one to the other happens at the same dark
// (fully faded) point on both ends instead of a hard jump.
const PAGE_TRANSITION_MS = 250;

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
          {/* pb-16 (rather than plain centering) so the taller block --
              checklist included -- still centers as a whole a bit above
              dead-center, not pushed down by its own added height. Fades
              out just before navigating to gerer-ma-passation (see
              `leaving`), which fades in the same way on arrival. */}
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
              onClick={() => setState("generating")}
              disabled={state === "generating"}
              className="mt-5 flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white shadow-card transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-70"
            >
              <Plus className="h-4 w-4" />
              Générer ma passation
            </button>

            {/* Space for the checklist is reserved even at rest (no
                conditional render), just invisible -- so revealing it
                doesn't grow the block and shift the rest of the page. Each
                line fades/slides in on its own, a beat after the previous
                one (transitionDelay below), for a soft cascade rather than
                all four appearing at once. */}
            <ul className="mt-5 flex flex-col gap-2" aria-hidden={state !== "generating"}>
              {STEPS.map((label, index) => {
                const isDone = state === "generating" && index < completedCount;
                const isActive = state === "generating" && index === completedCount;
                return (
                  <li
                    key={label}
                    style={{
                      transitionDelay: state === "generating" ? `${index * 150}ms` : "0ms",
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
  );
}
