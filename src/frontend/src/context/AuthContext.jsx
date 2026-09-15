import { createContext, useContext, useState } from "react";
import { useCollaborators } from "./CollaboratorsContext.jsx";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const { collaborators } = useCollaborators();
  const [currentUser, setCurrentUser] = useState(null);

  function login(email, password) {
    const normalizedEmail = email.trim().toLowerCase();
    const match = collaborators.find(
      (c) => c.email.toLowerCase() === normalizedEmail && c.password === password,
    );
    if (match) setCurrentUser(match);
    return match ?? null;
  }

  function logout() {
    setCurrentUser(null);
  }

  return (
    <AuthContext.Provider value={{ currentUser, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
