"use client";

import { useEffect, useState } from "react";
import { Loader2, RotateCcw } from "lucide-react";
import { Header } from "@/components/Header";
import { Sidebar } from "@/components/Sidebar";
import { PassationCard } from "@/components/passation/PassationCard";
import { passation } from "@/lib/mock-data";

type GenerationState = "generating" | "ready";

// Simulated delay before the mock passation "appears" -- stands in for the
// real generation call once the agent actually assembles a passation.
const GENERATION_DELAY_MS = 600;

export default function GererMaPassationPage() {
  const [state, setState] = useState<GenerationState>("generating");

  useEffect(() => {
    if (state !== "generating") return;
    const timeout = setTimeout(() => setState("ready"), GENERATION_DELAY_MS);
    return () => clearTimeout(timeout);
  }, [state]);

  return (
    <div className="flex h-screen flex-col">
      <Header />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />

        <main className="flex flex-1 flex-col overflow-hidden bg-[#f5f6f8] px-8 py-8">
          <div className="mx-auto flex w-full max-w-5xl min-h-0 flex-1 flex-col">
            {state === "generating" ? (
              <div className="flex flex-1 flex-col items-center justify-center text-center">
                <Loader2 className="h-7 w-7 animate-spin text-brand-600" />
                <p className="mt-3 text-sm text-gray-500">
                  Chargement de votre passation…
                </p>
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
