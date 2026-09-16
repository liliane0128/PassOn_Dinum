import { createContext, useContext, useRef, useState } from "react";
import { useToastProvider } from "@gouvfr-lasuite/ui-components";
import * as handoverApi from "../api/handover.js";

const SummaryContext = createContext(null);

const EMPTY_SUMMARY = {
  text: "",
  validated: false,
  actions: [],
  decisions: [],
  deadlines: [],
  blockers: [],
  contactIds: [],
  documents: [],
};

// Les passations sont stockées côté serveur (`passon.Handover`) : ce que
// l'employé écrit et valide, son manager le voit. Ce contexte n'en garde
// qu'un cache local, chargé à la demande pour chaque collaborateur affiché.
export function SummaryProvider({ children }) {
  const { toast } = useToastProvider();
  const [summaries, setSummaries] = useState({});
  // Ids déjà demandés au serveur, pour ne pas relancer la même requête à
  // chaque rendu (`getSummary` est appelé pendant le rendu des pages).
  const requested = useRef(new Set());

  function store(collaboratorId, data) {
    setSummaries((prev) => ({ ...prev, [collaboratorId]: { ...EMPTY_SUMMARY, ...data } }));
  }

  function load(collaboratorId) {
    if (!collaboratorId || requested.current.has(collaboratorId)) return;
    requested.current.add(collaboratorId);
    handoverApi
      .fetchHandover(collaboratorId)
      .then((data) => store(collaboratorId, data))
      .catch(() => {
        // Pas de passation lisible (droits, session expirée) : on laisse le
        // résumé vide plutôt que d'afficher celui de quelqu'un d'autre.
        requested.current.delete(collaboratorId);
      });
  }

  // Vrai une fois la passation réellement lue côté serveur : tant que c'est
  // faux, un résumé vide veut dire "pas encore chargé", pas "il n'y en a pas".
  function isLoaded(collaboratorId) {
    return Boolean(summaries[collaboratorId]);
  }

  function getSummary(collaboratorId) {
    load(collaboratorId);
    return summaries[collaboratorId] ?? EMPTY_SUMMARY;
  }

  // `patch` est fusionné dans la passation existante (texte, ou n'importe
  // quelle section) ; toute modification la repasse en non validée, côté
  // serveur comme ici.
  // Un enregistrement qui échoue en silence, c'est du travail perdu sans que
  // personne ne le sache : on prévient, et on réaffiche ce que le serveur a
  // réellement enregistré plutôt que de laisser l'écran mentir.
  async function persist(collaboratorId, call, failureMessage) {
    try {
      const saved = await call();
      store(collaboratorId, saved);
      return saved;
    } catch (error) {
      toast(
        error.status === 401
          ? "Votre session a expiré, reconnectez-vous."
          : failureMessage,
        error.status === 401 ? "warning" : "error",
      );
      requested.current.delete(collaboratorId);
      load(collaboratorId);
      return null;
    }
  }

  async function updateSummary(collaboratorId, patch) {
    // Affiché tout de suite, confirmé (ou corrigé) par la réponse du serveur.
    store(collaboratorId, {
      ...EMPTY_SUMMARY,
      ...summaries[collaboratorId],
      ...patch,
      validated: false,
    });
    return persist(
      collaboratorId,
      () => handoverApi.saveHandover(collaboratorId, patch),
      "Modification non enregistrée : réessayez.",
    );
  }

  async function validateSummary(collaboratorId) {
    return persist(
      collaboratorId,
      () => handoverApi.validateHandover(collaboratorId),
      "Validation non enregistrée : réessayez.",
    );
  }

  return (
    <SummaryContext.Provider
      value={{ getSummary, isLoaded, updateSummary, validateSummary }}
    >
      {children}
    </SummaryContext.Provider>
  );
}

export function useSummaries() {
  return useContext(SummaryContext);
}
