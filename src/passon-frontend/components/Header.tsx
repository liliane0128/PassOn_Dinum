"use client";

import { Bell, ChevronDown, CircleHelp, Search } from "lucide-react";
import { PassOnLogo } from "./PassOnLogo";
import { currentUser } from "@/lib/mock-data";
import { cn } from "@/lib/cn";
import { Role, useRole } from "@/context/RoleContext";

const roleOptions: { value: Role; label: string }[] = [
  { value: "agent", label: "Agent" },
  { value: "manager", label: "Manager" },
];

// Purely local, front-end-only view switch for demos: not a real login or
// permission system, see context/RoleContext.tsx.
function RoleSwitcher() {
  const { role, setRole } = useRole();

  return (
    <div
      role="group"
      aria-label="Basculer entre la vue agent et la vue manager"
      className="flex items-center rounded-lg border border-gray-200 bg-gray-50 p-0.5 text-xs font-medium"
    >
      {roleOptions.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => setRole(option.value)}
          aria-pressed={role === option.value}
          className={cn(
            "rounded-md px-2.5 py-1 transition-colors",
            role === option.value
              ? "bg-white text-brand-700 shadow-card"
              : "text-gray-500 hover:text-gray-700"
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function Header() {
  return (
    <header className="flex h-16 w-full items-center justify-between border-b border-gray-200 bg-white px-6">
      <div className="flex items-center gap-3">
        <PassOnLogo variant="mark" height={32} />
        {/* Couleur alignée sur le titre "Docs" de La Suite (Title.tsx,
            $color="var(--c--contextuals--content--logo1)", thème "default"
            -> #4844ad), pas la palette brand-600 déjà utilisée ailleurs
            (boutons, etc.), volontairement différente. */}
        <span className="ml-2 text-lg font-bold text-[#4844ad]">PassOn</span>
      </div>

      <div className="mx-8 hidden max-w-xl flex-1 items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-500 md:flex">
        <Search className="h-4 w-4 text-gray-400" />
        <input
          type="text"
          placeholder="Rechercher une passation, un document, un collègue..."
          className="w-full bg-transparent text-sm text-gray-700 placeholder:text-gray-400 focus:outline-none"
        />
      </div>

      <div className="flex items-center gap-5 text-sm text-gray-600">
        <button className="flex items-center gap-1.5 hover:text-gray-900">
          <CircleHelp className="h-4 w-4" />
          <span className="hidden sm:inline">Aide</span>
        </button>
        <button className="relative hover:text-gray-900" aria-label="Notifications">
          <Bell className="h-5 w-5" />
          <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-red-500" />
        </button>
        <RoleSwitcher />
        <button className="flex items-center gap-2">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-600 text-xs font-semibold text-white">
            {currentUser.initials}
          </span>
          <span className="hidden flex-col items-start leading-tight sm:flex">
            <span className="font-medium text-gray-800">{currentUser.name}</span>
            <span className="text-xs text-gray-400">{currentUser.jobTitle}</span>
          </span>
          <ChevronDown className="h-4 w-4 text-gray-400" />
        </button>
      </div>
    </header>
  );
}
