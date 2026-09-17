"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Eye, EyeOff, LoaderCircle } from "lucide-react";
import { PassOnLogo } from "@/components/PassOnLogo";
import { useAuth } from "@/context/AuthContext";
import { LOGIN_ERRORS } from "@/lib/auth";
import { DASHBOARD_PATH } from "@/lib/routes";

export default function LoginPage() {
  const { session, restoring, login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [reveal, setReveal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Someone already logged in has no business on this page. `replace` rather
  // than `href`: this page must not stay in the history, or going back from
  // the dashboard would land here and bounce forward again.
  useEffect(() => {
    if (!restoring && session) window.location.replace(DASHBOARD_PATH);
  }, [restoring, session]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    const result = await login(email.trim(), password);
    if (result.ok) {
      // A full navigation rather than the Next router: the dashboard lives at
      // a path nginx owns (/dashboard -> this app's "/"), which the client
      // router knows nothing about. `replace` drops this page from the
      // history, so the back arrow from the dashboard skips it.
      window.location.replace(DASHBOARD_PATH);
      return;
    }
    setError(LOGIN_ERRORS[result.code ?? "network"] ?? LOGIN_ERRORS.network);
    setSubmitting(false);
  }

  // Until `/api/auth/me/` answers, showing the form would be a guess -- and
  // the wrong one for anyone already logged in, who would watch it for a
  // second before being sent away. A quiet placeholder instead.
  if (restoring || session) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f5f6f8]">
        <LoaderCircle className="h-6 w-6 animate-spin text-brand-600" />
        <span className="sr-only">Vérification de votre session…</span>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[#f5f6f8] px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <PassOnLogo variant="full" height={48} />
          <p className="text-sm text-gray-500">
            Connectez-vous avec vos identifiants Drive.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="flex flex-col gap-4 rounded-xl border border-gray-200 bg-white p-8 shadow-card"
        >
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="email"
              className="text-sm font-medium text-gray-700"
            >
              Adresse électronique
            </label>
            <input
              id="email"
              type="email"
              autoComplete="username"
              required
              value={email}
              disabled={submitting}
              onChange={(event) => setEmail(event.target.value)}
              className="rounded-lg border border-gray-200 px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100 disabled:bg-gray-50"
              placeholder="prenom.nom@exemple.fr"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="password"
              className="text-sm font-medium text-gray-700"
            >
              Mot de passe
            </label>
            <div className="relative">
              <input
                id="password"
                type={reveal ? "text" : "password"}
                autoComplete="current-password"
                required
                value={password}
                disabled={submitting}
                onChange={(event) => setPassword(event.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2.5 pr-10 text-sm text-gray-900 outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100 disabled:bg-gray-50"
              />
              <button
                type="button"
                onClick={() => setReveal((shown) => !shown)}
                aria-label={
                  reveal ? "Masquer le mot de passe" : "Afficher le mot de passe"
                }
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600"
              >
                {reveal ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>

          {error && (
            <p
              role="alert"
              className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700"
            >
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="mt-2 flex items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white shadow-card transition-colors hover:bg-brand-700 disabled:opacity-70"
          >
            {submitting && <LoaderCircle className="h-4 w-4 animate-spin" />}
            {submitting ? "Connexion…" : "Se connecter"}
          </button>
        </form>

        <p className="mt-6 text-center text-xs leading-relaxed text-gray-500">
          PassOn n&rsquo;a pas de compte à lui : vos identifiants sont vérifiés
          par votre Drive, et aucun mot de passe n&rsquo;est conservé ici.
        </p>
      </div>
    </main>
  );
}
