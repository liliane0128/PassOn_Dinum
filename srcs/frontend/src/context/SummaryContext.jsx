import { createContext, useContext, useState } from "react";
import { summaries as initialSummaries } from "../data/mockSummaries.js";

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

export function SummaryProvider({ children }) {
  const [summaries, setSummaries] = useState(initialSummaries);

  // `patch` est fusionné dans le résumé existant (texte, ou n'importe quelle
  // section structurée) ; toute modification repasse `validated` à false.
  function updateSummary(collaboratorId, patch) {
    setSummaries((prev) => ({
      ...prev,
      [collaboratorId]: {
        ...EMPTY_SUMMARY,
        ...prev[collaboratorId],
        ...patch,
        validated: false,
      },
    }));
  }

  function validateSummary(collaboratorId) {
    setSummaries((prev) => ({
      ...prev,
      [collaboratorId]: { ...prev[collaboratorId], validated: true },
    }));
  }

  function getSummary(collaboratorId) {
    return summaries[collaboratorId] ?? EMPTY_SUMMARY;
  }

  return (
    <SummaryContext.Provider
      value={{ getSummary, updateSummary, validateSummary }}
    >
      {children}
    </SummaryContext.Provider>
  );
}

export function useSummaries() {
  return useContext(SummaryContext);
}
