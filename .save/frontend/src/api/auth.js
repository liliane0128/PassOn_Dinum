// Appels au backend d'authentification (`src/backend/accounts/`).
//
// La session vit dans un cookie posé par Django, pas dans un jeton stocké en
// JavaScript : il faut donc `credentials: "same-origin"` sur chaque appel pour
// que le cookie circule, et un jeton CSRF sur les POST. C'est le mécanisme
// standard de Django, et il fonctionne ici parce que nginx sert l'appli et
// l'API sur la même origine (voir `src/server/README.md`).

const CSRF_COOKIE = "csrftoken";

function readCsrfToken() {
  const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${CSRF_COOKIE}=([^;]+)`));
  return match ? decodeURIComponent(match[1]) : null;
}

async function readError(response) {
  // Le backend répond {"error": "<code>"} ; une erreur inattendue (500, page
  // HTML d'erreur...) ne doit pas faire planter l'appelant pour autant.
  try {
    const body = await response.json();
    return body.error ?? "unexpected_error";
  } catch {
    return "unexpected_error";
  }
}

/** La session en cours ({ user, services, team }), ou null. Pose aussi le
 * cookie CSRF. */
export async function fetchCurrentUser() {
  try {
    const response = await fetch("/api/auth/me/", { credentials: "same-origin" });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

/** { user } si les identifiants sont bons, { error: "<code>" } sinon. */
export async function login(email, password) {
  // Le cookie CSRF est posé par /api/auth/me/ : au premier chargement de la
  // page il n'existe pas encore, donc on le demande avant de poster.
  if (!readCsrfToken()) await fetchCurrentUser();

  let response;
  try {
    response = await fetch("/api/auth/login/", {
      method: "POST",
      credentials: "same-origin",
      headers: {
        "Content-Type": "application/json",
        "X-CSRFToken": readCsrfToken() ?? "",
      },
      body: JSON.stringify({ email, password }),
    });
  } catch {
    // Serveur éteint, réseau coupé : distinct d'un refus d'identifiants.
    return { error: "network_error" };
  }

  if (!response.ok) return { error: await readError(response) };
  const body = await response.json();
  return { user: body.user, services: body.services, team: body.team ?? [] };
}

/** Ferme la session côté serveur. Sans effet si personne n'est connecté. */
export async function logout() {
  try {
    await fetch("/api/auth/logout/", {
      method: "POST",
      credentials: "same-origin",
      headers: { "X-CSRFToken": readCsrfToken() ?? "" },
    });
  } catch {
    // Déconnexion locale malgré tout : voir AuthContext.
  }
}
