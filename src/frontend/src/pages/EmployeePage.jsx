import { useMemo, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import {
  Badge,
  Button,
  useToastProvider,
} from "@gouvfr-lasuite/ui-components";
import { useAuth } from "../context/AuthContext.jsx";
import { useSummaries } from "../context/SummaryContext.jsx";
import { getCollaboratorItems } from "../utils/collaboratorItems.js";
import { ThemeToggle } from "../components/ThemeToggle.jsx";
import { AppFooter } from "../components/AppFooter.jsx";
import { SummaryDetails } from "../components/SummaryDetails.jsx";
import suiteLogo from "../assets/suite-logo.svg";
import "./EmployeePage.css";

const SUMMARY_HEADING_ID = "employee-summary-heading";

function formatDate(iso) {
  return new Date(iso).toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function EmployeePage() {
  const { currentUser, logout } = useAuth();
  const { getSummary, updateSummary, validateSummary } = useSummaries();
  const { toast } = useToastProvider();
  const navigate = useNavigate();
  const [expandedKey, setExpandedKey] = useState(null);

  const items = useMemo(
    () => getCollaboratorItems(currentUser?.id),
    [currentUser],
  );

  const summary = currentUser ? getSummary(currentUser.id) : { text: "", validated: false };
  const [draftText, setDraftText] = useState(summary.text);

  if (!currentUser || currentUser.accountRole !== "employee") {
    return <Navigate to="/" replace />;
  }

  const fullName = `${currentUser.firstName} ${currentUser.lastName}`;
  const hasUnsavedChanges = draftText !== summary.text;

  function handleSave() {
    updateSummary(currentUser.id, { text: draftText });
    toast("Résumé enregistré.", "success");
  }

  function handleValidate() {
    updateSummary(currentUser.id, { text: draftText });
    validateSummary(currentUser.id);
    toast("Résumé validé — votre manager pourra le consulter.", "success");
  }

  function handleLogout() {
    if (
      hasUnsavedChanges &&
      !window.confirm(
        "Vous avez des modifications non enregistrées sur votre résumé. Vous déconnecter quand même ?",
      )
    ) {
      return;
    }
    logout();
    navigate("/");
  }

  return (
    <div className="employee-page">
      <div className="employee-page__viewport">
        <header className="employee-page__header">
          <div className="employee-page__brand">
            <img src={suiteLogo} alt="La Suite numérique" className="employee-page__logo" />
            <span>Pass'on</span>
          </div>
          <div className="employee-page__identity">
            <div className="employee-page__identity__text">
              <span className="employee-page__identity__name">{fullName}</span>
              <span className="employee-page__identity__role">
                {currentUser.jobTitle} · {currentUser.team}
              </span>
            </div>
            <ThemeToggle />
            <Button variant="tertiary" size="small" onClick={handleLogout}>
              Se déconnecter
            </Button>
          </div>
        </header>

        <div className="employee-page__split">
          <div className="employee-page__summary">
            <div className="employee-page__summary__header">
              <span
                id={SUMMARY_HEADING_ID}
                className="employee-page__summary__title"
              >
                Mon résumé IA
              </span>
              <Badge type={summary.validated ? "success" : "warning"}>
                {summary.validated ? "Validé" : "Non validé"}
              </Badge>
            </div>

            <p className="employee-page__summary__hint">
              Ce résumé est généré automatiquement à partir de vos mails et
              documents. Relisez-le, modifiez-le si besoin, puis validez-le :
              c'est cette version que votre manager consultera.
            </p>

            <textarea
              className="employee-page__summary__textarea"
              aria-labelledby={SUMMARY_HEADING_ID}
              value={draftText}
              onChange={(e) => setDraftText(e.target.value)}
              rows={10}
              placeholder="Aucun résumé pour l'instant."
            />

            <div className="employee-page__summary__actions">
              <Button
                variant="tertiary"
                onClick={handleSave}
                disabled={!hasUnsavedChanges}
              >
                Enregistrer les modifications
              </Button>
              <Button onClick={handleValidate} disabled={summary.validated && !hasUnsavedChanges}>
                Valider ce résumé
              </Button>
            </div>

            <SummaryDetails collaboratorId={currentUser.id} />
          </div>

          <div className="employee-page__docs">
            <h2 className="employee-page__docs__title">
              Documents utilisés ({items.length})
            </h2>

            {items.length === 0 && (
              <p className="employee-page__empty">
                Aucun mail ni document enregistré pour l'instant.
              </p>
            )}

            <div className="employee-page__docs__list">
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
          </div>
        </div>
      </div>

      <AppFooter />
    </div>
  );
}
