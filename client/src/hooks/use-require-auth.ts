import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { api } from "@/lib/queryClient";

/**
 * Guards a page that requires authentication.
 * - If /api/auth/user returns 401, redirect to /login and preserve where we came from.
 * - Works with cookie OR the x-session-token fallback (which our axios instance sends).
 */
export function useRequireAuth() {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        await api.get("/api/auth/user"); // success if cookie or x-session-token is valid
      } catch (err: any) {
        if (!cancelled && err?.response?.status === 401) {
          const next = encodeURIComponent(location.pathname + location.search);
          navigate(`/login?next=${next}`, { replace: true });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [navigate, location]);
}
