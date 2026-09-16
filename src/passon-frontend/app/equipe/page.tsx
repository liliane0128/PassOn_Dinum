"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Clock, Users } from "lucide-react";
import { Header } from "@/components/Header";
import { Sidebar } from "@/components/Sidebar";
import { RequireSession } from "@/components/RequireSession";
import { useAuth } from "@/context/AuthContext";
import { fetchHandover, type Handover } from "@/lib/handover";
import { teamMembers } from "@/lib/mock-data";
import { DASHBOARD_PATH } from "@/lib/routes";
import { TeamMember } from "@/lib/types";
import { cn } from "@/lib/cn";

const statusLabel: Record<TeamMember["status"], string> = {
  actif: "Actif",
  en_depart: "En départ",
};

function ValidationIndicator({ validated }: { validated: boolean }) {
  return validated ? (
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
  const { session } = useAuth();
  const user = session?.user;
  const [handover, setHandover] = useState<Handover | null>(null);
  const [loading, setLoading] = useState(true);

  // Only the status is needed here, so a failure is silent: the row still
  // shows, reading "En attente", rather than the list losing a line.
  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    fetchHandover(user.id)
      .then((sheet) => !cancelled && setHandover(sheet))
      .catch(() => undefined)
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

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
                  {/* The live row: the logged-in person's own case, whose
                      status is read from their stored sheet. The rows below
                      are the demo fixture, kept to populate the list. */}
                  <li className="flex items-center justify-between gap-4 px-5 py-4">
                    <div>
                      <p className="text-sm font-semibold text-gray-900">
                        {user?.full_name || user?.email || "Moi"}
                        <span className="ml-2 rounded-full bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700">
                          vous
                        </span>
                      </p>
                      <p className="text-sm text-gray-500">
                        {user?.jobTitle || user?.email}
                      </p>
                    </div>

                    <div className="flex items-center gap-4">
                      <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700">
                        En départ
                      </span>
                      {loading ? (
                        <span className="text-xs text-gray-400">Chargement…</span>
                      ) : (
                        <ValidationIndicator validated={handover?.validated ?? false} />
                      )}
                      <Link
                        href={DASHBOARD_PATH}
                        className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700"
                      >
                        Voir la passation
                      </Link>
                    </div>
                  </li>

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

                        <span className="text-xs text-gray-400">
                          Aucune passation en cours
                        </span>
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
