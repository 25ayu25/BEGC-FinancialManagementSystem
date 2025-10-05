import React, { useEffect, useMemo, useState } from "react";

/* ----------------------------- types ----------------------------- */
type Provider = { id: string; code: string; name: string; isActive: boolean };

type ClaimStatus =
  | "submitted"
  | "partially_paid"
  | "paid"
  | "rejected"
  | "written_off";

type Claim = {
  id: string;
  providerId: string;
  periodYear: number;
  periodMonth: number;
  periodStart: string;
  periodEnd: string;
  currency: "USD" | "SSP";
  claimedAmount: number | string;
  status: ClaimStatus;
  notes?: string | null;
  createdAt?: string;
};

type Payment = {
  id: string;
  providerId: string;
  claimId?: string | null;
  paymentDate: string;
  amount: number | string;
  currency: "USD" | "SSP";
  reference?: string | null;
  notes?: string | null;
  createdAt?: string;
};

/** Matches the server `/api/insurance-balances` response */
type BalancesResponse = {
  providers: Array<{
    providerId: string;
    providerName: string;
    claimed: number;   // total billed
    paid: number;      // total collected
    balance: number;   // outstanding
  }>;
  // per-claim ledger the API returns (via storage.getInsuranceBalances)
  claims: Array<{
    id: string;
    providerId: string;
    providerName: string;
    periodYear: number;
    periodMonth: number;
    periodStart: string;
    periodEnd: string;
    currency: "USD" | "SSP";
    claimedAmount: number;
    status: ClaimStatus;
    notes?: string | null;
    paidToDate: number;
    balance: number;
  }>;
};

/* ---------------------------- helpers ---------------------------- */
const money = (n: number | string, currency: "USD" | "SSP" = "USD") =>
  `${currency} ${Number(n || 0).toLocaleString("en-US", {
    maximumFractionDigits: 0,
  })}`;

const titleCase = (s: string) => s.replace(/(^|_)([a-z])/g, (_, b, c) => (b ? " " : "") + c.toUpperCase());

/** API base comes from Netlify env -> Vite -> client. Fallback = same-origin. */
const RAW_BASE =
  (typeof import.meta !== "undefined" && (import.meta as any).env?.VITE_API_URL) ||
  (typeof window !== "undefined" && (window as any).__API_URL__) ||
  "";

/** Join helper: handles empty base, trailing/leading slashes, and absolute URLs */
function toUrl(path: string) {
  if (/^https?:\/\//i.test(path)) return path;
  const base = String(RAW_BASE || "").replace(/\/+$/, "");
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${base}${p}`;
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(toUrl(path), {
    credentials: "include",
    headers: { "content-type": "application/json" },
    ...init,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    const msg = text || res.statusText || `HTTP ${res.status}`;
    const err = new Error(msg);
    (err as any).status = res.status;
    throw err;
  }
  return res.json();
}

/* ----------------------------- UI bits --------------------------- */

function StatusChip({ status }: { status: ClaimStatus }) {
  const styles: Record<ClaimStatus, string> = {
    submitted:
      "bg-amber-50 text-amber-700 ring-1 ring-amber-200",
    partially_paid:
      "bg-sky-50 text-sky-700 ring-1 ring-sky-200",
    paid:
      "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
    rejected:
      "bg-rose-50 text-rose-700 ring-1 ring-rose-200",
    written_off:
      "bg-slate-50 text-slate-600 ring-1 ring-slate-200",
  };
  return (
    <span
      title={{
        submitted: "Claim sent to provider, waiting for payment.",
        partially_paid: "Provider paid part of this claim.",
        paid: "Provider has fully paid this claim.",
        rejected: "Provider rejected this claim.",
        written_off: "We chose not to pursue this claim.",
      }[status]}
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${styles[status]}`}
    >
      {titleCase(status)}
    </span>
  );
}

function HelpPopover() {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="text-slate-500 hover:text-slate-700 text-sm"
        title="What do these numbers mean?"
      >
        ℹ️ Help
      </button>
      {open && (
        <div className="absolute z-20 mt-2 w-80 rounded-xl border bg-white p-3 text-sm shadow-lg">
          <div className="font-medium mb-1">How to read this page</div>
          <ul className="list-disc pl-5 space-y-1 text-slate-600">
            <li><strong>Billed</strong>: total amount we invoiced the provider.</li>
            <li><strong>Collected</strong>: money received from the provider.</li>
            <li><strong>Outstanding</strong>: amount still owed (Billed − Collected).</li>
            <li>Status shows where a claim is in the process (Submitted, Partially paid, Paid, etc.).</li>
          </ul>
          <div className="text-right mt-2">
            <button className="text-xs text-slate-500 hover:underline" onClick={() => setOpen(false)}>Close</button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------ Page ----------------------------- */

export default function InsurancePage() {
  // data
  const [providers, setProviders] = useState<Provider[]>([]);
  const [claims, setClaims] = useState<Claim[]>([]);
  const [balances, setBalances] = useState<BalancesResponse | null>(null);

  // filters
  const [providerId, setProviderId] = useState<string>("");
  const [status, setStatus] = useState<string>("");
  const [year, setYear] = useState<number | "">("");
  const [month, setMonth] = useState<number | "">("");

  // modals
  const [showClaim, setShowClaim] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [detailProviderId, setDetailProviderId] = useState<string>("");

  // auth notice (incognito / blocked cookies)
  const [authError, setAuthError] = useState(false);

  // form state (claim)
  const [cProviderId, setCProviderId] = useState<string>("");
  const [cYear, setCYear] = useState<number>(new Date().getUTCFullYear());
  const [cMonth, setCMonth] = useState<number>(new Date().getUTCMonth() + 1);
  const [cStart, setCStart] = useState<string>(() =>
    new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1))
      .toISOString()
      .slice(0, 10)
  );
  const [cEnd, setCEnd] = useState<string>(() =>
    new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth() + 1, 0))
      .toISOString()
      .slice(0, 10)
  );
  const [cCurrency, setCCurrency] = useState<"USD" | "SSP">("USD");
  const [cAmount, setCAmount] = useState<string>("0");
  const [cNotes, setCNotes] = useState<string>("");

  // form state (payment)
  const [pProviderId, setPProviderId] = useState<string>("");
  const [pClaimId, setPClaimId] = useState<string>("");
  const [pDate, setPDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [pAmount, setPAmount] = useState<string>("0");
  const [pCurrency, setPCurrency] = useState<"USD" | "SSP">("USD");
  const [pRef, setPRef] = useState<string>("");
  const [pNotes, setPNotes] = useState<string>("");

  /* --------------------------- effects --------------------------- */
  useEffect(() => {
    api<Provider[]>("/api/insurance-providers")
      .then((rows) => setProviders(rows.filter((p) => p.isActive)))
      .catch((e: any) => {
        console.error("providers", e);
        if (e?.status === 401) setAuthError(true);
      });
  }, []);

  const reloadClaims = () => {
    const params = new URLSearchParams();
    if (providerId) params.set("providerId", providerId);
    if (status) params.set("status", status);
    if (year) params.set("year", String(year));
    if (month) params.set("month", String(month));
    api<Claim[]>(`/api/insurance-claims?${params.toString()}`)
      .then(setClaims)
      .catch((e: any) => {
        console.error("claims", e);
        if (e?.status === 401) setAuthError(true);
      });
  };

  useEffect(reloadClaims, [providerId, status, year, month]);

  const reloadBalances = () => {
    const params = new URLSearchParams();
    if (providerId) params.set("providerId", providerId);
    api<BalancesResponse>(`/api/insurance-balances?${params.toString()}`)
      .then(setBalances)
      .catch((e: any) => {
        console.error("balances", e);
        if (e?.status === 401) setAuthError(true);
      });
  };

  useEffect(reloadBalances, [providerId]);

  // open claims for selected provider when recording a payment
  const openClaims = useMemo(
    () =>
      claims.filter(
        (c) =>
          c.status !== "paid" &&
          (!pProviderId || c.providerId === pProviderId)
      ),
    [claims, pProviderId]
  );

  // summary cards data (for current provider filter or all)
  const summary = useMemo(() => {
    const provRows = balances?.providers ?? [];
    const filtered = providerId
      ? provRows.filter((r) => r.providerId === providerId)
      : provRows;
    const billed = filtered.reduce((a, r) => a + Number(r.claimed || 0), 0);
    const collected = filtered.reduce((a, r) => a + Number(r.paid || 0), 0);
    const outstanding = filtered.reduce((a, r) => a + Number(r.balance || 0), 0);
    return { billed, collected, outstanding };
  }, [balances, providerId]);

  const selectedProvider = useMemo(
    () => providers.find((p) => p.id === providerId) || null,
    [providers, providerId]
  );

  const providerClaimsForDrawer = useMemo(() => {
    if (!balances) return [];
    const pid = detailProviderId || providerId;
    return balances.claims
      .filter((c) => (pid ? c.providerId === pid : true))
      .sort((a, b) =>
        a.periodYear !== b.periodYear
          ? b.periodYear - a.periodYear
          : b.periodMonth - a.periodMonth
      );
  }, [balances, detailProviderId, providerId]);

  /* ------------------------ create claim ------------------------ */
  async function submitClaim() {
    try {
      await api<Claim>("/api/insurance-claims", {
        method: "POST",
        body: JSON.stringify({
          providerId: cProviderId || providerId,
          periodYear: cYear,
          periodMonth: cMonth,
          periodStart: cStart,
          periodEnd: cEnd,
          currency: cCurrency,
          claimedAmount: Number(cAmount),
          notes: cNotes || undefined,
        }),
      });
      setShowClaim(false);
      reloadClaims();
      reloadBalances();
      alert("Claim saved");
    } catch (e: any) {
      alert(`Failed to save claim: ${e.message || e}`);
    }
  }

  /* ----------------------- record payment ----------------------- */
  async function submitPayment() {
    try {
      await api<Payment>("/api/insurance-payments", {
        method: "POST",
        body: JSON.stringify({
          providerId: pProviderId || providerId,
          claimId: pClaimId || undefined,
          paymentDate: pDate,
          amount: Number(pAmount),
          currency: pCurrency,
          reference: pRef || undefined,
          notes: pNotes || undefined,
        }),
      });
      setShowPayment(false);
      reloadBalances();
      alert("Payment recorded");
    } catch (e: any) {
      alert(`Failed to record payment: ${e.message || e}`);
    }
  }

  /* ----------------------------- UI ----------------------------- */
  return (
    <div className="p-6 max-w-[1200px] mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-semibold">Insurance Management</h1>
        <div className="flex items-center gap-4">
          <HelpPopover />
          <div className="space-x-2">
            <button
              onClick={() => {
                setCProviderId(providerId || "");
                setShowClaim(true);
              }}
              className="px-3 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700"
            >
              + Add Claim
            </button>
            <button
              onClick={() => {
                setPProviderId(providerId || "");
                setShowPayment(true);
              }}
              className="px-3 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700"
            >
              Record Payment
            </button>
          </div>
        </div>
      </div>

      {authError && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          Authentication required. If you’re in Incognito/Private mode, allow third-party cookies or sign in again.
        </div>
      )}

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
        <select
          value={providerId}
          onChange={(e) => setProviderId(e.target.value)}
          className="border rounded-lg p-2"
        >
          <option value="">All providers</option>
          {providers.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>

        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="border rounded-lg p-2"
        >
          <option value="">Any status</option>
          <option value="submitted">Submitted</option>
          <option value="partially_paid">Partially paid</option>
          <option value="paid">Paid</option>
          <option value="rejected">Rejected</option>
          <option value="written_off">Written off</option>
        </select>

        <input
          type="number"
          placeholder="Year"
          value={year}
          onChange={(e) =>
            setYear(e.target.value ? Number(e.target.value) : "")
          }
          className="border rounded-lg p-2"
        />
        <input
          type="number"
          placeholder="Month (1-12)"
          value={month}
          onChange={(e) =>
            setMonth(e.target.value ? Number(e.target.value) : "")
          }
          className="border rounded-lg p-2"
        />
      </div>

      {/* Summary row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
        <div className="rounded-xl border bg-white p-4">
          <div className="text-slate-500 text-sm">Billed</div>
          <div className="mt-1 text-xl font-semibold">{money(summary.billed, "USD")}</div>
          <div className="text-xs text-slate-500 mt-1">
            {selectedProvider ? selectedProvider.name : "All providers"}
          </div>
        </div>
        <div className="rounded-xl border bg-white p-4">
          <div className="text-slate-500 text-sm">Collected</div>
          <div className="mt-1 text-xl font-semibold">{money(summary.collected, "USD")}</div>
          <div className="text-xs text-slate-500 mt-1">Payments received</div>
        </div>
        <div className="rounded-xl border bg-white p-4">
          <div className="text-slate-500 text-sm">Outstanding</div>
          <div
            className={`mt-1 text-xl font-semibold ${
              summary.outstanding < 0 ? "text-emerald-700" : "text-slate-900"
            }`}
            title={summary.outstanding < 0 ? "We have a credit with provider" : "Amount still owed"}
          >
            {summary.outstanding < 0 ? `Credit ${money(Math.abs(summary.outstanding), "USD")}` : money(summary.outstanding, "USD")}
          </div>
          <div className="text-xs text-slate-500 mt-1">Billed − Collected</div>
        </div>
      </div>

      {/* Layout: left = claims table, right = balances */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Claims Table */}
        <div className="lg:col-span-2 bg-white rounded-xl border">
          <div className="px-4 py-3 border-b flex items-center justify-between">
            <div className="font-medium">Claims</div>
            <div className="text-sm text-slate-500">
              {claims.length} {claims.length === 1 ? "item" : "items"}
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="text-left p-3">Provider</th>
                  <th className="text-left p-3">Period</th>
                  <th className="text-left p-3">Billed</th>
                  <th className="text-left p-3">Status</th>
                  <th className="text-left p-3">Notes</th>
                </tr>
              </thead>
              <tbody>
                {claims.map((c) => {
                  const prov = providers.find((p) => p.id === c.providerId);
                  return (
                    <tr key={c.id} className="border-t">
                      <td className="p-3">{prov?.name || c.providerId}</td>
                      <td className="p-3">
                        {new Date(c.periodYear, c.periodMonth - 1).toLocaleString("en-US", {
                          month: "long",
                          year: "numeric",
                        })}
                      </td>
                      <td className="p-3">{money(c.claimedAmount, c.currency)}</td>
                      <td className="p-3">
                        <StatusChip status={c.status} />
                      </td>
                      <td className="p-3">{c.notes || ""}</td>
                    </tr>
                  );
                })}
                {claims.length === 0 && (
                  <tr>
                    <td colSpan={5} className="p-6 text-center text-slate-500">
                      No claims yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Balances */}
        <div className="bg-white rounded-xl border">
          <div className="px-4 py-3 border-b font-medium">Provider Balances</div>
          <div className="p-4 space-y-3">
            {!balances && <div className="text-slate-500">Loading…</div>}
            {balances?.providers.map((row) => (
              <div key={row.providerId} className="border rounded-lg p-3">
                <div className="flex items-center justify-between">
                  <div className="font-medium">{row.providerName}</div>
                  <button
                    onClick={() => {
                      setDetailProviderId(row.providerId);
                    }}
                    className="text-sm text-indigo-600 hover:underline"
                  >
                    View details
                  </button>
                </div>
                <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
                  <div className="bg-slate-50 rounded p-2">
                    <div className="text-slate-500">Billed</div>
                    <div className="font-semibold">{money(row.claimed, "USD")}</div>
                  </div>
                  <div className="bg-slate-50 rounded p-2">
                    <div className="text-slate-500">Collected</div>
                    <div className="font-semibold">{money(row.paid, "USD")}</div>
                  </div>
                  <div className="bg-slate-50 rounded p-2">
                    <div className="text-slate-500">Outstanding</div>
                    <div
                      className={`font-semibold ${
                        row.balance < 0 ? "text-emerald-700" : ""
                      }`}
                    >
                      {row.balance < 0
                        ? `Credit ${money(Math.abs(row.balance), "USD")}`
                        : money(row.balance, "USD")}
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {balances && balances.providers.length === 0 && (
              <div className="text-slate-500">No balances yet.</div>
            )}
          </div>
        </div>
      </div>

      {/* ---------------------- Provider details drawer ---------------------- */}
      {detailProviderId && (
        <div className="fixed inset-0 z-40">
          <div
            className="absolute inset-0 bg-black/30"
            onClick={() => setDetailProviderId("")}
          />
          <div className="absolute right-0 top-0 h-full w-full max-w-xl bg-white shadow-2xl border-l z-50 flex flex-col">
            <div className="px-4 py-3 border-b flex items-center justify-between">
              <div className="font-medium">
                {providers.find((p) => p.id === detailProviderId)?.name ||
                  "Provider"}
                : details
              </div>
              <button
                className="text-slate-500"
                onClick={() => setDetailProviderId("")}
              >
                ✕
              </button>
            </div>
            <div className="p-4 overflow-y-auto">
              {!balances && <div className="text-slate-500">Loading…</div>}
              {balances && (
                <>
                  <div className="grid grid-cols-3 gap-3 mb-4">
                    {(() => {
                      const prov =
                        balances.providers.find(
                          (r) => r.providerId === detailProviderId
                        ) || {
                          claimed: 0,
                          paid: 0,
                          balance: 0,
                        };
                      return (
                        <>
                          <div className="rounded-lg border p-3">
                            <div className="text-xs text-slate-500">Billed</div>
                            <div className="font-semibold">
                              {money(prov.claimed, "USD")}
                            </div>
                          </div>
                          <div className="rounded-lg border p-3">
                            <div className="text-xs text-slate-500">Collected</div>
                            <div className="font-semibold">
                              {money(prov.paid, "USD")}
                            </div>
                          </div>
                          <div className="rounded-lg border p-3">
                            <div className="text-xs text-slate-500">Outstanding</div>
                            <div
                              className={`font-semibold ${
                                prov.balance < 0 ? "text-emerald-700" : ""
                              }`}
                            >
                              {prov.balance < 0
                                ? `Credit ${money(Math.abs(prov.balance), "USD")}`
                                : money(prov.balance, "USD")}
                            </div>
                          </div>
                        </>
                      );
                    })()}
                  </div>

                  <div className="text-sm text-slate-600 mb-2">
                    {providerClaimsForDrawer.length}{" "}
                    {providerClaimsForDrawer.length === 1 ? "claim" : "claims"}
                  </div>

                  <div className="divide-y border rounded-lg">
                    {providerClaimsForDrawer.map((c) => (
                      <div key={c.id} className="p-3">
                        <div className="flex items-center justify-between">
                          <div className="font-medium">
                            {new Date(
                              c.periodYear,
                              c.periodMonth - 1
                            ).toLocaleString("en-US", {
                              month: "long",
                              year: "numeric",
                            })}
                          </div>
                          <StatusChip status={c.status} />
                        </div>
                        <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
                          <div className="bg-slate-50 rounded p-2">
                            <div className="text-slate-500">Billed</div>
                            <div className="font-semibold">
                              {money(c.claimedAmount, c.currency)}
                            </div>
                          </div>
                          <div className="bg-slate-50 rounded p-2">
                            <div className="text-slate-500">Collected</div>
                            <div className="font-semibold">
                              {money(c.paidToDate, c.currency)}
                            </div>
                          </div>
                          <div className="bg-slate-50 rounded p-2">
                            <div className="text-slate-500">Outstanding</div>
                            <div className="font-semibold">
                              {money(c.balance, c.currency)}
                            </div>
                          </div>
                        </div>
                        <div className="mt-2 flex items-center justify-between">
                          <div className="text-xs text-slate-500">
                            {c.notes || ""}
                          </div>
                          <button
                            className="text-xs px-2 py-1 rounded-md bg-indigo-600 text-white"
                            onClick={() => {
                              setDetailProviderId("");
                              setPProviderId(c.providerId);
                              setPClaimId(c.id);
                              setShowPayment(true);
                            }}
                          >
                            Record payment
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* --------------------------- Add Claim --------------------------- */}
      {showClaim && (
        <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-xl shadow-lg">
            <div className="px-4 py-3 border-b flex items-center justify-between">
              <div className="font-medium">Add Claim</div>
              <button
                className="text-slate-500"
                onClick={() => setShowClaim(false)}
              >
                ✕
              </button>
            </div>
            <div className="p-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-500 mb-1">
                    Provider
                  </label>
                  <select
                    className="border rounded-lg p-2 w-full"
                    value={cProviderId}
                    onChange={(e) => setCProviderId(e.target.value)}
                  >
                    <option value="">Select…</option>
                    {providers.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">
                    Currency
                  </label>
                  <select
                    className="border rounded-lg p-2 w-full"
                    value={cCurrency}
                    onChange={(e) => setCCurrency(e.target.value as any)}
                  >
                    <option value="USD">USD</option>
                    <option value="SSP">SSP</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">
                    Year
                  </label>
                  <input
                    type="number"
                    className="border rounded-lg p-2 w-full"
                    value={cYear}
                    onChange={(e) => setCYear(Number(e.target.value))}
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">
                    Month
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={12}
                    className="border rounded-lg p-2 w-full"
                    value={cMonth}
                    onChange={(e) => setCMonth(Number(e.target.value))}
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">
                    Period Start
                  </label>
                  <input
                    type="date"
                    className="border rounded-lg p-2 w-full"
                    value={cStart}
                    onChange={(e) => setCStart(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">
                    Period End
                  </label>
                  <input
                    type="date"
                    className="border rounded-lg p-2 w-full"
                    value={cEnd}
                    onChange={(e) => setCEnd(e.target.value)}
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs text-slate-500 mb-1">
                    Billed Amount
                  </label>
                  <input
                    type="number"
                    min="0"
                    className="border rounded-lg p-2 w-full"
                    value={cAmount}
                    onChange={(e) => setCAmount(e.target.value)}
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs text-slate-500 mb-1">
                    Notes (optional)
                  </label>
                  <textarea
                    className="border rounded-lg p-2 w-full"
                    rows={2}
                    value={cNotes}
                    onChange={(e) => setCNotes(e.target.value)}
                  />
                </div>
              </div>
            </div>
            <div className="px-4 py-3 border-t flex justify-end gap-2">
              <button
                className="px-3 py-2 rounded-lg border"
                onClick={() => setShowClaim(false)}
              >
                Cancel
              </button>
              <button
                className="px-3 py-2 rounded-lg bg-emerald-600 text-white"
                onClick={submitClaim}
              >
                Save Claim
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------- Record Payment ------------------------ */}
      {showPayment && (
        <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-xl shadow-lg">
            <div className="px-4 py-3 border-b flex items-center justify-between">
              <div className="font-medium">Record Payment</div>
              <button
                className="text-slate-500"
                onClick={() => setShowPayment(false)}
              >
                ✕
              </button>
            </div>
            <div className="p-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-500 mb-1">
                    Provider
                  </label>
                  <select
                    className="border rounded-lg p-2 w-full"
                    value={pProviderId}
                    onChange={(e) => setPProviderId(e.target.value)}
                  >
                    <option value="">Select…</option>
                    {providers.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">
                    Link to Claim (optional)
                  </label>
                  <select
                    className="border rounded-lg p-2 w-full"
                    value={pClaimId}
                    onChange={(e) => setPClaimId(e.target.value)}
                  >
                    <option value="">— None —</option>
                    {openClaims.map((c) => (
                      <option key={c.id} value={c.id}>
                        {new Date(c.periodYear, c.periodMonth - 1).toLocaleString(
                          "en-US",
                          { month: "short", year: "numeric" }
                        )}{" "}
                        — {money(c.claimedAmount, c.currency)}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">
                    Payment Date
                  </label>
                  <input
                    type="date"
                    className="border rounded-lg p-2 w-full"
                    value={pDate}
                    onChange={(e) => setPDate(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">
                    Currency
                  </label>
                  <select
                    className="border rounded-lg p-2 w-full"
                    value={pCurrency}
                    onChange={(e) => setPCurrency(e.target.value as any)}
                  >
                    <option value="USD">USD</option>
                    <option value="SSP">SSP</option>
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="block text-xs text-slate-500 mb-1">
                    Amount Received
                  </label>
                  <input
                    type="number"
                    min="0"
                    className="border rounded-lg p-2 w-full"
                    value={pAmount}
                    onChange={(e) => setPAmount(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">
                    Reference (optional)
                  </label>
                  <input
                    className="border rounded-lg p-2 w-full"
                    value={pRef}
                    onChange={(e) => setPRef(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">
                    Notes (optional)
                  </label>
                  <input
                    className="border rounded-lg p-2 w-full"
                    value={pNotes}
                    onChange={(e) => setPNotes(e.target.value)}
                  />
                </div>
              </div>
            </div>
            <div className="px-4 py-3 border-t flex justify-end gap-2">
              <button
                className="px-3 py-2 rounded-lg border"
                onClick={() => setShowPayment(false)}
              >
                Cancel
              </button>
              <button
                className="px-3 py-2 rounded-lg bg-indigo-600 text-white"
                onClick={submitPayment}
              >
                Record Payment
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
