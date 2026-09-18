"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Settings, FolderOpen, Users } from "lucide-react";
import { cn } from "@/lib/cn";
import { useRole } from "@/context/RoleContext";
import { DASHBOARD_PATH, EQUIPE_PATH, PASSATION_PATH } from "@/lib/routes";

export function Sidebar() {
  const pathname = usePathname();
  const { role } = useRole();

  const navItems = [
    // DASHBOARD_PATH, not "/": behind nginx "/" is the static homepage, and
    // linking there drops the person out of the application.
    { id: "accueil", label: "Accueil", icon: Home, href: DASHBOARD_PATH },
    {
      id: "ma-passation",
      label: "Ma passation",
      icon: FolderOpen,
      href: PASSATION_PATH,
    },
    {
      id: "equipe",
      label: "Mon équipe",
      icon: Users,
      href: EQUIPE_PATH,
      managerOnly: true,
    },
  ];

  const visibleItems = navItems.filter((item) => !item.managerOnly || role === "manager");

  // A manager landing on /gerer-ma-passation came from "Mon équipe"
  // (equipe/page.tsx's "Voir la passation"), not from "Ma passation" -- they
  // are reviewing someone else's sheet, not their own -- so the active item
  // stays "Mon équipe" instead of jumping to whichever nav item happens to
  // share that URL.
  const viewingViaTeam = pathname === PASSATION_PATH && role === "manager";

  return (
    <aside className="flex h-full w-56 shrink-0 flex-col justify-between border-r border-gray-200 bg-white px-3 py-4">
      <nav className="flex flex-col gap-1">
        {visibleItems.map((item) => {
          const Icon = item.icon;
          const active = viewingViaTeam ? item.id === "equipe" : pathname === item.href;
          return (
            <Link
              key={item.id}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-brand-50 text-brand-700"
                  : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
              )}
            >
              <Icon className="h-[18px] w-[18px]" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="flex flex-col gap-4">
        <a
          href="#"
          className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900"
        >
          <Settings className="h-[18px] w-[18px]" />
          Paramètres
        </a>
      </div>
    </aside>
  );
}
