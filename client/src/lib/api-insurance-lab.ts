import { API_BASE_URL } from "@/lib/constants";

const base = (path: string) =>
  new URL(`/api/insurance${path}`, API_BASE_URL).toString();

const headers = (): HeadersInit => {
  const h: HeadersInit = { "Content-Type": "application/json" };
  const tok = localStorage.getItem("user_session_backup"); // you used BACKUP_KEY before
  if (tok) h["x-session-token"] = tok;
  return h;
};

/* ---------------------------------------------------------------------- */
/* Existing functions                                                     */
/* ---------------------------------------------------------------------- */

export async function getLabSummary(year: number, month: number) {
  const res = await fetch(
    base(`/lab-summary?year=${year}&month=${month}`),
    { credentials: "include", headers: headers() }
  );
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
  const res = await fetch(
    base(`/lab-payments?year=${year}&month=${month}`),
    { credentials: "include", headers: headers() }
  );
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

/**
 * Update an existing lab payment.
 *
 * Assumes backend route:
 *   PUT /api/insurance/lab-payment/:id
 * Adjust the path if your API uses a different pattern.
 */
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

/**
 * Delete an existing lab payment.
 *
 * Assumes backend route:
 *   DELETE /api/insurance/lab-payment/:id
 * Adjust the path if your API uses a different pattern.
 */
export async function deleteLabPayment(id: string | number) {
  const res = await fetch(base(`/lab-payment/${String(id)}`), {
    method: "DELETE",
    credentials: "include",
    headers: headers(),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
