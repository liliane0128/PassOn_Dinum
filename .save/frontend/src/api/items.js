// Les mails et documents d'un collaborateur, via
// GET /api/collaborators/<id>/items/ (backend : passon/item_views.py).
//
// Pour soi-même, le backend interroge Drive et Messages en direct, et met à
// jour au passage la photo stockée. Pour un membre de son équipe, il renvoie
// cette photo : Drive ne répond que pour la session qu'on lui présente, et on
// n'a que celle de la personne connectée. D'où `fetchedAt`, qui dit de quand
// datent les données affichées, et `errors`, qui liste les services
// interrogés en échec plutôt que de faire échouer tout l'appel.

export async function fetchItems(collaboratorId) {
  const response = await fetch(`/api/collaborators/${collaboratorId}/items/`, {
    credentials: "same-origin",
  });
  if (!response.ok) {
    let detail = null;
    try {
      detail = await response.json();
    } catch {
      // Corps non-JSON (page d'erreur Django) : on garde detail à null.
    }
    const error = new Error(detail?.error ?? `request_failed_${response.status}`);
    error.status = response.status;
    throw error;
  }
  const body = await response.json();
  return {
    items: (body.items ?? []).sort((a, b) => new Date(b.date) - new Date(a.date)),
    // { drive: "upstream_timeout", ... } : services interrogés qui ont échoué.
    errors: body.errors ?? {},
    // Quand la photo a été prise. null = jamais synchronisé.
    fetchedAt: body.fetchedAt ?? null,
    isOwn: Boolean(body.isOwn),
  };
}
