import { createContext, useContext, useState } from "react";
import { collaborators as initialCollaborators } from "../data/mockData.js";

const CollaboratorsContext = createContext(null);

// Mot de passe de test identique aux comptes mockés (voir mockData.js) : pas
// de vrai backend d'authentification pour l'instant.
const TEST_PASSWORD = "demo";

export function CollaboratorsProvider({ children }) {
  const [collaborators, setCollaborators] = useState(initialCollaborators);

  function addCollaborator({ firstName, lastName, jobTitle, team, email, managerId }) {
    const collaborator = {
      id: crypto.randomUUID(),
      firstName,
      lastName,
      jobTitle,
      team,
      email,
      password: TEST_PASSWORD,
      accountRole: "employee",
      managerId,
    };
    setCollaborators((prev) => [...prev, collaborator]);
    return collaborator;
  }

  function removeCollaborator(id) {
    setCollaborators((prev) => prev.filter((c) => c.id !== id));
  }

  return (
    <CollaboratorsContext.Provider
      value={{ collaborators, addCollaborator, removeCollaborator }}
    >
      {children}
    </CollaboratorsContext.Provider>
  );
}

export function useCollaborators() {
  return useContext(CollaboratorsContext);
}
