// client/src/pages/insurance.tsx
import React, { useEffect, useMemo, useState } from "react";

/* ----------------------------- types ----------------------------- */
type Provider = { id: string; code: string; name: string; isActive: boolean };

type ClaimStatus = "submitted" | "partially_paid" | "paid";

type Claim = {
  id: string;
  providerId: string;
  periodYear: number;
  periodMonth: number;
  periodStart: string; // ISO
  periodEnd: string;   // ISO
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
  paymentDate: string | null; // ISO or null
  amount: number | string;
  currency: "USD" | "SSP";
  reference?: string | null;
  notes?: string | null;
  createdAt?: string | null; // when staff recorded it
};

type BalancesResponse = {
  providers: Array<{
    providerId: string;
    providerName: string;
    claimed: number;   // billed in window
    paid: number;      // collected in window
  }>;
  claims: Array<
    Claim & {
      providerName: string;
      paidToDate: number;
      balance: number;
    }
  >;
};

/* ---------------------------- helpers ---------------------------- */
const money = (n: number | string, currency: "USD" | "SSP" = "USD") =>
  `${currency} ${Number(n || 0).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;

const titleCase = (s: string) =>
  s.replace(/(^|_)([a-z])/g, (_, b, c) => (b ? " " : "") + c.toUpperCase());

const RAW_BASE =
  (typeof import.meta !== "undefined" && (import.meta as any).env?.VITE_API_URL) ||
  (typeof window !== "undefined" && (window as any).__API_URL__) ||
  "";

function toUrl(path: string) {
  if (/^https?:\/\//i.test(path)) return path;
  const base = String(RAW_BASE || "").replace(/\/+$/, "");
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${base}${p}`;
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers || {});
  headers.set("content-type", "application/json");
  if (typeof window !== "undefined") {
    const backup = localStorage.getItem("user_session_backup");
    if (backup) headers.set("x-session-token", backup);
  }
  const res = await fetch(toUrl(path), { credentials: "include", ...init, headers });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    const err = new Error(txt || res.statusText || `HTTP ${res.status}`);
    (err as any).status = res.status;
    throw err;
  }
  return res.json();
}

function safeFmtDate(d: string | null | undefined) {
  if (!d) return "—";
  const t = Date.parse(d);
  if (!Number.isFinite(t)) return "—";
  return new Date(t).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

/* ----------------------------- provider order ----------------------------- */
const PROVIDER_ORDER = ["CIC", "CIGNA", "UAP", "New Sudan", "Nile International", "Other"];
const rank = (name: string) => {
  const i = PROVIDER_ORDER.indexOf((name || "").trim());
  return i === -1 ? 999 : i;
};

/* ----------------------------- UI bits --------------------------- */
function StatusChip({ status }: { status: ClaimStatus }) {
  const styles: Record<ClaimStatus, string> = {
    submitted: "bg-amber-50 text-amber-700 ring-1 ring-amber-200",
    partially_paid: "bg-sky-50 text-sky-700 ring-1 ring-sky-200",
    paid: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
  };
  const titles: Record<ClaimStatus, string> = {
    submitted: "Claim sent to provider, waiting for payment.",
    partially_paid: "Provider paid part of this claim.",
    paid: "Provider has fully paid this claim.",
  };
  return (
    <span
      title={titles[status]}
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
        className="px-3 py-2 rounded-lg border hover:bg-slate-50 text-sm"
        title="What do these numbers mean?"
      >
        ℹ︎ Help
      </button>
      {open && (
        <div className="absolute right-0 z-20 mt-2 w-80 rounded-xl border bg-white p-3 text-sm shadow-lg">
          <div className="font-medium mb-1">How to read this page</div>
          <ul className="list-disc pl-5 space-y-1 text-slate-600">
            <li><strong>Billed</strong>: claims in the current window.</li>
            <li><strong>Collected</strong>: payments received in the window.</li>
            <li><strong>Outstanding</strong>: Billed − Collected.</li>
          </ul>
          <div className="text-right mt-2">
            <button className="text-xs text-slate-500 hover:underline" onClick={() => setOpen(false)}>Close</button>
          </div>
        </div>
      )}
    </div>
  );
}

function ProgressRing({ billed, paid, balance }: { billed: number; paid: number; balance: number }) {
  const pct = billed > 0 ? Math.min(100, Math.max(0, Math.round((paid / billed) * 100))) : 0;
  const label = balance < 0 ? "CR" : `${pct}%`;
  const sweep = Math.round((balance < 0 ? 100 : pct) * 3.6);
  return (
    <div className="relative h-10 w-10 shrink-0">
      {/* bolder emerald and faint track */}
      <div
        className="absolute inset-0 rounded-full"
        style={{ background: `conic-gradient(#059669 ${sweep}deg, #e5e7eb 0deg)` }}
      />
      <div className="absolute inset-[3px] rounded-full bg-white flex items-center justify-center text-[10px] font-semibold text-slate-700">
        {label}
      </div>
    </div>
  );
}

function exportClaimsCsv(rows: Claim[], providers: Provider[]) {
  const byId = new Map(providers.map((p) => [p.id, p.name]));
  const header = ["Provider","Year","Month","Currency","Billed","Status","Notes"].join(",");
  const body = rows.map((c) =>
    [
      (byId.get(c.providerId) || c.providerId).replace(/,/g, " "),
      c.periodYear,
      c.periodMonth,
      c.currency,
      Number(c.claimedAmount),
      c.status,
      (c.notes || "").replace(/[\r\n,]+/g, " "),
    ].join(",")
  );
  const csv = [header, ...body].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "insurance-claims.csv";
  a.click();
  URL.revokeObjectURL(a.href);
}

/* ------------------------------ Page ----------------------------- */
type WindowPreset = "all" | "ytd" | "year-2025" | "year-2024" | "year-2023" | "year-2022" | "custom";

export default function InsurancePage() {
  // data
  const [providers, setProviders] = useState<Provider[]>([]);
  const [claims, setClaims] = useState<Claim[]>([]);
  const [balances, setBalances] = useState<BalancesResponse | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loadingPayments, setLoadingPayments] = useState(false);
  const [loadingClaims, setLoadingClaims] = useState(false);
  const [loadingBalances, setLoadingBalances] = useState(false);

  // filters
  const [providerId, setProviderId] = useState<string>("");
  const [status, setStatus] = useState<string>(""); // "", submitted, partially_paid, paid

  // default window = current year
  const currentYear = new Date().getUTCFullYear();
  const [preset, setPreset] = useState<WindowPreset>(("year-" + currentYear) as WindowPreset);
  const [start, setStart] = useState<string>(() => new Date(Date.UTC(currentYear, 0, 1)).toISOString().slice(0,10));
  const [end, setEnd] = useState<string>(() => new Date(Date.UTC(currentYear, 11, 31)).toISOString().slice(0,10));

  // modals & drawer
  const [showClaim, setShowClaim] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [detailProviderId, setDetailProviderId] = useState<string>("");

  // editing (Edit actions removed; keep ID just to reuse modal header text if needed)
  const [editingClaimId, setEditingClaimId] = useState<string>("");
  const [editingPaymentId, setEditingPaymentId] = useState<string>("");

  const [authError, setAuthError] = useState(false);

  // Add-Claim form (period fields hidden but still sent as current month)
  const [cProviderId, setCProviderId] = useState<string>("");
  const [cStart, setCStart] = useState<string>(() =>
    new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1)).toISOString().slice(0,10)
  );
  const [cEnd, setCEnd] = useState<string>(() =>
    new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth() + 1, 0)).toISOString().slice(0,10)
  );
  const [cCurrency, setCCurrency] = useState<"USD" | "SSP">("USD");
  const [cAmount, setCAmount] = useState<string>("0");
  const [cNotes, setCNotes] = useState<string>("");

  // Payment form (link-to-claim & reference removed)
  const [pProviderId, setPProviderId] = useState<string>("");
  const [pDate, setPDate] = useState<string>(() => new Date().toISOString().slice(0,10));
  const [pAmount, setPAmount] = useState<string>("0");
  const [pCurrency, setPCurrency] = useState<"USD" | "SSP">("USD");
  const [pNotes, setPNotes] = useState<string>("");

  /* --------------------------- date helpers --------------------------- */
  function setPresetWindow(p: WindowPreset) {
    setPreset(p);
    if (p === "all") {
      setStart(""); setEnd("");
      return;
    }
    const now = new Date();
    const yearOf = (y: number) => {
      const s = new Date(Date.UTC(y, 0, 1)).toISOString().slice(0,10);
      const e = new Date(Date.UTC(y, 11, 31)).toISOString().slice(0,10);
      setStart(s); setEnd(e);
    };
    if (p === "ytd") {
      const y = now.getUTCFullYear();
      setStart(new Date(Date.UTC(y,0,1)).toISOString().slice(0,10));
      setEnd(new Date(Date.UTC(y,11,31)).toISOString().slice(0,10));
      return;
    }
    if (p.startsWith("year-")) {
      const y = Number(p.replace("year-",""));
      yearOf(y);
      return;
    }
    // custom -> keep manual start/end
  }

  /* --------------------------- effects --------------------------- */
  useEffect(() => {
    api<Provider[]>("/api/insurance-providers")
      .then((rows) =>
        setProviders(
          rows
            .filter((p) => p.isActive)
            .sort((a, b) => rank(a.name) - rank(b.name) || a.name.localeCompare(b.name))
        )
      )
      .catch((e: any) => { console.error("providers", e); if (e?.status === 401) setAuthError(true); });
  }, []);

  function windowParams(qs = new URLSearchParams()) {
    if (start) qs.set("start", start);
    if (end) qs.set("end", end);
    return qs;
  }

  const reloadClaims = () => {
    setLoadingClaims(true);
    const params = windowParams(new URLSearchParams());
    if (providerId) params.set("providerId", providerId);
    if (status) params.set("status", status);
    api<Claim[]>(`/api/insurance-claims?${params.toString()}`)
      .then(setClaims)
      .catch((e: any) => { console.error("claims", e); if (e?.status === 401) setAuthError(true); })
      .finally(() => setLoadingClaims(false));
  };

  const reloadBalances = () => {
    setLoadingBalances(true);
    const params = windowParams(new URLSearchParams());
    if (providerId) params.set("providerId", providerId);
    api<BalancesResponse>(`/api/insurance-balances?${params.toString()}`)
      .then(setBalances)
      .catch((e: any) => { console.error("balances", e); if (e?.status === 401) setAuthError(true); })
      .finally(() => setLoadingBalances(false));
  };

  useEffect(reloadClaims, [providerId, status, start, end]);
  useEffect(reloadBalances, [providerId, start, end]);

  // when opening provider drawer, show full payment history (no window)
  useEffect(() => {
    if (!detailProviderId) return;
    setLoadingPayments(true);
    const qs = new URLSearchParams({ providerId: detailProviderId });
    api<Payment[]>(`/api/insurance-payments?${qs.toString()}`)
      .then(setPayments)
      .catch(() => setPayments([]))
      .finally(() => setLoadingPayments(false));
  }, [detailProviderId]);

  const openClaims = useMemo(
    () => claims.filter((c) => c.status !== "paid" && (!pProviderId || c.providerId === pProviderId)),
    [claims, pProviderId]
  );

  // summary: NO carry forward; Outstanding = Billed - Collected
  const summary = useMemo(() => {
    const provRows = balances?.providers ?? [];
    const filtered = providerId ? provRows.filter((r) => r.providerId === providerId) : provRows;
    const billed = filtered.reduce((a, r) => a + Number(r.claimed || 0), 0);
    const collected = filtered.reduce((a, r) => a + Number(r.paid || 0), 0);
    const outstanding = billed - collected;
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
        a.periodYear !== b.periodYear ? b.periodYear - a.periodYear : b.periodMonth - a.periodMonth
      );
  }, [balances, detailProviderId, providerId]);

  // keep provider order consistent on balances list too
  const orderedBalanceProviders = useMemo(
    () =>
      (balances?.providers ?? [])
        .slice()
        .sort((a, b) => rank(a.providerName) - rank(b.providerName) || a.providerName.localeCompare(b.providerName)),
    [balances]
  );

  /* ------------------------ create / edit claim ------------------------ */
  function hydrateClaimForm(c: Claim) {
    setCProviderId(c.providerId);
    setCStart(c.periodStart.slice(0,10));
    setCEnd(c.periodEnd.slice(0,10));
    setCCurrency(c.currency);
    setCAmount(String(c.claimedAmount));
    setCNotes(c.notes || "");
  }

  async function submitClaim() {
    const body = {
      providerId: cProviderId || providerId,
      periodStart: cStart, // hidden, defaults to current month
      periodEnd: cEnd,     // hidden, defaults to current month
      currency: cCurrency,
      claimedAmount: Number(cAmount),
      notes: cNotes || undefined,
    };
    try {
      if (editingClaimId) {
        await api<Claim>(`/api/insurance-claims/${editingClaimId}`, { method: "PATCH", body: JSON.stringify(body) });
      } else {
        await api<Claim>("/api/insurance-claims", { method: "POST", body: JSON.stringify(body) });
      }
      setShowClaim(false);
      setEditingClaimId("");
      reloadClaims();
      reloadBalances();
      alert("Claim saved");
    } catch (e: any) {
      alert(`Failed to save claim: ${e.message || e}`);
    }
  }

  async function deleteClaim(id: string) {
    if (!confirm("Delete this claim? This cannot be undone.")) return;
    try {
      await api(`/api/insurance-claims/${id}`, { method: "DELETE" });
      reloadClaims();
      reloadBalances();
      if (detailProviderId) {
        const qs = new URLSearchParams({ providerId: detailProviderId });
        setLoadingPayments(true);
        api<Payment[]>(`/api/insurance-payments?${qs.toString()}`)
          .then(setPayments)
          .finally(() => setLoadingPayments(false));
      }
    } catch (e: any) {
      alert(`Failed to delete claim: ${e.message || e}`);
    }
  }

  /* ----------------------- create / edit payment ----------------------- */
  async function submitPayment() {
    const body = {
      providerId: pProviderId || providerId,
      paymentDate: pDate || undefined,
      amount: Number(pAmount),
      currency: pCurrency,
      notes: pNotes || undefined,
    };
    try {
      if (editingPaymentId) {
        await api<Payment>(`/api/insurance-payments/${editingPaymentId}`, { method: "PATCH", body: JSON.stringify(body) });
      } else {
        await api<Payment>("/api/insurance-payments", { method: "POST", body: JSON.stringify(body) });
      }
      setShowPayment(false);
      setEditingPaymentId("");
      reloadBalances();
      if (detailProviderId) {
        const qs = new URLSearchParams({ providerId: detailProviderId });
        setLoadingPayments(true);
        api<Payment[]>(`/api/insurance-payments?${qs.toString()}`)
          .then(setPayments)
          .finally(() => setLoadingPayments(false));
      }
      alert("Payment saved");
    } catch (e: any) {
      alert(`Failed to save payment: ${e.message || e}`);
    }
  }

  async function deletePayment(id: string) {
    if (!confirm("Delete this payment? This cannot be undone.")) return;
    try {
      await api(`/api/insurance-payments/${id}`, { method: "DELETE" });
      reloadBalances();
      if (detailProviderId) {
        const qs = new URLSearchParams({ providerId: detailProviderId });
        setLoadingPayments(true);
        api<Payment[]>(`/api/insurance-payments?${qs.toString()}`)
          .then(setPayments)
          .finally(() => setLoadingPayments(false));
      }
    } catch (e: any) {
      alert(`Failed to delete payment: ${e.message || e}`);
    }
  }

  function clearFilters() {
    setProviderId("");
    setStatus("");
    setPresetWindow("all");
  }

  /* ----------------------------- UI ----------------------------- */
  return (
    <div className="p-6 max-w-[1200px] mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-semibold">Insurance Management</h1>
        <div className="flex items-center gap-2">
          {/* toned down buttons to match Export CSV */}
          <button
            onClick={() => {
              setEditingClaimId("");
              setCProviderId(providerId || "");
              setCStart(new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1)).toISOString().slice(0,10));
              setCEnd(new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth()+1, 0)).toISOString().slice(0,10));
              setCCurrency("USD"); setCAmount("0"); setCNotes(""); setShowClaim(true);
            }}
            className="px-3 py-2 rounded-lg border hover:bg-slate-50"
          >
            + Add Claim
          </button>

          <button
            onClick={() => {
              setEditingPaymentId("");
              setPProviderId(providerId || "");
              setPDate(new Date().toISOString().slice(0, 10));
              setPAmount("0"); setPCurrency("USD"); setPNotes("");
              setShowPayment(true);
            }}
            className="px-3 py-2 rounded-lg border hover:bg-slate-50"
          >
            Record Payment
          </button>

          <button onClick={() => exportClaimsCsv(claims, providers)} className="px-3 py-2 rounded-lg border hover:bg-slate-50">
            Export CSV
          </button>

          <HelpPopover />
        </div>
      </div>

      {authError && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          Authentication required. If you’re in Incognito/Private mode, allow third-party cookies or sign in again.
        </div>
      )}

      {/* Filters */}
      <div className="rounded-xl border p-3 mb-4 grid grid-cols-1 gap-3">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <select value={providerId} onChange={(e) => setProviderId(e.target.value)} className="border rounded-lg p-2">
            <option value="">All providers</option>
            {providers.map((p) => (<option key={p.id} value={p.id}>{p.name}</option>))}
          </select>

          <select value={status} onChange={(e) => setStatus(e.target.value)} className="border rounded-lg p-2">
            <option value="">Any status</option>
            <option value="submitted">Submitted</option>
            <option value="partially_paid">Partially paid</option>
            <option value="paid">Paid</option>
          </select>
        </div>

        {/* window chips (neutral active state) */}
        <div className="flex flex-wrap gap-2 items-center">
          {[
            { id: "all", label: "All time" },
            { id: "ytd", label: "YTD" },
            { id: `year-${currentYear}`, label: `Year ${currentYear}` },
            { id: `year-${currentYear-1}`, label: `Year ${currentYear-1}` },
            { id: `year-${currentYear-2}`, label: `Year ${currentYear-2}` },
            { id: `year-${currentYear-3}`, label: `Year ${currentYear-3}` },
            { id: "custom", label: "Custom" },
          ].map((chip) => (
            <button
              key={chip.id}
              onClick={() => setPresetWindow(chip.id as WindowPreset)}
              className={`px-3 py-1.5 rounded-full border ${
                preset === chip.id
                  ? "bg-slate-900/10 text-slate-900 border-slate-300"
                  : "hover:bg-slate-50"
              }`}
            >
              {chip.label}
            </button>
          ))}
          {preset === "custom" && (
            <>
              <input type="date" value={start} onChange={(e) => setStart(e.target.value)} className="border rounded-lg p-2" />
              <input type="date" value={end} onChange={(e) => setEnd(e.target.value)} className="border rounded-lg p-2" />
            </>
          )}
          <div className="ml-auto">
            <button onClick={clearFilters} className="px-3 py-2 rounded-lg border hover:bg-slate-50">Clear filters</button>
          </div>
        </div>
      </div>

      {/* Summary (slightly larger numbers) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
        <div className="rounded-2xl border bg-white p-4">
          <div className="text-slate-500 text-sm">Billed</div>
          <div className="mt-1 text-2xl font-semibold">{money(summary.billed, "USD")}</div>
          <div className="text-xs text-slate-500 mt-1">{selectedProvider ? selectedProvider.name : "All providers"}</div>
        </div>
        <div className="rounded-2xl border bg-white p-4">
          <div className="text-slate-500 text-sm">Collected</div>
          <div className="mt-1 text-2xl font-semibold">{money(summary.collected, "USD")}</div>
          <div className="text-xs text-slate-500 mt-1">Payments received (window)</div>
        </div>
        <div className="rounded-2xl border bg-white p-4">
          <div className="text-slate-500 text-sm">Outstanding</div>
          <div className={`mt-1 text-2xl font-semibold ${summary.outstanding < 0 ? "text-emerald-700" : ""}`}>
            {summary.outstanding < 0 ? `Credit ${money(Math.abs(summary.outstanding), "USD")}` : money(summary.outstanding, "USD")}
          </div>
          <div className="text-xs text-slate-500 mt-1">Billed − Collected</div>
        </div>
      </div>

      {/* Layout: left table, right balances */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Claims table */}
        <div className="lg:col-span-2 bg-white rounded-xl border">
          <div className="px-4 py-3 border-b flex items-center justify-between">
            <div className="font-medium">Claims</div>
            <div className="text-sm text-slate-500">{claims.length} {claims.length === 1 ? "item" : "items"}</div>
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
                  <th className="text-right p-3 w-32">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {claims.map((c) => {
                  const prov = providers.find((p) => p.id === c.providerId);
                  return (
                    <tr key={c.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="p-3">{prov?.name || c.providerId}</td>
                      <td className="p-3">
                        {new Date(c.periodYear, c.periodMonth - 1).toLocaleString("en-US", { month: "long", year: "numeric" })}
                      </td>
                      <td className="p-3">{money(c.claimedAmount, c.currency)}</td>
                      <td className="p-3"><StatusChip status={c.status} /></td>
                      <td className="p-3">{c.notes || ""}</td>
                      <td className="p-3 text-right">
                        <div className="inline-flex gap-2">
                          <button
                            className="text-xs px-2 py-1 rounded-md border text-rose-700"
                            onClick={() => deleteClaim(c.id)}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {!loadingClaims && claims.length === 0 && (
                  <tr><td colSpan={6} className="p-6 text-center text-slate-500">No claims in this window.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Provider balances (ordered) */}
        <div className="bg-white rounded-xl border">
          <div className="px-4 py-3 border-b font-medium">Provider Balances</div>
          <div className="p-4 space-y-3">
            {!balances && <div className="text-slate-500">Loading…</div>}
            {orderedBalanceProviders.map((row) => {
              const outstanding = (row.claimed || 0) - (row.paid || 0);
              const pct = row.claimed > 0 ? Math.round((row.paid / row.claimed) * 100) : 0;
              return (
                <div key={row.providerId} className="border rounded-lg p-3 hover:shadow-sm transition-shadow bg-white">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <ProgressRing billed={row.claimed} paid={row.paid} balance={outstanding} />
                      <div>
                        <div className="font-medium">{row.providerName}</div>
                        <div className={`text-xs ${pct > 0 ? "text-emerald-700" : "text-slate-400"}`}>{pct}% Paid</div>
                      </div>
                    </div>
                    <button onClick={() => setDetailProviderId(row.providerId)} className="text-sm text-indigo-600 hover:underline">
                      View details
                    </button>
                  </div>
                  <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
                    <div className="bg-slate-50 rounded p-2"><div className="text-slate-500">Billed</div><div className="font-semibold">{money(row.claimed, "USD")}</div></div>
                    <div className="bg-slate-50 rounded p-2"><div className="text-slate-500">Collected</div><div className="font-semibold">{money(row.paid, "USD")}</div></div>
                    <div className="bg-slate-50 rounded p-2">
                      <div className="text-slate-500">Outstanding</div>
                      <div className={`font-semibold ${outstanding < 0 ? "text-emerald-700" : ""}`}>
                        {outstanding < 0 ? `Credit ${money(Math.abs(outstanding), "USD")}` : money(outstanding, "USD")}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
            {balances && orderedBalanceProviders.length === 0 && <div className="text-slate-500">No balances yet.</div>}
          </div>
        </div>
      </div>

      {/* Drawer */}
      {detailProviderId && (
        <div className="fixed inset-0 z-40">
          <div className="absolute inset-0 bg-black/30" onClick={() => setDetailProviderId("")} />
          <div className="absolute right-0 top-0 h-full w-full max-w-2xl bg-white shadow-2xl border-l z-50 flex flex-col">
            <div className="px-4 py-3 border-b flex items-center justify-between">
              <div className="font-medium">{providers.find((p) => p.id === detailProviderId)?.name || "Provider"}: details</div>
              <button className="text-slate-500" onClick={() => setDetailProviderId("")}>✕</button>
            </div>

            <div className="p-4 overflow-y-auto space-y-6">
              {/* Totals in current window (NO carry) */}
              <div className="grid grid-cols-3 gap-3">
                {(() => {
                  const prov = balances?.providers.find((r) => r.providerId === detailProviderId) || { claimed: 0, paid: 0 };
                  const outstanding = (prov.claimed || 0) - (prov.paid || 0);
                  const pct = prov.claimed > 0 ? Math.round((prov.paid / prov.claimed) * 100) : 0;
                  return (
                    <>
                      <div className="rounded-lg border p-3"><div className="text-xs text-slate-500">Billed</div><div className="font-semibold">{money(prov.claimed, "USD")}</div></div>
                      <div className="rounded-lg border p-3"><div className="text-xs text-slate-500">Collected</div><div className="font-semibold">{money(prov.paid, "USD")}</div></div>
                      <div className="rounded-lg border p-3">
                        <div className="text-xs text-slate-500">Outstanding</div>
                        <div className={`font-semibold ${outstanding < 0 ? "text-emerald-700" : ""}`}>{outstanding < 0 ? `Credit ${money(Math.abs(outstanding), "USD")}` : money(outstanding, "USD")}</div>
                        <div className={`text-xs mt-1 ${pct > 0 ? "text-emerald-700" : "text-slate-400"}`}>{pct}% Paid</div>
                      </div>
                    </>
                  );
                })()}
              </div>

              {/* Claims ledger (all-time list from balances.claims) */}
              <div>
                <div className="mb-2 font-medium">Claims</div>
                {providerClaimsForDrawer.length === 0 && <div className="text-sm text-slate-500">No claims for this provider.</div>}
                <div className="divide-y border rounded-lg">
                  {providerClaimsForDrawer.map((c) => {
                    const pct = Number(c.claimedAmount) > 0 ? Math.min(100, Math.round((Number(c.paidToDate) / Number(c.claimedAmount)) * 100)) : 0;
                    return (
                      <div key={c.id} className="p-3">
                        <div className="flex items-center justify-between">
                          <div className="font-medium">
                            {new Date(c.periodYear, c.periodMonth - 1).toLocaleString("en-US", { month: "long", year: "numeric" })}
                          </div>
                          <div className="flex items-center gap-2">
                            <StatusChip status={c.status as ClaimStatus} />
                            <button
                              className="text-xs px-2 py-1 rounded-md border text-rose-700"
                              onClick={() => deleteClaim(c.id)}
                            >
                              Delete
                            </button>
                          </div>
                        </div>

                        <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
                          <div className="bg-slate-50 rounded p-2"><div className="text-slate-500">Billed</div><div className="font-semibold">{money(c.claimedAmount, c.currency)}</div></div>
                          <div className="bg-slate-50 rounded p-2"><div className="text-slate-500">Collected</div><div className="font-semibold">{money(c.paidToDate, c.currency)}</div></div>
                          <div className="bg-slate-50 rounded p-2"><div className="text-slate-500">Outstanding</div><div className="font-semibold">{money(c.balance, c.currency)}</div></div>
                        </div>

                        <div className="mt-2 h-1.5 w-full bg-slate-100 rounded">
                          <div className="h-1.5 bg-emerald-500 rounded" style={{ width: `${pct}%` }} title={`${pct}% collected`} />
                        </div>

                        <div className="mt-2 flex items-center justify-between">
                          <div className="text-xs text-slate-500">{c.notes || ""}</div>
                          <button
                            className="text-xs px-2 py-1 rounded-md border hover:bg-slate-50"
                            onClick={() => {
                              setPProviderId(c.providerId);
                              setEditingPaymentId("");
                              setShowPayment(true);
                            }}
                          >
                            Record payment
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Payments history (all-time) */}
              <div>
                <div className="mb-2 font-medium">Payments (history)</div>
                {loadingPayments && <div className="text-sm text-slate-500">Loading…</div>}
                {!loadingPayments && payments.length === 0 && <div className="text-sm text-slate-500">No payments recorded.</div>}
                <div className="divide-y border rounded-lg">
                  {payments.map((p) => {
                    return (
                      <div key={p.id} className="p-3 flex items-center justify-between">
                        <div className="text-sm">
                          <div className="font-medium">{money(p.amount, p.currency)}</div>
                          <div className="text-xs text-slate-500">
                            Paid: {safeFmtDate(p.paymentDate)}
                            {p.createdAt ? ` • Entered: ${safeFmtDate(p.createdAt)}` : ""}
                            {p.notes ? ` • ${p.notes}` : ""}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button className="text-xs px-2 py-1 rounded-md border text-rose-700" onClick={() => deletePayment(p.id)}>Delete</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit Claim (Period fields hidden) */}
      {showClaim && (
        <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-xl shadow-lg">
            <div className="px-4 py-3 border-b flex items-center justify-between">
              <div className="font-medium">{editingClaimId ? "Edit Claim" : "Add Claim"}</div>
              <button className="text-slate-500" onClick={() => { setShowClaim(false); setEditingClaimId(""); }}>✕</button>
            </div>
            <div className="p-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Provider</label>
                  <select className="border rounded-lg p-2 w-full" value={cProviderId} onChange={(e) => setCProviderId(e.target.value)}>
                    <option value="">Select…</option>
                    {providers.map((p) => (<option key={p.id} value={p.id}>{p.name}</option>))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Currency</label>
                  <select className="border rounded-lg p-2 w-full" value={cCurrency} onChange={(e) => setCCurrency(e.target.value as any)}>
                    <option value="USD">USD</option>
                    <option value="SSP">SSP</option>
                  </select>
                </div>
                {/* Period Start/End intentionally hidden */}
                <div className="col-span-2">
                  <label className="block text-xs text-slate-500 mb-1">Billed Amount</label>
                  <input type="number" min="0" className="border rounded-lg p-2 w-full" value={cAmount} onChange={(e) => setCAmount(e.target.value)} />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs text-slate-500 mb-1">Notes (optional)</label>
                  <textarea className="border rounded-lg p-2 w-full" rows={2} value={cNotes} onChange={(e) => setCNotes(e.target.value)} />
                </div>
              </div>
            </div>
            <div className="px-4 py-3 border-t flex justify-end gap-2">
              <button className="px-3 py-2 rounded-lg border" onClick={() => { setShowClaim(false); setEditingClaimId(""); }}>Cancel</button>
              <button className="px-3 py-2 rounded-lg border bg-slate-900 text-white hover:opacity-90" onClick={submitClaim}>
                {editingClaimId ? "Save Changes" : "Save Claim"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Record Payment (simplified) */}
      {showPayment && (
        <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-xl shadow-lg">
            <div className="px-4 py-3 border-b flex items-center justify-between">
              <div className="font-medium">{editingPaymentId ? "Edit Payment" : "Record Payment"}</div>
              <button className="text-slate-500" onClick={() => { setShowPayment(false); setEditingPaymentId(""); }}>✕</button>
            </div>
            <div className="p-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Provider</label>
                  <select className="border rounded-lg p-2 w-full" value={pProviderId} onChange={(e) => setPProviderId(e.target.value)}>
                    <option value="">Select…</option>
                    {providers.map((p) => (<option key={p.id} value={p.id}>{p.name}</option>))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Payment Date</label>
                  <input type="date" className="border rounded-lg p-2 w-full" value={pDate} onChange={(e) => setPDate(e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Currency</label>
                  <select className="border rounded-lg p-2 w-full" value={pCurrency} onChange={(e) => setPCurrency(e.target.value as any)}>
                    <option value="USD">USD</option>
                    <option value="SSP">SSP</option>
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="block text-xs text-slate-500 mb-1">Amount Received</label>
                  <input type="number" min="0" className="border rounded-lg p-2 w-full" value={pAmount} onChange={(e) => setPAmount(e.target.value)} />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs text-slate-500 mb-1">Notes (optional)</label>
                  <input className="border rounded-lg p-2 w-full" value={pNotes} onChange={(e) => setPNotes(e.target.value)} />
                </div>
              </div>
            </div>
            <div className="px-4 py-3 border-t flex justify-end gap-2">
              <button className="px-3 py-2 rounded-lg border" onClick={() => { setShowPayment(false); setEditingPaymentId(""); }}>Cancel</button>
              <button className="px-3 py-2 rounded-lg border bg-slate-800 text-white hover:opacity-90" onClick={submitPayment}>
                {editingPaymentId ? "Save Changes" : "Record Payment"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
