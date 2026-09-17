"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Settings, FolderOpen, Users } from "lucide-react";
import { cn } from "@/lib/cn";
import { useRole } from "@/context/RoleContext";

export function Sidebar() {
  const pathname = usePathname();
  const { role } = useRole();

  const navItems = [
    { id: "accueil", label: "Accueil", icon: Home, href: "/" },
    {
      id: "ma-passation",
      label: "Ma passation",
      icon: FolderOpen,
      href: "/gerer-ma-passation",
    },
    {
      id: "equipe",
      label: "Mon équipe",
      icon: Users,
      href: "/equipe",
      managerOnly: true,
    },
  ];

  const visibleItems = navItems.filter((item) => !item.managerOnly || role === "manager");

  return (
    <aside className="flex h-full w-56 shrink-0 flex-col justify-between border-r border-gray-200 bg-white px-3 py-4">
      <nav className="flex flex-col gap-1">
        {visibleItems.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href;
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
