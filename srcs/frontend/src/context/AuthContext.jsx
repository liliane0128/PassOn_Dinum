import { createContext, useContext, useState } from "react";
import { collaborators } from "../data/mockData.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
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
