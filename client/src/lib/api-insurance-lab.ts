import { API_BASE_URL } from "@/lib/constants";

const base = (path: string) => new URL(`/api/insurance${path}`, API_BASE_URL).toString();
const headers = (): HeadersInit => {
  const h: HeadersInit = { "Content-Type": "application/json" };
  const tok = localStorage.getItem("user_session_backup"); // you used BACKUP_KEY before
  if (tok) h["x-session-token"] = tok;
  return h;
};

export async function getLabSummary(year: number, month: number) {
  const res = await fetch(base(`/lab-summary?year=${year}&month=${month}`), { credentials: "include", headers: headers() });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function setLabPortion(input: { periodYear: number; periodMonth: number; currency: string; amount: number; }) {
  const res = await fetch(base("/lab-portion"), {
    method: "POST", credentials: "include", headers: headers(), body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function addLabPayment(input: { payDate: string; periodYear: number; periodMonth: number; currency: string; amount: number; note?: string; }) {
  const res = await fetch(base("/lab-payment"), {
    method: "POST", credentials: "include", headers: headers(), body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function getLabPayments(year: number, month: number) {
  const res = await fetch(base(`/lab-payments?year=${year}&month=${month}`), { credentials: "include", headers: headers() });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
