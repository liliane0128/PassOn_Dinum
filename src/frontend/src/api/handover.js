// La passation d'un collaborateur, côté serveur (backend : passon/handover_views.py).
//
// Elle est partagée : ce que l'employé écrit et valide, son manager le voit,
// et inversement. Avant, tout cela ne vivait que dans la mémoire du navigateur.

function readCsrfToken() {
  const match = document.cookie.match(/(?:^|;\s*)csrftoken=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

async function failure(response) {
  let code = null;
  try {
    code = (await response.json()).error ?? null;
  } catch {
    // Corps non-JSON : on garde le code à null.
  }
  const error = new Error(code ?? `request_failed_${response.status}`);
  error.status = response.status;
  error.code = code;
  return error;
}

export async function fetchHandover(collaboratorId) {
  const response = await fetch(`/api/collaborators/${collaboratorId}/handover/`, {
    credentials: "same-origin",
  });
  if (!response.ok) throw await failure(response);
  return response.json();
}

/** `patch` ne contient que ce qui change (texte et/ou sections). */
export async function saveHandover(collaboratorId, patch) {
  const response = await fetch(`/api/collaborators/${collaboratorId}/handover/`, {
    method: "PATCH",
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
      "X-CSRFToken": readCsrfToken() ?? "",
    },
    body: JSON.stringify(patch),
  });
  if (!response.ok) throw await failure(response);
  return response.json();
}

export async function validateHandover(collaboratorId) {
  const response = await fetch(
    `/api/collaborators/${collaboratorId}/handover/validate/`,
    {
      method: "POST",
      credentials: "same-origin",
      headers: { "X-CSRFToken": readCsrfToken() ?? "" },
    },
  );
  if (!response.ok) throw await failure(response);
  return response.json();
}

/** Envoie la passation par mail, depuis le compte Messages de l'utilisateur. */
export async function sendHandover(collaboratorId, recipients) {
  const response = await fetch(
    `/api/collaborators/${collaboratorId}/handover/send/`,
    {
      method: "POST",
      credentials: "same-origin",
      headers: {
        "Content-Type": "application/json",
        "X-CSRFToken": readCsrfToken() ?? "",
      },
      body: JSON.stringify({ to: recipients }),
    },
  );
  if (!response.ok) throw await failure(response);
  return response.json();
}
