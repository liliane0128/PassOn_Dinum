"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  fetchSession,
  login as loginRequest,
  logout as logoutRequest,
  type Session,
} from "@/lib/auth";

interface AuthContextValue {
  session: Session | null;
  /** True until the first `/api/auth/me/` answers. */
  restoring: boolean;
  login: (email: string, password: string) => Promise<{ ok: boolean; code?: string }>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

/**
 * Holds the session for the whole app.
 *
 * The truth lives in a cookie the backend set, not here, which is why a page
 * reload does not log anyone out: this asks `/api/auth/me/` once on mount and
 * restores whatever it finds.
 *
 * `restoring` matters more than it looks: until that first answer arrives we
 * do not know whether someone is logged in, and a guard that redirects during
 * that window would bounce a logged-in person to the login page on every
 * refresh.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [restoring, setRestoring] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetchSession()
      .then((found) => {
        if (!cancelled) setSession(found);
      })
      .catch(() => {
        if (!cancelled) setSession(null);
      })
      .finally(() => {
        if (!cancelled) setRestoring(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const result = await loginRequest(email, password);
    if (result.ok) {
      setSession(result.session);
      return { ok: true };
    }
    return { ok: false, code: result.code };
  }, []);

  const logout = useCallback(async () => {
    await logoutRequest();
    setSession(null);
  }, []);

  return (
    <AuthContext.Provider value={{ session, restoring, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
