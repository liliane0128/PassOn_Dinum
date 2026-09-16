import { createContext, useContext, useEffect, useRef, useState } from "react";
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

  // Même raison que pour les passations : les documents lus appartiennent à la
  // session qui les a demandés, pas au navigateur.
  useEffect(() => {
    setByCollaborator({});
    requested.current.clear();
  }, [currentUser?.id]);

  // `requested` marks an id as *attempted*, not as succeeded: a failure must
  // keep it marked. getItems() runs during render, so un-marking on failure
  // would make the next render fire the request again, and again -- each one
  // re-reading every document from Drive and Messages. Retrying is an
  // explicit act: reload(), or the page being opened afresh.
  function load(collaboratorId, { force = false } = {}) {
    if (!collaboratorId || !currentUser) return;
    if (!force && requested.current.has(collaboratorId)) return;
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

  /** Relecture explicite (bouton, ajout de collaborateur...). */
  function reload(collaboratorId) {
    load(collaboratorId, { force: true });
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
