"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

export interface PassationStatus {
  validated: boolean;
  validatedAt?: string;
}

interface PassationStatusContextValue {
  getStatus: (id: string) => PassationStatus;
  setValidated: (id: string, validatedAt: string) => void;
  /** Set the whole status, including back to not-validated. */
  setStatus: (id: string, status: PassationStatus) => void;
}

const DEFAULT_STATUS: PassationStatus = { validated: false };

const PassationStatusContext = createContext<PassationStatusContextValue | undefined>(
  undefined,
);

/**
 * Validation status per passation id, shared across every component that
 * needs it (PassationCard's header badge and button, the "Mon équipe" list,
 * ...) instead of living in one component's local useState.
 */
export function PassationStatusProvider({ children }: { children: ReactNode }) {
  const [statuses, setStatuses] = useState<Record<string, PassationStatus>>({});

  function getStatus(id: string): PassationStatus {
    return statuses[id] ?? DEFAULT_STATUS;
  }

  function setValidated(id: string, validatedAt: string) {
    setStatuses((prev) => ({
      ...prev,
      [id]: { validated: true, validatedAt },
    }));
  }

  // Needed because a sheet can also become *un*-validated: the backend resets
  // the flag on every edit, so "validated" has to be able to travel back.
  function setStatus(id: string, status: PassationStatus) {
    setStatuses((prev) => ({ ...prev, [id]: status }));
  }

  return (
    <PassationStatusContext.Provider value={{ getStatus, setValidated, setStatus }}>
      {children}
    </PassationStatusContext.Provider>
  );
}

export function usePassationStatus() {
  const context = useContext(PassationStatusContext);
  if (!context) {
    throw new Error("usePassationStatus must be used within a PassationStatusProvider");
  }
  return context;
}
