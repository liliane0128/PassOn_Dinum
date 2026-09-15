import { createContext, useContext, useEffect, useState } from "react";
import { collaborators } from "../data/mockData.js";
import * as authApi from "../api/auth.js";

const AuthContext = createContext(null);

// Le backend renvoie l'identité que Drive connaît : { id, email, full_name }.
// Les pages, elles, attendent encore le profil complet des données mockées —
// `accountRole` décide quelle page s'affiche, `id` sert à retrouver le résumé
// et les documents de la personne. On relie les deux par l'email.
//
// C'est volontairement une passerelle temporaire : le jour où le rôle et la
// hiérarchie viendront du backend (voir PLAN.md), `toAppUser` disparaît et les
// pages lisent directement ce que renvoie l'API.
function toAppUser(account) {
  const email = (account.email ?? "").toLowerCase();
  const known = collaborators.find((c) => c.email.toLowerCase() === email);
  if (known) {
    // Compte mocké correspondant : on garde son profil (rôle, équipe, poste)
    // et on note au passage l'identifiant Drive réel.
    return { ...known, driveId: account.id };
  }

  // Vrai compte Drive sans équivalent mocké (le cas normal une fois le mock
  // éteint). Faute de rôle côté Drive, on ouvre l'espace employé : c'est le
  // moins privilégié des deux. Son résumé et ses documents seront vides tant
  // que les données ne viennent pas du backend, ce que les pages gèrent déjà.
  const fullName = (account.full_name ?? "").trim();
  const [firstName, ...rest] = (fullName || account.email || "").split(" ");
  return {
    id: account.id,
    firstName,
    lastName: rest.join(" "),
    jobTitle: "Poste non renseigné",
    team: "Drive",
    email: account.email,
    accountRole: "employee",
    managerId: null,
    driveId: account.id,
  };
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  // La session est un cookie côté serveur : au chargement de la page on ne
  // sait pas encore qui est connecté. Tant que `restoring` est vrai, App
  // n'affiche aucune page, sinon les pages protégées redirigeraient vers
  // l'écran de connexion avant même d'avoir eu la réponse.
  const [restoring, setRestoring] = useState(true);

  useEffect(() => {
    let cancelled = false;
    authApi.fetchCurrentUser().then((account) => {
      if (cancelled) return;
      if (account) setCurrentUser(toAppUser(account));
      setRestoring(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Renvoie { user } ou { error: "<code>" } — LoginPage traduit le code en
  // message. Les identifiants sont ceux de Drive : c'est lui qui les vérifie.
  async function login(email, password) {
    const result = await authApi.login(email, password);
    if (result.error) return { error: result.error };
    const user = toAppUser(result.user);
    setCurrentUser(user);
    return { user };
  }

  async function logout() {
    // On déconnecte localement quoi qu'il arrive : si l'appel échoue, rester
    // affiché comme connecté serait pire que la session qui traîne côté
    // serveur (elle expirera).
    await authApi.logout();
    setCurrentUser(null);
  }

  return (
    <AuthContext.Provider value={{ currentUser, restoring, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
