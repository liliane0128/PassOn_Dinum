import { useState } from "react";
import { Badge } from "@gouvfr-lasuite/ui-components";
import { useItems } from "../context/ItemsContext.jsx";

function formatDate(iso) {
  return new Date(iso).toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Expandable list of a collaborator's mails/documents. Shared by the
// employee page (own items) and the manager page (basic view of a
// not-yet-validated collaborator's items, before the AI summary is shown).
export function CollaboratorItemsList({ collaboratorId }) {
  const [expandedKey, setExpandedKey] = useState(null);
  const { getItems, getStatus } = useItems();
  const items = getItems(collaboratorId);
  const { fetchedAt, loading, error } = getStatus(collaboratorId);

  if (loading) {
    return <p className="employee-page__empty">Chargement des documents...</p>;
  }

  if (error) {
    return (
      <p className="employee-page__empty">
        Documents indisponibles pour le moment.
      </p>
    );
  }

  if (items.length === 0) {
    return (
      <p className="employee-page__empty">
        {fetchedAt
          ? "Aucun mail ni document trouvé."
          : // Les données d'un collaborateur sont relevées quand il se connecte
            // lui-même : Drive ne répond que pour la session de l'intéressé.
            "Rien de synchronisé pour l'instant : les documents sont relevés lors de la connexion du collaborateur."}
      </p>
    );
  }

  return (
    <div className="employee-page__docs__list">
      {/* Pour un membre de l'équipe, ce sont des données relevées lors de sa
          dernière connexion, pas une lecture en direct : on le dit. */}
      {fetchedAt && (
        <p className="employee-page__docs__freshness">
          Données relevées le {formatDate(fetchedAt)}
        </p>
      )}
      {items.map((item) => {
        const key = `${item.type}-${item.id}`;
        const isExpanded = expandedKey === key;
        return (
          <div key={key} className="employee-page__docs__item">
            <button
              className="employee-page__docs__item__header"
              onClick={() => setExpandedKey(isExpanded ? null : key)}
              aria-expanded={isExpanded}
            >
              <span className="material-icons employee-page__docs__item__icon">
                {item.icon}
              </span>
              <span className="employee-page__docs__item__text">
                <span className="employee-page__docs__item__title">
                  {item.title}
                </span>
                <span className="employee-page__docs__item__subtitle">
                  {item.subtitle}
                </span>
              </span>
              <span className="material-icons employee-page__docs__item__chevron">
                {isExpanded ? "expand_less" : "expand_more"}
              </span>
            </button>

            {isExpanded && (
              <div className="employee-page__docs__item__detail">
                <Badge type={item.type === "mail" ? "info" : "accent"}>
                  {item.type === "mail" ? "Mail" : "Document"}
                </Badge>
                <p className="employee-page__docs__item__date">
                  {formatDate(item.date)}
                </p>
                {item.preview && <p>{item.preview}</p>}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
