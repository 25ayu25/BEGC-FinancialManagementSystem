import React, { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/queryClient";
import { useRequireAuth } from "@/hooks/use-require-auth";

/* ----------------------------- types ----------------------------- */
type Provider = { id: string; code: string; name: string; isActive: boolean };

type ClaimStatus = "submitted" | "partially_paid" | "paid" | "rejected" | "written_off";

type Claim = {
  id: string;
  providerId: string;
  periodYear: number;
  periodMonth: number;
  periodStart: string;
  periodEnd: string;
  currency: "USD" | "SSP";
  claimedAmount: number | string; // backend field; shown as "Billed" in UI
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

type BalancesResponse = {
  providers: Array<{
    providerId: string;
    providerName: string;
    claimed: number; // sum of claim.claimedAmount
    paid: number;    // sum of payments.amount
    balance: number; // claimed - paid
  }>;
  // server also returns "claims", but we don't need it here
};

/* ---------------------------- helpers ---------------------------- */
const money = (n: number | string, currency = "USD") =>
  `${currency} ${Number(n || 0).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;

const niceStatus: Record<ClaimStatus, string> = {
  submitted: "Submitted",
  partially_paid: "Partially paid",
  paid: "Paid",
  rejected: "Rejected",
  written_off: "Written off",
};

function statusClass(s: ClaimStatus) {
  switch (s) {
    case "submitted":
      return "bg-amber-50 text-amber-700 ring-amber-200";
    case "partially_paid":
      return "bg-indigo-50 text-indigo-700 ring-indigo-200";
    case "paid":
      return "bg-emerald-50 text-emerald-700 ring-emerald-200";
    case "rejected":
      return "bg-rose-50 text-rose-700 ring-rose-200";
    case "written_off":
      return "bg-slate-100 text-slate-700 ring-slate-200";
    default:
      return "bg-slate-100 text-slate-700 ring-slate-200";
  }
}

/* ------------------------------ Page ----------------------------- */

export default function InsurancePage() {
  useRequireAuth(); // 🔒 redirect to /login when 401

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

  // Active providers only (server already filters, but be safe)
  useEffect(() => {
    api
      .get<Provider[]>("/api/insurance-providers")
      .then((res) => {
        const active = (res.data || []).filter((p) => p.isActive);
        // sort A→Z for nicer UX
        active.sort((a, b) => a.name.localeCompare(b.name));
        setProviders(active);
      })
      .catch((e) => console.error("providers Error:", e));
  }, []);

  const reloadClaims = () => {
    const params = new URLSearchParams();
    if (providerId) params.set("providerId", providerId);
    if (status) params.set("status", status);
    if (year) params.set("year", String(year));
    if (month) params.set("month", String(month));

    api
      .get<Claim[]>(`/api/insurance-claims?${params.toString()}`)
      .then((res) => setClaims(res.data || []))
      .catch((e) => console.error("claims Error:", e));
  };

  useEffect(reloadClaims, [providerId, status, year, month]);

  const reloadBalances = () => {
    const params = new URLSearchParams();
    if (providerId) params.set("providerId", providerId);

    api
      .get<BalancesResponse>(`/api/insurance-balances?${params.toString()}`)
      .then((res) => setBalances(res.data))
      .catch((e) => console.error("balances Error:", e));
  };

  useEffect(reloadBalances, [providerId]);

  // claims for selected provider when recording a payment
  const openClaims = useMemo(
    () => claims.filter((c) => c.status !== "paid" && (!pProviderId || c.providerId === pProviderId)),
    [claims, pProviderId]
  );

  // filter balances to ACTIVE providers only (to match dropdown)
  const activeProviderIds = useMemo(() => new Set(providers.map((p) => p.id)), [providers]);
  const visibleBalances = useMemo(
    () =>
      (balances?.providers || [])
        .filter((row) => activeProviderIds.has(row.providerId))
        .sort((a, b) => a.providerName.localeCompare(b.providerName)),
    [balances, activeProviderIds]
  );

  /* ------------------------ create claim ------------------------ */
  async function submitClaim() {
    try {
      await api.post<Claim>("/api/insurance-claims", {
        providerId: cProviderId || providerId,
        periodYear: cYear,
        periodMonth: cMonth,
        periodStart: cStart,
        periodEnd: cEnd,
        currency: cCurrency,
        claimedAmount: Number(cAmount),
        notes: cNotes || undefined,
      });
      setShowClaim(false);
      reloadClaims();
      reloadBalances();
      alert("Claim saved");
    } catch (e: any) {
      alert(`Failed to save claim: ${e.response?.data?.error || e.message || e}`);
    }
  }

  /* ----------------------- record payment ----------------------- */
  async function submitPayment() {
    try {
      await api.post<Payment>("/api/insurance-payments", {
        providerId: pProviderId || providerId,
        claimId: pClaimId || undefined,
        paymentDate: pDate,
        amount: Number(pAmount),
        currency: pCurrency,
        reference: pRef || undefined,
        notes: pNotes || undefined,
      });
      setShowPayment(false);
      reloadBalances();
      reloadClaims(); // update claim statuses if a claim got fully paid
      alert("Payment recorded");
    } catch (e: any) {
      alert(`Failed to record payment: ${e.response?.data?.error || e.message || e}`);
    }
  }

  /* ----------------------------- UI ----------------------------- */
  return (
    <div className="p-6 max-w-[1200px] mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">Insurance Management</h1>
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

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-6">
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

        <select value={status} onChange={(e) => setStatus(e.target.value)} className="border rounded-lg p-2">
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
          onChange={(e) => setYear(e.target.value ? Number(e.target.value) : "")}
          className="border rounded-lg p-2"
        />
        <input
          type="number"
          placeholder="Month (1-12)"
          value={month}
          onChange={(e) => setMonth(e.target.value ? Number(e.target.value) : "")}
          className="border rounded-lg p-2"
        />
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
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs ring-1 ${statusClass(
                            c.status
                          )}`}
                        >
                          {niceStatus[c.status]}
                        </span>
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

        {/* Provider Balances */}
        <div className="bg-white rounded-xl border">
          <div className="px-4 py-3 border-b font-medium">Provider Balances</div>
          <div className="p-4 space-y-3">
            {!balances && <div className="text-slate-500">Loading…</div>}

            {visibleBalances.map((row) => {
              const outstanding = Number(row.balance);
              const overpaid = outstanding < 0;
              const badge =
                overpaid ? (
                  <div className="font-semibold text-emerald-700">{`Overpaid ${money(
                    Math.abs(outstanding)
                  )}`}</div>
                ) : (
                  <div className="font-semibold text-amber-700">{money(outstanding)}</div>
                );

              return (
                <div key={row.providerId} className="border rounded-lg p-3">
                  <div className="flex items-center justify-between">
                    <div className="font-medium">{row.providerName}</div>
                    <button
                      onClick={() => setProviderId(row.providerId)}
                      className="text-sm text-indigo-600 hover:underline"
                    >
                      View details
                    </button>
                  </div>
                  <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
                    <div className="bg-slate-50 rounded p-2">
                      <div className="text-slate-500">Billed</div>
                      <div className="font-semibold">{money(row.claimed)}</div>
                    </div>
                    <div className="bg-slate-50 rounded p-2">
                      <div className="text-slate-500">Collected</div>
                      <div className="font-semibold">{money(row.paid)}</div>
                    </div>
                    <div className="bg-slate-50 rounded p-2">
                      <div className="text-slate-500">{overpaid ? "Status" : "Outstanding"}</div>
                      {badge}
                    </div>
                  </div>
                </div>
              );
            })}

            {balances && visibleBalances.length === 0 && (
              <div className="text-slate-500">No balances to show.</div>
            )}
          </div>
        </div>
      </div>

      {/* --------------------------- Add Claim --------------------------- */}
      {showClaim && (
        <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-xl shadow-lg">
            <div className="px-4 py-3 border-b flex items-center justify-between">
              <div className="font-medium">Add Claim</div>
              <button className="text-slate-500" onClick={() => setShowClaim(false)}>
                ✕
              </button>
            </div>
            <div className="p-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Provider</label>
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
                  <label className="block text-xs text-slate-500 mb-1">Currency</label>
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
                  <label className="block text-xs text-slate-500 mb-1">Year</label>
                  <input
                    type="number"
                    className="border rounded-lg p-2 w-full"
                    value={cYear}
                    onChange={(e) => setCYear(Number(e.target.value))}
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Month</label>
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
                  <label className="block text-xs text-slate-500 mb-1">Period Start</label>
                  <input
                    type="date"
                    className="border rounded-lg p-2 w-full"
                    value={cStart}
                    onChange={(e) => setCStart(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Period End</label>
                  <input
                    type="date"
                    className="border rounded-lg p-2 w-full"
                    value={cEnd}
                    onChange={(e) => setCEnd(e.target.value)}
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs text-slate-500 mb-1">Billed Amount</label>
                  <input
                    type="number"
                    min="0"
                    className="border rounded-lg p-2 w-full"
                    value={cAmount}
                    onChange={(e) => setCAmount(e.target.value)}
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs text-slate-500 mb-1">Notes (optional)</label>
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
              <button className="px-3 py-2 rounded-lg border" onClick={() => setShowClaim(false)}>
                Cancel
              </button>
              <button className="px-3 py-2 rounded-lg bg-emerald-600 text-white" onClick={submitClaim}>
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
              <button className="text-slate-500" onClick={() => setShowPayment(false)}>
                ✕
              </button>
            </div>
            <div className="p-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Provider</label>
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
                  <label className="block text-xs text-slate-500 mb-1">Link to Claim (optional)</label>
                  <select
                    className="border rounded-lg p-2 w-full"
                    value={pClaimId}
                    onChange={(e) => setPClaimId(e.target.value)}
                  >
                    <option value="">— None —</option>
                    {openClaims.map((c) => (
                      <option key={c.id} value={c.id}>
                        {new Date(c.periodYear, c.periodMonth - 1).toLocaleString("en-US", {
                          month: "short",
                          year: "numeric",
                        })}{" "}
                        — {money(c.claimedAmount, c.currency)}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Payment Date</label>
                  <input
                    type="date"
                    className="border rounded-lg p-2 w-full"
                    value={pDate}
                    onChange={(e) => setPDate(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Currency</label>
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
                  <label className="block text-xs text-slate-500 mb-1">Amount Received</label>
                  <input
                    type="number"
                    min="0"
                    className="border rounded-lg p-2 w-full"
                    value={pAmount}
                    onChange={(e) => setPAmount(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Reference (optional)</label>
                  <input
                    className="border rounded-lg p-2 w-full"
                    value={pRef}
                    onChange={(e) => setPRef(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Notes (optional)</label>
                  <input
                    className="border rounded-lg p-2 w-full"
                    value={pNotes}
                    onChange={(e) => setPNotes(e.target.value)}
                  />
                </div>
              </div>
            </div>
            <div className="px-4 py-3 border-t flex justify-end gap-2">
              <button className="px-3 py-2 rounded-lg border" onClick={() => setShowPayment(false)}>
                Cancel
              </button>
              <button className="px-3 py-2 rounded-lg bg-indigo-600 text-white" onClick={submitPayment}>
                Record Payment
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
