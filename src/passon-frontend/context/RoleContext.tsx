"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

export type Role = "agent" | "manager";

interface RoleContextValue {
  role: Role;
  setRole: (role: Role) => void;
}

const RoleContext = createContext<RoleContextValue | undefined>(undefined);

/**
 * Purely client-side role switch used to demo the agent and manager views
 * without a real login/permission system. Defaults to "agent".
 */
export function RoleProvider({ children }: { children: ReactNode }) {
  const [role, setRole] = useState<Role>("agent");

  return (
    <RoleContext.Provider value={{ role, setRole }}>
      {children}
    </RoleContext.Provider>
  );
}

export function useRole() {
  const context = useContext(RoleContext);
  if (!context) {
    throw new Error("useRole must be used within a RoleProvider");
  }
  return context;
}
