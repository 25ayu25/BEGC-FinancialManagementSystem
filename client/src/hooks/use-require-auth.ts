import { useEffect } from "react";
import { api } from "@/lib/queryClient";
import { useAuth } from "@/context/auth";

/**
 * Safety net: if a 401 happens *after* login (e.g., session expiry),
 * send the user to /login and preserve the intended return path.
 * We only attach the interceptor when status === "authed" to avoid pre-login flicker.
 */
export function useRequireAuth() {
  const { status } = useAuth(); // "loading" | "guest" | "authed"

  useEffect(() => {
    if (status !== "authed") return;

    const id = api.interceptors.response.use(
      (res) => res,
      (error) => {
        const st = error?.response?.status;
        const onLogin = window.location.pathname.startsWith("/login");
        if (st === 401 && !onLogin) {
          const next = encodeURIComponent(
            `${window.location.pathname}${window.location.search}`
          );
          window.location.replace(`/login?next=${next}`);
          return; // break chain; navigation takes over
        }
        return Promise.reject(error);
      }
    );

    return () => {
      api.interceptors.response.eject(id);
    };
  }, [status]);
}
