import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/queryClient";

type User = {
  id: string;
  username: string;
  role: string;
  location?: string;
  fullName?: string;
  email?: string;
  defaultCurrency?: string;
};

type AuthState = "loading" | "guest" | "authed";

type AuthContextValue = {
  status: AuthState;
  user: User | null;
  /** Re-check session with the API and update state */
  refresh: () => Promise<void>;
  /** Force guest (e.g., after logout) */
  setGuest: () => void;
};

const AuthCtx = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthCtx);
  if (!ctx) {
    throw new Error("useAuth must be used inside <AuthProvider>");
  }
  return ctx;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<AuthState>("loading");
  const [user, setUser] = useState<User | null>(null);

  // Always send cookies to the API
  useEffect(() => {
    api.defaults.withCredentials = true;
  }, []);

  const refresh = async () => {
    try {
      const res = await api.get<User>("/api/auth/user", { withCredentials: true });
      setUser(res.data || null);
      setStatus(res.data ? "authed" : "guest");
    } catch {
      setUser(null);
      setStatus("guest");
    }
  };

  useEffect(() => {
    // Boot-time auth check; avoids showing the shell for guests
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user,
      refresh,
      setGuest: () => {
        setUser(null);
        setStatus("guest");
      },
    }),
    [status, user]
  );

  // Render nothing until we know (prevents sidebar flash)
  if (status === "loading") return null;

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}
