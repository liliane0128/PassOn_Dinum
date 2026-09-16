import { createContext, useContext, useEffect, useState } from "react";
import { useAuth } from "./AuthContext.jsx";
import { fetchItems } from "../api/items.js";
import { getCollaboratorItems } from "../utils/collaboratorItems.js";

const ItemsContext = createContext(null);

export function ItemsProvider({ children }) {
  const { currentUser, sessionExpired } = useAuth();
  // null tant que rien n'a été chargé : on retombe alors sur les données
  // mockées, pour que l'interface ne soit jamais vide pendant le chargement.
  const [ownItems, setOwnItems] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  // Services interrogés mais en échec, ex. { messages: "upstream_timeout" }.
  const [serviceErrors, setServiceErrors] = useState({});

  useEffect(() => {
    if (!currentUser) {
      setOwnItems(null);
      setServiceErrors({});
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchItems()
      .then(({ items, errors }) => {
        if (cancelled) return;
        setOwnItems(items);
        setServiceErrors(errors);
      })
      .catch((err) => {
        if (cancelled) return;
        if (err.status === 401) {
          sessionExpired();
          return;
        }
        setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [currentUser]);

  // On ne peut lire les fichiers que du compte dont on détient la session :
  // les autres collaborateurs gardent donc leurs données mockées, en attendant
  // que le backend sache répondre pour quelqu'un d'autre que l'appelant.
  function getItems(collaboratorId) {
    if (currentUser && collaboratorId === currentUser.id && ownItems) {
      return ownItems;
    }
    return getCollaboratorItems(collaboratorId);
  }

  function isReal(collaboratorId) {
    return Boolean(currentUser && collaboratorId === currentUser.id && ownItems);
  }

  return (
    <ItemsContext.Provider
      value={{ getItems, isReal, loading, error, serviceErrors }}
    >
      {children}
    </ItemsContext.Provider>
  );
}

export function useItems() {
  return useContext(ItemsContext);
}
