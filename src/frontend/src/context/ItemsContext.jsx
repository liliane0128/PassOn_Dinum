import { createContext, useContext, useRef, useState } from "react";
import { useAuth } from "./AuthContext.jsx";
import { fetchItems } from "../api/items.js";

const ItemsContext = createContext(null);

const EMPTY = { items: [], fetchedAt: null, errors: {}, loading: true };

// Les mails et documents viennent du backend, pour soi comme pour les membres
// de son équipe (voir api/items.js). Rien de mocké ici : ce qui n'a jamais été
// synchronisé s'affiche comme tel, plutôt que par des données fictives.
export function ItemsProvider({ children }) {
  const { currentUser, sessionExpired } = useAuth();
  const [byCollaborator, setByCollaborator] = useState({});
  // Ids déjà demandés, pour ne pas relancer la requête à chaque rendu :
  // `getItems` est appelé pendant le rendu des pages.
  const requested = useRef(new Set());

  function load(collaboratorId) {
    if (!collaboratorId || !currentUser || requested.current.has(collaboratorId)) return;
    requested.current.add(collaboratorId);
    setByCollaborator((prev) => ({ ...prev, [collaboratorId]: { ...EMPTY } }));

    fetchItems(collaboratorId)
      .then(({ items, errors, fetchedAt }) => {
        setByCollaborator((prev) => ({
          ...prev,
          [collaboratorId]: { items, errors, fetchedAt, loading: false },
        }));
      })
      .catch((err) => {
        if (err.status === 401) {
          sessionExpired();
          return;
        }
        requested.current.delete(collaboratorId);
        setByCollaborator((prev) => ({
          ...prev,
          [collaboratorId]: { ...EMPTY, loading: false, error: err.message },
        }));
      });
  }

  function entry(collaboratorId) {
    load(collaboratorId);
    return byCollaborator[collaboratorId] ?? EMPTY;
  }

  function getItems(collaboratorId) {
    return entry(collaboratorId).items;
  }

  /** Quand la photo a été prise (null si jamais synchronisé), et son état. */
  function getStatus(collaboratorId) {
    const { fetchedAt, loading, error, errors } = entry(collaboratorId);
    return { fetchedAt, loading, error, errors };
  }

  /** Force une relecture, après un ajout de collaborateur par exemple. */
  function reload(collaboratorId) {
    requested.current.delete(collaboratorId);
    load(collaboratorId);
  }

  return (
    <ItemsContext.Provider value={{ getItems, getStatus, reload }}>
      {children}
    </ItemsContext.Provider>
  );
}

export function useItems() {
  return useContext(ItemsContext);
}
