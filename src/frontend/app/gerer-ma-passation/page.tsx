"use client";

import { Suspense, useEffect, useState } from "react";
import { Header } from "@/components/Header";
import { Sidebar } from "@/components/Sidebar";
import { RequireSession } from "@/components/RequireSession";
import { PassationBoard } from "@/components/passation/PassationBoard";

// Matches the entry page's fade/scale-out, so arriving here (from that
// page, faded out) fades back in at the same pace rather than as a hard cut.
const PAGE_TRANSITION_MS = 280;

function PassationView() {
  const [visible, setVisible] = useState(false);

  // Starts at opacity-0 and flips right after the first paint -- doing it in
  // the same render as the initial state would never actually transition,
  // since there would be nothing painted at 0 to animate from.
  useEffect(() => {
    const frame = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <div className="flex h-screen flex-col">
      <Header />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />

        <main className="flex flex-1 flex-col overflow-hidden bg-[#f5f6f8] px-8 py-8">
          <div
            className={`mx-auto flex min-h-0 w-full max-w-5xl flex-1 flex-col transition-all ease-out ${
              visible ? "scale-100 opacity-100" : "scale-[0.97] opacity-0"
            }`}
            style={{ transitionDuration: `${PAGE_TRANSITION_MS}ms` }}
          >
            {/* lil's page held a simulated two-line wait before showing a
                fixture card. The board does the real thing: it reads the
                stored sheet, generates one from the person's documents when
                there is none, and saves what comes back -- with
                its own progress, which is why the `prewarmed` hint is no
                longer needed to avoid showing a wait twice. */}
            <PassationBoard />
          </div>
        </main>
      </div>
    </div>
  );
}

export default function GererMaPassationPage() {
  return (
    <RequireSession>
      {/* useSearchParams (inside the board's children) needs a Suspense
          boundary to keep this route from opting the whole page into
          client-side rendering at build time. */}
      <Suspense fallback={null}>
        <PassationView />
      </Suspense>
    </RequireSession>
  );
}
