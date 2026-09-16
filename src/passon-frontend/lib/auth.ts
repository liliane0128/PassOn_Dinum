/**
 * Client for the Django session API (`src/backend/accounts/`).
 *
 * There is no PassOn account: the backend checks the email and password
 * against the local **Drive**, and tries Messages with the same credentials.
 * Nothing is verified here, and no password is ever stored on this side.
 *
 * Everything goes through relative URLs, which is why nginx proxies `/api/`
 * on the same origin as this app (:8091). A session cookie and Django's CSRF
 * check both depend on that: a cross-origin call would need CORS *and* an
 * exemption in CSRF_TRUSTED_ORIGINS, and would still drop the cookie in a
 * browser that blocks third-party cookies.
 */

export interface SessionUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  full_name: string;
  jobTitle: string;
  team: string;
  accountRole: "manager" | "employee";
  managerId: string | null;
}

export interface Session {
  user: SessionUser;
  /** Which upstream services this session actually holds a credential for. */
  services: { drive: boolean; messages: boolean };
  /** The manager's team; empty for an employee. */
  team: SessionUser[];
}

/** The codes the backend answers with, in words someone can act on. */
export const LOGIN_ERRORS: Record<string, string> = {
  invalid_credentials: "Adresse ou mot de passe incorrect.",
  invalid_request: "Adresse et mot de passe sont tous les deux nécessaires.",
  drive_unreachable: "Le Drive est injoignable. Est-il démarré ?",
  drive_timeout: "Le Drive met trop de temps à répondre.",
  unexpected_response: "Réponse inattendue du Drive.",
  network: "Serveur injoignable.",
};

function csrfToken(): string {
  const match = document.cookie.match(/(?:^|;\s*)csrftoken=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : "";
}

/**
 * Who is logged in, or `null`.
 *
 * This call is also what sets the `csrftoken` cookie (the view carries
 * `@ensure_csrf_cookie`), so it has to happen before any POST below.
 */
export async function fetchSession(): Promise<Session | null> {
  const response = await fetch("/api/auth/me/", {
    credentials: "same-origin",
    headers: { Accept: "application/json" },
  });
  if (response.status === 401) return null;
  if (!response.ok) throw new Error(`me:${response.status}`);
  return (await response.json()) as Session;
}

export type LoginResult =
  | { ok: true; session: Session }
  | { ok: false; code: string };

export async function login(
  email: string,
  password: string
): Promise<LoginResult> {
  // The CSRF cookie may not be set yet if the login page was opened directly.
  if (!csrfToken()) await fetchSession().catch(() => null);

  let response: Response;
  try {
    response = await fetch("/api/auth/login/", {
      method: "POST",
      credentials: "same-origin",
      headers: {
        "Content-Type": "application/json",
        "X-CSRFToken": csrfToken(),
      },
      body: JSON.stringify({ email, password }),
    });
  } catch {
    return { ok: false, code: "network" };
  }

  if (response.ok) return { ok: true, session: await response.json() };

  const body = await response.json().catch(() => ({}));
  return { ok: false, code: (body as { error?: string }).error ?? "network" };
}

export async function logout(): Promise<void> {
  await fetch("/api/auth/logout/", {
    method: "POST",
    credentials: "same-origin",
    headers: { "X-CSRFToken": csrfToken() },
  }).catch(() => undefined);
}
