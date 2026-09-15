import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import {
  Badge,
  Button,
  Input,
  useToastProvider,
} from "@gouvfr-lasuite/ui-components";
import { useAuth } from "../context/AuthContext.jsx";
import { useSummaries } from "../context/SummaryContext.jsx";
import { collaborators } from "../data/mockData.js";
import { ThemeToggle } from "../components/ThemeToggle.jsx";
import { AppFooter } from "../components/AppFooter.jsx";
import { SummaryDetails } from "../components/SummaryDetails.jsx";
import suiteLogo from "../assets/suite-logo.svg";
import "./ManagerPage.css";

const SUMMARY_HEADING_ID = "manager-summary-heading";

function formatDateTime(iso) {
  return new Date(iso).toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ManagerPage() {
  const { currentUser, logout } = useAuth();
  const { getSummary, updateSummary } = useSummaries();
  const { toast } = useToastProvider();
  const navigate = useNavigate();

  const team = currentUser
    ? collaborators.filter((c) => c.managerId === currentUser.id)
    : [];

  const [selectedId, setSelectedId] = useState(() => team[0]?.id ?? null);
  const selected = team.find((c) => c.id === selectedId) ?? null;
  const summary = selected ? getSummary(selected.id) : null;
  const [draftText, setDraftText] = useState(summary?.text ?? "");
  const [recipientEmails, setRecipientEmails] = useState([]);
  const [emailDraft, setEmailDraft] = useState("");
  const [emailError, setEmailError] = useState(false);
  // { [collaboratorId]: [{ to: ["email@...", ...], at: isoString }, ...] }
  const [shareLogs, setShareLogs] = useState({});

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
    setRecipientEmails([]);
    setEmailDraft("");
    setEmailError(false);
  }

  function handleSave() {
    if (!selected) return;
    updateSummary(selected.id, { text: draftText });
    toast(`Résumé de ${selected.firstName} enregistré.`, "success");
  }

  function handleAddRecipient(event) {
    event.preventDefault();
    const email = emailDraft.trim().toLowerCase();
    if (!email || !email.includes("@") || email.includes(" ")) {
      setEmailError(true);
      return;
    }
    if (!recipientEmails.includes(email)) {
      setRecipientEmails((prev) => [...prev, email]);
    }
    setEmailDraft("");
    setEmailError(false);
  }

  function handleRemoveRecipient(email) {
    setRecipientEmails((prev) => prev.filter((e) => e !== email));
  }

  // Envoi simulé : aucun mail n'est réellement envoyé pour l'instant, c'est
  // prévu pour plus tard (voir PLAN.md). On garde juste une trace locale pour
  // que l'action ait un retour visible.
  function handleShare() {
    if (!selected || recipientEmails.length === 0) return;
    setShareLogs((prev) => ({
      ...prev,
      [selected.id]: [
        { to: recipientEmails, at: new Date().toISOString() },
        ...(prev[selected.id] ?? []),
      ],
    }));
    toast(
      `Résumé de ${selected.firstName} envoyé à ${recipientEmails.length} destinataire${recipientEmails.length > 1 ? "s" : ""} (simulé).`,
      "success",
    );
    setRecipientEmails([]);
  }

  function handleLogout() {
    if (
      selected &&
      draftText !== summary.text &&
      !window.confirm(
        "Vous avez des modifications non enregistrées. Vous déconnecter quand même ?",
      )
    ) {
      return;
    }
    logout();
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
              <button
                key={c.id}
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
            ))}
          </nav>

          <div className="manager-page__summary">
            {selected ? (
              <>
                <div className="manager-page__summary__header">
                  <span className="material-icons manager-page__summary__icon">
                    auto_awesome
                  </span>
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
                  Envoyer le résumé de {selected.firstName} à une ou plusieurs
                  adresses mail. L'envoi est simulé pour l'instant — l'envoi
                  réel par mail sera branché plus tard.
                </p>

                <form
                  className="manager-page__share__form"
                  onSubmit={handleAddRecipient}
                >
                  <Input
                    label="Adresse mail"
                    type="email"
                    list="known-emails"
                    fullWidth
                    state={emailError ? "error" : "default"}
                    text={emailError ? "Adresse invalide." : undefined}
                    value={emailDraft}
                    onChange={(e) => {
                      setEmailDraft(e.target.value);
                      setEmailError(false);
                    }}
                  />
                  <datalist id="known-emails">
                    {collaborators
                      .filter((c) => c.id !== selected.id)
                      .map((c) => (
                        <option key={c.id} value={c.email} />
                      ))}
                  </datalist>
                  <Button type="submit" variant="secondary" fullWidth>
                    Ajouter ce destinataire
                  </Button>
                </form>

                {recipientEmails.length > 0 && (
                  <ul className="manager-page__share__chips">
                    {recipientEmails.map((email) => (
                      <li key={email} className="manager-page__share__chip">
                        <span>{email}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveRecipient(email)}
                          aria-label={`Retirer ${email}`}
                        >
                          <span className="material-icons">close</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}

                <Button
                  fullWidth
                  onClick={handleShare}
                  disabled={recipientEmails.length === 0}
                >
                  Envoyer ({recipientEmails.length})
                </Button>

                {(shareLogs[selected.id]?.length ?? 0) > 0 && (
                  <div className="manager-page__share__log">
                    <h3 className="manager-page__share__log__title">
                      Envois récents
                    </h3>
                    <ul>
                      {shareLogs[selected.id].map((entry, index) => (
                        <li key={index}>
                          {formatDateTime(entry.at)} → {entry.to.join(", ")}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      <AppFooter />
    </div>
  );
}
