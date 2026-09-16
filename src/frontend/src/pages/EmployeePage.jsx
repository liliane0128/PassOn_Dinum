import { useEffect, useMemo, useRef, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import {
  Badge,
  Button,
  useToastProvider,
} from "@gouvfr-lasuite/ui-components";
import { useAuth } from "../context/AuthContext.jsx";
import { useSummaries } from "../context/SummaryContext.jsx";
import { useItems } from "../context/ItemsContext.jsx";
import { generateDossier } from "../api/dossier.js";
import { ThemeToggle } from "../components/ThemeToggle.jsx";
import { AppFooter } from "../components/AppFooter.jsx";
import { SummaryDetails } from "../components/SummaryDetails.jsx";
import { CollaboratorItemsList } from "../components/CollaboratorItemsList.jsx";
import suiteLogo from "../assets/suite-logo.svg";
import "./EmployeePage.css";

const SUMMARY_HEADING_ID = "employee-summary-heading";

export function EmployeePage() {
  const { currentUser, logout, sessionExpired } = useAuth();
  const { getSummary, isLoaded, updateSummary, validateSummary } = useSummaries();
  const { toast } = useToastProvider();
  const navigate = useNavigate();

  const { getItems } = useItems();
  const items = useMemo(
    () => getItems(currentUser?.id),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [currentUser, getItems],
  );

  const summary = currentUser ? getSummary(currentUser.id) : { text: "", validated: false };
  const [draftText, setDraftText] = useState(summary.text);

  // La passation arrive du serveur après le premier rendu, alors que l'éditeur
  // a déjà été initialisé — sans cette synchronisation il resterait sur le
  // texte vide du départ, et le résumé semblerait vide alors qu'il est bien
  // enregistré. On ne réécrit pas par-dessus une saisie en cours : seul un
  // texte qu'on n'a pas modifié depuis la dernière synchronisation est
  // remplacé.
  const loadedText =
    currentUser && isLoaded(currentUser.id) ? (summary.text ?? "") : null;
  // Lu dans l'effet sans en être une dépendance : voir ManagerPage.
  const draftTextRef = useRef(draftText);
  draftTextRef.current = draftText;

  const lastSynced = useRef({ id: null, text: "" });
  useEffect(() => {
    if (loadedText === null || !currentUser) return;
    const otherCollaborator = lastSynced.current.id !== currentUser.id;
    const edited =
      !otherCollaborator && draftTextRef.current !== lastSynced.current.text;
    if (otherCollaborator || !edited) setDraftText(loadedText);
    lastSynced.current = { id: currentUser.id, text: loadedText };
  }, [currentUser, loadedText]);
  const [regenerating, setRegenerating] = useState(false);

  // Le résumé généré remplace la passation enregistrée : texte et sections
  // d'un coup, ce qui la repasse en non validée (updateSummary s'en charge).
  function applyDossier(result) {
    updateSummary(currentUser.id, {
      text: result.text,
      actions: result.actions.map((item) => ({ ...item, id: crypto.randomUUID() })),
      decisions: result.decisions.map((item) => ({ ...item, id: crypto.randomUUID() })),
      deadlines: result.deadlines.map((item) => ({ ...item, id: crypto.randomUUID() })),
      blockers: result.blockers.map((item) => ({ ...item, id: crypto.randomUUID() })),
      documents: result.documents,
    });
    setDraftText(result.text);
  }

  // Régénération demandée explicitement. C'est le seul moyen de rafraîchir un
  // résumé existant : la génération automatique ne se déclenche que sur une
  // passation vide, pour ne pas écraser un texte corrigé à chaque affichage.
  async function handleRegenerate() {
    if (
      summary.text &&
      !window.confirm(
        "Régénérer remplacera le résumé actuel et ses sections par une nouvelle version générée par l'IA. Continuer ?",
      )
    ) {
      return;
    }
    setRegenerating(true);
    try {
      applyDossier(await generateDossier());
      toast("Nouveau résumé généré à partir de vos documents.", "success");
    } catch (err) {
      if (err.status === 401) {
        toast("Votre session a expiré, reconnectez-vous.", "warning");
        sessionExpired();
        return;
      }
      toast(
        err.code === "no_data_to_summarize"
          ? "Aucun document ni mail à résumer : ajoutez des fichiers dans Drive ou attendez de recevoir des messages."
          : `Échec de la génération du résumé IA : ${err.message}`,
        err.code === "no_data_to_summarize" ? "info" : "error",
      );
    } finally {
      setRegenerating(false);
    }
  }

  // Génère le résumé IA (connectors/generation.py) la première fois, et
  // seulement s'il n'y en a pas déjà un enregistré : régénérer à chaque
  // affichage écraserait le texte que l'employé a corrigé et validé, et le
  // repasserait en non validé. Ne remplit que le brouillon, ne valide jamais.
  const generationAttempted = useRef(false);
  useEffect(() => {
    if (!currentUser) return;
    if (!isLoaded(currentUser.id)) return; // on ne sait pas encore ce qui existe
    if (generationAttempted.current) return;
    generationAttempted.current = true;
    if (summary.text) return; // déjà une passation enregistrée

    let cancelled = false;
    generateDossier()
      .then((result) => {
        if (cancelled) return;
        applyDossier(result);
      })
      .catch((err) => {
        if (cancelled) return;
        if (err.status === 401) {
          // Session perdue côté serveur : ce n'est pas l'IA qui a échoué.
          toast("Votre session a expiré, reconnectez-vous.", "warning");
          sessionExpired();
          return;
        }
        if (err.code === "no_data_to_summarize") {
          // Rien à résumer : c'est un état normal (Drive et boîte mail vides),
          // pas une panne. La génération automatique se tait, l'utilisateur
          // n'a rien demandé.
          return;
        }
        toast(`Échec de la génération du résumé IA : ${err.message}`, "error");
      });
    return () => {
      cancelled = true;
    };
  }, [currentUser, summary]);

  if (!currentUser || currentUser.accountRole !== "employee") {
    return <Navigate to="/" replace />;
  }

  const fullName = `${currentUser.firstName} ${currentUser.lastName}`;
  const hasUnsavedChanges = draftText !== summary.text;

  async function handleSave() {
    const saved = await updateSummary(currentUser.id, { text: draftText });
    if (saved) toast("Résumé enregistré.", "success");
  }

  async function handleValidate() {
    // Enregistrer *puis* valider, dans cet ordre et en attendant le premier :
    // l'enregistrement repasse la passation en non validée (toute modification
    // le fait), donc lancer les deux en parallèle laissait une chance sur deux
    // que l'enregistrement arrive en dernier et annule la validation -- côté
    // serveur, sans que rien ne le signale.
    if (hasUnsavedChanges) {
      const saved = await updateSummary(currentUser.id, { text: draftText });
      if (!saved) return; // l'échec a déjà été signalé
    }
    const validated = await validateSummary(currentUser.id);
    if (validated) {
      toast("Résumé validé — votre manager pourra le consulter.", "success");
    }
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
              <Button
                variant="tertiary"
                icon={<span className="material-icons">autorenew</span>}
                onClick={handleRegenerate}
                disabled={regenerating}
              >
                {regenerating ? "Génération..." : "Régénérer"}
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
