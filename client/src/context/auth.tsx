import React, { createContext, useContext, useEffect, useState } from "react";

type User = {
  id: string;
  username: string;
  role: string;
  location?: string;
  fullName?: string;
};

type AuthState =
  | { status: "loading"; user: null }
  | { status: "guest"; user: null }
  | { status: "authed"; user: User };

const AuthCtx = createContext<AuthState>({ status: "loading", user: null });
export const useAuth = () => useContext(AuthCtx);

/**
 * Boots auth once at app start by calling /api/auth/user.
 * Until we know, renders nothing (prevents sidebar/dashboard flash).
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: "loading", user: null });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/auth/user", { credentials: "include" });
        if (!res.ok) throw new Error(String(res.status));
        const user = (await res.json()) as User;
        if (!cancelled) setState({ status: "authed", user });
      } catch {
        if (!cancelled) setState({ status: "guest", user: null });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (state.status === "loading") return null; // optional: a full-screen splash
  return <AuthCtx.Provider value={state}>{children}</AuthCtx.Provider>;
}
