// client/src/lib/api-insurance-lab.ts
import { API_BASE_URL, USE_API_PROXY } from "@/lib/constants";

/**
 * Build an API URL for insurance/lab routes.
 * - When USE_API_PROXY is true (Vercel), call same-origin:
 *     /api/insurance/...
 *   so auth works cleanly through Vercel rewrites.
 * - Otherwise, call the absolute backend:
 *     https://<backend>/api/insurance/...
 */
const base = (path: string) => {
  const p = path.startsWith("/") ? path : `/${path}`;
  if (USE_API_PROXY) return `/api/insurance${p}`;
  return new URL(`/api/insurance${p}`, API_BASE_URL).toString();
};

const headers = (): HeadersInit => {
  const h: HeadersInit = { "Content-Type": "application/json" };

  // Keep using the same localStorage key as queryClient.ts BACKUP_KEY
  const tok = localStorage.getItem("user_session_backup");
  if (tok) (h as any)["x-session-token"] = tok;

  return h;
};

/* ---------------------------------------------------------------------- */
/* Existing functions                                                     */
/* ---------------------------------------------------------------------- */

export async function getLabSummary(year: number, month: number) {
  const res = await fetch(base(`/lab-summary?year=${year}&month=${month}`), {
    credentials: "include",
    headers: headers(),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function setLabPortion(input: {
  periodYear: number;
  periodMonth: number;
  currency: string;
  amount: number;
}) {
  const res = await fetch(base("/lab-portion"), {
    method: "POST",
    credentials: "include",
    headers: headers(),
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function addLabPayment(input: {
  payDate: string;
  periodYear: number;
  periodMonth: number;
  currency: string;
  amount: number;
  note?: string;
}) {
  const res = await fetch(base("/lab-payment"), {
    method: "POST",
    credentials: "include",
    headers: headers(),
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function getLabPayments(year: number, month: number) {
  const res = await fetch(base(`/lab-payments?year=${year}&month=${month}`), {
    credentials: "include",
    headers: headers(),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

/* ---------------------------------------------------------------------- */
/* New functions: edit + delete payments                                  */
/* ---------------------------------------------------------------------- */

export type LabPaymentInput = {
  payDate: string;
  periodYear: number;
  periodMonth: number;
  currency: string;
  amount: number;
  note?: string;
};

export async function updateLabPayment(
  id: string | number,
  input: LabPaymentInput
) {
  const res = await fetch(base(`/lab-payment/${String(id)}`), {
    method: "PUT",
    credentials: "include",
    headers: headers(),
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function deleteLabPayment(id: string | number) {
  const res = await fetch(base(`/lab-payment/${String(id)}`), {
    method: "DELETE",
    credentials: "include",
    headers: headers(),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
