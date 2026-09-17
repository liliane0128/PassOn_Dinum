"use client";

import { useEffect, type ReactNode } from "react";
import { LoaderCircle } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { LOGIN_PATH } from "@/lib/routes";

/**
 * Keeps a page for people who are logged in.
 *
 * Without this the protection would be cosmetic: the homepage would send a
 * stranger to the login page, but typing the dashboard's URL would walk
 * straight in.
 *
 * Nothing is decided while `restoring` is true. The session is restored by an
 * asynchronous call, and redirecting before it answers would bounce a
 * logged-in person to the login page on every refresh.
 */
export function RequireSession({ children }: { children: ReactNode }) {
  const { session, restoring } = useAuth();

  // `replace`, so a bounced visit leaves no entry to go "back" to. From an
  // effect rather than from render: React may render a component twice before
  // committing it, and a navigation started during render would fire twice --
  // and fire at all during a render React then throws away.
  useEffect(() => {
    if (!restoring && !session) window.location.replace(LOGIN_PATH);
  }, [restoring, session]);

  if (restoring) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#f5f6f8]">
        <LoaderCircle className="h-6 w-6 animate-spin text-brand-600" />
        <span className="sr-only">Chargement de votre session…</span>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#f5f6f8]">
        <p className="text-sm text-gray-500">Redirection vers la connexion…</p>
      </div>
    );
  }

  return <>{children}</>;
}
