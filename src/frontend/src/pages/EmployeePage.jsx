import { useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import {
  Badge,
  Button,
  useToastProvider,
} from "@gouvfr-lasuite/ui-components";
import { useAuth } from "../context/AuthContext.jsx";
import { useSummaries } from "../context/SummaryContext.jsx";
import { getCollaboratorItems } from "../utils/collaboratorItems.js";
import { generateDossier } from "../api/dossier.js";
import { ThemeToggle } from "../components/ThemeToggle.jsx";
import { AppFooter } from "../components/AppFooter.jsx";
import { SummaryDetails } from "../components/SummaryDetails.jsx";
import { CollaboratorItemsList } from "../components/CollaboratorItemsList.jsx";
import suiteLogo from "../assets/suite-logo.svg";
import "./EmployeePage.css";

const SUMMARY_HEADING_ID = "employee-summary-heading";

export function EmployeePage() {
  const { currentUser, logout } = useAuth();
  const { getSummary, updateSummary, validateSummary } = useSummaries();
  const { toast } = useToastProvider();
  const navigate = useNavigate();

  const items = useMemo(
    () => getCollaboratorItems(currentUser?.id),
    [currentUser],
  );

  const summary = currentUser ? getSummary(currentUser.id) : { text: "", validated: false };
  const [draftText, setDraftText] = useState(summary.text);

  // Auto-generate the AI summary from the backend's mock data as soon as
  // this collaborator's own page loads (see connectors/generation.py) --
  // this only fills the draft, it never auto-validates.
  useEffect(() => {
    if (!currentUser) return;
    let cancelled = false;
    generateDossier()
      .then((result) => {
        if (cancelled) return;
        updateSummary(currentUser.id, {
          text: result.text,
          actions: result.actions.map((item) => ({ ...item, id: crypto.randomUUID() })),
          decisions: result.decisions.map((item) => ({ ...item, id: crypto.randomUUID() })),
          deadlines: result.deadlines.map((item) => ({ ...item, id: crypto.randomUUID() })),
          blockers: result.blockers.map((item) => ({ ...item, id: crypto.randomUUID() })),
          documents: result.documents,
        });
        setDraftText(result.text);
      })
      .catch((err) => {
        if (!cancelled) toast(`Échec de la génération du résumé IA : ${err.message}`, "error");
      });
    return () => {
      cancelled = true;
    };
  }, [currentUser]);

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

  async function handleLogout() {
    if (
      hasUnsavedChanges &&
      !window.confirm(
        "Vous avez des modifications non enregistrées sur votre résumé. Vous déconnecter quand même ?",
      )
    ) {
      return;
    }
    await logout();
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
            <CollaboratorItemsList collaboratorId={currentUser.id} />
          </div>
        </div>
      </div>

      <AppFooter />
    </div>
  );
}
