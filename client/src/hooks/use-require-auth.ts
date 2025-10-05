import { useEffect } from "react";
import { api } from "@/lib/queryClient";

/**
 * Redirect to /login whenever an API response returns 401.
 * Works even in incognito because the first failing request triggers the redirect.
 * Cleans itself up when the component unmounts.
 */
export function useRequireAuth() {
  useEffect(() => {
    const id = api.interceptors.response.use(
      (res) => res,
      (error) => {
        const status = error?.response?.status;
        if (status === 401) {
          const next = encodeURIComponent(
            `${window.location.pathname}${window.location.search}`
          );
          // Use replace so back button doesn't come back to a broken page
          window.location.replace(`/login?next=${next}`);
          return; // stop promise chain; navigation will take over
        }
        return Promise.reject(error);
      }
    );

    return () => {
      api.interceptors.response.eject(id);
    };
  }, []);
}
