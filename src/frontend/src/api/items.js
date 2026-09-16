// Les vrais mails et documents de l'utilisateur connecté, via
// GET /api/extraction/items/ (backend : connectors/extraction.py).
//
// Le backend n'interroge que les services pour lesquels la session contient
// des identifiants : un utilisateur connecté à Drive mais absent du Keycloak
// de Messages reçoit ses fichiers sans ses mails, avec le service manquant
// listé dans `errors` plutôt qu'une erreur globale.

import { DOC_TYPE_ICONS } from "../utils/collaboratorItems.js";

// Les éléments normalisés du backend ont la forme
// { id: "drive:<uuid>", title, author, date, content, source: {...} }.
// L'interface, elle, parle de "mail" et de "doc" (icône, badge, tri). On
// traduit ici, en gardant `refId` : l'identifiant tel que le backend le
// connaît, celui qu'utilisent les "documents importants" du résumé généré.
function toDisplayItem(item) {
  const source = item.source ?? {};
  const isMail = source.type === "messages";
  return {
    type: isMail ? "mail" : "doc",
    id: source.resource_id ?? item.id,
    refId: item.id,
    icon: isMail ? "mail" : (DOC_TYPE_ICONS[source.type] ?? "description"),
    title: item.title || "(sans titre)",
    subtitle: item.author || source.type || "",
    preview: (item.content ?? "").slice(0, 400),
    date: item.date,
    url: source.resource_url ?? null,
  };
}

export async function fetchItems() {
  const response = await fetch("/api/extraction/items/", {
    credentials: "same-origin",
  });
  if (!response.ok) {
    let detail = null;
    try {
      detail = await response.json();
    } catch {
      // Corps non-JSON (page d'erreur Django) : on garde detail à null.
    }
    throw new Error(detail?.error ?? `request_failed_${response.status}`);
  }
  const body = await response.json();
  return {
    items: (body.items ?? [])
      .map(toDisplayItem)
      .sort((a, b) => new Date(b.date) - new Date(a.date)),
    // { drive: "upstream_timeout", ... } : services interrogés qui ont échoué.
    errors: body.errors ?? {},
  };
}
