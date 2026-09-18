"use client";

import { Bell, CircleHelp, LogOut, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { PassOnLogo } from "./PassOnLogo";
import { cn } from "@/lib/cn";
import { Role, useRole } from "@/context/RoleContext";
import { useAuth } from "@/context/AuthContext";
import { DASHBOARD_PATH, EQUIPE_PATH, LOGIN_PATH } from "@/lib/routes";
import { MANAGER_PERSONA } from "@/lib/demo-data";

const roleOptions: { value: Role; label: string }[] = [
  { value: "agent", label: "Agent" },
  { value: "manager", label: "Manager" },
];

// Where switching to a role lands: the manager's own view is the team list,
// the agent's is their own dashboard -- so the switch reads as "go look at
// things from there" rather than a toggle that leaves you on whatever page
// you happened to be on.
const roleDestination: Record<Role, string> = {
  agent: DASHBOARD_PATH,
  manager: EQUIPE_PATH,
};

// Purely local, front-end-only view switch for demos: not a real login or
// permission system, see context/RoleContext.tsx.
function RoleSwitcher() {
  const { role, setRole } = useRole();
  const router = useRouter();

  function switchTo(next: Role) {
    setRole(next);
    router.push(roleDestination[next]);
  }

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
          onClick={() => switchTo(option.value)}
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

/** Initials from the name the backend reports, for the avatar. */
function initialsOf(fullName: string, email: string) {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return email.slice(0, 2).toUpperCase();
}

export function Header() {
  const { session, logout } = useAuth();
  const { role } = useRole();
  const user = session?.user;

  // The "Manager" view is a cosmetic swap, not a second account (see
  // RoleContext.tsx): the session underneath is still the real one, only what
  // the header shows for it changes, so a demo can be given as "now looking
  // at this as Marie's manager" without a second login.
  const isManagerView = role === "manager";
  const displayName = isManagerView ? MANAGER_PERSONA.full_name : user?.full_name;
  const displayTitle = isManagerView ? MANAGER_PERSONA.jobTitle : user?.jobTitle;
  const avatarUrl = isManagerView ? null : user?.avatarUrl;

  async function handleLogout() {
    await logout();
    window.location.href = LOGIN_PATH;
  }

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
        <div className="flex items-center gap-2">
          {/* The picture when there is one, initials otherwise -- most people
              have none, and an empty circle says less than two letters. */}
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt=""
              className="h-8 w-8 shrink-0 rounded-full object-cover"
            />
          ) : (
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-600 text-xs font-semibold text-white">
              {displayName ? initialsOf(displayName, user?.email ?? "") : "?"}
            </span>
          )}
          <span className="hidden flex-col items-start leading-tight sm:flex">
            <span className="font-medium text-gray-800">
              {displayName || user?.email || "Non connecté"}
            </span>
            <span className="text-xs text-gray-400">
              {displayTitle || user?.email}
            </span>
          </span>
          <button
            type="button"
            onClick={handleLogout}
            title="Se déconnecter"
            aria-label="Se déconnecter"
            className="ml-1 rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </header>
  );
}
