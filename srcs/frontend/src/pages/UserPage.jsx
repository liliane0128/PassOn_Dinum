import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Badge, Button, MainLayout } from "@gouvfr-lasuite/ui-components";
import { emails, documents } from "../data/mockData.js";
import { findCollaboratorBySlug } from "../utils/user.js";
import "./UserPage.css";

const FILTERS = [
  { id: "all", label: "Tous" },
  { id: "mail", label: "Mails" },
  { id: "doc", label: "Documents" },
];

const DOC_TYPE_ICONS = {
  pdf: "picture_as_pdf",
  doc: "description",
  sheet: "table_chart",
  slide: "slideshow",
};

function formatDate(iso) {
  return new Date(iso).toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const RIGHT_PANEL_MIN_WIDTH = 320;

// Le kit ne rend pas ce panneau redimensionnable, et le CSS `resize` natif ne
// fonctionne pas sur un enfant flex (limitation des navigateurs) : on gère le
// redimensionnement à la main en modifiant directement le style du panneau.
function handleResizeStart(event) {
  const panel = event.currentTarget.closest(".c__right-panel");
  if (!panel) return;
  event.preventDefault();

  const startX = event.clientX;
  const startWidth = panel.getBoundingClientRect().width;
  const maxWidth = window.innerWidth * 0.8;
  panel.style.transition = "none";
  document.body.style.userSelect = "none";
  document.body.style.cursor = "col-resize";

  function handleMove(moveEvent) {
    const draggedLeft = startX - moveEvent.clientX;
    const nextWidth = Math.min(
      Math.max(startWidth + draggedLeft, RIGHT_PANEL_MIN_WIDTH),
      maxWidth,
    );
    panel.style.width = `${nextWidth}px`;
  }

  function handleEnd() {
    panel.style.transition = "";
    document.body.style.userSelect = "";
    document.body.style.cursor = "";
    window.removeEventListener("pointermove", handleMove);
    window.removeEventListener("pointerup", handleEnd);
  }

  window.addEventListener("pointermove", handleMove);
  window.addEventListener("pointerup", handleEnd);
}

export function UserPage() {
  const { slug } = useParams();
  const collaborator = findCollaboratorBySlug(slug);
  const [filter, setFilter] = useState("all");
  const [selected, setSelected] = useState(null);

  const items = useMemo(() => {
    if (!collaborator) return [];
    const mailItems = emails
      .filter((m) => m.collaboratorId === collaborator.id)
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
      .filter((d) => d.collaboratorId === collaborator.id)
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
  }, [collaborator]);

  const visibleItems = items.filter(
    (item) => filter === "all" || item.type === filter,
  );

  if (!collaborator) {
    return (
      <div className="user-page__not-found">
        <h1>Utilisateur introuvable</h1>
        <p>
          Aucun collaborateur ne correspond à « {slug.replace(/-/g, " ")} »
          dans les données de démonstration.
        </p>
        <Link to="/">
          <Button>Retour à l'accueil</Button>
        </Link>
      </div>
    );
  }

  const fullName = `${collaborator.firstName} ${collaborator.lastName}`;

  return (
    <MainLayout
      icon={
        <Link to="/" className="user-page__brand">
          Continuité d'activité
        </Link>
      }
      rightHeaderContent={
        <div className="user-page__identity">
          <div className="user-page__identity__consultation">
            <span className="user-page__identity__label">
              <span className="material-icons user-page__identity__icon">
                folder_shared
              </span>
              Dossier consulté de
            </span>
            <div className="user-page__identity__text">
              <span className="user-page__identity__name">{fullName}</span>
              <span className="user-page__identity__role">
                {collaborator.role} · {collaborator.team}
              </span>
            </div>
          </div>
          <span className="user-page__identity__divider" aria-hidden="true" />
          <Link to="/" className="user-page__identity__switch">
            Changer de collègue
          </Link>
        </div>
      }
      leftPanelContent={
        <nav className="user-page__filters">
          {FILTERS.map((f) => {
            const count =
              f.id === "all"
                ? items.length
                : items.filter((i) => i.type === f.id).length;
            return (
              <Button
                key={f.id}
                variant={filter === f.id ? "primary" : "tertiary"}
                fullWidth
                onClick={() => setFilter(f.id)}
              >
                {f.label} ({count})
              </Button>
            );
          })}
        </nav>
      }
      rightPanelIsOpen={selected !== null}
      rightPanelContent={
        selected && (
          <div className="user-page__detail">
            <div
              className="user-page__resize-handle"
              onPointerDown={handleResizeStart}
            />
            <div className="user-page__detail__header">
              <Badge type={selected.type === "mail" ? "info" : "accent"}>
                {selected.type === "mail" ? "Mail" : "Document"}
              </Badge>
              <Button
                variant="tertiary"
                size="small"
                icon={<span className="material-icons">close</span>}
                onClick={() => setSelected(null)}
                aria-label="Fermer"
              />
            </div>
            <h2>{selected.title}</h2>
            <p className="user-page__detail__subtitle">{selected.subtitle}</p>
            <p className="user-page__detail__date">{formatDate(selected.date)}</p>
            {selected.preview && (
              <p className="user-page__detail__preview">{selected.preview}</p>
            )}
          </div>
        )
      }
    >
      <div className="user-page__list">
        {visibleItems.length === 0 && (
          <p className="user-page__empty">Aucun élément pour ce filtre.</p>
        )}
        {visibleItems.map((item) => (
          <button
            key={`${item.type}-${item.id}`}
            className="user-page__item"
            onClick={() => setSelected(item)}
          >
            <span className="material-icons user-page__item__icon">
              {item.icon}
            </span>
            <span className="user-page__item__text">
              <span className="user-page__item__title">{item.title}</span>
              <span className="user-page__item__subtitle">
                {item.subtitle}
              </span>
            </span>
            <span className="user-page__item__date">
              {formatDate(item.date)}
            </span>
          </button>
        ))}
      </div>
    </MainLayout>
  );
}
