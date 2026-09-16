import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import {
  Badge,
  Button,
  ConfirmationModal,
  DeleteConfirmationModal,
  Input,
  useToastProvider,
} from "@gouvfr-lasuite/ui-components";
import { useAuth } from "../context/AuthContext.jsx";
import * as teamApi from "../api/collaborators.js";
import { useSummaries } from "../context/SummaryContext.jsx";
import { ThemeToggle } from "../components/ThemeToggle.jsx";
import { AppFooter } from "../components/AppFooter.jsx";
import { SummaryDetails } from "../components/SummaryDetails.jsx";
import { CollaboratorItemsList } from "../components/CollaboratorItemsList.jsx";
import suiteLogo from "../assets/suite-logo.svg";
import "./ManagerPage.css";

const SUMMARY_HEADING_ID = "manager-summary-heading";

export function ManagerPage() {
  const { currentUser, team, logout, sessionExpired, refreshTeam } = useAuth();
  const { getSummary, updateSummary } = useSummaries();
  const { toast } = useToastProvider();
  const navigate = useNavigate();


  const [selectedId, setSelectedId] = useState(() => team[0]?.id ?? null);
  const selected = team.find((c) => c.id === selectedId) ?? null;
  const summary = selected ? getSummary(selected.id) : null;
  const [draftText, setDraftText] = useState(summary?.text ?? "");
  const [pendingShare, setPendingShare] = useState(false);

  const [isAddingCollaborator, setIsAddingCollaborator] = useState(false);
  const [newFirstName, setNewFirstName] = useState("");
  const [newLastName, setNewLastName] = useState("");
  const [newJobTitle, setNewJobTitle] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newCollaboratorError, setNewCollaboratorError] = useState(false);
  const [pendingRemove, setPendingRemove] = useState(null);

  if (!currentUser || currentUser.accountRole !== "manager") {
    return <Navigate to="/" replace />;
  }

  function handleSelect(collaborator) {
    if (selected && draftText !== summary.text) {
      const confirmed = window.confirm(
        `Vous avez des modifications non enregistrées sur le résumé de ${selected.firstName}. Les abandonner ?`,
      );
      if (!confirmed) return;
    }
    setSelectedId(collaborator.id);
    setDraftText(getSummary(collaborator.id).text);
  }

  function resetAddCollaboratorForm() {
    setNewFirstName("");
    setNewLastName("");
    setNewJobTitle("");
    setNewEmail("");
    setNewCollaboratorError(false);
  }

  function handleCancelAddCollaborator() {
    setIsAddingCollaborator(false);
    resetAddCollaboratorForm();
  }

  async function handleAddCollaborator(event) {
    event.preventDefault();
    const firstName = newFirstName.trim();
    const lastName = newLastName.trim();
    const email = newEmail.trim().toLowerCase();
    if (!firstName || !lastName || !email || !email.includes("@")) {
      setNewCollaboratorError(true);
      return;
    }

    // Enregistré côté serveur : la personne reste dans l'équipe après un
    // rafraîchissement, et son compte Drive sera rattaché à cette fiche à sa
    // première connexion (rapprochement par email).
    let collaborator;
    try {
      collaborator = await teamApi.addCollaborator({
        firstName,
        lastName,
        email,
        jobTitle: newJobTitle.trim(),
        team: currentUser.team,
      });
    } catch (err) {
      if (err.status === 401) {
        toast("Votre session a expiré, reconnectez-vous.", "warning");
        sessionExpired();
        return;
      }
      const messages = {
        collaborator_has_manager: `${email} fait déjà partie de l'équipe d'un autre manager.`,
        cannot_manage_yourself: "Vous ne pouvez pas vous ajouter à votre propre équipe.",
        would_create_a_cycle: `${email} est déjà, directement ou non, votre manager.`,
        invalid_request: "Prénom, nom et adresse email sont nécessaires.",
      };
      toast(
        messages[err.code] ?? "Impossible d'ajouter ce collaborateur pour le moment.",
        "error",
      );
      setNewCollaboratorError(true);
      return;
    }

    await refreshTeam();
    toast(`${firstName} ${lastName} a été ajouté à votre équipe.`, "success");
    setIsAddingCollaborator(false);
    resetAddCollaboratorForm();
    handleSelect(collaborator);
  }

  async function handleRemoveCollaboratorDecide(decision) {
    if (decision === "delete" && pendingRemove) {
      try {
        await teamApi.removeCollaborator(pendingRemove.id);
      } catch (err) {
        if (err.status === 401) {
          toast("Votre session a expiré, reconnectez-vous.", "warning");
          sessionExpired();
          setPendingRemove(null);
          return;
        }
        toast("Impossible de retirer ce collaborateur pour le moment.", "error");
        setPendingRemove(null);
        return;
      }
      await refreshTeam();
      if (selectedId === pendingRemove.id) {
        setSelectedId(null);
        setDraftText("");
      }
      toast(
        `${pendingRemove.firstName} ${pendingRemove.lastName} a été retiré de votre équipe.`,
        "success",
      );
    }
    setPendingRemove(null);
  }

  function handleSave() {
    if (!selected) return;
    updateSummary(selected.id, { text: draftText });
    toast(`Résumé de ${selected.firstName} enregistré.`, "success");
  }

  // Ouvre l'application mail pour envoyer ce résumé ; le lien réel sera
  // branché côté backend plus tard (voir PLAN.md).
  function sendMail() {
    toast(`Ouverture de l'application mail pour ${selected.firstName}...`, "info");
  }

  function handleShare() {
    if (!selected) return;
    if (!summary.validated) {
      setPendingShare(true);
      return;
    }
    sendMail();
  }

  function handleShareDecide(decision) {
    if (decision === "yes") {
      sendMail();
    }
    setPendingShare(false);
  }

  async function handleLogout() {
    if (
      selected &&
      draftText !== summary.text &&
      !window.confirm(
        "Vous avez des modifications non enregistrées. Vous déconnecter quand même ?",
      )
    ) {
      return;
    }
    await logout();
    navigate("/");
  }

  return (
    <div className="manager-page">
      <div className="manager-page__viewport">
        <header className="manager-page__header">
          <div className="manager-page__brand">
            <img src={suiteLogo} alt="La Suite numérique" className="manager-page__logo" />
            <span>Pass'on</span>
          </div>
          <div className="manager-page__identity">
            <div className="manager-page__identity__text">
              <span className="manager-page__identity__name">
                {currentUser.firstName} {currentUser.lastName}
              </span>
              <span className="manager-page__identity__role">
                {currentUser.jobTitle} · {currentUser.team}
              </span>
            </div>
            <ThemeToggle />
            <Button variant="tertiary" size="small" onClick={handleLogout}>
              Se déconnecter
            </Button>
          </div>
        </header>

        <div className="manager-page__split">
          <nav className="manager-page__team">
            <h2 className="manager-page__team__title">
              Mon équipe ({team.length})
            </h2>
            {team.length === 0 && (
              <p className="manager-page__empty">
                Aucun collaborateur rattaché pour l'instant.
              </p>
            )}
            {team.map((c) => (
              <div key={c.id} className="manager-page__team__row">
                <button
                  className={
                    c.id === selectedId
                      ? "manager-page__team__item manager-page__team__item--active"
                      : "manager-page__team__item"
                  }
                  onClick={() => handleSelect(c)}
                >
                  <span className="manager-page__team__item__name">
                    {c.firstName} {c.lastName}
                  </span>
                  <span className="manager-page__team__item__role">
                    {c.jobTitle}
                  </span>
                </button>
                <button
                  type="button"
                  className="manager-page__team__item__remove"
                  onClick={() => setPendingRemove(c)}
                  aria-label={`Retirer ${c.firstName} ${c.lastName} de l'équipe`}
                >
                  <span className="material-icons">close</span>
                </button>
              </div>
            ))}

            {isAddingCollaborator ? (
              <form
                className="manager-page__team__add-form"
                onSubmit={handleAddCollaborator}
              >
                <Input
                  label="Prénom"
                  fullWidth
                  state={newCollaboratorError ? "error" : "default"}
                  value={newFirstName}
                  onChange={(e) => {
                    setNewFirstName(e.target.value);
                    setNewCollaboratorError(false);
                  }}
                />
                <Input
                  label="Nom"
                  fullWidth
                  state={newCollaboratorError ? "error" : "default"}
                  value={newLastName}
                  onChange={(e) => {
                    setNewLastName(e.target.value);
                    setNewCollaboratorError(false);
                  }}
                />
                <Input
                  label="Poste"
                  fullWidth
                  value={newJobTitle}
                  onChange={(e) => setNewJobTitle(e.target.value)}
                />
                <Input
                  label="Email professionnel"
                  type="email"
                  fullWidth
                  state={newCollaboratorError ? "error" : "default"}
                  text={
                    newCollaboratorError
                      ? "Prénom, nom et email valide requis."
                      : undefined
                  }
                  value={newEmail}
                  onChange={(e) => {
                    setNewEmail(e.target.value);
                    setNewCollaboratorError(false);
                  }}
                />
                <div className="manager-page__team__add-form__actions">
                  <Button type="submit" fullWidth>
                    Ajouter
                  </Button>
                  <Button
                    type="button"
                    variant="tertiary"
                    fullWidth
                    onClick={handleCancelAddCollaborator}
                  >
                    Annuler
                  </Button>
                </div>
              </form>
            ) : (
              <Button
                variant="secondary"
                fullWidth
                onClick={() => setIsAddingCollaborator(true)}
              >
                Ajouter un collaborateur
              </Button>
            )}
          </nav>

          <div className="manager-page__summary">
            {selected ? (
              <>
                <div className="manager-page__summary__header">
                  <div className="manager-page__summary__heading">
                    <h2
                      id={SUMMARY_HEADING_ID}
                      className="manager-page__summary__title"
                    >
                      Résumé IA — {selected.firstName} {selected.lastName}
                    </h2>
                    <p className="manager-page__summary__subtitle">
                      {selected.jobTitle} · {selected.team}
                    </p>
                  </div>
                  <Badge type={summary.validated ? "success" : "warning"}>
                    {summary.validated ? "Validé par le collaborateur" : "Non validé"}
                  </Badge>
                </div>

                {summary.validated ? (
                  <>
                    <p className="manager-page__summary__hint">
                      Vous pouvez modifier librement ce résumé, des documents et
                      mails de {selected.firstName}.
                    </p>

                    <textarea
                      className="manager-page__summary__textarea"
                      aria-labelledby={SUMMARY_HEADING_ID}
                      value={draftText}
                      onChange={(e) => setDraftText(e.target.value)}
                      rows={12}
                      placeholder="Aucun résumé pour l'instant."
                    />

                    <div className="manager-page__summary__actions">
                      <Button
                        onClick={handleSave}
                        disabled={draftText === summary.text}
                      >
                        Enregistrer les modifications
                      </Button>
                    </div>

                    <SummaryDetails collaboratorId={selected.id} />
                  </>
                ) : (
                  <>
                    <p className="manager-page__summary__hint">
                      {selected.firstName} n'a pas encore validé son résumé IA.
                      En attendant, voici ses mails et documents.
                    </p>
                    <CollaboratorItemsList collaboratorId={selected.id} />
                  </>
                )}
              </>
            ) : (
              <p className="manager-page__empty">
                Sélectionnez un collaborateur dans la liste pour voir son
                résumé.
              </p>
            )}
          </div>

          <div className="manager-page__share">
            <h2 className="manager-page__share__title">Partager ce résumé</h2>

            {!selected ? (
              <p className="manager-page__empty">
                Sélectionnez un collaborateur pour partager son résumé.
              </p>
            ) : (
              <>
                <p className="manager-page__share__hint">
                  Envoyer le résumé de {selected.firstName} par mail.
                </p>

                <Button fullWidth onClick={handleShare}>
                  Envoyer par mail
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      <AppFooter />

      <ConfirmationModal
        isOpen={pendingShare}
        onClose={() => setPendingShare(false)}
        onDecide={handleShareDecide}
        title="Résumé non validé"
      >
        {selected
          ? `${selected.firstName} n'a pas encore validé ce résumé. L'envoyer quand même ?`
          : null}
      </ConfirmationModal>

      <DeleteConfirmationModal
        isOpen={pendingRemove !== null}
        onClose={() => setPendingRemove(null)}
        onDecide={handleRemoveCollaboratorDecide}
        title="Retirer ce collaborateur ?"
      >
        {pendingRemove
          ? `Voulez-vous vraiment retirer ${pendingRemove.firstName} ${pendingRemove.lastName} de votre équipe ? Son résumé et son compte ne seront plus accessibles.`
          : null}
      </DeleteConfirmationModal>
    </div>
  );
}
