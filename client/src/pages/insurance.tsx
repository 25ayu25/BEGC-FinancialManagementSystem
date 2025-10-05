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
  paymentDate: string; // ISO
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
    claimed: number;   // all-time billed
    paid: number;      // all-time collected
    balance: number;   // all-time outstanding (may be negative)
    openingBalance?: number;
    openingBalanceAsOf?: string | null;
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

const startOfUTC = (y: number, m: number, d: number) =>
  new Date(Date.UTC(y, m, d, 0, 0, 0, 0));

const endOfUTC = (y: number, m: number, d: number) =>
  new Date(Date.UTC(y, m, d, 23, 59, 59, 999));

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

  // Safari/Incognito fallback
  if (typeof window !== "undefined") {
    const backup = localStorage.getItem("user_session_backup");
    if (backup) headers.set("x-session-token", backup);
  }

  const res = await fetch(toUrl(path), {
    credentials: "include",
    ...init,
    headers,
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    const err = new Error(txt || res.statusText || `HTTP ${res.status}`);
    (err as any).status = res.status;
    throw err;
  }
  return res.json();
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
        className="text-slate-500 hover:text-slate-700 text-sm inline-flex items-center gap-1 px-3 py-2 rounded-lg border"
        title="What do these numbers mean?"
      >
        <span className="text-base">ℹ️</span> Help
      </button>
      {open && (
        <div className="absolute right-0 z-20 mt-2 w-[22rem] rounded-xl border bg-white p-3 text-sm shadow-lg">
          <div className="font-medium mb-1">How to read this page</div>
          <ul className="list-disc pl-5 space-y-1 text-slate-600">
            <li><strong>Billed</strong>: total amount we invoiced the provider in the selected window.</li>
            <li><strong>Collected</strong>: payments received in the selected window.</li>
            <li><strong>Carry Forward</strong>: outstanding from <em>before</em> the window.</li>
            <li><strong>Outstanding</strong>: Billed − Collected + Carry&nbsp;Forward.</li>
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

/* CSS-only donut % ring */
function ProgressRing({ billed, paid, balance }: { billed: number; paid: number; balance: number }) {
  const pct = billed > 0 ? Math.min(100, Math.max(0, Math.round((paid / billed) * 100))) : 0;
  const label = balance < 0 ? "CR" : `${pct}%`;
  const sweep = Math.round((balance < 0 ? 100 : pct) * 3.6);
  return (
    <div className="relative h-10 w-10 shrink-0">
      <div className="absolute inset-0 rounded-full" style={{ background: `conic-gradient(#10b981 ${sweep}deg, #e5e7eb 0deg)` }} />
      <div className="absolute inset-[3px] rounded-full bg-white flex items-center justify-center text-[10px] font-semibold text-slate-700">
        {label}
      </div>
    </div>
  );
}

/* CSV export for claims table */
function exportClaimsCsv(rows: Claim[], providers: Provider[]) {
  const byId = new Map(providers.map((p) => [p.id, p.name]));
  const header = ["Provider", "Period Start", "Period End", "Currency", "Billed", "Status", "Notes"].join(",");
  const body = rows.map((c) =>
    [
      (byId.get(c.providerId) || c.providerId).replace(/,/g, " "),
      c.periodStart.slice(0, 10),
      c.periodEnd.slice(0, 10),
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

type WindowKind = "all" | "ytd" | number | "custom";

export default function InsurancePage() {
  /* ----------------------- data & ui state ----------------------- */
  const [providers, setProviders] = useState<Provider[]>([]);
  const [claims, setClaims] = useState<Claim[]>([]);
  const [balances, setBalances] = useState<BalancesResponse | null>(null);

  // payments used for window summary (provider-specific or all)
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loadingPayments, setLoadingPayments] = useState(false);

  const [loadingClaims, setLoadingClaims] = useState(false);
  const [loadingBalances, setLoadingBalances] = useState(false);

  // filters
  const [providerId, setProviderId] = useState<string>("");
  const [status, setStatus] = useState<string>(""); // "", "submitted", "partially_paid", "paid"
  const [win, setWin] = useState<WindowKind>("all");
  const [customFrom, setCustomFrom] = useState<string>("");
  const [customTo, setCustomTo] = useState<string>("");

  // modals & drawer
  const [showClaim, setShowClaim] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [detailProviderId, setDetailProviderId] = useState<string>("");

  // editing states
  const [editingClaimId, setEditingClaimId] = useState<string>("");
  const [editingPaymentId, setEditingPaymentId] = useState<string>("");

  // auth hint
  const [authError, setAuthError] = useState(false);

  // form state (claim) — simplified (derive year/month from start date)
  const [cProviderId, setCProviderId] = useState<string>("");
  const [cStart, setCStart] = useState<string>(() =>
    startOfUTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1).toISOString().slice(0, 10)
  );
  const [cEnd, setCEnd] = useState<string>(() =>
    endOfUTC(new Date().getUTCFullYear(), new Date().getUTCMonth() + 1, 0).toISOString().slice(0, 10)
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

  // convenient window helper (start & end inclusive)
  const windowRange = useMemo(() => {
    if (win === "all") return { from: "", to: "" };
    const now = new Date();
    const y = now.getUTCFullYear();
    if (win === "ytd") {
      const from = startOfUTC(y, 0, 1).toISOString().slice(0, 10);
      const to = endOfUTC(y, now.getUTCMonth(), now.getUTCDate()).toISOString().slice(0, 10);
      return { from, to };
    }
    if (typeof win === "number") {
      const from = startOfUTC(win, 0, 1).toISOString().slice(0, 10);
      const to = endOfUTC(win, 11, 31).toISOString().slice(0, 10);
      return { from, to };
    }
    // custom
    return { from: customFrom, to: customTo };
  }, [win, customFrom, customTo]);

  const reloadClaims = () => {
    setLoadingClaims(true);
    const params = new URLSearchParams();
    if (providerId) params.set("providerId", providerId);
    if (status) params.set("status", status);

    // Server supports ?year, so use it where possible.
    if (win === "ytd") {
      params.set("year", String(new Date().getUTCFullYear()));
    } else if (typeof win === "number") {
      params.set("year", String(win));
    }
    api<Claim[]>(`/api/insurance-claims?${params.toString()}`)
      .then((rows) => {
        // Client-side guard: apply exact date window when needed.
        const { from, to } = windowRange;
        let out = rows.slice();
        if (from && to) {
          const f = new Date(from);
          const t = new Date(to);
          out = out.filter((c) => {
            const d = new Date(c.periodStart); // month bucket start
            return d >= f && d <= t;
          });
        }
        setClaims(out);
      })
      .catch((e: any) => {
        console.error("claims", e);
        if (e?.status === 401) setAuthError(true);
      })
      .finally(() => setLoadingClaims(false));
  };

  useEffect(reloadClaims, [providerId, status, win, customFrom, customTo]);

  const reloadBalances = () => {
    setLoadingBalances(true);
    const params = new URLSearchParams();
    if (providerId) params.set("providerId", providerId);
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

  useEffect(reloadBalances, [providerId]);

  // payments for the summary window (provider-specific or all)
  useEffect(() => {
    setLoadingPayments(true);
    const params = new URLSearchParams();
    if (providerId) params.set("providerId", providerId);

    api<Payment[]>(`/api/insurance-payments?${params.toString()}`)
      .then((rows) => setPayments(rows))
      .catch(() => setPayments([]))
      .finally(() => setLoadingPayments(false));
  }, [providerId]);

  // open-claim options for Record Payment form
  const openClaims = useMemo(
    () => claims.filter((c) => c.status !== "paid" && (!pProviderId || c.providerId === pProviderId)),
    [claims, pProviderId]
  );

  // claims/payments within window (for cards)
  const claimsInWindow = useMemo(() => {
    const { from, to } = windowRange;
    if (!from || !to) return claims;
    const f = new Date(from);
    const t = new Date(to);
    return claims.filter((c) => {
      const d = new Date(c.periodStart);
      return d >= f && d <= t;
    });
  }, [claims, windowRange]);

  const paymentsInWindow = useMemo(() => {
    const { from, to } = windowRange;
    if (!from || !to) return payments;
    const f = new Date(from);
    const t = new Date(to);
    return payments.filter((p) => {
      const raw = p.paymentDate || p.createdAt || "";
      const d = raw ? new Date(raw) : new Date("Invalid");
      return isFinite(d.getTime()) && d >= f && d <= t;
    });
  }, [payments, windowRange]);

  // summary (billed/collected from visible window; carry from before window)
  const summary = useMemo(() => {
    const billed = claimsInWindow.reduce((a, c) => a + Number(c.claimedAmount || 0), 0);
    const collected = paymentsInWindow.reduce((a, p) => a + Number(p.amount || 0), 0);

    // Compute carry-forward using all-time totals if a provider is selected.
    let carry = 0;
    if (providerId && balances) {
      const row = balances.providers.find((r) => r.providerId === providerId);
      if (row) {
        const allOutstanding = Number(row.claimed || 0) - Number(row.paid || 0);
        const windowOutstanding = billed - collected;
        carry = allOutstanding - windowOutstanding;
      }
    }
    const outstanding = billed - collected + carry;
    return { billed, collected, carry, outstanding };
  }, [claimsInWindow, paymentsInWindow, providerId, balances]);

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

  /* ------------------------ create / edit claim ------------------------ */
  function hydrateClaimForm(c: Claim) {
    setCProviderId(c.providerId);
    setCStart(c.periodStart.slice(0, 10));
    setCEnd(c.periodEnd.slice(0, 10));
    setCCurrency(c.currency);
    setCAmount(String(c.claimedAmount));
    setCNotes(c.notes || "");
  }

  async function submitClaim() {
    // derive periodYear/periodMonth from start date
    const d = new Date(cStart);
    const periodYear = d.getUTCFullYear();
    const periodMonth = d.getUTCMonth() + 1;

    const body = {
      providerId: cProviderId || providerId,
      periodYear,
      periodMonth,
      periodStart: cStart,
      periodEnd: cEnd,
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
        await api<Claim>("/api/insurance-claims", {
          method: "POST",
          body: JSON.stringify(body),
        });
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
    } catch (e: any) {
      alert(`Failed to delete claim: ${e.message || e}`);
    }
  }

  /* ----------------------- create / edit payment ----------------------- */
  function hydratePaymentForm(p: Payment) {
    setPProviderId(p.providerId);
    setPClaimId(p.claimId || "");
    setPDate((p.paymentDate || "").slice(0, 10) || new Date().toISOString().slice(0, 10));
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
      // refresh visible numbers
      reloadBalances();
      reloadClaims();
      // refresh payments cache for summary
      const params = new URLSearchParams();
      if (providerId) params.set("providerId", providerId);
      setLoadingPayments(true);
      api<Payment[]>(`/api/insurance-payments?${params.toString()}`)
        .then(setPayments)
        .finally(() => setLoadingPayments(false));
      alert("Payment saved");
    } catch (e: any) {
      alert(`Failed to save payment: ${e.message || e}`);
    }
  }

  async function deletePayment(id: string) {
    if (!confirm("Delete this payment? This cannot be undone.")) return;
    try {
      await api(`/api/insurance-payments/${id}`, { method: "DELETE" });
      // refresh everything since balances & summaries depend on it
      reloadBalances();
      reloadClaims();
      const params = new URLSearchParams();
      if (providerId) params.set("providerId", providerId);
      setLoadingPayments(true);
      api<Payment[]>(`/api/insurance-payments?${params.toString()}`)
        .then(setPayments)
        .finally(() => setLoadingPayments(false));
    } catch (e: any) {
      alert(`Failed to delete payment: ${e.message || e}`);
    }
  }

  /* ----------------------------- UI ----------------------------- */
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
              const now = new Date();
              const s = startOfUTC(now.getUTCFullYear(), now.getUTCMonth(), 1).toISOString().slice(0, 10);
              const e = endOfUTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0).toISOString().slice(0, 10);
              setCStart(s);
              setCEnd(e);
              setCCurrency("USD");
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
              setPDate(new Date().toISOString().slice(0, 10));
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
            onClick={() => exportClaimsCsv(claimsInWindow, providers)}
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

      {/* Filters */}
      <div className="rounded-2xl border p-3 mb-4 grid grid-cols-1 gap-3">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
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
          </select>
        </div>

        {/* Window chips */}
        <div className="flex flex-wrap items-center gap-2">
          {[
            { k: "all" as WindowKind, label: "All time" },
            { k: "ytd" as WindowKind, label: "YTD" },
            { k: new Date().getUTCFullYear(), label: `Year ${new Date().getUTCFullYear()}` },
            { k: new Date().getUTCFullYear() - 1, label: `Year ${new Date().getUTCFullYear() - 1}` },
            { k: new Date().getUTCFullYear() - 2, label: `Year ${new Date().getUTCFullYear() - 2}` },
            { k: new Date().getUTCFullYear() - 3, label: `Year ${new Date().getUTCFullYear() - 3}` },
            { k: "custom" as WindowKind, label: "Custom" },
          ].map(({ k, label }) => {
            const active = win === k || (typeof k === "number" && typeof win === "number" && win === k);
            return (
              <button
                key={String(label)}
                onClick={() => setWin(k)}
                className={`px-3 py-1.5 rounded-lg border ${active ? "bg-slate-900 text-white border-slate-900" : "bg-white hover:bg-slate-50"}`}
              >
                {label}
              </button>
            );
          })}

          <button
            onClick={() => {
              setProviderId("");
              setStatus("");
              setWin("all");
              setCustomFrom("");
              setCustomTo("");
            }}
            className="ml-auto px-3 py-1.5 rounded-lg border hover:bg-slate-50"
          >
            Clear filters
          </button>
        </div>

        {/* Custom range inputs */}
        {win === "custom" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input
              type="date"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
              className="border rounded-lg p-2"
              placeholder="From (YYYY-MM-DD)"
            />
            <input
              type="date"
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
              className="border rounded-lg p-2"
              placeholder="To (YYYY-MM-DD)"
            />
          </div>
        )}
      </div>

      {/* Summary row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-6">
        <div className="rounded-2xl border bg-white p-4">
          <div className="text-slate-500 text-sm">Billed</div>
          <div className="mt-1 text-xl font-semibold">{money(summary.billed, "USD")}</div>
          <div className="text-xs text-slate-500 mt-1">
            {selectedProvider ? selectedProvider.name : "All providers"}
          </div>
        </div>
        <div className="rounded-2xl border bg-white p-4">
          <div className="text-slate-500 text-sm">Collected</div>
          <div className="mt-1 text-xl font-semibold">
            {loadingPayments ? "…" : money(summary.collected, "USD")}
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

      {/* Layout: left = claims table, right = balances */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Claims Table */}
        <div className="lg:col-span-2 bg-white rounded-xl border">
          <div className="px-4 py-3 border-b flex items-center justify-between">
            <div className="font-medium">Claims</div>
            <div className="text-sm text-slate-500">
              {claimsInWindow.length} {claimsInWindow.length === 1 ? "item" : "items"}
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
                {claimsInWindow.map((c) => {
                  const prov = providers.find((p) => p.id === c.providerId);
                  return (
                    <tr key={c.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="p-3">{prov?.name || c.providerId}</td>
                      <td className="p-3">
                        {new Date(c.periodYear, c.periodMonth - 1).toLocaleString("en-US", {
                          month: "long",
                          year: "numeric",
                        })}
                      </td>
                      <td className="p-3">{money(c.claimedAmount, c.currency)}</td>
                      <td className="p-3"><StatusChip status={c.status} /></td>
                      <td className="p-3">{c.notes || ""}</td>
                      <td className="p-3 text-right">
                        <div className="inline-flex gap-2">
                          <button
                            className="text-xs px-2 py-1 rounded-md border"
                            onClick={() => {
                              setEditingClaimId(c.id);
                              hydrateClaimForm(c);
                              setShowClaim(true);
                            }}
                          >
                            Edit
                          </button>
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

                {!loadingClaims && claimsInWindow.length === 0 && (
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

            {!loadingBalances &&
              balances?.providers.map((row) => {
                const carry = Number((row as any).openingBalance || 0);
                const asOf = (row as any).openingBalanceAsOf || null;
                const outstandingWithCarry = (row.claimed || 0) - (row.paid || 0) + carry;

                return (
                  <div key={row.providerId} className="border rounded-lg p-3 hover:shadow-sm transition-shadow bg-white">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <ProgressRing billed={row.claimed} paid={row.paid} balance={outstandingWithCarry} />
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
                        <div className="font-semibold">{money(row.claimed, "USD")}</div>
                      </div>
                      <div className="bg-slate-50 rounded p-2">
                        <div className="text-slate-500">Collected</div>
                        <div className="font-semibold">{money(row.paid, "USD")}</div>
                      </div>
                      <div className="bg-slate-50 rounded p-2">
                        <div className="text-slate-500">Carry Fwd</div>
                        <div className={`font-semibold ${carry < 0 ? "text-emerald-700" : ""}`}>
                          {carry < 0 ? `Credit ${money(Math.abs(carry), "USD")}` : money(carry, "USD")}
                        </div>
                        {asOf && <div className="text-[10px] text-slate-500 mt-0.5">as of {new Date(asOf).toLocaleDateString()}</div>}
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
                  const prov =
                    balances?.providers.find((r) => r.providerId === detailProviderId) ||
                    { claimed: 0, paid: 0, balance: 0 };
                  const carry = Number((prov as any).openingBalance || 0);
                  const asOf = (prov as any).openingBalanceAsOf || null;
                  const outWithCarry = (prov.claimed || 0) - (prov.paid || 0) + carry;

                  return (
                    <>
                      <div className="rounded-lg border p-3">
                        <div className="text-xs text-slate-500">Billed</div>
                        <div className="font-semibold">{money(prov.claimed, "USD")}</div>
                      </div>
                      <div className="rounded-lg border p-3">
                        <div className="text-xs text-slate-500">Collected</div>
                        <div className="font-semibold">{money(prov.paid, "USD")}</div>
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
                <div className="mb-2 font-medium">Claims</div>
                {providerClaimsForDrawer.length === 0 && (
                  <div className="text-sm text-slate-500">No claims for this provider.</div>
                )}
                <div className="divide-y border rounded-lg">
                  {providerClaimsForDrawer.map((c) => {
                    const pct =
                      Number(c.claimedAmount) > 0
                        ? Math.min(100, Math.round((Number(c.paidToDate) / Number(c.claimedAmount)) * 100))
                        : 0;
                    return (
                      <div key={c.id} className="p-3">
                        <div className="flex items-center justify-between">
                          <div className="font-medium">
                            {new Date(c.periodYear, c.periodMonth - 1).toLocaleString("en-US", {
                              month: "long",
                              year: "numeric",
                            })}
                          </div>
                          <div className="flex items-center gap-2">
                            <StatusChip status={c.status} />
                            <button
                              className="text-xs px-2 py-1 rounded-md border"
                              onClick={() => {
                                setEditingClaimId(c.id);
                                hydrateClaimForm(c);
                                setShowClaim(true);
                              }}
                            >
                              Edit
                            </button>
                            <button
                              className="text-xs px-2 py-1 rounded-md border text-rose-700"
                              onClick={() => deleteClaim(c.id)}
                            >
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
                            <div className="text-slate-500">Collected</div>
                            <div className="font-semibold">{money(c.paidToDate, c.currency)}</div>
                          </div>
                          <div className="bg-slate-50 rounded p-2">
                            <div className="text-slate-500">Outstanding</div>
                            <div className="font-semibold">{money(c.balance, c.currency)}</div>
                          </div>
                        </div>

                        {/* progress bar */}
                        <div className="mt-2 h-1.5 w-full bg-slate-100 rounded">
                          <div
                            className="h-1.5 bg-emerald-500 rounded"
                            style={{ width: `${pct}%` }}
                            title={`${pct}% collected`}
                          />
                        </div>

                        <div className="mt-2 flex items-center justify-between">
                          <div className="text-xs text-slate-500">{c.notes || ""}</div>
                          <button
                            className="text-xs px-2 py-1 rounded-md bg-slate-700 text-white hover:bg-slate-600"
                            onClick={() => {
                              setPProviderId(c.providerId);
                              setPClaimId(c.id);
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

              {/* Payments history */}
              <div>
                <div className="mb-2 font-medium">Payments (history)</div>
                {loadingPayments && <div className="text-sm text-slate-500">Loading…</div>}
                {!loadingPayments && payments.length === 0 && (
                  <div className="text-sm text-slate-500">No payments recorded.</div>
                )}
                <div className="divide-y border rounded-lg">
                  {payments
                    .filter((p) => !detailProviderId || p.providerId === detailProviderId)
                    .map((p) => {
                      const claim = balances?.claims.find((c) => c.id === p.claimId);
                      const rawDate = p.paymentDate || p.createdAt || "";
                      const d = rawDate ? new Date(rawDate) : new Date("Invalid");
                      const dateStr = isFinite(d.getTime())
                        ? d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })
                        : "—";
                      return (
                        <div key={p.id} className="p-3 flex items-center justify-between">
                          <div className="text-sm">
                            <div className="font-medium">{money(p.amount, p.currency)}</div>
                            <div className="text-xs text-slate-500">
                              {dateStr}
                              {claim
                                ? ` • ${new Date(claim.periodYear, claim.periodMonth - 1).toLocaleString("en-US", {
                                    month: "short",
                                    year: "numeric",
                                  })}`
                                : ""}
                              {p.reference ? ` • Ref: ${p.reference}` : ""}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              className="text-xs px-2 py-1 rounded-md border"
                              onClick={() => {
                                setEditingPaymentId(p.id);
                                hydratePaymentForm(p);
                                setShowPayment(true);
                              }}
                            >
                              Edit
                            </button>
                            <button
                              className="text-xs px-2 py-1 rounded-md border text-rose-700"
                              onClick={() => deletePayment(p.id)}
                            >
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
                  <select
                    className="border rounded-lg p-2 w-full"
                    value={cProviderId}
                    onChange={(e) => setCProviderId(e.target.value)}
                  >
                    <option value="">Select…</option>
                    {providers.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Currency</label>
                  <select className="border rounded-lg p-2 w-full" value={cCurrency} onChange={(e) => setCCurrency(e.target.value as any)}>
                    <option value="USD">USD</option>
                    <option value="SSP">SSP</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs text-slate-500 mb-1">Period Start</label>
                  <input type="date" className="border rounded-lg p-2 w-full" value={cStart} onChange={(e) => setCStart(e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Period End</label>
                  <input type="date" className="border rounded-lg p-2 w-full" value={cEnd} onChange={(e) => setCEnd(e.target.value)} />
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
              <button className="px-3 py-2 rounded-lg bg-slate-900 text-white hover:bg-slate-800" onClick={submitClaim}>
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
                    {providers.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Link to Claim (optional)</label>
                  <select className="border rounded-lg p-2 w-full" value={pClaimId} onChange={(e) => setPClaimId(e.target.value)}>
                    <option value="">— None —</option>
                    {openClaims.map((c) => (
                      <option key={c.id} value={c.id}>
                        {new Date(c.periodYear, c.periodMonth - 1).toLocaleString("en-US", {
                          month: "short",
                          year: "numeric",
                        })} — {money(c.claimedAmount, c.currency)}
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
              <button className="px-3 py-2 rounded-lg bg-slate-700 text-white hover:bg-slate-600" onClick={submitPayment}>
                {editingPaymentId ? "Save Changes" : "Record Payment"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
