// Gestion de l'équipe d'un manager, côté serveur (backend : passon/views.js).
//
// Les collaborateurs ajoutés ici sont enregistrés en base : ils survivent au
// rafraîchissement de la page, contrairement à la version précédente qui ne
// vivait qu'en mémoire du navigateur.

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

/** Cherche qui pourrait être ajouté, par nom ou adresse.
 *
 * Le backend interroge l'annuaire de Drive (tout compte existant) et nos
 * propres collaborateurs, et dit pour chacun s'il est ajoutable — plutôt que
 * de laisser saisir une adresse au hasard qui ne correspond à personne.
 */
export async function searchCollaborators(query) {
  const response = await fetch(
    `/api/collaborators/search/?q=${encodeURIComponent(query)}`,
    { credentials: "same-origin" },
  );
  if (!response.ok) throw await failure(response);
  const body = await response.json();
  return {
    results: body.results ?? [],
    // false = l'annuaire Drive n'a pas pu être interrogé (session Drive
    // expirée, service indisponible) : aucun résultat ne veut alors pas dire
    // que la personne n'existe pas.
    directory: body.directory !== false,
  };
}

/** Ajoute un collaborateur à l'équipe du manager connecté. */
export async function addCollaborator({ firstName, lastName, email, jobTitle, team }) {
  const response = await fetch("/api/collaborators/", {
    method: "POST",
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
      "X-CSRFToken": readCsrfToken() ?? "",
    },
    body: JSON.stringify({ firstName, lastName, email, jobTitle, team }),
  });
  if (!response.ok) throw await failure(response);
  return response.json();
}

/** Retire un collaborateur de l'équipe (et supprime sa passation). */
export async function removeCollaborator(id) {
  const response = await fetch(`/api/collaborators/${id}/`, {
    method: "DELETE",
    credentials: "same-origin",
    headers: { "X-CSRFToken": readCsrfToken() ?? "" },
  });
  if (!response.ok) throw await failure(response);
}
