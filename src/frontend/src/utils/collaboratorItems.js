import { emails, documents } from "../data/mockData.js";

export const DOC_TYPE_ICONS = {
  pdf: "picture_as_pdf",
  doc: "description",
  sheet: "table_chart",
  slide: "slideshow",
};

// Mails + documents d'un collaborateur, fusionnés dans une forme commune et
// triés par date décroissante. Utilisé par la liste "Documents utilisés" des
// pages employé/manager, et par le sélecteur "documents importants" du résumé.
export function getCollaboratorItems(collaboratorId) {
  if (!collaboratorId) return [];

  const mailItems = emails
    .filter((m) => m.collaboratorId === collaboratorId)
    .map((m) => ({
      type: "mail",
      id: m.id,
      icon: "mail",
      title: m.subject,
      subtitle: m.from,
      preview: m.preview,
      date: m.receivedAt,
    }));

  const docItems = documents
    .filter((d) => d.collaboratorId === collaboratorId)
    .map((d) => ({
      type: "doc",
      id: d.id,
      icon: DOC_TYPE_ICONS[d.type] ?? "description",
      title: d.title,
      subtitle: `${d.sizeKb >= 1024 ? (d.sizeKb / 1024).toFixed(1) + " Mo" : d.sizeKb + " Ko"}`,
      date: d.updatedAt,
    }));

  return [...mailItems, ...docItems].sort(
    (a, b) => new Date(b.date) - new Date(a.date),
  );
}
