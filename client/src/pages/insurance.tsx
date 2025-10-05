import React, { useEffect, useMemo, useState } from "react";

/* ----------------------------- types ----------------------------- */
type Provider = { id: string; code: string; name: string; isActive: boolean };

type ClaimStatus = "submitted" | "partially_paid" | "paid";

type Claim = {
  id: string;
  providerId: string;
  periodYear: number;
  periodMonth: number;
  periodStart: string; // ISO yyyy-mm-dd
  periodEnd: string;   // ISO yyyy-mm-dd
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
  paymentDate: string; // ISO yyyy-mm-dd or full ISO
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
    claimed: number;   // all-time billed (server)
    paid: number;      // all-time collected (server)
    balance: number;   // all-time outstanding (server)
    openingBalance?: number;            // carry fwd for this provider (optional)
    openingBalanceAsOf?: string | null; // ISO date (optional)
  }>;
  claims: Array<
    Claim & {
      providerName: string;
      paidToDate: number; // all-time, server-calculated
      balance: number;    // all-time for the claim
    }
  >;
};

/* ---------------------------- helpers ---------------------------- */
const money = (n: number | string, currency: "USD" | "SSP" = "USD") =>
  `${currency} ${Number(n || 0).toLocaleString("en-US", {
    maximumFractionDigits: 0,
  })}`;

const titleCase = (s: string) =>
  s.replace(/(^|_)([a-z])/g, (_, b, c) => (b ? " " : "") + c.toUpperCase());

const PREFERRED_ORDER = ["CIC", "CIGNA", "UAP", "New Sudan", "Nile International", "Other"];
const weightForName = (name: string) => {
  const idx = PREFERRED_ORDER.findIndex((x) => x.toLowerCase() === name.toLowerCase());
  return idx >= 0 ? idx : 100;
};

/** API base from Vite env/Netlify, fallback same-origin. */
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

/* date utils (robust parsing) */
const pad = (n: number) => (n < 10 ? `0${n}` : String(n));
const toISODate = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

function parseISOish(value?: string | null): Date | null {
  if (!value) return null;
  // Accept 'YYYY-MM-DD' or full ISO
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (m) {
    const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
    return isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

function monthRangeFromDateStr(dateStr: string) {
  const d = parseISOish(dateStr) || new Date();
  const start = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
  const end = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0));
  return { start: toISODate(start), end: toISODate(end), year: start.getUTCFullYear(), month: start.getUTCMonth() + 1 };
}

function inWindow(dateISO: string, from?: string, to?: string) {
  if (!from && !to) return true;
  const d = parseISOish(dateISO);
  if (!d) return false;
  const val = toISODate(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())));
  if (from && val < from) return false;
  if (to && val > to) return false;
  return true;
}

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
    <span title={titles[status]} className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${styles[status]}`}>
      {titleCase(status)}
    </span>
  );
}

function HelpPopover() {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen((v) => !v)} className="px-3 py-2 rounded-lg border hover:bg-slate-50 text-slate-600">
        ⓘ Help
      </button>
      {open && (
        <div className="absolute right-0 z-20 mt-2 w-80 rounded-xl border bg-white p-3 text-sm shadow-lg">
          <div className="font-medium mb-1">How to read this page</div>
          <ul className="list-disc pl-5 space-y-1 text-slate-600">
            <li><strong>Billed</strong>: claims submitted in the selected window.</li>
            <li><strong>Collected</strong>: payments received in the window.</li>
            <li><strong>Carry Forward</strong>: balance from before the window (if provided by API).</li>
            <li><strong>Outstanding</strong>: <em>Billed − Collected + Carry</em>.</li>
          </ul>
          <div className="text-right mt-2">
            <button className="text-xs text-slate-500 hover:underline" onClick={() => setOpen(false)}>Close</button>
          </div>
        </div>
      )}
    </div>
  );
}

function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-slate-200/70 ${className}`} />;
}

function ProgressRing({ billed, paid, balance }: { billed: number; paid: number; balance: number; }) {
  const pct = billed > 0 ? Math.min(100, Math.max(0, Math.round((paid / billed) * 100))) : 0;
  const label = balance < 0 ? "CR" : `${pct}%`;
  const sweep = Math.round((balance < 0 ? 100 : pct) * 3.6);
  return (
    <div className="relative h-10 w-10 shrink-0">
      <div className="absolute inset-0 rounded-full" style={{ background: `conic-gradient(#10b981 ${sweep}deg, #e5e7eb 0deg)` }} />
      <div className="absolute inset-[3px] rounded-full bg-white flex items-center justify-center text-[10px] font-semibold text-slate-700">{label}</div>
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
type WindowPreset = "all" | "ytd" | "y2025" | "y2024" | "y2023" | "y2022" | "custom";

export default function InsurancePage() {
  // data
  const [providers, setProviders] = useState<Provider[]>([]);
  const [claims, setClaims] = useState<Claim[]>([]);
  const [balances, setBalances] = useState<BalancesResponse | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);         // details drawer (provider)
  const [windowPayments, setWindowPayments] = useState<Payment[]>([]); // for summary + cards
  const [loadingPayments, setLoadingPayments] = useState(false);
  const [loadingWindowPayments, setLoadingWindowPayments] = useState(false);
  const [loadingClaims, setLoadingClaims] = useState(false);
  const [loadingBalances, setLoadingBalances] = useState(false);

  // filters
  const [providerId, setProviderId] = useState<string>("");
  const [status, setStatus] = useState<string>(""); // submitted / partially_paid / paid
  const [preset, setPreset] = useState<WindowPreset>("all");
  const [from, setFrom] = useState<string>(""); // ISO yyyy-mm-dd
  const [to, setTo] = useState<string>("");

  // modals & drawer
  const [showClaim, setShowClaim] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [detailProviderId, setDetailProviderId] = useState<string>("");

  // editing states
  const [editingClaimId, setEditingClaimId] = useState<string>("");
  const [editingPaymentId, setEditingPaymentId] = useState<string>("");

  // auth hint
  const [authError, setAuthError] = useState(false);

  // claim form (simplified)
  const [cProviderId, setCProviderId] = useState<string>("");
  const [cCurrency, setCCurrency] = useState<"USD" | "SSP">("USD");
  const [cClaimDate, setCClaimDate] = useState<string>(() => toISODate(new Date())); // single date
  const [cAmount, setCAmount] = useState<string>("0");
  const [cNotes, setCNotes] = useState<string>("");

  // payment form
  const [pProviderId, setPProviderId] = useState<string>("");
  const [pClaimId, setPClaimId] = useState<string>("");
  const [pDate, setPDate] = useState<string>(() => toISODate(new Date()));
  const [pAmount, setPAmount] = useState<string>("0");
  const [pCurrency, setPCurrency] = useState<"USD" | "SSP">("USD");
  const [pRef, setPRef] = useState<string>("");
  const [pNotes, setPNotes] = useState<string>("");

  /* --------------------------- effects --------------------------- */
  useEffect(() => {
    api<Provider[]>("/api/insurance-providers")
      .then((rows) => {
        const act = rows.filter((p) => p.isActive);
        act.sort((a, b) => {
          const wa = weightForName(a.name);
          const wb = weightForName(b.name);
          if (wa !== wb) return wa - wb;
          return a.name.localeCompare(b.name);
        });
        setProviders(act);
      })
      .catch((e: any) => {
        console.error("providers", e);
        if (e?.status === 401) setAuthError(true);
      });
  }, []);

  // apply window preset
  useEffect(() => {
    const now = new Date();
    const startOfYear = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
    const startOfThisYear = toISODate(startOfYear);
    const endOfThisYear = toISODate(new Date(Date.UTC(now.getUTCFullYear(), 11, 31)));

    const setYear = (y: number) => {
      setFrom(`${y}-01-01`);
      setTo(`${y}-12-31`);
    };

    if (preset === "all") {
      setFrom("");
      setTo("");
    } else if (preset === "ytd") {
      setFrom(startOfThisYear);
      setTo(toISODate(now));
    } else if (preset === "y2025") setYear(2025);
    else if (preset === "y2024") setYear(2024);
    else if (preset === "y2023") setYear(2023);
    else if (preset === "y2022") setYear(2022);
    else if (preset === "custom") {
      // keep user-entered from/to
      if (!from && !to) {
        setFrom(startOfThisYear);
        setTo(endOfThisYear);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preset]);

  // load claims (pass window to API if supported; also filter locally)
  const reloadClaims = () => {
    setLoadingClaims(true);
    const params = new URLSearchParams();
    if (providerId) params.set("providerId", providerId);
    if (status) params.set("status", status);
    if (from) params.set("from", from);
    if (to) params.set("to", to);

    api<Claim[]>(`/api/insurance-claims?${params.toString()}`)
      .then(setClaims)
      .catch((e: any) => {
        console.error("claims", e);
        if (e?.status === 401) setAuthError(true);
      })
      .finally(() => setLoadingClaims(false));
  };
  useEffect(reloadClaims, [providerId, status, from, to]);

  // load balances (server may ignore window; we still compute window figures on the client)
  const reloadBalances = () => {
    setLoadingBalances(true);
    const params = new URLSearchParams();
    if (providerId) params.set("providerId", providerId);
    if (from) params.set("from", from);
    if (to) params.set("to", to);

    api<BalancesResponse>(`/api/insurance-balances?${params.toString()}`)
      .then((data) => {
        data.providers.sort((a, b) => {
          const wa = weightForName(a.providerName);
          const wb = weightForName(b.providerName);
          if (wa !== wb) return wa - wb;
          return a.providerName.localeCompare(b.providerName);
        });
        setBalances(data);
      })
      .catch((e: any) => {
        console.error("balances", e);
        if (e?.status === 401) setAuthError(true);
      })
      .finally(() => setLoadingBalances(false));
  };
  useEffect(reloadBalances, [providerId, from, to]);

  // load payments for current window (for summary & provider tiles)
  useEffect(() => {
    setLoadingWindowPayments(true);
    const qs = new URLSearchParams();
    if (providerId) qs.set("providerId", providerId);
    if (from) qs.set("from", from);
    if (to) qs.set("to", to);

    api<Payment[]>(`/api/insurance-payments?${qs.toString()}`)
      .then(setWindowPayments)
      .catch(() => setWindowPayments([]))
      .finally(() => setLoadingWindowPayments(false));
  }, [providerId, from, to]);

  // drawer: load full payment history for that provider (we’ll still show only in-window)
  useEffect(() => {
    if (!detailProviderId) return;
    setLoadingPayments(true);
    const qs = new URLSearchParams({ providerId: detailProviderId });
    api<Payment[]>(`/api/insurance-payments?${qs.toString()}`)
      .then(setPayments)
      .catch(() => setPayments([]))
      .finally(() => setLoadingPayments(false));
  }, [detailProviderId]);

  // visible claims (enforce window on client too)
  const visibleClaims = useMemo(() => {
    const byProvider = providerId ? (c: Claim) => c.providerId === providerId : () => true;
    const byStatus = status ? (c: Claim) => c.status === (status as ClaimStatus) : () => true;
    const byWindow = (c: Claim) => (!from && !to) || inWindow(c.periodStart, from, to);
    return (balances?.claims ?? claims).filter((c) => byProvider(c) && byStatus(c) && byWindow(c));
  }, [balances, claims, providerId, status, from, to]);

  // group window payments by provider
  const windowPaymentsByProvider = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of windowPayments) {
      if (!inWindow(p.paymentDate, from, to)) continue;
      if (providerId && p.providerId !== providerId) continue;
      map.set(p.providerId, (map.get(p.providerId) || 0) + Number(p.amount || 0));
    }
    return map;
  }, [windowPayments, from, to, providerId]);

  // summary cards (window)
  const summary = useMemo(() => {
    const billed = visibleClaims.reduce((a, c) => a + Number(c.claimedAmount || 0), 0);
    const collected = windowPayments.reduce((a, p) => {
      if (!inWindow(p.paymentDate, from, to)) return a;
      if (providerId && p.providerId !== providerId) return a;
      return a + Number(p.amount || 0);
    }, 0);
    const carry = (balances?.providers ?? [])
      .filter((r) => (providerId ? r.providerId === providerId : true))
      .reduce((a, r) => a + Number(r.openingBalance || 0), 0);
    const outstanding = billed - collected + carry;
    return { billed, collected, carry, outstanding };
  }, [visibleClaims, windowPayments, balances, providerId, from, to]);

  const selectedProvider = useMemo(
    () => providers.find((p) => p.id === providerId) || null,
    [providers, providerId]
  );

  const providerClaimsForDrawer = useMemo(() => {
    const pid = detailProviderId || providerId || "";
    return visibleClaims
      .filter((c) => (!pid ? true : c.providerId === pid))
      .sort((a, b) =>
        a.periodYear !== b.periodYear ? b.periodYear - a.periodYear : b.periodMonth - a.periodMonth
      );
  }, [visibleClaims, detailProviderId, providerId]);

  /* ------------------------ create / edit claim ------------------------ */
  function hydrateClaimForm(c: Claim) {
    setCProviderId(c.providerId);
    setCCurrency(c.currency);
    setCClaimDate(c.periodStart.slice(0, 10));
    setCAmount(String(c.claimedAmount));
    setCNotes(c.notes || "");
  }

  async function submitClaim() {
    // derive month range + Y/M for the API from single claim date
    const { start, end, year, month } = monthRangeFromDateStr(cClaimDate);
    const body = {
      providerId: cProviderId || providerId,
      periodYear: year,
      periodMonth: month,
      periodStart: start,
      periodEnd: end,
      currency: cCurrency,
      claimedAmount: Number(cAmount),
      notes: cNotes || undefined,
    };
    try {
      if (editingClaimId) {
        await api<Claim>(`/api/insurance-claims/${editingClaimId}`, {
          method: "PATCH",
          body: JSON.stringify(body),
        });
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
        setLoadingPayments(true);
        const qs = new URLSearchParams({ providerId: detailProviderId });
        api<Payment[]>(`/api/insurance-payments?${qs.toString()}`)
          .then(setPayments)
          .finally(() => setLoadingPayments(false));
      }
    } catch (e: any) {
      alert(`Failed to delete claim: ${e.message || e}`);
    }
  }

  /* ----------------------- create / edit payment ----------------------- */
  function hydratePaymentForm(p: Payment) {
    setPProviderId(p.providerId);
    setPClaimId(p.claimId || "");
    setPDate((parseISOish(p.paymentDate) ? p.paymentDate : (p.createdAt || toISODate(new Date()))).slice(0,10));
    setPAmount(String(p.amount));
    setPCurrency(p.currency);
    setPRef(p.reference || "");
    setPNotes(p.notes || "");
  }

  async function submitPayment() {
    const body = {
      providerId: pProviderId || providerId,
      claimId: pClaimId || undefined,
      paymentDate: pDate,
      amount: Number(pAmount),
      currency: pCurrency,
      reference: pRef || undefined,
      notes: pNotes || undefined,
    };
    try {
      if (editingPaymentId) {
        await api<Payment>(`/api/insurance-payments/${editingPaymentId}`, {
          method: "PATCH",
          body: JSON.stringify(body),
        });
      } else {
        await api<Payment>("/api/insurance-payments", {
          method: "POST",
          body: JSON.stringify(body),
        });
      }
      setShowPayment(false);
      setEditingPaymentId("");
      reloadBalances();
      // refresh window payments + drawer
      setLoadingWindowPayments(true);
      const qs2 = new URLSearchParams();
      if (providerId) qs2.set("providerId", providerId);
      if (from) qs2.set("from", from);
      if (to) qs2.set("to", to);
      api<Payment[]>(`/api/insurance-payments?${qs2.toString()}`)
        .then(setWindowPayments)
        .finally(() => setLoadingWindowPayments(false));

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
      setLoadingWindowPayments(true);
      const qs2 = new URLSearchParams();
      if (providerId) qs2.set("providerId", providerId);
      if (from) qs2.set("from", from);
      if (to) qs2.set("to", to);
      api<Payment[]>(`/api/insurance-payments?${qs2.toString()}`)
        .then(setWindowPayments)
        .finally(() => setLoadingWindowPayments(false));

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

  /* ----------------------------- UI ----------------------------- */
  const clearFilters = () => {
    setProviderId("");
    setStatus("");
    setPreset("all");
    setFrom("");
    setTo("");
  };

  return (
    <div className="p-6 max-w-[1200px] mx-auto">
      {/* Header + actions */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-semibold">Insurance Management</h1>
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              setEditingClaimId("");
              setCProviderId(providerId || "");
              setCCurrency("USD");
              setCClaimDate(toISODate(new Date()));
              setCAmount("0");
              setCNotes("");
              setShowClaim(true);
            }}
            className="px-3 py-2 rounded-lg bg-slate-900 text-white hover:bg-slate-800"
          >
            + Add Claim
          </button>

          <button
            onClick={() => {
              setEditingPaymentId("");
              setPProviderId(providerId || "");
              setPClaimId("");
              setPDate(toISODate(new Date()));
              setPAmount("0");
              setPCurrency("USD");
              setPRef("");
              setPNotes("");
              setShowPayment(true);
            }}
            className="px-3 py-2 rounded-lg bg-slate-700 text-white hover:bg-slate-600"
          >
            Record Payment
          </button>

          <button
            onClick={() => exportClaimsCsv(visibleClaims, providers)}
            className="px-3 py-2 rounded-lg border hover:bg-slate-50"
            title="Download current table as CSV"
          >
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

      {/* Filters / window */}
      <div className="rounded-xl border p-3 mb-4 grid grid-cols-1 gap-3">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <select value={providerId} onChange={(e) => setProviderId(e.target.value)} className="border rounded-lg p-2">
            <option value="">All providers</option>
            {providers.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>

          <select value={status} onChange={(e) => setStatus(e.target.value)} className="border rounded-lg p-2">
            <option value="">Any status</option>
            <option value="submitted">Submitted</option>
            <option value="partially_paid">Partially paid</option>
            <option value="paid">Paid</option>
          </select>
        </div>

        <div className="flex flex-wrap gap-2 items-center">
          {[
            { id: "all", label: "All time" },
            { id: "ytd", label: "YTD" },
            { id: "y2025", label: "Year 2025" },
            { id: "y2024", label: "Year 2024" },
            { id: "y2023", label: "Year 2023" },
            { id: "y2022", label: "Year 2022" },
          ].map((chip) => (
            <button
              key={chip.id}
              className={`px-3 py-1.5 rounded-full border ${preset === chip.id ? "bg-slate-900 text-white border-slate-900" : "hover:bg-slate-50"}`}
              onClick={() => setPreset(chip.id as WindowPreset)}
            >
              {chip.label}
            </button>
          ))}

          <button
            className={`px-3 py-1.5 rounded-full border ${preset === "custom" ? "bg-slate-900 text-white border-slate-900" : "hover:bg-slate-50"}`}
            onClick={() => setPreset("custom")}
          >
            Custom
          </button>

          <div className="ml-auto">
            <button onClick={clearFilters} className="px-3 py-1.5 rounded-lg border hover:bg-slate-50">
              Clear filters
            </button>
          </div>
        </div>

        {preset === "custom" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="border rounded-lg p-2" />
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="border rounded-lg p-2" />
          </div>
        )}
      </div>

      {/* Summary row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-6">
        <div className="rounded-2xl border bg-white p-4">
          <div className="text-slate-500 text-sm">Billed</div>
          <div className="mt-1 text-xl font-semibold">{money(summary.billed, "USD")}</div>
          <div className="text-xs text-slate-500 mt-1">{selectedProvider ? selectedProvider.name : "All providers"}</div>
        </div>
        <div className="rounded-2xl border bg-white p-4">
          <div className="text-slate-500 text-sm">Collected</div>
          <div className="mt-1 text-xl font-semibold">
            {loadingWindowPayments ? "…" : money(summary.collected, "USD")}
          </div>
          <div className="text-xs text-slate-500 mt-1">Payments received (window)</div>
        </div>
        <div className="rounded-2xl border bg-white p-4">
          <div className="text-slate-500 text-sm">Carry Forward</div>
          <div className={`mt-1 text-xl font-semibold ${summary.carry < 0 ? "text-emerald-700" : "text-slate-900"}`}>
            {summary.carry < 0 ? `Credit ${money(Math.abs(summary.carry), "USD")}` : money(summary.carry, "USD")}
          </div>
          <div className="text-xs text-slate-500 mt-1">Before current window</div>
        </div>
        <div className="rounded-2xl border bg-white p-4">
          <div className="text-slate-500 text-sm">Outstanding</div>
          <div className={`mt-1 text-xl font-semibold ${summary.outstanding < 0 ? "text-emerald-700" : "text-slate-900"}`}>
            {summary.outstanding < 0
              ? `Credit ${money(Math.abs(summary.outstanding), "USD")}`
              : money(summary.outstanding, "USD")}
          </div>
          <div className="text-xs text-slate-500 mt-1">Billed − Collected + Carry</div>
        </div>
      </div>

      {/* Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Claims Table */}
        <div className="lg:col-span-2 bg-white rounded-xl border">
          <div className="px-4 py-3 border-b flex items-center justify-between">
            <div className="font-medium">Claims</div>
            <div className="text-sm text-slate-500">
              {visibleClaims.length} {visibleClaims.length === 1 ? "item" : "items"}
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
                  <th className="text-right p-3 w-40">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {visibleClaims.map((c) => {
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
                            className="text-xs px-2 py-1 rounded-md border"
                            onClick={() => { setEditingClaimId(c.id); hydrateClaimForm(c); setShowClaim(true); }}
                          >Edit</button>
                          <button
                            className="text-xs px-2 py-1 rounded-md border text-rose-700"
                            onClick={() => deleteClaim(c.id)}
                          >Delete</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}

                {loadingClaims &&
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={`sk-${i}`}>
                      <td className="p-3"><Skeleton className="h-4 w-28" /></td>
                      <td className="p-3"><Skeleton className="h-4 w-32" /></td>
                      <td className="p-3"><Skeleton className="h-4 w-20" /></td>
                      <td className="p-3"><Skeleton className="h-5 w-20 rounded-full" /></td>
                      <td className="p-3"><Skeleton className="h-4 w-24" /></td>
                      <td className="p-3 text-right"><Skeleton className="h-8 w-24 ml-auto" /></td>
                    </tr>
                  ))}

                {!loadingClaims && visibleClaims.length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-6 text-center text-slate-500">
                      {providerId ? "No claims for this provider in this window." : "No claims in this window."}
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
            {loadingBalances && (
              <>
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="border rounded-lg p-3">
                    <div className="flex items-center justify-between">
                      <Skeleton className="h-4 w-28" />
                      <Skeleton className="h-4 w-20" />
                    </div>
                    <div className="mt-2 grid grid-cols-4 gap-2 text-xs">
                      <Skeleton className="h-10 w-full" />
                      <Skeleton className="h-10 w-full" />
                      <Skeleton className="h-10 w-full" />
                      <Skeleton className="h-10 w-full" />
                    </div>
                  </div>
                ))}
              </>
            )}

            {!loadingBalances && balances?.providers.map((row) => {
              const billedWin = visibleClaims
                .filter((c) => c.providerId === row.providerId)
                .reduce((a, c) => a + Number(c.claimedAmount || 0), 0);
              const collectedWin = windowPaymentsByProvider.get(row.providerId) || 0;
              const carry = Number(row.openingBalance || 0);
              const outstandingWithCarry = billedWin - collectedWin + carry;

              return (
                <div key={row.providerId} className="border rounded-lg p-3 hover:shadow-sm transition-shadow bg-white">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <ProgressRing billed={billedWin} paid={collectedWin} balance={outstandingWithCarry} />
                      <div className="font-medium">{row.providerName}</div>
                    </div>
                    <button
                      onClick={() => setDetailProviderId(row.providerId)}
                      className="text-sm text-indigo-600 hover:underline"
                    >
                      View details
                    </button>
                  </div>

                  <div className="mt-2 grid grid-cols-4 gap-2 text-xs">
                    <div className="bg-slate-50 rounded p-2">
                      <div className="text-slate-500">Billed</div>
                      <div className="font-semibold">{money(billedWin, "USD")}</div>
                    </div>
                    <div className="bg-slate-50 rounded p-2">
                      <div className="text-slate-500">Collected</div>
                      <div className="font-semibold">{money(collectedWin, "USD")}</div>
                    </div>
                    <div className="bg-slate-50 rounded p-2">
                      <div className="text-slate-500">Carry Fwd</div>
                      <div className={`font-semibold ${carry < 0 ? "text-emerald-700" : ""}`}>
                        {carry < 0 ? `Credit ${money(Math.abs(carry), "USD")}` : money(carry, "USD")}
                      </div>
                      {row.openingBalanceAsOf && (
                        <div className="text-[10px] text-slate-500 mt-0.5">as of {new Date(row.openingBalanceAsOf).toLocaleDateString()}</div>
                      )}
                    </div>
                    <div className="bg-slate-50 rounded p-2">
                      <div className="text-slate-500">Outstanding</div>
                      <div className={`font-semibold ${outstandingWithCarry < 0 ? "text-emerald-700" : ""}`}>
                        {outstandingWithCarry < 0
                          ? `Credit ${money(Math.abs(outstandingWithCarry), "USD")}`
                          : money(outstandingWithCarry, "USD")}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}

            {!loadingBalances && balances && balances.providers.length === 0 && (
              <div className="text-slate-500">No balances yet.</div>
            )}
          </div>
        </div>
      </div>

      {/* ---------------------- Provider details drawer ---------------------- */}
      {detailProviderId && (
        <div className="fixed inset-0 z-40">
          <div className="absolute inset-0 bg-black/30" onClick={() => setDetailProviderId("")} />
          <div className="absolute right-0 top-0 h-full w-full max-w-2xl bg-white shadow-2xl border-l z-50 flex flex-col">
            <div className="px-4 py-3 border-b flex items-center justify-between">
              <div className="font-medium">
                {providers.find((p) => p.id === detailProviderId)?.name || "Provider"}: details
              </div>
              <button className="text-slate-500" onClick={() => setDetailProviderId("")}>✕</button>
            </div>

            <div className="p-4 overflow-y-auto space-y-6">
              {/* Provider totals */}
              <div className="grid grid-cols-4 gap-3">
                {(() => {
                  const pid = detailProviderId;
                  const billedWin = visibleClaims.filter((c) => c.providerId === pid)
                    .reduce((a, c) => a + Number(c.claimedAmount || 0), 0);
                  const collectedWin = windowPaymentsByProvider.get(pid) || 0;
                  const prov = balances?.providers.find((r) => r.providerId === pid) || { openingBalance: 0 };
                  const carry = Number((prov as any).openingBalance || 0);
                  const asOf = (prov as any).openingBalanceAsOf || null;
                  const outWithCarry = billedWin - collectedWin + carry;

                  return (
                    <>
                      <div className="rounded-lg border p-3">
                        <div className="text-xs text-slate-500">Billed</div>
                        <div className="font-semibold">{money(billedWin, "USD")}</div>
                      </div>
                      <div className="rounded-lg border p-3">
                        <div className="text-xs text-slate-500">Collected</div>
                        <div className="font-semibold">{money(collectedWin, "USD")}</div>
                      </div>
                      <div className="rounded-lg border p-3">
                        <div className="text-xs text-slate-500">Carry Forward</div>
                        <div className={`font-semibold ${carry < 0 ? "text-emerald-700" : ""}`}>
                          {carry < 0 ? `Credit ${money(Math.abs(carry), "USD")}` : money(carry, "USD")}
                        </div>
                        {asOf && <div className="text-[10px] text-slate-500 mt-0.5">as of {new Date(asOf).toLocaleDateString()}</div>}
                      </div>
                      <div className="rounded-lg border p-3">
                        <div className="text-xs text-slate-500">Outstanding</div>
                        <div className={`font-semibold ${outWithCarry < 0 ? "text-emerald-700" : ""}`}>
                          {outWithCarry < 0 ? `Credit ${money(Math.abs(outWithCarry), "USD")}` : money(outWithCarry, "USD")}
                        </div>
                      </div>
                    </>
                  );
                })()}
              </div>

              {/* Claims ledger */}
              <div>
                <div className="mb-2 font-medium">Claims (in window)</div>
                {providerClaimsForDrawer.filter(c => c.providerId === detailProviderId).length === 0 && (
                  <div className="text-sm text-slate-500">No claims for this provider in this window.</div>
                )}
                <div className="divide-y border rounded-lg">
                  {providerClaimsForDrawer.filter(c => c.providerId === detailProviderId).map((c) => {
                    const pct =
                      Number(c.claimedAmount) > 0
                        ? Math.min(100, Math.round((Number(c.paidToDate) / Number(c.claimedAmount)) * 100))
                        : 0;
                    return (
                      <div key={c.id} className="p-3">
                        <div className="flex items-center justify-between">
                          <div className="font-medium">
                            {new Date(c.periodYear, c.periodMonth - 1).toLocaleString("en-US", { month: "long", year: "numeric" })}
                          </div>
                          <div className="flex items-center gap-2">
                            <StatusChip status={c.status} />
                            <button
                              className="text-xs px-2 py-1 rounded-md border"
                              onClick={() => { setEditingClaimId(c.id); hydrateClaimForm(c); setShowClaim(true); }}
                            >Edit</button>
                            <button className="text-xs px-2 py-1 rounded-md border text-rose-700" onClick={() => deleteClaim(c.id)}>
                              Delete
                            </button>
                          </div>
                        </div>

                        <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
                          <div className="bg-slate-50 rounded p-2">
                            <div className="text-slate-500">Billed</div>
                            <div className="font-semibold">{money(c.claimedAmount, c.currency)}</div>
                          </div>
                          <div className="bg-slate-50 rounded p-2">
                            <div className="text-slate-500">Collected (to date)</div>
                            <div className="font-semibold">{money(c.paidToDate, c.currency)}</div>
                          </div>
                          <div className="bg-slate-50 rounded p-2">
                            <div className="text-slate-500">Outstanding</div>
                            <div className="font-semibold">{money(c.balance, c.currency)}</div>
                          </div>
                        </div>

                        {/* progress bar */}
                        <div className="mt-2 h-1.5 w-full bg-slate-100 rounded">
                          <div className="h-1.5 bg-emerald-500 rounded" style={{ width: `${pct}%` }} title={`${pct}% collected`} />
                        </div>

                        <div className="mt-2 flex items-center justify-between">
                          <div className="text-xs text-slate-500">{c.notes || ""}</div>
                          <button
                            className="text-xs px-2 py-1 rounded-md bg-slate-700 text-white"
                            onClick={() => { setPProviderId(c.providerId); setPClaimId(c.id); setEditingPaymentId(""); setShowPayment(true); }}
                          >
                            Record payment
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Payments history (in window) */}
              <div>
                <div className="mb-2 font-medium">Payments (in window)</div>
                {loadingPayments && <div className="text-sm text-slate-500">Loading…</div>}
                {!loadingPayments &&
                  payments.filter((p) => p.providerId === detailProviderId && inWindow(p.paymentDate, from, to)).length === 0 && (
                  <div className="text-sm text-slate-500">No payments recorded in this window.</div>
                )}
                <div className="divide-y border rounded-lg">
                  {payments
                    .filter((p) => p.providerId === detailProviderId && inWindow(p.paymentDate, from, to))
                    .map((p) => {
                      const claim = balances?.claims.find((c) => c.id === p.claimId);
                      const dd = parseISOish(p.paymentDate) || parseISOish(p.createdAt) || new Date();
                      return (
                        <div key={p.id} className="p-3 flex items-center justify-between">
                          <div className="text-sm">
                            <div className="font-medium">{money(p.amount, p.currency)}</div>
                            <div className="text-xs text-slate-500">
                              {dd.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}
                              {claim
                                ? ` • ${new Date(claim.periodYear, claim.periodMonth - 1).toLocaleString("en-US", { month: "short", year: "numeric" })}`
                                : ""}
                              {p.reference ? ` • Ref: ${p.reference}` : ""}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button className="text-xs px-2 py-1 rounded-md border" onClick={() => { setEditingPaymentId(p.id); hydratePaymentForm(p); setShowPayment(true); }}>
                              Edit
                            </button>
                            <button className="text-xs px-2 py-1 rounded-md border text-rose-700" onClick={() => deletePayment(p.id)}>
                              Delete
                            </button>
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

      {/* --------------------------- Add/Edit Claim --------------------------- */}
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

                <div className="col-span-2">
                  <label className="block text-xs text-slate-500 mb-1">Claim Date (when sent)</label>
                  <input type="date" className="border rounded-lg p-2 w-full" value={cClaimDate} onChange={(e) => setCClaimDate(e.target.value)} />
                  <div className="text-[11px] text-slate-500 mt-1">We’ll use this month for the claim period automatically.</div>
                </div>

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
              <button className="px-3 py-2 rounded-lg bg-slate-900 text-white" onClick={submitClaim}>
                {editingClaimId ? "Save Changes" : "Save Claim"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ----------------------- Add/Edit Payment ------------------------ */}
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
                  <label className="block text-xs text-slate-500 mb-1">Link to Claim (optional)</label>
                  <select className="border rounded-lg p-2 w-full" value={pClaimId} onChange={(e) => setPClaimId(e.target.value)}>
                    <option value="">— None —</option>
                    {visibleClaims
                      .filter((c) => !pProviderId || c.providerId === pProviderId)
                      .map((c) => (
                        <option key={c.id} value={c.id}>
                          {new Date(c.periodYear, c.periodMonth - 1).toLocaleString("en-US", { month: "short", year: "numeric" })} — {money(c.claimedAmount, c.currency)}
                        </option>
                      ))}
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
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Reference (optional)</label>
                  <input className="border rounded-lg p-2 w-full" value={pRef} onChange={(e) => setPRef(e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Notes (optional)</label>
                  <input className="border rounded-lg p-2 w-full" value={pNotes} onChange={(e) => setPNotes(e.target.value)} />
                </div>
              </div>
            </div>
            <div className="px-4 py-3 border-t flex justify-end gap-2">
              <button className="px-3 py-2 rounded-lg border" onClick={() => { setShowPayment(false); setEditingPaymentId(""); }}>Cancel</button>
              <button className="px-3 py-2 rounded-lg bg-slate-700 text-white" onClick={submitPayment}>
                {editingPaymentId ? "Save Changes" : "Record Payment"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
