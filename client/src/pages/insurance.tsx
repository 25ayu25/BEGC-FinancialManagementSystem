import React, { useEffect, useMemo, useState, useRef } from "react";
import { Calendar as CalendarIcon, Search, X, Send, Wallet, CheckCircle, AlertCircle, Plus, CreditCard, Download, HelpCircle, ChevronDown, ChevronUp, FileText } from "lucide-react";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { useToast } from "@/hooks/use-toast";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

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
  paymentDate?: string | null; // ISO (preferred display date)
  amount: number | string;
  currency: "USD" | "SSP";
  reference?: string | null;
  notes?: string | null;
  createdAt?: string | null;   // ISO (fallback display date)
};

type BalancesResponse = {
  providers: Array<{
    providerId: string;
    providerName: string;
    claimed: number;   // billed in window
    paid: number;      // collected in window
    balance?: number;
    outstanding?: number;
    credit?: number;
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

const fmtDate = (iso?: string | null) => {
  if (!iso) return "—";
  
  // Handle various date formats
  let dateStr = iso;
  
  // If it's an ISO timestamp, extract just the date part
  if (dateStr.includes('T')) {
    dateStr = dateStr.split('T')[0];
  }
  
  // Try to parse YYYY-MM-DD format (creates local date to avoid timezone issues)
  const parts = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (parts) {
    const d = new Date(Number(parts[1]), Number(parts[2]) - 1, Number(parts[3]));
    return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
  }
  
  // Fallback: try Date.parse on original string
  const t = Date.parse(iso);
  if (!Number.isNaN(t)) {
    return new Date(t).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
  }
  
  return "—";
};

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

/* --------------------- **Payment date normalizer** --------------------- */
/* Some APIs return snake_case. Always display payment_date if present.    */
function getPaymentDate(p: Payment | any): string | undefined {
  const raw = p?.paymentDate ?? p?.payment_date ?? p?.date;
  if (!raw) return undefined;
  // Handle both string dates and Date objects
  if (raw instanceof Date) return raw.toISOString();
  if (typeof raw === 'string') return raw;
  return undefined;
}
function getCreatedAt(p: Payment | any): string | undefined {
  return (p?.createdAt ?? p?.created_at ?? undefined) || undefined;
}
function displayPaymentDate(p: Payment): string {
  const paymentDate = getPaymentDate(p);
  if (paymentDate) return fmtDate(paymentDate);
  
  // Fallback to createdAt if paymentDate is null
  const createdAt = getCreatedAt(p);
  return createdAt ? fmtDate(createdAt) : "—";
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
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="p-2 rounded-lg border hover:bg-slate-50 transition-colors"
            title="What do these numbers mean?"
          >
            <HelpCircle className="h-4 w-4 text-slate-500" />
          </button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Click for help</p>
        </TooltipContent>
      </Tooltip>
      {open && (
        <div className="absolute right-0 z-20 mt-2 w-80 rounded-xl border bg-white p-3 text-sm shadow-lg">
          <div className="font-medium mb-1">How to read this page</div>
          <ul className="list-disc pl-5 space-y-1 text-slate-600">
            <li><strong>Claims sent</strong>: Total claims submitted in the selected time window.</li>
            <li><strong>Payments received</strong>: Total payments received from providers in the window.</li>
            <li><strong>Still unpaid</strong>: Amount owed by providers (Claims - Payments). Shown when Claims &gt;= Payments.</li>
            <li><strong>Overpaid</strong>: You've received more payments than claims submitted in this window. This can happen when providers pay claims from a previous period.</li>
          </ul>
          <div className="mt-3 p-2 bg-emerald-50 rounded-lg text-xs text-emerald-700">
            <strong>Example:</strong> If you sent $10,000 in claims and received $12,000 in payments, the page shows "Overpaid: USD 2,000".
          </div>
          <div className="text-right mt-2">
            <button className="text-xs text-slate-500 hover:underline" onClick={() => setOpen(false)}>Close</button>
          </div>
        </div>
      )}
    </TooltipProvider>
  );
}

function ProgressRing({ billed, paid, balance }: { billed: number; paid: number; balance: number }) {
  const pct = billed > 0 ? Math.min(100, Math.round((paid / billed) * 100)) : 0;
  const isOverpaid = balance < 0;
  const sweep = Math.round((isOverpaid ? 100 : pct) * 3.6);
  return (
    <div className="relative h-10 w-10 shrink-0">
      <div className="absolute inset-0 rounded-full" style={{ background: `conic-gradient(#10b981 ${sweep}deg, #e5e7eb 0deg)` }} />
      <div className="absolute inset-[3px] rounded-full bg-white flex items-center justify-center">
        {isOverpaid ? (
          <CheckCircle className="h-4 w-4 text-emerald-600" />
        ) : (
          <span className="text-[10px] font-semibold text-slate-700">{pct}%</span>
        )}
      </div>
    </div>
  );
}

function exportClaimsCsv(rows: Claim[], providers: Provider[]) {
  const byId = new Map(providers.map((p) => [p.id, p.name]));
  const header = ["Provider","Year","Month","Currency","Claims sent","Status","Notes"].join(",");
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

/* CSV for payments (no reference column) */
function exportPaymentsCSV(rows: Payment[], providers: Provider[]) {
  const byId = new Map(providers.map((p) => [p.id, p.name]));
  const header = ["Payment Date","Provider","Currency","Amount","Notes"].join(",");
  const body = rows.map((p) =>
    [
      displayPaymentDate(p), // use normalized payment date
      (byId.get(p.providerId) || p.providerId).replace(/,/g, " "),
      p.currency,
      Number(p.amount),
      String(p.notes || "").replace(/[\r\n,]+/g, " "),
    ].join(",")
  );
  const csv = [header, ...body].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "insurance-payments.csv";
  a.click();
  URL.revokeObjectURL(a.href);
}

/* ------------------------- DateField ------------------------ */
function toISO(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function fromISO(s?: string | null) {
  if (!s) return undefined;
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return undefined;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}
function fmtDisplay(iso?: string) {
  const d = fromISO(iso || "");
  return d ? d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }) : "";
}
function DateField({
  value,
  onChange,
  placeholder = "Pick a date",
}: {
  value?: string;
  onChange: (iso: string) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = fromISO(value);
  const initialMonth = selected ?? new Date();

  return (
    <Popover modal open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="w-full inline-flex items-center justify-between rounded-lg border px-3 py-2 text-left text-sm hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
        >
          <span className={fmtDisplay(value) ? "text-slate-900" : "text-slate-500"}>
            {fmtDisplay(value) || placeholder}
          </span>
          <CalendarIcon className="ml-2 h-4 w-4 text-slate-500 shrink-0" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="z-[70] p-2 bg-white" sideOffset={8} align="start">
        <Calendar
          mode="single"
          selected={selected}
          defaultMonth={initialMonth}
          onSelect={(d) => {
            if (d) {
              onChange(toISO(d));
              setOpen(false);
            }
          }}
          numberOfMonths={1}
          captionLayout="dropdown"
          fromYear={2015}
          toYear={new Date().getFullYear() + 1}
          showOutsideDays
        />
      </PopoverContent>
    </Popover>
  );
}

/* ------------------------------ Page ----------------------------- */
type WindowPreset = "all" | "ytd" | "year-2025" | "year-2024" | "year-2023" | "year-2022" | "custom";

export default function InsurancePage() {
  // Toast notifications
  const { toast } = useToast();
  
  // data
  const [providers, setProviders] = useState<Provider[]>([]);
  const [claims, setClaims] = useState<Claim[]>([]);
  const [balances, setBalances] = useState<BalancesResponse | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]); // provider drawer (all-time)
  const [loadingPayments, setLoadingPayments] = useState(false);
  const [loadingClaims, setLoadingClaims] = useState(false);
  const [loadingBalances, setLoadingBalances] = useState(false);

  // filters
  const [providerId, setProviderId] = useState<string>("");
  const [status, setStatus] = useState<string>("");

  // default window = current year
  const currentYear = new Date().getUTCFullYear();
  const [preset, setPreset] = useState<WindowPreset>(("year-" + currentYear) as WindowPreset);
  const [start, setStart] = useState<string>(() => new Date(Date.UTC(currentYear, 0, 1)).toISOString().slice(0,10));
  const [end, setEnd] = useState<string>(() => new Date(Date.UTC(currentYear, 11, 31)).toISOString().slice(0,10));

  // modals & drawer
  const [showClaim, setShowClaim] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [detailProviderId, setDetailProviderId] = useState<string>("");

  // KPI detail modals
  const [showCollected, setShowCollected] = useState(false);
  const [showOutstanding, setShowOutstanding] = useState(false);

  // payments in current window (for Collected modal)
  const [windowPayments, setWindowPayments] = useState<Payment[]>([]);
  const [loadingWindowPays, setLoadingWindowPays] = useState(false);
  const [paymentsQuery, setPaymentsQuery] = useState("");

  // editing (disabled currently)
  const [_editingClaimId, setEditingClaimId] = useState<string>("");
  const [_editingPaymentId, setEditingPaymentId] = useState<string>("");

  const [authError, setAuthError] = useState(false);

  // Collapsible state for inactive providers
  const [showInactiveProviders, setShowInactiveProviders] = useState(false);

  // Top actions (mobile dropdown)
  const [showActions, setShowActions] = useState(false);
  const actionsRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (!actionsRef.current) return;
      if (!actionsRef.current.contains(e.target as Node)) setShowActions(false);
    };
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, []);

  // ---- Add-Claim form (single Claim Date) ----
  const [cProviderId, setCProviderId] = useState<string>("");
  const [cDate, setCDate] = useState<string>(() => new Date().toISOString().slice(0,10));
  const [cCurrency, setCCurrency] = useState<"USD" | "SSP">("USD");
  const [cAmount, setCAmount] = useState<string>("0");
  const [cNotes, setCNotes] = useState<string>("");

  // Payment form
  const [pProviderId, setPProviderId] = useState<string>("");
  const [pDate, setPDate] = useState<string>(() => new Date().toISOString().slice(0,10));
  const [pAmount, setPAmount] = useState<string>("0");
  const [pCurrency, setPCurrency] = useState<"USD" | "SSP">("USD");
  const [pNotes, setPNotes] = useState<string>("");
  const [pAmountError, setPAmountError] = useState<string>("");
  const [pProviderError, setPProviderError] = useState<string>("");

  // sticky header shadow only after scroll
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // measure top sticky header height for offset
  const headerRef = useRef<HTMLDivElement | null>(null);
  const [headerH, setHeaderH] = useState(64);
  useEffect(() => {
    const el = headerRef.current;
    if (!el) return;
    const update = () => setHeaderH(el.getBoundingClientRect().height || 64);
    update();
    const ro = (typeof ResizeObserver !== "undefined") ? new ResizeObserver(update) : null;
    ro?.observe(el);
    window.addEventListener("resize", update, { passive: true });
    return () => {
      ro?.disconnect();
      window.removeEventListener("resize", update);
    };
  }, []);

  // measure filters height to offset sticky summary on desktop
  const filtersRef = useRef<HTMLDivElement | null>(null);
  const [filtersH, setFiltersH] = useState(0);
  useEffect(() => {
    const el = filtersRef.current;
    if (!el) return;
    const update = () => setFiltersH(el.getBoundingClientRect().height || 0);
    update();
    const ro = (typeof ResizeObserver !== "undefined") ? new ResizeObserver(update) : null;
    ro?.observe(el);
    window.addEventListener("resize", update, { passive: true });
    return () => {
      ro?.disconnect();
      window.removeEventListener("resize", update);
    };
  }, []);

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
      setEnd(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString().slice(0,10));
      return;
    }
    if (p.startsWith("year-")) {
      const y = Number(p.replace("year-",""));
      yearOf(y);
      return;
    }
  }

  function monthBoundsFromDateStr(dateStr?: string) {
    let y: number, m: number;
    if (dateStr && /^\d{4}-\d{2}/.test(dateStr)) {
      y = Number(dateStr.slice(0, 4));
      m = Number(dateStr.slice(5, 7));
    } else {
      const d = new Date();
      y = d.getUTCFullYear();
      m = d.getUTCMonth() + 1;
    }
    const startIso = new Date(Date.UTC(y, m - 1, 1)).toISOString().slice(0, 10);
    const endIso = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
    return { startIso, endIso };
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
    if (status) params.set("status", status);
    api<BalancesResponse>(`/api/insurance-balances?${params.toString()}`)
      .then(setBalances)
      .catch((e: any) => { console.error("balances", e); if (e?.status === 401) setAuthError(true); })
      .finally(() => setLoadingBalances(false));
  };

  useEffect(reloadClaims, [providerId, status, start, end]);
  useEffect(reloadBalances, [providerId, status, start, end]);

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

  // payments in current window (for Collected modal)
  async function loadWindowPayments() {
    setLoadingWindowPays(true);
    const params = windowParams(new URLSearchParams());
    if (providerId) params.set("providerId", providerId);
    try {
      const rows = await api<Payment[]>(`/api/insurance-payments?${params.toString()}`);
      setWindowPayments(rows);
    } catch {
      setWindowPayments([]);
    } finally {
      setLoadingWindowPays(false);
    }
  }

  // summary (window)
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

  const orderedBalanceProviders = useMemo(
    () =>
      (balances?.providers ?? [])
        .slice()
        .sort((a, b) => rank(a.providerName) - rank(b.providerName) || a.providerName.localeCompare(b.providerName)),
    [balances]
  );

  /* -------------------- derived data for KPI modals -------------------- */
  function normalizedPayments(list: Payment[]) {
    return list
      .slice()
      .filter((p) => p.currency === "USD")
      .sort((a, b) => {
        const da = Date.parse(getPaymentDate(a) || "");
        const db = Date.parse(getPaymentDate(b) || "");
        // Payments without payment dates go to the end
        if (isNaN(da) && isNaN(db)) return 0;
        if (isNaN(da)) return 1;
        if (isNaN(db)) return -1;
        return db - da; // newest first
      });
  }

  const filteredWindowPayments = useMemo(() => {
    const rows = normalizedPayments(windowPayments);
    if (!paymentsQuery.trim()) return rows;
    const q = paymentsQuery.toLowerCase();
    const byId = new Map(providers.map((p) => [p.id, p.name.toLowerCase()]));
    return rows.filter((p) => {
      const prov = byId.get(p.providerId) || "";
      return prov.includes(q) || String(p.notes || "").toLowerCase().includes(q);
    });
  }, [windowPayments, paymentsQuery, providers]);

  const providerTotals = useMemo(() => {
    const byId = new Map<string, number>();
    normalizedPayments(filteredWindowPayments).forEach((p) => {
      const cur = byId.get(p.providerId) || 0;
      byId.set(p.providerId, cur + Number(p.amount || 0));
    });
    const arr = Array.from(byId.entries()).map(([pid, total]) => ({
      providerId: pid,
      name: providers.find((x) => x.id === pid)?.name || pid,
      total,
    }));
    return arr.sort((a, b) => rank(a.name) - rank(b.name) || b.total - a.total);
  }, [filteredWindowPayments, providers]);

  const orderedOutstanding = useMemo(() => {
    const rows = (balances?.providers || []).slice();
    const filteredByProvider = providerId ? rows.filter((r) => r.providerId === providerId) : rows;
    const withPositiveOutstanding = filteredByProvider.map((r) => ({
      providerId: r.providerId,
      providerName: r.providerName,
      outstanding: (r.claimed || 0) - (r.paid || 0),
    })).filter((r) => r.outstanding > 0);
    return withPositiveOutstanding.sort((a, b) => b.outstanding - a.outstanding);
  }, [balances, providerId]);

  /* ----------------------------- payment form helpers ----------------------------- */
  // Computed validation state for payment form
  const isPaymentFormValid = Number(pAmount) > 0 && !!pProviderId;
  
  // Reset payment form to initial state
  const resetPaymentForm = () => {
    setShowPayment(false);
    setEditingPaymentId("");
    setPProviderId("");
    setPDate(new Date().toISOString().slice(0, 10));
    setPAmount("0");
    setPCurrency("USD");
    setPNotes("");
    setPAmountError("");
    setPProviderError("");
  };

  /* ----------------------------- small helpers ----------------------------- */
  function windowLabel() {
    if (preset === "all") return "All time";
    if (preset === "ytd") return "Year to date";
    if (preset.startsWith("year-")) return `Year ${preset.replace("year-","")}`;
    if (preset === "custom") return `${fmtDisplay(start)} – ${fmtDisplay(end)}`;
    return "";
  }

  /* ----------------------------- UI helpers ----------------------------- */
  function SummaryCards() {
    const isOverpaid = summary.outstanding < 0;
    const isUnpaid = summary.outstanding > 0;
    
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* Claims sent card */}
        <div className="rounded-2xl border bg-white p-4 hover:shadow-md transition-all duration-200">
          <div className="flex items-center gap-2 text-slate-500 text-sm">
            <Send className="h-4 w-4" />
            <span>Claims sent</span>
          </div>
          <div className="mt-1 text-[22px] font-semibold">{money(summary.billed, "USD")}</div>
          <div className="text-xs text-slate-500 mt-1">
            {selectedProvider ? selectedProvider.name : "All providers"}
          </div>
        </div>

        {/* Payments received card - Clickable KPI */}
        <button
          onClick={async () => { await loadWindowPayments(); setPaymentsQuery(""); setShowCollected(true); }}
          className="text-left rounded-2xl border bg-white p-4 hover:shadow-md transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
          title="Click to view all payments in this window"
        >
          <div className="flex items-center gap-2 text-slate-500 text-sm">
            <Wallet className="h-4 w-4" />
            <span>Payments received</span>
          </div>
          <div className="mt-1 text-[22px] font-semibold">{money(summary.collected, "USD")}</div>
          <div className="text-xs text-slate-500 mt-1">Payments received (window) • Click for details</div>
        </button>

        {/* Outstanding/Overpaid card - Clickable KPI */}
        <button
          onClick={() => setShowOutstanding(true)}
          className={`text-left rounded-2xl border p-4 hover:shadow-md transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-300 ${
            isOverpaid ? "bg-emerald-50 border-emerald-200" : isUnpaid ? "bg-amber-50 border-amber-200" : "bg-white"
          }`}
          title="Click to view outstanding by provider"
        >
          <div className={`flex items-center gap-2 text-sm ${isOverpaid ? "text-emerald-600" : isUnpaid ? "text-amber-600" : "text-slate-500"}`}>
            {isOverpaid ? (
              <CheckCircle className="h-4 w-4" />
            ) : (
              <AlertCircle className="h-4 w-4" />
            )}
            <span>{isOverpaid ? "Overpaid" : "Still unpaid"}</span>
          </div>
          <div className={`mt-1 text-[22px] font-semibold ${isOverpaid ? "text-emerald-700" : isUnpaid ? "text-amber-700" : ""}`}>
            {money(Math.abs(summary.outstanding), "USD")}
          </div>
          <div className={`text-xs mt-1 ${isOverpaid ? "text-emerald-600" : isUnpaid ? "text-amber-600" : "text-slate-500"}`}>
            {isOverpaid ? "You've received more than claimed" : "Claims sent − Payments received"} • Click for details
          </div>
        </button>
      </div>
    );
  }

  /* ----------------------------- UI ----------------------------- */
  return (
    <div className="max-w-[1200px] mx-auto">
      {/* Sticky header with actions */}
      <div ref={headerRef} className={`sticky top-0 z-30 bg-white ${scrolled ? "border-b shadow-sm" : ""}`}>
        <div className="px-4 sm:px-6 py-3 flex items-center justify-between gap-2">
          <h1 className="text-2xl font-semibold">Insurance Management</h1>

          {/* Desktop actions */}
          <div className="hidden md:flex items-center gap-2">
            <button
              onClick={() => {
                setEditingClaimId("");
                setCProviderId(providerId || "");
                setCDate(new Date().toISOString().slice(0,10));
                setCCurrency("USD");
                setCAmount("0");
                setCNotes("");
                setShowClaim(true);
              }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-900 text-white hover:bg-slate-800 transition-colors"
            >
              <Plus className="h-4 w-4" />
              Add Claim
            </button>

            <button
              onClick={() => {
                setEditingPaymentId("");
                setPProviderId(providerId || "");
                setPDate(new Date().toISOString().slice(0, 10));
                setPAmount("0"); setPCurrency("USD"); setPNotes("");
                setShowPayment(true);
              }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-900 text-white hover:bg-slate-800 transition-colors"
            >
              <CreditCard className="h-4 w-4" />
              Record Payment
            </button>

            <button 
              onClick={() => exportClaimsCsv(claims, providers)} 
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-300 hover:bg-slate-50 transition-colors"
            >
              <Download className="h-4 w-4" />
              Export CSV
            </button>

            <HelpPopover />
          </div>

          {/* Mobile actions */}
          <div className="md:hidden relative" ref={actionsRef}>
            <button
              onClick={() => setShowActions((v) => !v)}
              className="px-3 py-2 rounded-lg bg-slate-900 text-white hover:bg-slate-800 transition-colors"
              aria-expanded={showActions}
            >
              Actions ▾
            </button>
            {showActions && (
              <div className="absolute right-0 mt-2 w-52 rounded-xl border bg-white shadow-lg p-1 z-40">
                <button
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-slate-50"
                  onClick={() => {
                    setShowActions(false);
                    setEditingClaimId("");
                    setCProviderId(providerId || "");
                    setCDate(new Date().toISOString().slice(0,10));
                    setCCurrency("USD"); setCAmount("0"); setCNotes("");
                    setShowClaim(true);
                  }}
                >
                  <Plus className="h-4 w-4" />
                  Add Claim
                </button>
                <button
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-slate-50"
                  onClick={() => {
                    setShowActions(false);
                    setEditingPaymentId("");
                    setPProviderId(providerId || "");
                    setPDate(new Date().toISOString().slice(0, 10));
                    setPAmount("0"); setPCurrency("USD"); setPNotes("");
                    setShowPayment(true);
                  }}
                >
                  <CreditCard className="h-4 w-4" />
                  Record Payment
                </button>
                <button
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-slate-50"
                  onClick={() => { setShowActions(false); exportClaimsCsv(claims, providers); }}
                >
                  <Download className="h-4 w-4" />
                  Export CSV
                </button>
                <div className="border-t my-1" />
                <div className="px-3 py-2">
                  <HelpPopover />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Auth notice */}
      <div className="p-4 sm:p-6">
        {authError && (
          <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            Authentication required. If you’re in Incognito/Private mode, allow third-party cookies or sign in again.
          </div>
        )}
      </div>

      {/* STICKY FILTERS */}
      <div ref={filtersRef} className={`sticky z-20 bg-white ${scrolled ? "border-b shadow-sm" : ""}`} style={{ top: headerH }}>
        <div className="p-4 sm:p-6 pt-3">
          <div className="rounded-xl border p-3 mb-0 grid grid-cols-1 gap-3">
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
                <option value="rejected">Rejected</option>
                <option value="written_off">Written off</option>
              </select>
            </div>

            {/* window chips */}
            <div className="flex items-center gap-2 overflow-x-auto whitespace-nowrap [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] py-2">
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
                  className={`shrink-0 px-3 py-1.5 rounded-full border focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-300 transition-colors ${
                    preset === chip.id ? "bg-slate-100 text-slate-900 border-slate-300" : "hover:bg-slate-50"
                  }`}
                >
                  {chip.label}
                </button>
              ))}
              {preset === "custom" && (
                <div className="ml-2 flex items-center gap-2">
                  <div className="w-[170px]">
                    <DateField value={start} onChange={setStart} placeholder="Start date" />
                  </div>
                  <div className="w-[170px]">
                    <DateField value={end} onChange={setEnd} placeholder="End date" />
                  </div>
                </div>
              )}
              <div className="ml-auto">
                <button onClick={() => { setProviderId(""); setStatus(""); setPresetWindow("all"); }} className="px-3 py-2 rounded-lg border hover:bg-slate-50">Clear filters</button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* SUMMARY (mobile) */}
      <div className="md:hidden p-4 sm:p-6 pt-3">
        <SummaryCards />
      </div>

      {/* SUMMARY (desktop) */}
      <div className={`hidden md:block sticky z-10 bg-white ${scrolled ? "border-b shadow-sm" : ""}`} style={{ top: headerH + filtersH }}>
        <div className="p-4 sm:p-6 pt-3">
          <SummaryCards />
        </div>
      </div>

      {/* Main content */}
      <div className="p-4 sm:p-6">
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
                    <th className="text-left p-3">Claims sent</th>
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
                            <button className="text-xs px-2 py-1 rounded-md border text-rose-700" onClick={() => {
                              if (confirm("Delete this claim? This cannot be undone.")) {
                                api(`/api/insurance-claims/${c.id}`, { method: "DELETE" }).then(() => { reloadClaims(); reloadBalances(); });
                              }
                            }}>
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {!loadingClaims && claims.length === 0 && (
                    <tr>
                      <td colSpan={6} className="p-8 text-center">
                        <div className="flex flex-col items-center gap-3">
                          <FileText className="h-12 w-12 text-slate-300" />
                          <div className="text-slate-500">You haven't submitted any claims in this period</div>
                          <button
                            onClick={() => {
                              setEditingClaimId("");
                              setCProviderId(providerId || "");
                              setCDate(new Date().toISOString().slice(0,10));
                              setCCurrency("USD");
                              setCAmount("0");
                              setCNotes("");
                              setShowClaim(true);
                            }}
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-900 text-white hover:bg-slate-800 transition-colors"
                          >
                            <Plus className="h-4 w-4" />
                            Add Your First Claim
                          </button>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Provider balances */}
          <div className="bg-white rounded-xl border">
            <div className="px-4 py-3 border-b font-medium">Provider Balances</div>
            <div className="p-4 space-y-3">
              {!balances && <div className="text-slate-500">Loading…</div>}
              {(() => {
                // Separate active (has activity) vs inactive (zero activity) providers
                const activeProviders = orderedBalanceProviders.filter(row => row.claimed > 0 || row.paid > 0);
                const inactiveProviders = orderedBalanceProviders.filter(row => row.claimed === 0 && row.paid === 0);
                
                return (
                  <>
                    {/* Active providers (always shown) */}
                    {activeProviders.map((row) => {
                      const outstanding = (row.claimed || 0) - (row.paid || 0);
                      const isOverpaid = outstanding < 0;
                      const paidPct = row.claimed > 0 ? Math.round((row.paid / row.claimed) * 100) : 0;
                      return (
                        <div key={row.providerId} className="border rounded-lg p-3 hover:shadow-md transition-all duration-200 bg-white">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <ProgressRing billed={row.claimed} paid={row.paid} balance={outstanding} />
                              <div className="font-medium">{row.providerName}</div>
                            </div>
                            <button onClick={() => setDetailProviderId(row.providerId)} className="text-sm text-indigo-600 hover:underline">
                              View details
                            </button>
                          </div>
                          <div className="text-[11px] text-emerald-700 mt-1">{paidPct}% Paid</div>
                          <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
                            <div className="bg-slate-50 rounded p-2"><div className="text-slate-500">Claims sent</div><div className="font-semibold">{money(row.claimed, "USD")}</div></div>
                            <div className="bg-slate-50 rounded p-2"><div className="text-slate-500">Payments received</div><div className="font-semibold">{money(row.paid, "USD")}</div></div>
                            <div className={`rounded p-2 ${isOverpaid ? "bg-emerald-50" : "bg-slate-50"}`}>
                              <div className={`${isOverpaid ? "text-emerald-600" : "text-slate-500"}`}>
                                {isOverpaid ? "Overpaid" : "Still unpaid"}
                              </div>
                              <div className={`font-semibold ${isOverpaid ? "text-emerald-700" : ""}`}>
                                {money(Math.abs(outstanding), "USD")}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    
                    {/* Inactive providers (collapsible) */}
                    {inactiveProviders.length > 0 && (
                      <Collapsible open={showInactiveProviders} onOpenChange={setShowInactiveProviders}>
                        <CollapsibleTrigger asChild>
                          <button className="w-full flex items-center justify-between p-3 rounded-lg border border-dashed hover:bg-slate-50 transition-colors text-sm text-slate-500">
                            <span>{inactiveProviders.length} inactive provider{inactiveProviders.length > 1 ? 's' : ''}</span>
                            {showInactiveProviders ? (
                              <ChevronUp className="h-4 w-4" />
                            ) : (
                              <ChevronDown className="h-4 w-4" />
                            )}
                          </button>
                        </CollapsibleTrigger>
                        <CollapsibleContent className="space-y-3 mt-3">
                          {inactiveProviders.map((row) => (
                            <div key={row.providerId} className="border rounded-lg p-3 bg-slate-50/50 opacity-75">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                  <ProgressRing billed={0} paid={0} balance={0} />
                                  <div className="font-medium text-slate-500">{row.providerName}</div>
                                </div>
                                <button onClick={() => setDetailProviderId(row.providerId)} className="text-sm text-indigo-600 hover:underline">
                                  View details
                                </button>
                              </div>
                              <div className="text-[11px] text-slate-400 mt-1">No activity in this window</div>
                            </div>
                          ))}
                        </CollapsibleContent>
                      </Collapsible>
                    )}
                    
                    {activeProviders.length === 0 && inactiveProviders.length === 0 && balances && (
                      <div className="text-slate-500">No balances yet.</div>
                    )}
                  </>
                );
              })()}
            </div>
          </div>
        </div>
      </div>

      {/* Drawer: Provider details (unchanged layout) */}
      {detailProviderId && (
        <div className="fixed inset-0 z-40">
          <div className="absolute inset-0 bg-black/30" onClick={() => setDetailProviderId("")} />
          <div className="absolute right-0 top-0 h-full w-full max-w-2xl bg-white shadow-2xl border-l z-50 flex flex-col">
            <div className="px-4 py-3 border-b flex items-center justify-between">
              <div className="font-medium">{providers.find((p) => p.id === detailProviderId)?.name || "Provider"}: details</div>
              <button className="text-slate-500" onClick={() => setDetailProviderId("")}>✕</button>
            </div>

            <div className="p-4 overflow-y-auto space-y-6">
              {/* Totals in current window */}
              <div className="grid grid-cols-3 gap-3">
                {(() => {
                  const prov = balances?.providers.find((r) => r.providerId === detailProviderId) || { claimed: 0, paid: 0 };
                  const outstanding = (prov.claimed || 0) - (prov.paid || 0);
                  const isOverpaid = outstanding < 0;
                  const paidPct = prov.claimed > 0 ? Math.round((prov.paid / prov.claimed) * 100) : 0;
                  return (
                    <>
                      <div className="rounded-lg border p-3"><div className="text-xs text-slate-500">Claims sent</div><div className="font-semibold">{money(prov.claimed, "USD")}</div></div>
                      <div className="rounded-lg border p-3"><div className="text-xs text-slate-500">Payments received</div><div className="font-semibold">{money(prov.paid, "USD")}</div></div>
                      <div className={`rounded-lg border p-3 ${isOverpaid ? "bg-emerald-50 border-emerald-200" : ""}`}>
                        <div className={`text-xs ${isOverpaid ? "text-emerald-600" : "text-slate-500"}`}>
                          {isOverpaid ? "Overpaid" : "Still unpaid"}
                        </div>
                        <div className={`font-semibold ${isOverpaid ? "text-emerald-700" : ""}`}>
                          {money(Math.abs(outstanding), "USD")}
                        </div>
                        <div className="text-[11px] text-emerald-700 mt-1">{paidPct}% Paid</div>
                      </div>
                    </>
                  );
                })()}
              </div>

              {/* Claims ledger */}
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
                            <button className="text-xs px-2 py-1 rounded-md border text-rose-700" onClick={() => {
                              if (confirm("Delete this claim? This cannot be undone.")) {
                                api(`/api/insurance-claims/${c.id}`, { method: "DELETE" }).then(() => { reloadClaims(); reloadBalances(); });
                              }
                            }}>
                              Delete
                            </button>
                          </div>
                        </div>

                        <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
                          <div className="bg-slate-50 rounded p-2"><div className="text-slate-500">Claims sent</div><div className="font-semibold">{money(c.claimedAmount, c.currency)}</div></div>
                          <div className="bg-slate-50 rounded p-2"><div className="text-slate-500">Payments received</div><div className="font-semibold">{money(c.paidToDate, c.currency)}</div></div>
                          <div className="bg-slate-50 rounded p-2"><div className="text-slate-500">Still unpaid</div><div className="font-semibold">{money(c.balance, c.currency)}</div></div>
                        </div>

                        <div className="mt-2 h-1.5 w-full bg-slate-100 rounded">
                          <div className="h-1.5 bg-emerald-500 rounded" style={{ width: `${pct}%` }} title={`${pct}% collected`} />
                        </div>

                        <div className="mt-2 flex items-center justify-between">
                          <div className="text-xs text-slate-500">{c.notes || ""}</div>
                          <button className="text-xs px-2 py-1 rounded-md border hover:bg-slate-50" onClick={() => {
                            setPProviderId(c.providerId);
                            setPDate(new Date().toISOString().slice(0,10));
                            setEditingPaymentId("");
                            setShowPayment(true);
                          }}>
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
                  {payments.map((p) => (
                    <div key={p.id} className="p-3 flex items-center justify-between">
                      <div className="text-sm">
                        <div className="font-medium">{money(p.amount, p.currency)}</div>
                        <div className="text-xs text-slate-500">
                          {displayPaymentDate(p)}
                        </div>
                        {p.notes ? <div className="text-xs text-slate-500 mt-1">{p.notes}</div> : null}
                      </div>
                      <div className="flex items-center gap-2">
                        <button className="text-xs px-2 py-1 rounded-md border text-rose-700" onClick={() => {
                          if (confirm("Delete this payment? This cannot be undone.")) {
                            api(`/api/insurance-payments/${p.id}`, { method: "DELETE" }).then(() => {
                              reloadBalances();
                              const qs = new URLSearchParams({ providerId: detailProviderId });
                              setLoadingPayments(true);
                              api<Payment[]>(`/api/insurance-payments?${qs.toString()}`)
                                .then(setPayments)
                                .finally(() => setLoadingPayments(false));
                            });
                          }
                        }}>Delete</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: KPI — Collected (payments in window) */}
      {showCollected && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-4 sm:p-6">
          <div className="absolute inset-0 bg-black/30" onClick={() => setShowCollected(false)} />
          <div className="relative w-full max-w-4xl rounded-2xl bg-white shadow-2xl border z-50">
            <div className="px-4 py-3 border-b flex items-center justify-between">
              <div className="font-medium">
                Payments received — {money(summary.collected, "USD")}
                <div className="text-xs text-slate-500">As of: {windowLabel()}</div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => exportPaymentsCSV(filteredWindowPayments, providers)}
                  className="px-3 py-2 rounded-lg border hover:bg-slate-50 text-sm"
                >
                  Export CSV
                </button>
                <button className="text-slate-500" onClick={() => setShowCollected(false)} title="Close"><X size={18} /></button>
              </div>
            </div>

            {/* Filters line */}
            <div className="px-4 py-3 border-b flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  className="w-full pl-8 pr-3 py-2 border rounded-lg text-sm"
                  placeholder="Search payments by provider or notes…"
                  value={paymentsQuery}
                  onChange={(e) => setPaymentsQuery(e.target.value)}
                />
              </div>
            </div>

            {/* Content */}
            <div className="p-4 overflow-y-auto max-h-[70vh]">
              {loadingWindowPays && <div className="text-slate-500">Loading…</div>}
              {!loadingWindowPays && filteredWindowPayments.length === 0 && (
                <div className="text-slate-500">No payments in this window.</div>
              )}

              {/* Provider roll-up */}
              {filteredWindowPayments.length > 0 && (
                <div className="mb-4">
                  <div className="text-xs text-slate-500 mb-1">By provider (window)</div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {providerTotals.map(({ providerId: pid, name, total }) => (
                      <div key={pid} className="border rounded-lg p-3 bg-slate-50 flex items-center justify-between">
                        <div className="text-sm font-medium">{name}</div>
                        <div className="text-sm font-semibold">{money(total, "USD")}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Table */}
              {filteredWindowPayments.length > 0 && (
                <div className="overflow-x-auto border rounded-lg">
                  <table className="min-w-full text-sm">
                    <thead className="bg-slate-50 text-slate-600">
                      <tr>
                        <th className="text-left p-3">Payment Date</th>
                        <th className="text-left p-3">Provider</th>
                        <th className="text-left p-3">Amount</th>
                        <th className="text-left p-3">Notes</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {filteredWindowPayments.map((p) => {
                        const pv = providers.find((x) => x.id === p.providerId);
                        return (
                          <tr key={p.id} className="hover:bg-slate-50/60">
                            <td className="p-3">{displayPaymentDate(p)}</td>
                            <td className="p-3">{pv?.name || p.providerId}</td>
                            <td className="p-3 font-medium">{money(p.amount, p.currency)}</td>
                            <td className="p-3">{p.notes || ""}</td>
                          </tr>
                        );
                      })}
                      {/* total row */}
                      <tr className="bg-slate-50/60 font-medium">
                        <td className="p-3" colSpan={2}>Total</td>
                        <td className="p-3">
                          {money(filteredWindowPayments.reduce((a, r) => a + Number(r.amount || 0), 0), "USD")}
                        </td>
                        <td className="p-3" />
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal: KPI — Outstanding (only outstanding by provider) */}
      {showOutstanding && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-4 sm:p-6">
          <div className="absolute inset-0 bg-black/30" onClick={() => setShowOutstanding(false)} />
          <div className="relative w-full max-w-3xl rounded-2xl bg-white shadow-2xl border z-50">
            <div className="px-4 py-3 border-b flex items-center justify-between">
              <div className="font-medium">
                <div className="flex items-center gap-2">
                  {summary.outstanding < 0 ? (
                    <CheckCircle className="h-4 w-4 text-emerald-600" />
                  ) : (
                    <AlertCircle className="h-4 w-4 text-amber-600" />
                  )}
                  <span>{summary.outstanding < 0 ? "Overpaid" : "Still unpaid"} — {money(Math.abs(summary.outstanding), "USD")}</span>
                </div>
                <div className="text-xs text-slate-500">As of: {windowLabel()}</div>
              </div>
              <button className="text-slate-500" onClick={() => setShowOutstanding(false)} title="Close"><X size={18} /></button>
            </div>

            <div className="p-4 overflow-y-auto max-h-[70vh]">
              {(!balances || orderedOutstanding.length === 0) && (
                <div className="text-slate-500">No unpaid amounts for this window.</div>
              )}

              {orderedOutstanding.length > 0 && (
                <div className="space-y-2">
                  {orderedOutstanding.map((r) => {
                    const isOverpaid = r.outstanding < 0;
                    return (
                      <div
                        key={r.providerId}
                        className={`border rounded-xl p-3 hover:shadow-md transition-all duration-200 ${
                          isOverpaid ? "bg-emerald-50 border-emerald-200" : "bg-white"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="font-medium">{providers.find(p => p.id === r.providerId)?.name || r.providerId}</div>
                          <div className="text-right">
                            <div className={`text-xs mb-0.5 ${isOverpaid ? "text-emerald-600" : "text-slate-500"}`}>
                              {isOverpaid ? "Overpaid" : "Still unpaid"}
                            </div>
                            <div className={`text-base font-semibold ${isOverpaid ? "text-emerald-700" : ""}`}>
                              {money(Math.abs(r.outstanding), "USD")}
                            </div>
                          </div>
                        </div>
                        <div className="mt-2 text-right">
                          <button
                            className="text-sm text-indigo-600 hover:underline"
                            onClick={() => setDetailProviderId(r.providerId)}
                          >
                            Open provider
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Add Claim */}
      {showClaim && (
        <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-xl shadow-lg">
            <div className="px-4 py-3 border-b flex items-center justify-between">
              <div className="font-medium">Add Claim</div>
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

                {/* Claim Date (single date; backend period inferred from its month) */}
                <div className="col-span-2">
                  <label className="block text-xs text-slate-500 mb-1">Claim Date</label>
                  <DateField value={cDate} onChange={setCDate} placeholder="Pick a date" />
                  <div className="text-[11px] text-slate-500 mt-1">
                    We’ll bill this claim for the month of the selected date.
                  </div>
                </div>

                {/* Amount */}
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
              <button className="px-3 py-2 rounded-lg bg-slate-900 text-white" onClick={async () => {
                const { startIso, endIso } = monthBoundsFromDateStr(cDate);
                const body = {
                  providerId: cProviderId || providerId,
                  periodStart: startIso,
                  periodEnd: endIso,
                  currency: cCurrency,
                  claimedAmount: Number(cAmount),
                  notes: cNotes || undefined,
                };
                try {
                  await api<Claim>("/api/insurance-claims", { method: "POST", body: JSON.stringify(body) });
                  setShowClaim(false);
                  setEditingClaimId("");
                  setCProviderId(""); setCDate(new Date().toISOString().slice(0,10)); setCCurrency("USD"); setCAmount("0"); setCNotes("");
                  reloadClaims(); reloadBalances();
                  toast({
                    title: "Success",
                    description: "Claim saved successfully."
                  });
                } catch (e: any) {
                  toast({
                    title: "Error",
                    description: `Failed to save claim: ${e.message || e}`,
                    variant: "destructive"
                  });
                }
              }}>Save Claim</button>
            </div>
          </div>
        </div>
      )}

      {/* Record Payment */}
      {showPayment && (
        <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-xl shadow-lg">
            <div className="px-4 py-3 border-b flex items-center justify-between">
              <div className="font-medium">Record Payment</div>
              <button className="text-slate-500" onClick={resetPaymentForm}>✕</button>
            </div>
            <div className="p-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Provider</label>
                  <select 
                    className={`border rounded-lg p-2 w-full ${pProviderError ? 'border-red-500 focus:ring-red-500' : ''}`}
                    value={pProviderId} 
                    onChange={(e) => {
                      setPProviderId(e.target.value);
                      // Clear error when user selects a provider
                      if (e.target.value) {
                        setPProviderError("");
                      }
                    }}
                  >
                    <option value="">Select…</option>
                    {providers.map((p) => (<option key={p.id} value={p.id}>{p.name}</option>))}
                  </select>
                  {pProviderError && (
                    <p className="text-xs text-red-600 mt-1">{pProviderError}</p>
                  )}
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Payment Date</label>
                  <DateField value={pDate} onChange={setPDate} placeholder="Pick a date" />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Currency</label>
                  <select className="border rounded-lg p-2 w-full" value={pCurrency} onChange={(e) => setPCurrency(e.target.value as any)}>
                    <option value="USD">USD</option>
                    <option value="SSP">SSP</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Amount Received</label>
                  <input 
                    type="number" 
                    min="0" 
                    className={`border rounded-lg p-2 w-full ${pAmountError ? 'border-red-500 focus:ring-red-500' : ''}`}
                    value={pAmount} 
                    onChange={(e) => {
                      setPAmount(e.target.value);
                      // Clear error when user starts typing a valid amount
                      if (Number(e.target.value) > 0) {
                        setPAmountError("");
                      }
                    }} 
                  />
                  {pAmountError && (
                    <p className="text-xs text-red-600 mt-1">{pAmountError}</p>
                  )}
                </div>
                <div className="col-span-2">
                  <label className="block text-xs text-slate-500 mb-1">Notes (optional)</label>
                  <input className="border rounded-lg p-2 w-full" value={pNotes} onChange={(e) => setPNotes(e.target.value)} />
                </div>
              </div>
            </div>
            <div className="px-4 py-3 border-t flex justify-end gap-2">
              <button className="px-3 py-2 rounded-lg border" onClick={resetPaymentForm}>Cancel</button>
              <button 
                className={`px-3 py-2 rounded-lg text-white ${
                  isPaymentFormValid
                    ? 'bg-slate-800 hover:bg-slate-700' 
                    : 'bg-slate-400 cursor-not-allowed'
                }`}
                disabled={!isPaymentFormValid}
                onClick={async () => {
                  // Client-side validation with inline error messages
                  let hasErrors = false;
                  const amount = Number(pAmount);
                  
                  if (!pProviderId) {
                    setPProviderError("Please select a provider.");
                    hasErrors = true;
                  }
                  
                  if (!amount || amount <= 0) {
                    setPAmountError("Please enter an amount greater than 0.");
                    hasErrors = true;
                  }
                  
                  if (hasErrors) return;

                  const body = {
                    providerId: pProviderId || providerId,
                    paymentDate: pDate || undefined,
                    amount: amount,
                    currency: pCurrency,
                    notes: pNotes || undefined,
                  };
                  try {
                    await api<Payment>("/api/insurance-payments", { method: "POST", body: JSON.stringify(body) });
                    resetPaymentForm();
                    reloadBalances();
                    if (detailProviderId) {
                      const qs = new URLSearchParams({ providerId: detailProviderId });
                      setLoadingPayments(true);
                      api<Payment[]>(`/api/insurance-payments?${qs.toString()}`)
                        .then(setPayments)
                        .finally(() => setLoadingPayments(false));
                    }
                    toast({
                      title: "Success",
                      description: "Payment saved successfully."
                    });
                  } catch (e: any) {
                    toast({
                      title: "Error",
                      description: `Failed to save payment: ${e.message || e}`,
                      variant: "destructive"
                    });
                  }
                }}
              >Record Payment</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
