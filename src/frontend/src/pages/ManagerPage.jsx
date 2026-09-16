import { useEffect, useRef, useState } from "react";
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
import { sendHandover } from "../api/handover.js";
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
  const { getSummary, isLoaded, updateSummary } = useSummaries();
  const { toast } = useToastProvider();
  const navigate = useNavigate();


  const [selectedId, setSelectedId] = useState(() => team[0]?.id ?? null);
  const selected = team.find((c) => c.id === selectedId) ?? null;
  const summary = selected ? getSummary(selected.id) : null;
  const [draftText, setDraftText] = useState(summary?.text ?? "");

  // La passation arrive du serveur après le premier rendu, alors que l'éditeur
  // a déjà été initialisé — sans cette synchronisation il resterait sur le
  // texte vide du départ, et le résumé semblerait vide alors qu'il est bien
  // enregistré. On ne réécrit pas par-dessus une saisie en cours : seul un
  // texte qu'on n'a pas modifié depuis la dernière synchronisation est
  // remplacé.
  const loadedText = selected && isLoaded(selected.id) ? (summary?.text ?? "") : null;
  // Lu dans l'effet sans en être une dépendance : la frappe en cours sert à
  // décider s'il faut écraser le brouillon, elle ne doit pas relancer la
  // synchronisation à chaque caractère.
  const draftTextRef = useRef(draftText);
  draftTextRef.current = draftText;

  const lastSynced = useRef({ id: null, text: "" });
  useEffect(() => {
    if (loadedText === null || !selected) return;
    const otherCollaborator = lastSynced.current.id !== selected.id;
    const edited =
      !otherCollaborator && draftTextRef.current !== lastSynced.current.text;
    if (otherCollaborator || !edited) setDraftText(loadedText);
    lastSynced.current = { id: selected.id, text: loadedText };
  }, [selected, loadedText]);
  const [pendingShare, setPendingShare] = useState(false);
  // Les destinataires se constituent en liste : on cherche la personne, on
  // l'ajoute, on peut la retirer. Une adresse extérieure à l'annuaire reste
  // saisissable telle quelle -- une passation se transmet parfois à quelqu'un
  // qui n'utilise ni Drive ni Pass'on.
  const [recipients, setRecipients] = useState([]);
  const [recipientSearch, setRecipientSearch] = useState("");
  const [recipientResults, setRecipientResults] = useState([]);
  const recipientToken = useRef(0);
  const [sending, setSending] = useState(false);

  const [isAddingCollaborator, setIsAddingCollaborator] = useState(false);
  // On cherche la personne dans l'annuaire plutôt que de saisir son adresse :
  // une adresse tapée à la main ne désigne quelqu'un que si elle correspond
  // exactement à un compte existant.
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  // L'annuaire Drive est interrogé avec la session Drive du manager : elle
  // peut avoir expiré alors qu'il est toujours connecté ici.
  const [directoryReachable, setDirectoryReachable] = useState(true);
  const [newJobTitle, setNewJobTitle] = useState("");
  const [adding, setAdding] = useState(false);
  const searchToken = useRef(0);

  // Une adresse email tapée en entier, si aucun résultat ne la porte déjà :
  // quelqu'un qui n'a jamais ouvert Drive n'est pas dans l'annuaire, et doit
  // pouvoir être ajouté quand même.
  // Une adresse email saisie en entier pour le partage, si elle n'est ni déjà
  // dans la liste ni proposée par la recherche.
  const trimmedRecipient = recipientSearch.trim().toLowerCase();
  const typedRecipient =
    trimmedRecipient.includes("@") &&
    !trimmedRecipient.endsWith("@") &&
    !recipients.some((r) => r.email === trimmedRecipient) &&
    !recipientResults.some((p) => p.email.toLowerCase() === trimmedRecipient)
      ? trimmedRecipient
      : null;

  const trimmedSearch = search.trim().toLowerCase();
  const typedAddress =
    trimmedSearch.includes("@") &&
    !trimmedSearch.endsWith("@") &&
    !searchResults.some((person) => person.email.toLowerCase() === trimmedSearch)
      ? trimmedSearch
      : null;
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
    setSearch("");
    setSearchResults([]);
    setSearching(false);
    setNewJobTitle("");
  }

  // Recherche à la frappe, au-delà de deux caractères. Une réponse est ignorée
  // si une frappe plus récente est partie entre-temps, pour qu'un résultat
  // lent n'écrase pas un résultat plus récent.
  async function handleSearchChange(value) {
    setSearch(value);
    const token = ++searchToken.current;
    if (value.trim().length < 2) {
      setSearchResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    try {
      const { results, directory } = await teamApi.searchCollaborators(value.trim());
      if (searchToken.current === token) {
        setSearchResults(results);
        setDirectoryReachable(directory);
      }
    } catch (err) {
      if (searchToken.current !== token) return;
      if (err.status === 401) {
        toast("Votre session a expiré, reconnectez-vous.", "warning");
        sessionExpired();
        return;
      }
      setSearchResults([]);
    } finally {
      if (searchToken.current === token) setSearching(false);
    }
  }

  function handleCancelAddCollaborator() {
    setIsAddingCollaborator(false);
    resetAddCollaboratorForm();
  }

  async function handleRecipientSearch(value) {
    setRecipientSearch(value);
    const token = ++recipientToken.current;
    if (value.trim().length < 2) {
      setRecipientResults([]);
      return;
    }
    try {
      const { results, directory } = await teamApi.searchCollaborators(value.trim());
      if (recipientToken.current === token) {
        setRecipientResults(results);
        setDirectoryReachable(directory);
      }
    } catch (err) {
      if (recipientToken.current !== token) return;
      if (err.status === 401) {
        toast("Votre session a expiré, reconnectez-vous.", "warning");
        sessionExpired();
        return;
      }
      setRecipientResults([]);
    }
  }

  function addRecipient(person) {
    const email = person.email.trim().toLowerCase();
    if (!email.includes("@")) return;
    // Sans doublon : envoyer deux fois à la même adresse n'a pas de sens, et
    // le bouton doit pouvoir être cliqué sans y penser.
    if (!recipients.some((r) => r.email === email)) {
      setRecipients([...recipients, { email, fullName: person.fullName || email }]);
    }
    setRecipientSearch("");
    setRecipientResults([]);
  }

  function removeRecipient(email) {
    setRecipients(recipients.filter((r) => r.email !== email));
  }

  async function handleAddCollaborator(person) {
    // Le nom vient de l'annuaire, pas d'une saisie : c'est celui que Drive
    // connaît, et c'est par l'email que sa fiche sera rattachée à son compte
    // à sa première connexion.
    const [firstName, ...rest] = (person.fullName || person.email).split(" ");
    setAdding(true);
    let collaborator;
    try {
      collaborator = await teamApi.addCollaborator({
        firstName,
        lastName: rest.join(" "),
        email: person.email,
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
        collaborator_has_manager: `${person.email} fait déjà partie de l'équipe d'un autre manager.`,
        cannot_manage_yourself: "Vous ne pouvez pas vous ajouter à votre propre équipe.",
        would_create_a_cycle: `${person.email} est déjà, directement ou non, votre manager.`,
        invalid_request: "Ce compte n'a pas les informations nécessaires.",
      };
      toast(
        messages[err.code] ?? "Impossible d'ajouter ce collaborateur pour le moment.",
        "error",
      );
      return;
    } finally {
      setAdding(false);
    }

    await refreshTeam();
    toast(`${person.fullName || person.email} a été ajouté à votre équipe.`, "success");
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
  async function sendMail() {
    // Envoyé depuis le compte Messages du manager, via le backend : le mail
    // part donc de sa vraie adresse. Plusieurs destinataires séparés par des
    // virgules ou des points-virgules.
    const to = recipients.map((recipient) => recipient.email);
    if (to.length === 0) {
      toast("Ajoutez au moins un destinataire.", "error");
      return;
    }

    setSending(true);
    try {
      await sendHandover(selected.id, to);
      toast(
        `Résumé de ${selected.firstName} envoyé à ${to.join(", ")}.`,
        "success",
      );
      setRecipients([]);
    } catch (err) {
      if (err.status === 401) {
        toast("Votre session a expiré, reconnectez-vous.", "warning");
        sessionExpired();
        return;
      }
      const messages = {
        empty_handover: "Ce résumé est vide : il n'y a rien à envoyer.",
        messages_not_connected:
          "Votre compte Messages n'est pas connecté : reconnectez-vous pour envoyer un mail.",
        no_mailbox: "Aucune boîte mail n'est associée à votre compte Messages.",
        messages_unreachable: "Messages est injoignable pour le moment.",
        messages_timeout: "Messages met trop de temps à répondre.",
      };
      toast(messages[err.code] ?? "L'envoi a échoué. Réessayez.", "error");
    } finally {
      setSending(false);
    }
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
              <div className="manager-page__team__add-form">
                <Input
                  label="Rechercher une personne"
                  fullWidth
                  text="Par nom ou adresse email, dans l'annuaire"
                  value={search}
                  onChange={(e) => handleSearchChange(e.target.value)}
                />
                <Input
                  label="Poste (facultatif)"
                  fullWidth
                  value={newJobTitle}
                  onChange={(e) => setNewJobTitle(e.target.value)}
                />

                {searching && (
                  <p className="manager-page__team__search__hint">Recherche...</p>
                )}
                {!searching && search.trim().length >= 2 && searchResults.length === 0 && (
                  <p className="manager-page__team__search__hint">
                    {directoryReachable
                      ? "Aucun compte ne correspond. L'annuaire ne liste que les personnes ayant déjà utilisé Drive, et la recherche se fait par début de nom ou d'adresse."
                      : "Annuaire Drive indisponible : votre session Drive a peut-être expiré. Reconnectez-vous, ou saisissez l'adresse complète pour ajouter la personne."}
                  </p>
                )}

                <ul className="manager-page__team__search__results">
                  {/* Une adresse complète est toujours proposée, même absente
                      de l'annuaire : quelqu'un qui n'a jamais ouvert Drive n'y
                      figure pas encore. Sa fiche sera rattachée à son compte à
                      sa première connexion, par cet email. */}
                  {typedAddress && (
                    <li key={typedAddress}>
                      <button
                        type="button"
                        className="manager-page__team__search__result"
                        disabled={adding}
                        onClick={() =>
                          handleAddCollaborator({
                            email: typedAddress,
                            fullName: typedAddress.split("@")[0],
                          })
                        }
                      >
                        <span className="manager-page__team__search__result__name">
                          Ajouter {typedAddress}
                        </span>
                        <span className="manager-page__team__search__result__email">
                          Adresse saisie — la personne n'a pas encore utilisé Drive
                        </span>
                      </button>
                    </li>
                  )}
                  {searchResults.map((person) => {
                    // Le serveur dit déjà pourquoi quelqu'un n'est pas
                    // ajoutable : on l'affiche au lieu de laisser le clic
                    // échouer.
                    const reasons = {
                      on_your_team: "Déjà dans votre équipe",
                      on_another_team: "Dans l'équipe d'un autre manager",
                      yourself: "C'est vous",
                    };
                    const blocked = person.status !== "available";
                    return (
                      <li key={person.email}>
                        <button
                          type="button"
                          className="manager-page__team__search__result"
                          disabled={blocked || adding}
                          onClick={() => handleAddCollaborator(person)}
                        >
                          <span className="manager-page__team__search__result__name">
                            {person.fullName}
                          </span>
                          <span className="manager-page__team__search__result__email">
                            {person.email}
                          </span>
                          {blocked && (
                            <span className="manager-page__team__search__result__reason">
                              {reasons[person.status]}
                            </span>
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>

                <div className="manager-page__team__add-form__actions">
                  <Button
                    type="button"
                    variant="tertiary"
                    fullWidth
                    onClick={handleCancelAddCollaborator}
                  >
                    Annuler
                  </Button>
                </div>
              </div>
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
                  Envoyer le résumé de {selected.firstName} par mail, depuis
                  votre propre adresse.
                </p>

                <Input
                  label="Destinataires"
                  fullWidth
                  text="Chercher par nom ou adresse, puis ajouter"
                  value={recipientSearch}
                  onChange={(e) => handleRecipientSearch(e.target.value)}
                />

                <ul className="manager-page__share__results">
                  {/* Une adresse complète peut toujours être ajoutée telle
                      quelle : le destinataire n'est pas forcément quelqu'un
                      que l'annuaire connaît. */}
                  {typedRecipient && (
                    <li key={typedRecipient}>
                      <button
                        type="button"
                        className="manager-page__share__result"
                        onClick={() =>
                          addRecipient({ email: typedRecipient, fullName: typedRecipient })
                        }
                      >
                        <span>Ajouter {typedRecipient}</span>
                        <span className="manager-page__share__result__add">
                          Ajouter
                        </span>
                      </button>
                    </li>
                  )}
                  {recipientResults.map((person) => (
                    <li key={person.email}>
                      <button
                        type="button"
                        className="manager-page__share__result"
                        onClick={() => addRecipient(person)}
                      >
                        <span>
                          {person.fullName}
                          <span className="manager-page__share__result__email">
                            {person.email}
                          </span>
                        </span>
                        <span className="manager-page__share__result__add">
                          Ajouter
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>

                {recipients.length > 0 && (
                  <ul className="manager-page__share__chips">
                    {recipients.map((recipient) => (
                      <li key={recipient.email} className="manager-page__share__chip">
                        <span title={recipient.email}>{recipient.fullName}</span>
                        <button
                          type="button"
                          aria-label={`Retirer ${recipient.email}`}
                          onClick={() => removeRecipient(recipient.email)}
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
                  disabled={sending || recipients.length === 0}
                >
                  {sending
                    ? "Envoi..."
                    : `Envoyer par mail${recipients.length > 1 ? ` (${recipients.length})` : ""}`}
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
          ? `Retirer ${pendingRemove.firstName} ${pendingRemove.lastName} de votre équipe ? Sa passation et son compte sont conservés : vous ne les verrez simplement plus, et vous pourrez le rattacher à nouveau.`
          : null}
      </DeleteConfirmationModal>
    </div>
  );
}
