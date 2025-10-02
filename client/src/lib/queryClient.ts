// client/src/lib/queryClient.ts
import axios from "axios";
import { QueryClient } from "@tanstack/react-query";

/** Your API root. Leave blank to use same-origin in dev. */
const BASE_URL = (process.env.NEXT_PUBLIC_API_BASE_URL || "").trim();

console.log("[CFG] API base URL =", BASE_URL || "(same-origin)");

export const api = axios.create({
  baseURL: BASE_URL,         // e.g. https://bgc-financialmanagementsystem.onrender.com
  withCredentials: false,
  headers: {
    Accept: "application/json",
  },
});

/**
 * Ensure all known endpoints are routed under /api.
 * If a request already starts with /api or is absolute (http/https), we don't touch it.
 */
const KNOWN_SEGMENTS = [
  "reports",
  "dashboard",
  "income-trends",
  "departments",
  "insurance-providers",
  "patients",
  "transactions",
];

api.interceptors.request.use((config) => {
  let url = config.url ?? "";

  // absolute URL? do nothing
  if (/^https?:\/\//i.test(url)) return config;

  // normalize leading slash
  if (url && !url.startsWith("/")) url = `/${url}`;

  // already /api?
  if (url.startsWith("/api/")) {
    config.url = url;
    return config;
  }

  // prefix /api for our known app endpoints
  const needsPrefix = KNOWN_SEGMENTS.some(
    (seg) => url === `/${seg}` || url.startsWith(`/${seg}/`) || url.startsWith(`/${seg}?`)
  );
  if (needsPrefix) url = `/api${url}`;

  config.url = url;
  return config;
});

/** Shared React Query client */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});
