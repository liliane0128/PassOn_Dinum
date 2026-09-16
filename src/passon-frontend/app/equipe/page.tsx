"use client";

import Link from "next/link";
import { CheckCircle2, Clock, Users } from "lucide-react";
import { Header } from "@/components/Header";
import { Sidebar } from "@/components/Sidebar";
import { RequireSession } from "@/components/RequireSession";
import { usePassationStatus } from "@/components/PassationStatusProvider";
import { passation, teamMembers } from "@/lib/mock-data";
import { TeamMember } from "@/lib/types";
import { cn } from "@/lib/cn";

const statusLabel: Record<TeamMember["status"], string> = {
  actif: "Actif",
  en_depart: "En départ",
};

// Only one passation exists in this demo, and it is the one generated for
// whoever is "en_depart" -- so this row's indicator just reads that
// passation's status, same Provider as PassationCard's own badge/button.
function ValidationIndicator() {
  const { getStatus } = usePassationStatus();
  const status = getStatus(passation.id);

  return status.validated ? (
    <span className="flex items-center gap-1 text-xs font-medium text-emerald-600">
      <CheckCircle2 className="h-3.5 w-3.5" />
      Validée
    </span>
  ) : (
    <span className="flex items-center gap-1 text-xs font-medium text-amber-600">
      <Clock className="h-3.5 w-3.5" />
      En attente
    </span>
  );
}

export default function EquipePage() {
  return (
<RequireSession>
      <div className="flex h-screen flex-col">
        <Header />
        <div className="flex flex-1 overflow-hidden">
          <Sidebar />

          <main className="flex-1 overflow-y-auto bg-[#f5f6f8] px-8 py-8">
            <div className="mx-auto max-w-5xl">
              <section className="mb-8 flex items-center gap-4">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-brand-50">
                  <Users className="h-6 w-6 text-brand-600" />
                </span>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">Mon équipe</h1>
                  <p className="mt-1 text-sm text-gray-500">
                    Suivi des membres de votre équipe et de leurs départs en cours.
                  </p>
                </div>
              </section>

              <div className="rounded-2xl border border-gray-200 bg-white shadow-card">
                <ul className="divide-y divide-gray-100">
                  {teamMembers.map((member) => (
                    <li
                      key={member.id}
                      className="flex items-center justify-between gap-4 px-5 py-4"
                    >
                      <div>
                        <p className="text-sm font-semibold text-gray-900">{member.name}</p>
                        <p className="text-sm text-gray-500">{member.role}</p>
                      </div>

                      <div className="flex items-center gap-4">
                        <span
                          className={cn(
                            "rounded-full px-2.5 py-0.5 text-xs font-medium",
                            member.status === "en_depart"
                              ? "bg-amber-50 text-amber-700"
                              : "bg-gray-100 text-gray-600"
                          )}
                        >
                          {statusLabel[member.status]}
                        </span>

                        {member.status === "en_depart" ? (
                          <>
                            <ValidationIndicator />
                            <Link
                              href="/"
                              className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700"
                            >
                              Générer la passation
                            </Link>
                          </>
                        ) : (
                          <span className="text-xs text-gray-400">Aucun départ en cours</span>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </main>
        </div>
      </div>
    </RequireSession>
  );
}
