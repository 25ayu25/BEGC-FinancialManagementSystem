// client/src/lib/queryClient.ts
import { QueryClient, QueryFunction } from "@tanstack/react-query";
import axios from "axios";
import { API_BASE_URL } from "./constants";

/* ---------------- Base URL & axios instance ---------------- */

const baseURL = API_BASE_URL;
console.info("[CFG] API base URL =", baseURL);

export const api = axios.create({
  baseURL,
  withCredentials: true, // send HttpOnly cookie when allowed
  headers: { "Content-Type": "application/json" },
});

/* ---------------- Session backup (for Safari/3rd-party cookie blocks) ---------------- */

const BACKUP_KEY = "user_session_backup";

function readBackup(): string | null {
  try {
    return localStorage.getItem(BACKUP_KEY);
  } catch {
    return null;
  }
}
function writeBackup(payload: any) {
  try {
    localStorage.setItem(BACKUP_KEY, JSON.stringify(payload));
  } catch {}
}
function clearBackup() {
  try {
    localStorage.removeItem(BACKUP_KEY);
  } catch {}
}

/* Attach backup token (if present) to every request */
api.interceptors.request.use((config) => {
  const sessionBackup = readBackup();
  if (sessionBackup) {
    (config.headers ??= {});
    (config.headers as any)["x-session-token"] = sessionBackup;
  }
  return config;
});

/* On successful login, persist backup; on 401, clear backup */
api.interceptors.response.use(
  (response) => {
    const url = response.config?.url || "";
    if (response.status >= 200 && response.status < 300 && url.includes("/api/auth/login")) {
      // Server returns the session payload; keep a JSON backup client-side.
      writeBackup(response.data);
    }
    return response;
  },
  (error) => {
    const status = error?.response?.status;
    if (status === 401) {
      clearBackup();
    }
    return Promise.reject(error);
  }
);

/* ---------------- fetch-like wrapper (kept) ---------------- */

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown
): Promise<Response> {
  try {
    const response = await api.request({ method, url, data });
    return {
      ok: response.status >= 200 && response.status < 300,
      status: response.status,
      statusText: response.statusText,
      json: async () => response.data,
      text: async () => JSON.stringify(response.data),
    } as Response;
  } catch (error: any) {
    throw new Error(
      `${error.response?.status || 500}: ${error.response?.data?.error || error.message}`
    );
  }
}

/* ---------------- Default query fn + client (kept, with small 401 helper) ---------------- */

type UnauthorizedBehavior = "returnNull" | "throw";

export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    try {
      const path = queryKey.join("/");
      const response = await api.get(path.startsWith("/") ? path : `/${path}`);
      return response.data;
    } catch (error: any) {
      if (unauthorizedBehavior === "returnNull" && error.response?.status === 401) {
        // make sure we don't keep sending a stale header
        clearBackup();
        return null as T;
      }
      throw new Error(
        `${error.response?.status || 500}: ${error.response?.data?.error || error.message}`
      );
    }
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
