import { createContext, useContext, useEffect, useState } from "react";
import * as authApi from "../api/auth.js";

const AuthContext = createContext(null);

// Le backend renvoie désormais le profil tel que *notre* base le connaît
// (`passon.Collaborator`) : rôle, équipe, manager. C'est lui qui décide quelle
// page s'affiche — Drive ne sait pas qui encadre qui.
//
// Les données mockées ne servent plus qu'aux collaborateurs dont personne n'a
// la session : la liste d'équipe du manager tant qu'elle n'est pas alimentée,
// et leurs mails/documents (voir ItemsContext).
function toAppUser(account) {
  return {
    id: account.id,
    firstName: account.firstName || account.full_name || account.email,
    lastName: account.lastName || "",
    jobTitle: account.jobTitle || "Poste non renseigné",
    team: account.team || "",
    email: account.email,
    accountRole: account.accountRole || "employee",
    managerId: account.managerId ?? null,
  };
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  // Les collaborateurs qui rattachent leur manager à l'utilisateur connecté,
  // tels que la base les connaît. Vide tant que personne n'a été rattaché.
  const [team, setTeam] = useState([]);
  // La session est un cookie côté serveur : au chargement de la page on ne
  // sait pas encore qui est connecté. Tant que `restoring` est vrai, App
  // n'affiche aucune page, sinon les pages protégées redirigeraient vers
  // l'écran de connexion avant même d'avoir eu la réponse.
  const [restoring, setRestoring] = useState(true);

  // Volontairement une seule fois, au démarrage : il s'agit de retrouver une
  // session déjà ouverte, pas de la recalculer à chaque ajout de collaborateur.
  useEffect(() => {
    let cancelled = false;
    authApi.fetchCurrentUser().then((session) => {
      if (cancelled) return;
      if (session?.user) {
        setCurrentUser(toAppUser(session.user));
        setTeam((session.team ?? []).map(toAppUser));
      }
      setRestoring(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Renvoie { user } ou { error: "<code>" } — LoginPage traduit le code en
  // message. Les identifiants sont ceux de Drive : c'est lui qui les vérifie,
  // rien n'est comparé dans le navigateur.
  async function login(email, password) {
    const result = await authApi.login(email, password);
    if (result.error) return { error: result.error };
    const user = toAppUser(result.user);
    setCurrentUser(user);
    setTeam((result.team ?? []).map(toAppUser));
    return { user };
  }

  async function logout() {
    // On déconnecte localement quoi qu'il arrive : si l'appel échoue, rester
    // affiché comme connecté serait pire que la session qui traîne côté
    // serveur (elle expirera).
    await authApi.logout();
    setCurrentUser(null);
    setTeam([]);
  }

  return (
    <AuthContext.Provider value={{ currentUser, team, restoring, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
