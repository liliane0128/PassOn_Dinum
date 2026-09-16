"use client";

import { Header } from "@/components/Header";
import { Sidebar } from "@/components/Sidebar";
import { RequireSession } from "@/components/RequireSession";
import { PassationBoard } from "@/components/passation/PassationBoard";

/**
 * The handover itself.
 *
 * lil's layout, with the simulated 600 ms "generation" replaced by
 * `PassationBoard`, which loads the stored sheet, generates it from the
 * person's documents and mails when it is empty, and saves what comes back.
 */
export default function GererMaPassationPage() {
  return (
    <RequireSession>
      <div className="flex h-screen flex-col">
        <Header />
        <div className="flex flex-1 overflow-hidden">
          <Sidebar />

          <main className="flex flex-1 flex-col overflow-hidden bg-[#f5f6f8] px-8 py-8">
            <div className="mx-auto flex min-h-0 w-full max-w-5xl flex-1 flex-col">
              <PassationBoard />
            </div>
          </main>
        </div>
      </div>
    </RequireSession>
  );
}
