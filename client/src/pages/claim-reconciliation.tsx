// client/src/pages/claim-reconciliation.tsx

import {
  useState,
  useMemo,
  useCallback,
  useEffect,
  useRef,
  type ReactNode,
} from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useDropzone } from "react-dropzone";
import { cn } from "@/lib/utils";

/* -------------------------------------------------------------------------- */
/* Shadcn/UI Components */
/* -------------------------------------------------------------------------- */
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

/* -------------------------------------------------------------------------- */
/* Icons (lucide-react) */
/* -------------------------------------------------------------------------- */
import {
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  Clock,
  Trash2,
  Loader2,
  MoreHorizontal,
  X,
  Info,
  Download,
  CheckCircle,
  FileStack,
  AlertTriangle,
  DollarSign,
  FileText,
} from "lucide-react";

/* -------------------------------------------------------------------------- */
/* Other Imports */
/* -------------------------------------------------------------------------- */
import { useToast } from "@/hooks/use-toast";
import { API_BASE_URL } from "@/lib/constants";
import { ReconciliationStepper } from "@/components/ui/reconciliation-stepper";

/* -------------------------------------------------------------------------- */
/* Types */
/* -------------------------------------------------------------------------- */

interface ReconRun {
  id: number;
  providerName: string;
  periodYear: number;
  periodMonth: number;
  createdAt: string;
  totalClaimRows: number;
  totalRemittanceRows: number;
  autoMatched: number;
  partialMatched: number;
  manualReview: number;
  status?: "awaiting_remittance" | "reconciled" | "pending_review";
}

interface ClaimDetail {
  id: number;
  memberNumber: string;
  patientName: string | null;
  serviceDate: string;
  billedAmount: string;
  amountPaid: string;
  status: string;
  currency?: string;
}

interface PeriodStatus {
  provider: string;
  period: string;
  claims: {
    total: number;
    awaitingRemittance: number;
    matched: number;
    partiallyPaid: number;
    unpaid: number;
  };
  remittances: {
    total: number;
    orphans: number;
  };
  hasClaimsOnly: boolean;
  hasRemittances: boolean;
  isReconciled: boolean;
}

interface ClaimsInventoryItem extends ClaimDetail {
  periodYear: number;
  periodMonth: number;
  providerName: string;
}

interface ClaimsInventoryResponse {
  claims: ClaimsInventoryItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

interface PeriodSummary {
  providerName: string;
  periodYear: number;
  periodMonth: number;
  totalClaims: number;
  awaitingRemittance: number;
  matched: number;
  partiallyPaid: number;
  unpaid: number;
  manualReview: number;
  totalBilled: string;
  totalPaid: string;
  currency: string;
}

/* -------------------------------------------------------------------------- */
/* Session backup helper */
/* -------------------------------------------------------------------------- */

const BACKUP_KEY = "user_session_backup";

function readSessionBackup(): string | null {
  try {
    return localStorage.getItem(BACKUP_KEY);
  } catch {
    return null;
  }
}

/* -------------------------------------------------------------------------- */
/* Utility helpers */
/* -------------------------------------------------------------------------- */

const MONTHS = [
  { value: "1", label: "January" },
  { value: "2", label: "February" },
  { value: "3", label: "March" },
  { value: "4", label: "April" },
  { value: "5", label: "May" },
  { value: "6", label: "June" },
  { value: "7", label: "July" },
  { value: "8", label: "August" },
  { value: "9", label: "September" },
  { value: "10", label: "October" },
  { value: "11", label: "November" },
  { value: "12", label: "December" },
];

function formatPeriodLabel(year: number, month: number): string {
  return new Date(year, month - 1).toLocaleString("default", {
    month: "long",
    year: "numeric",
  });
}

function pluralize(count: number, singular: string, plural?: string): string {
  if (count === 1) return singular;
  return plural || `${singular}s`;
}

/**
 * CIC should always display USD, even if stored as SSP
 */
function getCurrencyForDisplay(providerName: string, currency?: string): string {
  if (providerName === "CIC") return "USD";
  return currency || "USD";
}

/**
 * Explains cross-period matching for providers
 */
function getWorkflowDescription(providerName: string, periodLabel: string): string {
  return `Working on: ${providerName} – ${periodLabel} (claims for this month). Remittance uploads will be matched against all outstanding ${providerName} claims across all months.`;
}

/**
 * Remittance upload description
 */
function getRemittanceUploadDescription(providerName: string): string {
  if (providerName === "CIC") {
    return "This remittance will be matched against all CIC claims that are still awaiting remittance, not just this month";
  }
  return "Upload remittance advice from insurance";
}

/* -------------------------------------------------------------------------- */
/* A) Status label + grouping helpers */
/* -------------------------------------------------------------------------- */

function claimStatusLabel(status: string): string {
  switch (status) {
    case "matched":
    case "paid":
      return "Paid in full";
    case "partially_paid":
      return "Paid partially";
    case "unpaid":
      return "Not paid (0 paid)";
    case "manual_review":
      return "Needs checking";
    case "awaiting_remittance":
    case "submitted":
    default:
      return "Pending remittance";
  }
}

function claimStatusGroup(status: string): "paid" | "waiting" | "follow_up" {
  switch (status) {
    case "matched":
    case "paid":
      return "paid";
    case "partially_paid":
    case "unpaid":
    case "manual_review":
      return "follow_up";
    case "awaiting_remittance":
    case "submitted":
    default:
      return "waiting";
  }
}

/* -------------------------------------------------------------------------- */
/* D) Reconciliation history run grouping */
/* -------------------------------------------------------------------------- */

function runGroup(run: ReconRun): "needs_follow_up" | "completed" {
  if (run.partialMatched > 0 || run.manualReview > 0) return "needs_follow_up";
  return "completed";
}

/**
 * Infer a (year, month) from a filename like:
 *  - "CIC Jan 25.xlsx"
 *  - "claims_feb_2025.xls"
 */
function inferPeriodFromFilename(
  filename: string
): { year: string; month: string } | null {
  const name = filename.toLowerCase();

  const monthMap: Record<string, string> = {
    jan: "1",
    january: "1",
    feb: "2",
    february: "2",
    mar: "3",
    march: "3",
    apr: "4",
    april: "4",
    may: "5",
    jun: "6",
    june: "6",
    jul: "7",
    july: "7",
    aug: "8",
    august: "8",
    sep: "9",
    sept: "9",
    september: "9",
    oct: "10",
    october: "10",
    nov: "11",
    november: "11",
    dec: "12",
    december: "12",
  };

  const monthToken = Object.keys(monthMap).find((k) =>
    new RegExp(`\\b${k}\\b`).test(name)
  );
  if (!monthToken) return null;

  // year: 2025 or 25
  const yearMatch = name.match(/\b(20\d{2}|\d{2})\b/);
  if (!yearMatch) return null;

  const raw = yearMatch[1];
  const year = raw.length === 2 ? `20${raw}` : raw;

  return { year, month: monthMap[monthToken] };
}

/* -------------------------------------------------------------------------- */
/* Re-usable FileDropzone Component */
/* -------------------------------------------------------------------------- */

interface FileDropzoneProps {
  file: File | null;
  onFileChange: (file: File | null) => void;
  label: string;
  description: string;
  disabled?: boolean;
  tintColor?: "blue" | "green";
  icon?: ReactNode;
}

function FileDropzone({
  file,
  onFileChange,
  label,
  description,
  disabled,
  tintColor = "blue",
  icon,
}: FileDropzoneProps) {
  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      if (acceptedFiles.length > 0) onFileChange(acceptedFiles[0]);
    },
    [onFileChange]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [
        ".xlsx",
      ],
      "application/vnd.ms-excel": [".xls"],
    },
    maxFiles: 1,
    multiple: false,
    disabled,
  });

  const tintClasses =
    tintColor === "blue"
      ? "border-blue-200 bg-blue-50/40 hover:border-blue-300 hover:bg-blue-50/60"
      : "border-green-200 bg-green-50/40 hover:border-green-300 hover:bg-green-50/60";

  const iconColor = tintColor === "blue" ? "text-blue-500" : "text-green-500";

  if (file) {
    return (
      <div className="space-y-2">
        <Label className="flex items-center gap-2">
          {icon && <span className={iconColor}>{icon}</span>}
          {label}
        </Label>
        <div
          className={cn(
            "flex items-center gap-2 rounded-md border-2 p-3 transition-all",
            tintClasses
          )}
        >
          <FileSpreadsheet className={cn("w-5 h-5 shrink-0", iconColor)} />
          <span
            className="text-sm font-medium text-slate-800 truncate"
            title={file.name}
          >
            {file.name}
          </span>
          <span className="text-xs text-muted-foreground ml-auto whitespace-nowrap">
            {(file.size / 1024).toFixed(1)} KB
          </span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="w-6 h-6 shrink-0"
            onClick={() => onFileChange(null)}
            disabled={disabled}
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Label htmlFor={label} className="flex items-center gap-2">
        {icon && <span className={iconColor}>{icon}</span>}
        {label}
      </Label>
      <div
        {...getRootProps()}
        className={cn(
          "flex flex-col items-center justify-center w-full h-24 border-2 border-dashed rounded-lg cursor-pointer transition-all relative group",
          tintClasses,
          isDragActive && "border-primary bg-primary/10",
          disabled && "cursor-not-allowed opacity-60"
        )}
      >
        <div className="absolute inset-0 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity bg-gradient-to-r from-orange-400 via-amber-400 to-orange-400 -z-10 blur-sm" />
        <input {...getInputProps()} id={label} />
        {isDragActive ? (
          <p className="text-sm font-medium text-primary">Drop the file here...</p>
        ) : (
          <div className="text-center">
            <Upload className="w-5 h-5 text-slate-500 mx-auto mb-1" />
            <p className="text-sm text-slate-600">
              <span className="font-semibold">Click to upload</span> or drag & drop
            </p>
            <p className="text-xs text-slate-500">Excel files (.xlsx, .xls)</p>
          </div>
        )}
      </div>
      <p className="text-xs text-muted-foreground">{description}</p>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Main Component */
/* -------------------------------------------------------------------------- */

export default function ClaimReconciliation() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const now = new Date();
  const didUserTouchPeriod = useRef(false);

  /* ------------------------------------------------------------------------ */
  /* Active Period Controls */
  /* ------------------------------------------------------------------------ */
  const [providerName, setProviderName] = useState("CIC");
  const [periodYear, setPeriodYear] = useState(now.getFullYear().toString());
  const [periodMonth, setPeriodMonth] = useState((now.getMonth() + 1).toString());

  const activePeriodLabel = useMemo(() => {
    return formatPeriodLabel(parseInt(periodYear, 10), parseInt(periodMonth, 10));
  }, [periodYear, periodMonth]);

  /* ------------------------------------------------------------------------ */
  /* UI State */
  /* ------------------------------------------------------------------------ */
  const [periodYearFilter, setPeriodYearFilter] = useState<number | null>(null);

  const [claimsFile, setClaimsFile] = useState<File | null>(null);
  const [remittanceFile, setRemittanceFile] = useState<File | null>(null);

  const [selectedRunId, setSelectedRunId] = useState<number | null>(null);
  const [showHelp, setShowHelp] = useState(false);

  // B) Claims Details filters + wording
  const [attentionFilter, setAttentionFilter] = useState<
    "all" | "waiting" | "follow_up"
  >("follow_up");

  // D) Reconciliation History tabs (fixed)
  const [statusFilter, setStatusFilter] = useState<
    "all" | "needs_follow_up" | "completed"
  >("all");

  // Claims Inventory (view-only filters)
  const [inventoryStatusFilter, setInventoryStatusFilter] = useState<
    "all" | "awaiting_remittance" | "matched" | "partially_paid" | "unpaid"
  >("all");
  const [inventoryPeriodFilter, setInventoryPeriodFilter] = useState<string | null>(null);
  const [inventoryPage, setInventoryPage] = useState(1);
  const [showInventory, setShowInventory] = useState(false);

  // Decorative header particles
  const particles = useMemo(() => {
    return Array.from({ length: 6 }, () => ({
      left: `${Math.random() * 100}%`,
      top: `${Math.random() * 100}%`,
      duration: 3 + Math.random() * 4,
      delay: Math.random() * 2,
    }));
  }, []);

  /* ------------------------------------------------------------------------ */
  /* Data loading */
  /* ------------------------------------------------------------------------ */

  const { data: runs = [], isLoading: runsLoading, isFetching: runsFetching } = useQuery<ReconRun[]>({
    queryKey: ["/api/claim-reconciliation/runs"],
  });

  // Filter to only show actual reconciliation runs (with remittances > 0)
  const actualReconciliationRuns = useMemo(() => {
    return runs.filter(run => run.totalRemittanceRows > 0);
  }, [runs]);

  const { data: claims = [], isLoading: claimsLoading } = useQuery<ClaimDetail[]>({
    queryKey: [`/api/claim-reconciliation/runs/${selectedRunId}/claims`],
    enabled: !!selectedRunId,
  });

  const providerOptions = useMemo(() => {
    const set = new Set<string>();
    set.add("CIC");
    runs.forEach((r) => set.add(r.providerName));
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [runs]);

  /* ------------------------------------------------------------------------ */
  /* Period status (active period) */
  /* ------------------------------------------------------------------------ */

  const { data: periodStatus, isLoading: periodStatusLoading } = useQuery<PeriodStatus>({
    queryKey: ["/api/claim-reconciliation/period", providerName, periodYear, periodMonth],
    queryFn: async () => {
      const url = new URL(
        `/api/claim-reconciliation/period/${providerName}/${periodYear}/${periodMonth}`,
        API_BASE_URL
      ).toString();

      const headers: HeadersInit = {};
      const backup = readSessionBackup();
      if (backup) headers["x-session-token"] = backup;

      const response = await fetch(url, { method: "GET", credentials: "include", headers });
      if (!response.ok) throw new Error("Failed to fetch period status");
      return response.json();
    },
    staleTime: 2000,
    enabled: !!(providerName && periodYear && periodMonth),
  });

  /* ------------------------------------------------------------------------ */
  /* Periods summary (cards) */
  /* ------------------------------------------------------------------------ */

  const { data: periodsSummary = [], isLoading: summaryLoading } = useQuery<PeriodSummary[]>({
    queryKey: ["/api/claim-reconciliation/periods-summary", providerName],
    queryFn: async () => {
      const params = new URLSearchParams({ providerName });
      const url = new URL(`/api/claim-reconciliation/periods-summary?${params.toString()}`, API_BASE_URL).toString();

      const headers: HeadersInit = {};
      const backup = readSessionBackup();
      if (backup) headers["x-session-token"] = backup;

      const response = await fetch(url, { method: "GET", credentials: "include", headers });
      if (!response.ok) throw new Error("Failed to fetch periods summary");
      return response.json();
    },
  });

  // Auto-select the latest period *with data* when provider changes (but never override user-chosen period)
  useEffect(() => {
    if (didUserTouchPeriod.current) return;
    if (!periodsSummary || periodsSummary.length === 0) return;

    const latest = periodsSummary.reduce(
      (best, p) => {
        const bestKey = best.periodYear * 100 + best.periodMonth;
        const pKey = p.periodYear * 100 + p.periodMonth;
        return pKey > bestKey ? p : best;
      },
      periodsSummary[0]
    );

    setPeriodYear(String(latest.periodYear));
    setPeriodMonth(String(latest.periodMonth));
  }, [periodsSummary, providerName]);

  const availableYears = useMemo(() => {
    const years = new Set(periodsSummary.map((p) => p.periodYear));
    return Array.from(years).sort((a, b) => b - a);
  }, [periodsSummary]);

  useEffect(() => {
    if (periodYearFilter === null && availableYears.length > 0) {
      setPeriodYearFilter(availableYears[0]);
    }
  }, [availableYears, periodYearFilter]);

  const filteredPeriods = useMemo(() => {
    let filtered = periodsSummary;
    if (periodYearFilter !== null) filtered = filtered.filter((p) => p.periodYear === periodYearFilter);
    return filtered.slice(0, 12);
  }, [periodsSummary, periodYearFilter]);

  /* ------------------------------------------------------------------------ */
  /* Claims Inventory query */
  /* ------------------------------------------------------------------------ */

  const { data: claimsInventory, isLoading: inventoryLoading } = useQuery<ClaimsInventoryResponse>({
    queryKey: [
      "/api/claim-reconciliation/claims",
      providerName,
      inventoryStatusFilter === "all" ? undefined : inventoryStatusFilter,
      inventoryPeriodFilter,
      inventoryPage,
    ],
    queryFn: async () => {
      const params = new URLSearchParams({
        providerName,
        page: inventoryPage.toString(),
        limit: "50",
      });

      if (inventoryStatusFilter !== "all") params.append("status", inventoryStatusFilter);

      if (inventoryPeriodFilter) {
        const parts = inventoryPeriodFilter.split("-");
        if (parts.length === 2 && parts[0] && parts[1]) {
          const year = parseInt(parts[0], 10);
          const month = parseInt(parts[1], 10);
          if (!isNaN(year) && !isNaN(month) && month >= 1 && month <= 12) {
            params.append("periodYear", String(year));
            params.append("periodMonth", String(month));
          }
        }
      }

      const url = new URL(`/api/claim-reconciliation/claims?${params.toString()}`, API_BASE_URL).toString();

      const headers: HeadersInit = {};
      const backup = readSessionBackup();
      if (backup) headers["x-session-token"] = backup;

      const response = await fetch(url, { method: "GET", credentials: "include", headers });
      if (!response.ok) throw new Error("Failed to fetch claims inventory");
      return response.json();
    },
    enabled: showInventory,
  });

  const inventoryPeriodLabel = useMemo(() => {
    if (!inventoryPeriodFilter) return null;
    const [y, m] = inventoryPeriodFilter.split("-");
    const yy = parseInt(y, 10);
    const mm = parseInt(m, 10);
    if (!isNaN(yy) && !isNaN(mm)) return formatPeriodLabel(yy, mm);
    return inventoryPeriodFilter;
  }, [inventoryPeriodFilter]);

  const inventorySummaryStats = useMemo(() => {
    if (!periodsSummary || periodsSummary.length === 0) {
      return { total: 0, awaiting: 0, matched: 0, unpaid: 0, partial: 0 };
    }

    if (inventoryPeriodFilter) {
      const [y, m] = inventoryPeriodFilter.split("-");
      const yy = parseInt(y, 10);
      const mm = parseInt(m, 10);
      const p = periodsSummary.find((x) => x.periodYear === yy && x.periodMonth === mm);
      if (!p) return { total: 0, awaiting: 0, matched: 0, unpaid: 0, partial: 0 };
      return {
        total: p.totalClaims,
        awaiting: p.awaitingRemittance,
        matched: p.matched,
        unpaid: p.unpaid,
        partial: p.partiallyPaid,
      };
    }

    return {
      total: periodsSummary.reduce((sum, p) => sum + p.totalClaims, 0),
      awaiting: periodsSummary.reduce((sum, p) => sum + p.awaitingRemittance, 0),
      matched: periodsSummary.reduce((sum, p) => sum + p.matched, 0),
      unpaid: periodsSummary.reduce((sum, p) => sum + p.unpaid, 0),
      partial: periodsSummary.reduce((sum, p) => sum + p.partiallyPaid, 0),
    };
  }, [periodsSummary, inventoryPeriodFilter]);

  /* ------------------------------------------------------------------------ */
  /* KPI strip stats */
  /* ------------------------------------------------------------------------ */

  const stats = useMemo(() => {
    const reconciliationsDone = runs.filter(run => run.totalRemittanceRows > 0).length;

    const totalClaims = periodsSummary.reduce((sum, p) => sum + p.totalClaims, 0);
    // Claims to follow up: partially paid, unpaid (with remittance), and manual review
    // EXCLUDES awaiting_remittance (not yet in any remittance)
    const problemClaims = periodsSummary.reduce(
      (sum, p) => sum + p.unpaid + p.partiallyPaid + (p.manualReview || 0), 
      0
    );
    const awaitingRemittance = periodsSummary.reduce((sum, p) => sum + p.awaitingRemittance, 0);

    const sortedRuns = [...runs].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    const latest = sortedRuns[0];

    const lastPeriodLabel = latest
      ? formatPeriodLabel(latest.periodYear, latest.periodMonth)
      : periodsSummary.length > 0
      ? formatPeriodLabel(periodsSummary[0].periodYear, periodsSummary[0].periodMonth)
      : "—";

    return {
      reconciliationsDone,
      totalClaims,
      problemClaims,
      awaitingRemittance,
      lastPeriodLabel,
      latestRunId: latest?.id ?? null,
    };
  }, [runs, periodsSummary]);

  /* ------------------------------------------------------------------------ */
  /* Mutations */
  /* ------------------------------------------------------------------------ */

  const uploadMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const uploadUrl = new URL("/api/claim-reconciliation/upload", API_BASE_URL).toString();

      const headers: HeadersInit = {};
      const backup = readSessionBackup();
      if (backup) headers["x-session-token"] = backup;

      const response = await fetch(uploadUrl, {
        method: "POST",
        body: formData,
        credentials: "include",
        headers,
      });

      if (!response.ok) {
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          const error = await response.json();
          throw new Error(error.error || "Upload failed");
        }
        const text = await response.text();
        throw new Error(`Upload failed (${response.status}): ${text.substring(0, 120)}`);
      }

      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Reconciliation completed",
        description: `Matched ${data.summary.autoMatched} claims automatically. ${data.summary.partialMatched} need manual review.`,
      });

      queryClient.invalidateQueries({ queryKey: ["/api/claim-reconciliation/runs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/claim-reconciliation/period"] });
      queryClient.invalidateQueries({ queryKey: ["/api/claim-reconciliation/periods-summary"] });
      queryClient.invalidateQueries({ queryKey: ["/api/claim-reconciliation/claims"] });

      setSelectedRunId(data.runId);
      setClaimsFile(null);
      setRemittanceFile(null);
      setAttentionFilter("follow_up");
    },
    onError: (error: Error) => {
      toast({ title: "Upload failed", description: error.message, variant: "destructive" });
    },
  });

  const uploadClaimsMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const uploadUrl = new URL("/api/claim-reconciliation/upload-claims", API_BASE_URL).toString();

      const headers: HeadersInit = {};
      const backup = readSessionBackup();
      if (backup) headers["x-session-token"] = backup;

      const response = await fetch(uploadUrl, {
        method: "POST",
        body: formData,
        credentials: "include",
        headers,
      });

      if (!response.ok) {
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          const error = await response.json();
          throw new Error(error.error || "Upload failed");
        }
        const text = await response.text();
        throw new Error(`Upload failed (${response.status}): ${text.substring(0, 120)}`);
      }

      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Claims uploaded",
        description: `${data.claimsStored} claims uploaded – awaiting remittance`,
      });

      queryClient.invalidateQueries({ queryKey: ["/api/claim-reconciliation/runs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/claim-reconciliation/period"] });
      queryClient.invalidateQueries({ queryKey: ["/api/claim-reconciliation/periods-summary"] });
      queryClient.invalidateQueries({ queryKey: ["/api/claim-reconciliation/claims"] });
      if (data?.runId) setSelectedRunId(data.runId);

      setClaimsFile(null);
    },
    onError: (error: Error) => {
      toast({ title: "Upload failed", description: error.message, variant: "destructive" });
    },
  });

  const uploadRemittanceMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const uploadUrl = new URL("/api/claim-reconciliation/upload-remittance", API_BASE_URL).toString();

      const headers: HeadersInit = {};
      const backup = readSessionBackup();
      if (backup) headers["x-session-token"] = backup;

      const response = await fetch(uploadUrl, {
        method: "POST",
        body: formData,
        credentials: "include",
        headers,
      });

      if (!response.ok) {
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          const error = await response.json();
          throw new Error(error.error || "Upload failed");
        }
        const text = await response.text();
        throw new Error(`Upload failed (${response.status}): ${text.substring(0, 120)}`);
      }

      return response.json();
    },
    onSuccess: (data) => {
      const reconciliation = data.reconciliation;
      const unpaidCount = (reconciliation.manualReview || 0) + (reconciliation.unpaidClaims || 0);
      const summary = `${reconciliation.totalClaims} claims, ${reconciliation.autoMatched} matched, ${reconciliation.partialMatched} partial, ${unpaidCount} unpaid`;

      toast({ title: "Reconciliation complete", description: summary });

      queryClient.invalidateQueries({ queryKey: ["/api/claim-reconciliation/runs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/claim-reconciliation/period"] });
      queryClient.invalidateQueries({ queryKey: ["/api/claim-reconciliation/periods-summary"] });
      queryClient.invalidateQueries({ queryKey: ["/api/claim-reconciliation/claims"] });
      if (data?.runId) setSelectedRunId(data.runId);

      setRemittanceFile(null);
    },
    onError: (error: Error) => {
      toast({ title: "Upload failed", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (runId: number) => {
      const url = new URL(`/api/claim-reconciliation/runs/${runId}`, API_BASE_URL).toString();

      const headers: HeadersInit = {};
      const backup = readSessionBackup();
      if (backup) headers["x-session-token"] = backup;

      const response = await fetch(url, { method: "DELETE", credentials: "include", headers });

      if (!response.ok) {
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          const error = await response.json();
          throw new Error(error.error || "Failed to delete reconciliation run");
        }
        const text = await response.text();
        throw new Error(`Failed to delete reconciliation run (${response.status}): ${text.substring(0, 120)}`);
      }

      return response.json();
    },
    onSuccess: (_data, runId) => {
      toast({ title: "Reconciliation deleted", description: "The run and its related data were removed." });

      if (selectedRunId === runId) setSelectedRunId(null);

      queryClient.invalidateQueries({ queryKey: ["/api/claim-reconciliation/runs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/claim-reconciliation/periods-summary"] });
      queryClient.invalidateQueries({ queryKey: ["/api/claim-reconciliation/claims"] });
    },
    onError: (error: Error) => {
      toast({ title: "Delete failed", description: error.message, variant: "destructive" });
    },
  });

  const exportIssuesMutation = useMutation({
    mutationFn: async (runId: number) => {
      const url = new URL(`/api/claim-reconciliation/runs/${runId}/issues/export`, API_BASE_URL).toString();

      const headers: HeadersInit = {};
      const backup = readSessionBackup();
      if (backup) headers["x-session-token"] = backup;

      const response = await fetch(url, { method: "GET", credentials: "include", headers });

      if (!response.ok) {
        const contentType = response.headers.get("content-type") || "";
        if (contentType.includes("application/json")) {
          const error = await response.json();
          throw new Error(error.error || "Export failed");
        }
        const text = await response.text();
        throw new Error(`Export failed (${response.status}): ${text.substring(0, 120)}`);
      }

      const contentType = response.headers.get("content-type") || "";
      if (contentType.includes("application/json")) {
        const error = await response.json();
        throw new Error(error.error || "Export failed");
      }

      const blob = await response.blob();
      const disposition = response.headers.get("content-disposition") || "";
      let fileName = "claim_issues.xlsx";
      const match = disposition.match(/filename="?([^"]+)"?/i);
      if (match?.[1]) fileName = match[1];

      return { blob, fileName };
    },
    onSuccess: ({ blob, fileName }) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      toast({ title: "Export ready", description: "Needs follow-up items were exported." });
    },
    onError: (error: Error) => {
      toast({ title: "Export failed", description: error.message, variant: "destructive" });
    },
  });

  const deletePeriodClaimsMutation = useMutation({
    mutationFn: async ({ providerName, year, month }: { providerName: string; year: number; month: number }) => {
      const url = new URL(`/api/claim-reconciliation/claims/period/${providerName}/${year}/${month}`, API_BASE_URL).toString();

      const headers: HeadersInit = {};
      const backup = readSessionBackup();
      if (backup) headers["x-session-token"] = backup;

      const response = await fetch(url, { method: "DELETE", credentials: "include", headers });

      if (!response.ok) {
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          const error = await response.json();
          throw new Error(error.error || "Failed to delete claims");
        }
        const text = await response.text();
        throw new Error(`Failed to delete claims (${response.status}): ${text.substring(0, 120)}`);
      }

      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Claims deleted", description: "All claims for the period were removed." });
      queryClient.invalidateQueries({ queryKey: ["/api/claim-reconciliation/periods-summary"] });
      queryClient.invalidateQueries({ queryKey: ["/api/claim-reconciliation/period"] });
      queryClient.invalidateQueries({ queryKey: ["/api/claim-reconciliation/claims"] });
    },
    onError: (error: Error) => {
      toast({ title: "Delete failed", description: error.message, variant: "destructive" });
    },
  });

  const deletePeriodRemittancesMutation = useMutation({
    mutationFn: async ({ providerName, year, month }: { providerName: string; year: number; month: number }) => {
      const url = new URL(`/api/claim-reconciliation/remittances/period/${providerName}/${year}/${month}`, API_BASE_URL).toString();

      const headers: HeadersInit = {};
      const backup = readSessionBackup();
      if (backup) headers["x-session-token"] = backup;

      const response = await fetch(url, { method: "DELETE", credentials: "include", headers });

      if (!response.ok) {
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          const error = await response.json();
          throw new Error(error.error || "Failed to delete remittances");
        }
        const text = await response.text();
        throw new Error(`Failed to delete remittances (${response.status}): ${text.substring(0, 120)}`);
      }

      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Remittances deleted", description: "All remittances for the period were removed." });
      queryClient.invalidateQueries({ queryKey: ["/api/claim-reconciliation/periods-summary"] });
      queryClient.invalidateQueries({ queryKey: ["/api/claim-reconciliation/period"] });
      queryClient.invalidateQueries({ queryKey: ["/api/claim-reconciliation/claims"] });
    },
    onError: (error: Error) => {
      toast({ title: "Delete failed", description: error.message, variant: "destructive" });
    },
  });

  const isUploading =
    uploadMutation.isPending || uploadClaimsMutation.isPending || uploadRemittanceMutation.isPending;
  const isDeleting =
    deleteMutation.isPending || deletePeriodClaimsMutation.isPending || deletePeriodRemittancesMutation.isPending;
  const isExporting = exportIssuesMutation.isPending;

  /* ------------------------------------------------------------------------ */
  /* Stepper state */
  /* ------------------------------------------------------------------------ */

  const stepperState = useMemo(() => {
    if (!periodStatus) {
      return {
        steps: {
          claimsUploaded: { completed: false },
          remittanceUploaded: { completed: false },
          reconciliationRun: { completed: false },
          reviewExceptions: { completed: false },
        },
        currentStep: 1 as 1 | 2 | 3 | 4,
        primaryAction: "Upload claims file to begin",
        primaryDisabled: true,
      };
    }

    const hasClaims = periodStatus.claims.total > 0;
    const hasRemittance = periodStatus.remittances.total > 0;
    const isReconciled = periodStatus.isReconciled;
    const exceptionsCount = periodStatus.claims.partiallyPaid + periodStatus.claims.unpaid;

    const step1 = {
      completed: hasClaims,
      details: hasClaims ? `${periodStatus.claims.total} claims` : undefined,
    };

    const step2 = {
      completed: hasRemittance,
      details: hasRemittance ? `${periodStatus.remittances.total} remittances` : undefined,
    };

    const step3 = {
      completed: isReconciled,
      details: isReconciled ? "Complete" : undefined,
    };

    const step4 = {
      completed: isReconciled && exceptionsCount === 0,
      details: exceptionsCount > 0 ? `${exceptionsCount} issues` : isReconciled ? "No issues" : undefined,
    };

    let currentStep: 1 | 2 | 3 | 4 = 1;
    let primaryAction = "";
    let primaryDisabled = false;

    if (!hasClaims) {
      currentStep = 1;
      primaryAction = "📄 Upload Claims File";
      primaryDisabled = !claimsFile;
    } else if (!hasRemittance) {
      currentStep = 2;
      primaryAction = "💰 Upload Remittance File";
      primaryDisabled = !remittanceFile;
    } else if (!isReconciled) {
      currentStep = 3;
      primaryAction = "▶️ Reconciliation runs automatically";
      primaryDisabled = true;
    } else {
      currentStep = 4;
      primaryAction = exceptionsCount > 0 ? "🔍 Review Exceptions" : "✅ All Complete";
      primaryDisabled = false;
    }

    return {
      steps: {
        claimsUploaded: step1,
        remittanceUploaded: step2,
        reconciliationRun: step3,
        reviewExceptions: step4,
      },
      currentStep,
      primaryAction,
      primaryDisabled,
    };
  }, [periodStatus, claimsFile, remittanceFile]);

  /* ------------------------------------------------------------------------ */
  /* Smart action */
  /* ------------------------------------------------------------------------ */

  const uploadAction = useMemo(() => {
    const hasClaims = !!claimsFile;
    const hasRemittance = !!remittanceFile;

    if (!hasClaims && !hasRemittance) {
      return { type: "disabled" as const, label: "Select files to continue", disabled: true };
    }
    if (hasClaims && !hasRemittance) {
      return { type: "claims-only" as const, label: `Upload Claims to ${activePeriodLabel}`, disabled: false };
    }
    if (!hasClaims && hasRemittance) {
      return { type: "remittance-only" as const, label: `Upload Remittance to ${activePeriodLabel}`, disabled: false };
    }
    return { type: "both" as const, label: `Upload Both & Reconcile (${activePeriodLabel})`, disabled: false };
  }, [claimsFile, remittanceFile, activePeriodLabel]);

  const inferredClaimsPeriod = useMemo(() => {
    if (!claimsFile) return null;
    return inferPeriodFromFilename(claimsFile.name);
  }, [claimsFile]);

  const claimsPeriodMismatch = useMemo(() => {
    if (!inferredClaimsPeriod) return false;
    return inferredClaimsPeriod.year !== periodYear || inferredClaimsPeriod.month !== periodMonth;
  }, [inferredClaimsPeriod, periodYear, periodMonth]);

  const submitClaims = useCallback(() => {
    if (!claimsFile) {
      toast({ title: "Missing file", description: "Please select a claims file.", variant: "destructive" });
      return;
    }
    if (claimsPeriodMismatch && inferredClaimsPeriod) {
      const inferredLabel = formatPeriodLabel(parseInt(inferredClaimsPeriod.year, 10), parseInt(inferredClaimsPeriod.month, 10));
      toast({
        title: "Period mismatch",
        description: `Your file looks like ${inferredLabel}. Switch the period (top of workflow) before uploading.`,
        variant: "destructive",
      });
      return;
    }

    const formData = new FormData();
    formData.append("claimsFile", claimsFile);
    formData.append("providerName", providerName);
    formData.append("periodYear", periodYear);
    formData.append("periodMonth", periodMonth);
    uploadClaimsMutation.mutate(formData);
  }, [claimsFile, providerName, periodYear, periodMonth, toast, uploadClaimsMutation, claimsPeriodMismatch, inferredClaimsPeriod]);

  const submitRemittance = useCallback(() => {
    if (!remittanceFile) {
      toast({ title: "Missing file", description: "Please select a remittance file.", variant: "destructive" });
      return;
    }

    const formData = new FormData();
    formData.append("remittanceFile", remittanceFile);
    formData.append("providerName", providerName);
    formData.append("periodYear", periodYear);
    formData.append("periodMonth", periodMonth);
    uploadRemittanceMutation.mutate(formData);
  }, [remittanceFile, providerName, periodYear, periodMonth, toast, uploadRemittanceMutation]);

  const submitBoth = useCallback(() => {
    if (!claimsFile || !remittanceFile) {
      toast({
        title: "Missing files",
        description: "Please select both the claims and remittance files.",
        variant: "destructive",
      });
      return;
    }
    if (claimsPeriodMismatch && inferredClaimsPeriod) {
      const inferredLabel = formatPeriodLabel(parseInt(inferredClaimsPeriod.year, 10), parseInt(inferredClaimsPeriod.month, 10));
      toast({
        title: "Period mismatch",
        description: `Your claims file looks like ${inferredLabel}. Switch the period (top of workflow) before uploading.`,
        variant: "destructive",
      });
      return;
    }

    const formData = new FormData();
    formData.append("claimsFile", claimsFile);
    formData.append("remittanceFile", remittanceFile);
    formData.append("providerName", providerName);
    formData.append("periodYear", periodYear);
    formData.append("periodMonth", periodMonth);
    uploadMutation.mutate(formData);
  }, [claimsFile, remittanceFile, providerName, periodYear, periodMonth, toast, uploadMutation, claimsPeriodMismatch, inferredClaimsPeriod]);

  const runSmartAction = useCallback(() => {
    if (uploadAction.type === "disabled") return;
    if (uploadAction.type === "claims-only") submitClaims();
    else if (uploadAction.type === "remittance-only") submitRemittance();
    else submitBoth();
  }, [uploadAction.type, submitClaims, submitRemittance, submitBoth]);

  /* ------------------------------------------------------------------------ */
  /* Inline validation - remittance without claims in THIS period */
  /* ------------------------------------------------------------------------ */

  const showRemittanceWarning = useMemo(() => {
    if (!remittanceFile || claimsFile) return false;
    if (!periodStatus) return false;
    return periodStatus.claims.total === 0;
  }, [remittanceFile, claimsFile, periodStatus]);

  /* ------------------------------------------------------------------------ */
  /* Contextual help text */
  /* ------------------------------------------------------------------------ */

  const helpText = useMemo(() => {
    const hasClaims = !!claimsFile;
    const hasRemittance = !!remittanceFile;
    const periodHasClaims = !!periodStatus && periodStatus.claims.total > 0;

    if (!hasClaims && !hasRemittance) {
      if (periodHasClaims) return "Claims are ready! Upload the remittance file to reconcile.";
      return "Upload your claims file to store them while waiting for remittance, or upload both files to reconcile immediately.";
    }

    if (hasClaims && !hasRemittance) return "Upload your claims file to store them while waiting for remittance.";
    if (!hasClaims && hasRemittance) {
      if (periodHasClaims) return "Upload remittance to reconcile against stored claims for this period.";
      return "⚠️ No claims found for this period. Please upload claims first or select a different period.";
    }

    return "Both files ready - click Upload to reconcile immediately.";
  }, [claimsFile, remittanceFile, periodStatus]);

  /* ------------------------------------------------------------------------ */
  /* Run helpers */
  /* ------------------------------------------------------------------------ */

  const getRunStatus = (run: ReconRun): "awaiting_remittance" | "reconciled" | "pending_review" => {
    if (run.totalRemittanceRows === 0) return "awaiting_remittance";
    if (run.partialMatched > 0 || run.manualReview > 0) return "pending_review";
    return "reconciled";
  };

  const getRunStatusBadge = (run: ReconRun) => {
    const status = getRunStatus(run);
    switch (status) {
      case "awaiting_remittance":
        return (
          <Badge className="bg-blue-500 text-white hover:bg-blue-600">
            <Clock className="w-3 h-3 mr-1" />
            Awaiting remittance
          </Badge>
        );
      case "pending_review":
        return (
          <Badge className="bg-orange-500 text-white hover:bg-orange-600">
            <AlertCircle className="w-3 h-3 mr-1" />
            Reconciled – pending review
          </Badge>
        );
      case "reconciled":
      default:
        return (
          <Badge className="bg-green-500 text-white hover:bg-green-600">
            <CheckCircle2 className="w-3 h-3 mr-1" />
            Reconciled
          </Badge>
        );
    }
  };

  // D) Updated filteredRuns
  const filteredRuns = useMemo(() => {
    if (statusFilter === "all") return actualReconciliationRuns;
    return actualReconciliationRuns.filter((run) => runGroup(run) === statusFilter);
  }, [actualReconciliationRuns, statusFilter]);

  const selectedRun = runs.find((r) => r.id === selectedRunId) || null;

  // B) Replace counts + filtering logic for Claims Details
  const waitingCountForSelected = useMemo(
    () => claims.filter((c) => claimStatusGroup(c.status) === "waiting").length,
    [claims]
  );

  const followUpCountForSelected = useMemo(
    () => claims.filter((c) => claimStatusGroup(c.status) === "follow_up").length,
    [claims]
  );

  const filteredClaims = useMemo(() => {
    if (attentionFilter === "all") return claims;
    if (attentionFilter === "waiting") return claims.filter((c) => claimStatusGroup(c.status) === "waiting");
    return claims.filter((c) => claimStatusGroup(c.status) === "follow_up");
  }, [claims, attentionFilter]);

  // C) Update badges text using claimStatusLabel()
  const getStatusBadge = (status: string) => {
    const label = claimStatusLabel(status);

    switch (status) {
      case "paid":
      case "matched":
        return (
          <Badge className="bg-green-500 text-white hover:bg-green-600">
            <CheckCircle2 className="w-3 h-3 mr-1" />
            {label}
          </Badge>
        );
      case "partially_paid":
        return (
          <Badge className="bg-yellow-500 text-black hover:bg-yellow-600">
            <Clock className="w-3 h-3 mr-1" />
            {label}
          </Badge>
        );
      case "manual_review":
        return (
          <Badge className="bg-orange-500 text-white hover:bg-orange-600">
            <AlertCircle className="w-3 h-3 mr-1" />
            {label}
          </Badge>
        );
      case "unpaid":
        return (
          <Badge className="bg-red-500 text-white hover:bg-red-600">
            <AlertCircle className="w-3 h-3 mr-1" />
            {label}
          </Badge>
        );
      case "awaiting_remittance":
      case "submitted":
      default:
        return (
          <Badge className="bg-blue-500 text-white hover:bg-blue-600">
            <Clock className="w-3 h-3 mr-1" />
            {label}
          </Badge>
        );
    }
  };

  /* ------------------------------------------------------------------------ */
  /* Handlers */
  /* ------------------------------------------------------------------------ */

  const touchPeriod = () => {
    didUserTouchPeriod.current = true;
  };

  const applyPeriod = (y: string, m: string) => {
    touchPeriod();
    setPeriodYear(y);
    setPeriodMonth(m);
  };

  const handleSelectPeriodCard = useCallback(
    (year: number, month: number) => {
      touchPeriod();
      setPeriodYear(String(year));
      setPeriodMonth(String(month));
    },
    []
  );

  const handleStepperAction = useCallback(() => {
    if (!periodStatus) return;

    const hasClaims = periodStatus.claims.total > 0;
    const hasRemittance = periodStatus.remittances.total > 0;
    const isReconciled = periodStatus.isReconciled;

    if (!hasClaims) {
      submitClaims();
    } else if (!hasRemittance) {
      submitRemittance();
    } else if (!isReconciled) {
      toast({
        title: "Reconciliation Pending",
        description: "Reconciliation will run automatically when you upload the remittance file.",
      });
    } else {
      const exceptionsSection = document.getElementById("exceptions-section");
      if (exceptionsSection) exceptionsSection.scrollIntoView({ behavior: "smooth" });
      else setShowInventory(true);
    }
  }, [periodStatus, submitClaims, submitRemittance, toast]);

  const handleDeleteRun = (runId: number) => {
    const run = runs.find((r) => r.id === runId);
    const label = run ? `${run.providerName} – ${formatPeriodLabel(run.periodYear, run.periodMonth)}` : `Run #${runId}`;

    const ok = window.confirm(
      `Delete reconciliation run "${label}"?\n\nThis will remove the run and all its claims/remittances. This cannot be undone.`
    );
    if (!ok) return;

    deleteMutation.mutate(runId);
  };

  const handleExportIssues = () => {
    if (!selectedRunId) return;
    if (followUpCountForSelected === 0) {
      toast({ title: "Nothing to export", description: "No needs follow-up items for this run." });
      return;
    }
    exportIssuesMutation.mutate(selectedRunId);
  };

  const handleDeletePeriod = (period: PeriodSummary, type: "claims" | "remittances") => {
    const periodLabel = formatPeriodLabel(period.periodYear, period.periodMonth);

    if (type === "claims") {
      const claimCount = period.totalClaims;
      const ok = window.confirm(
        `Delete all ${claimCount} ${pluralize(claimCount, "claim")} for ${periodLabel}?\n\nThis cannot be undone.`
      );
      if (!ok) return;

      deletePeriodClaimsMutation.mutate({
        providerName: period.providerName,
        year: period.periodYear,
        month: period.periodMonth,
      });
    } else {
      const ok = window.confirm(`Delete all remittances for ${periodLabel}?\n\nThis cannot be undone.`);
      if (!ok) return;

      deletePeriodRemittancesMutation.mutate({
        providerName: period.providerName,
        year: period.periodYear,
        month: period.periodMonth,
      });
    }
  };

  const handleReplacePeriodFile = (period: PeriodSummary, type: "claims" | "remittances") => {
    touchPeriod();
    setPeriodYear(period.periodYear.toString());
    setPeriodMonth(period.periodMonth.toString());
    setProviderName(period.providerName);

    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".xlsx,.xls";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      if (type === "claims") {
        setClaimsFile(file);
        const formData = new FormData();
        formData.append("claimsFile", file);
        formData.append("providerName", period.providerName);
        formData.append("periodYear", period.periodYear.toString());
        formData.append("periodMonth", period.periodMonth.toString());
        uploadClaimsMutation.mutate(formData);
      } else {
        setRemittanceFile(file);
        const formData = new FormData();
        formData.append("remittanceFile", file);
        formData.append("providerName", period.providerName);
        formData.append("periodYear", period.periodYear.toString());
        formData.append("periodMonth", period.periodMonth.toString());
        uploadRemittanceMutation.mutate(formData);
      }
    };
    input.click();
  };

  /* ------------------------------------------------------------------------ */
  /* Render */
  /* ------------------------------------------------------------------------ */

  return (
    <>
      {/* Premium Gradient Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-orange-600 via-amber-500 to-orange-400 p-8 shadow-2xl">
        <div className="absolute inset-0 opacity-20">
          <div className="absolute inset-0 reconciliation-header-pattern" />
        </div>

        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {particles.map((particle, i) => (
            <div
              key={i}
              className="absolute w-2 h-2 bg-white rounded-full opacity-30"
              style={{
                left: particle.left,
                top: particle.top,
                animation: `float ${particle.duration}s ease-in-out infinite ${particle.delay}s`,
              }}
            />
          ))}
        </div>

        <div className="absolute inset-0 backdrop-blur-[2px] bg-white/5" />
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-orange-500 via-amber-500 to-orange-400 animate-pulse" />

        <div className="relative z-10">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-white drop-shadow-2xl">Claim Reconciliation</h1>
              <p className="text-orange-100 mt-1 drop-shadow-lg">
                Upload claim and remittance files, then review matches, underpayments, and outstanding balances
              </p>
            </div>

            <button
              onClick={() => setShowHelp((v) => !v)}
              className="flex items-center gap-2 px-4 py-2 bg-white/95 backdrop-blur-md border-white/30 hover:bg-white transition-all hover:shadow-xl hover:scale-105 rounded-lg text-orange-700 font-medium text-sm"
            >
              <Info className="w-4 h-4" />
              <span className="hidden sm:inline">{showHelp ? "Hide help" : "Show help"}</span>
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto space-y-8 pb-10 pt-6">
        {/* KPI cards */}
        <section className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="relative overflow-hidden rounded-xl border-2 border-emerald-200 bg-white px-4 py-3 hover:border-emerald-300 transition-all hover:shadow-xl hover:-translate-y-1 group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-emerald-400/20 to-teal-500/20 rounded-full blur-2xl group-hover:scale-110 transition-transform" />
              <div className="relative flex items-start justify-between">
                <div className="flex-1">
                  <div className="text-xs font-medium text-slate-500 mb-1 flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-md">
                      <CheckCircle className="w-4 h-4 text-white" />
                    </div>
                    Reconciliations done
                  </div>
                  <div className="mt-1 flex items-baseline gap-2">
                    <span className="text-2xl font-bold text-gray-900">{stats.reconciliationsDone}</span>
                    <span className="text-[11px] uppercase tracking-wide text-slate-500">with remittances</span>
                  </div>
                  <div className="mt-1 text-[11px] text-slate-500">Latest period: {stats.lastPeriodLabel}</div>
                </div>
              </div>
            </div>

            <div className="relative overflow-hidden rounded-xl border-2 border-blue-200 bg-white px-4 py-3 hover:border-blue-300 transition-all hover:shadow-xl hover:-translate-y-1 group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-blue-400/20 to-cyan-500/20 rounded-full blur-2xl group-hover:scale-110 transition-transform" />
              <div className="relative flex items-start justify-between">
                <div className="flex-1">
                  <div className="text-xs font-medium text-slate-500 mb-1 flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center shadow-md">
                      <FileStack className="w-4 h-4 text-white" />
                    </div>
                    Claims processed
                  </div>
                  <div className="mt-1 flex items-baseline gap-2">
                    <span className="text-2xl font-bold text-gray-900">{stats.totalClaims.toLocaleString()}</span>
                    <span className="text-[11px] uppercase tracking-wide text-slate-500">rows in total</span>
                  </div>
                  <div className="mt-1 text-[11px] text-slate-500">Across all uploads.</div>
                </div>
              </div>
            </div>

            <div className="relative overflow-hidden rounded-xl border-2 border-orange-200 bg-white px-4 py-3 hover:border-orange-300 transition-all hover:shadow-xl hover:-translate-y-1 group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-orange-400/20 to-red-500/20 rounded-full blur-2xl group-hover:scale-110 transition-transform" />
              <div className="relative flex items-start justify-between">
                <div className="flex-1">
                  <div className="text-xs font-medium text-slate-500 mb-1 flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center shadow-md">
                      <AlertTriangle className="w-4 h-4 text-white" />
                    </div>
                    Claims to follow up
                  </div>
                  <div className="mt-1 flex items-baseline gap-2">
                    <span className="text-2xl font-bold text-orange-600">{stats.problemClaims}</span>
                    <span className="text-[11px] uppercase tracking-wide text-orange-500">confirmed issues</span>
                  </div>
                  <div className="mt-1 text-[11px] text-slate-500">
                    {stats.awaitingRemittance > 0
                      ? `Unpaid/partial claims. ${stats.awaitingRemittance} awaiting remittance.`
                      : "Unpaid or partially paid after reconciliation."}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {showHelp && (
            <Card className="border border-dashed border-slate-300 bg-slate-50/80">
              <CardContent className="pt-4 text-sm text-slate-700 space-y-2">
                <div className="font-medium text-slate-800">How the reconciliation workflow works</div>
                <ul className="list-disc list-inside space-y-1">
                  <li>
                    <strong>Select any month/year:</strong> Use the Provider/Year/Month controls in the Workflow card.
                  </li>
                  <li>
                    <strong>Upload claims first:</strong> Claims store as “awaiting remittance”.
                  </li>
                  <li>
                    <strong>Upload remittance later:</strong> Upload it to reconcile.
                  </li>
                  <li>
                    <strong>Submit button:</strong> The “Upload…” button under the dropzones is available once you select a file.
                  </li>
                </ul>
              </CardContent>
            </Card>
          )}
        </section>

        {/* Period cards */}
        {periodsSummary.length > 0 && (
          <Card className="border-2 border-slate-200/80 shadow-lg">
            <CardHeader className="pb-4 bg-gradient-to-r from-slate-50 to-white">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <div>
                  <CardTitle className="text-lg">Your Claim Periods</CardTitle>
                  <CardDescription>Click a period card to set the active month/year.</CardDescription>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-2">
                    <Label className="text-sm font-medium text-slate-700">Provider:</Label>
                    <Select
                      value={providerName}
                      onValueChange={(v) => {
                        // ✅ Do NOT mark period “touched” for provider changes
                        setProviderName(v);
                      }}
                    >
                      <SelectTrigger className="w-[160px] bg-white">
                        <SelectValue placeholder="Provider" />
                      </SelectTrigger>
                      <SelectContent>
                        {providerOptions.map((p) => (
                          <SelectItem key={p} value={p}>
                            {p}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {availableYears.length > 1 && (
                    <div className="flex items-center gap-2">
                      <Label className="text-sm font-medium text-slate-700">Year:</Label>
                      <Select
                        value={periodYearFilter?.toString() || "all"}
                        onValueChange={(value) => setPeriodYearFilter(value === "all" ? null : parseInt(value, 10))}
                      >
                        <SelectTrigger className="w-[140px] bg-white">
                          <SelectValue placeholder="Select year" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All years</SelectItem>
                          {availableYears.map((year) => (
                            <SelectItem key={year} value={year.toString()}>
                              {year}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  <Badge className="bg-orange-500 text-white">Active: {activePeriodLabel}</Badge>
                </div>
              </div>
            </CardHeader>

            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredPeriods.map((period) => {
                  const isActive =
                    period.periodYear === parseInt(periodYear, 10) &&
                    period.periodMonth === parseInt(periodMonth, 10);

                  const isComplete =
                    period.totalClaims > 0 &&
                    period.awaitingRemittance === 0 &&
                    period.unpaid === 0 &&
                    period.partiallyPaid === 0;

                  const hasAwaiting = period.awaitingRemittance > 0;
                  const hasIssues = period.unpaid > 0 || period.partiallyPaid > 0;

                  // ✅ Priority: issues > awaiting
                  const cardState: "complete" | "needs_review" | "awaiting" | "processing" =
                    isComplete ? "complete" : hasIssues ? "needs_review" : hasAwaiting ? "awaiting" : "processing";

                  return (
                    <div
                      key={`${period.periodYear}-${period.periodMonth}`}
                      onClick={() => handleSelectPeriodCard(period.periodYear, period.periodMonth)}
                      className={cn(
                        "relative overflow-hidden rounded-xl border-2 p-4 transition-all hover:shadow-lg hover:-translate-y-1 group cursor-pointer",
                        isActive
                          ? "border-orange-400 bg-orange-50/50 shadow-md ring-2 ring-orange-300"
                          : "border-slate-200 bg-white hover:border-slate-300"
                      )}
                    >
                      <div
                        className={cn(
                          "absolute top-0 right-0 w-24 h-24 rounded-full blur-2xl transition-all",
                          cardState === "complete"
                            ? "bg-gradient-to-br from-green-400/20 to-emerald-500/20"
                            : cardState === "awaiting"
                            ? "bg-gradient-to-br from-blue-400/20 to-cyan-500/20"
                            : cardState === "needs_review"
                            ? "bg-gradient-to-br from-orange-400/20 to-red-500/20"
                            : "bg-gradient-to-br from-slate-400/10 to-slate-500/10",
                          "group-hover:scale-110"
                        )}
                      />

                      <div className="relative space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <h3 className="font-bold text-lg text-slate-800 group-hover:text-orange-600 transition-colors">
                              {formatPeriodLabel(period.periodYear, period.periodMonth)}
                            </h3>
                          </div>

                          <div className="flex items-center gap-2">
                            {cardState === "complete" ? (
                              <CheckCircle2 className="w-5 h-5 text-green-600" />
                            ) : cardState === "awaiting" ? (
                              <Clock className="w-5 h-5 text-blue-600" />
                            ) : cardState === "needs_review" ? (
                              <AlertTriangle className="w-5 h-5 text-orange-600" />
                            ) : null}

                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="w-7 h-7 text-slate-500 hover:text-slate-700 hover:bg-slate-100"
                                  onClick={(e) => e.stopPropagation()}
                                  disabled={isDeleting || isUploading}
                                >
                                  <MoreHorizontal className="w-4 h-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleReplacePeriodFile(period, "claims");
                                  }}
                                  disabled={isUploading}
                                  className="cursor-pointer"
                                >
                                  <Upload className="w-3 h-3 mr-2" />
                                  Replace claims file
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeletePeriod(period, "claims");
                                  }}
                                  disabled={isDeleting}
                                  className="text-red-600 focus:text-red-600 focus:bg-red-50 cursor-pointer"
                                >
                                  <Trash2 className="w-3 h-3 mr-2" />
                                  Clear all claims
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleReplacePeriodFile(period, "remittances");
                                  }}
                                  disabled={isUploading}
                                  className="cursor-pointer"
                                >
                                  <Upload className="w-3 h-3 mr-2" />
                                  Replace remittance file
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeletePeriod(period, "remittances");
                                  }}
                                  disabled={isDeleting}
                                  className="text-red-600 focus:text-red-600 focus:bg-red-50 cursor-pointer"
                                >
                                  <Trash2 className="w-3 h-3 mr-2" />
                                  Clear remittances
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>

                        <div className="w-full text-left">
                          <div className="text-2xl font-bold text-slate-900">
                            {period.totalClaims} {pluralize(period.totalClaims, "claim")}
                          </div>
                          <div className="text-sm text-slate-600">
                            {getCurrencyForDisplay(period.providerName, period.currency)}{" "}
                            {parseFloat(period.totalBilled).toLocaleString()} billed
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          {cardState === "complete" ? (
                            <Badge className="bg-green-500 text-white hover:bg-green-600">
                              <CheckCircle2 className="w-3 h-3 mr-1" />
                              Complete
                            </Badge>
                          ) : cardState === "needs_review" ? (
                            <Badge className="bg-orange-500 text-white hover:bg-orange-600">
                              <AlertTriangle className="w-3 h-3 mr-1" />
                              Needs review
                            </Badge>
                          ) : cardState === "awaiting" ? (
                            <Badge className="bg-blue-500 text-white hover:bg-blue-600">
                              <Clock className="w-3 h-3 mr-1" />
                              Awaiting Remittance
                            </Badge>
                          ) : (
                            <Badge className="bg-slate-500 text-white hover:bg-slate-600">Processing</Badge>
                          )}
                        </div>

                        <div className="text-xs text-slate-500 space-y-1">
                          {period.awaitingRemittance > 0 && <div>• {period.awaitingRemittance} awaiting remittance</div>}
                          {period.matched > 0 && <div>• {period.matched} matched</div>}
                          {period.partiallyPaid > 0 && <div>• {period.partiallyPaid} partially paid</div>}
                          {period.unpaid > 0 && <div>• {period.unpaid} unpaid</div>}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Workflow */}
        <Card id="workflow-section" className="border-2 border-slate-200/80 shadow-lg">
          <CardHeader className="pb-4 bg-gradient-to-r from-orange-50 to-amber-50">
            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
              <div>
                <CardTitle className="text-lg md:text-xl flex items-center gap-2">
                  <div className="w-1 h-6 bg-gradient-to-b from-orange-500 to-amber-500 rounded-full" />
                  Reconciliation Workflow
                </CardTitle>
                <CardDescription>{getWorkflowDescription(providerName, activePeriodLabel)}</CardDescription>
              </div>

              <div className="flex flex-wrap items-end gap-2">
                <div className="grid gap-1">
                  <span className="text-xs text-muted-foreground">Provider</span>
                  <Select
                    value={providerName}
                    onValueChange={(v) => {
                      // ✅ Do NOT mark period “touched” for provider changes
                      setProviderName(v);
                    }}
                  >
                    <SelectTrigger className="w-[160px] bg-white">
                      <SelectValue placeholder="Provider" />
                    </SelectTrigger>
                    <SelectContent>
                      {providerOptions.map((p) => (
                        <SelectItem key={p} value={p}>
                          {p}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid gap-1">
                  <span className="text-xs text-muted-foreground">Year</span>
                  <Select value={periodYear} onValueChange={(v) => applyPeriod(v, periodMonth)}>
                    <SelectTrigger className="w-[110px] bg-white">
                      <SelectValue placeholder="Year" />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 7 }).map((_, i) => {
                        const y = String(now.getFullYear() - 4 + i);
                        return (
                          <SelectItem key={y} value={y}>
                            {y}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid gap-1">
                  <span className="text-xs text-muted-foreground">Month</span>
                  <Select value={periodMonth} onValueChange={(v) => applyPeriod(periodYear, v)}>
                    <SelectTrigger className="w-[150px] bg-white">
                      <SelectValue placeholder="Month" />
                    </SelectTrigger>
                    <SelectContent>
                      {MONTHS.map((m) => (
                        <SelectItem key={m.value} value={m.value}>
                          {m.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <Badge variant="outline" className="bg-white">
                  Active: {activePeriodLabel}
                </Badge>
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-6 pt-4">
            <ReconciliationStepper
              steps={stepperState.steps}
              currentStep={stepperState.currentStep}
              primaryActionLabel={stepperState.primaryAction}
              primaryActionDisabled={stepperState.primaryDisabled || isUploading || isDeleting}
              primaryActionLoading={isUploading}
              onPrimaryAction={handleStepperAction}
            />

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-700">File Upload</h3>
                {periodStatusLoading ? (
                  <span className="text-xs text-muted-foreground">Loading status…</span>
                ) : periodStatus ? (
                  <span className="text-xs text-muted-foreground">
                    {periodStatus.claims.total} claims • {periodStatus.remittances.total} remittances
                  </span>
                ) : null}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <FileDropzone
                    label="Claims File"
                    description="Upload claims submitted to insurance"
                    file={claimsFile}
                    onFileChange={setClaimsFile}
                    disabled={isUploading}
                    tintColor="blue"
                    icon={<FileText className="w-4 h-4" />}
                  />

                  {claimsFile && inferredClaimsPeriod && claimsPeriodMismatch && (
                    <div className="mt-2 rounded-lg border-2 border-orange-300 bg-orange-50 px-4 py-3 text-sm">
                      <div className="font-semibold text-orange-800">Period mismatch detected</div>
                      <div className="text-orange-700 text-xs mt-1">
                        File looks like{" "}
                        <b>
                          {formatPeriodLabel(
                            parseInt(inferredClaimsPeriod.year, 10),
                            parseInt(inferredClaimsPeriod.month, 10)
                          )}
                        </b>
                        , but active period is <b>{activePeriodLabel}</b>.
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="mt-2"
                        onClick={() => applyPeriod(inferredClaimsPeriod.year, inferredClaimsPeriod.month)}
                      >
                        Switch active period to{" "}
                        {formatPeriodLabel(
                          parseInt(inferredClaimsPeriod.year, 10),
                          parseInt(inferredClaimsPeriod.month, 10)
                        )}
                      </Button>
                    </div>
                  )}
                </div>

                <FileDropzone
                  label="Remittance File"
                  description={getRemittanceUploadDescription(providerName)}
                  file={remittanceFile}
                  onFileChange={setRemittanceFile}
                  disabled={isUploading}
                  tintColor="green"
                  icon={<DollarSign className="w-4 h-4" />}
                />
              </div>

              {showRemittanceWarning && (
                <div className="flex items-start gap-3 px-4 py-3 bg-orange-50 border-2 border-orange-300 rounded-lg">
                  <AlertTriangle className="w-5 h-5 text-orange-600 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <div className="font-semibold text-sm text-orange-800 mb-1">No claims found for this period</div>
                    <div className="text-xs text-orange-700">Please upload claims first or select a different period.</div>
                  </div>
                </div>
              )}

              <div className="flex items-start gap-2 rounded-lg border bg-slate-50 px-4 py-3">
                <Info className="w-4 h-4 mt-0.5 text-slate-600" />
                <div className="text-xs text-slate-700">{helpText}</div>
              </div>

              <Button
                type="button"
                className="w-full"
                onClick={runSmartAction}
                disabled={isUploading || isDeleting || uploadAction.disabled}
              >
                {isUploading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                {uploadAction.label}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Claims Inventory */}
        <Card id="exceptions-section" className="border-2 border-slate-200/80 shadow-lg">
          <CardHeader className="pb-3 bg-gradient-to-r from-slate-50 to-white">
            <div className="flex items-center justify-between gap-2">
              <div>
                <CardTitle className="text-lg">Claims Inventory</CardTitle>
                <CardDescription>All claims submitted to {providerName} across all periods</CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowInventory(!showInventory)}
                className="gap-2"
              >
                <FileStack className="w-4 h-4" />
                {showInventory ? "Hide" : "View All Claims"}
              </Button>
            </div>
          </CardHeader>

          {showInventory && (
            <CardContent className="pt-0">
              <div className="py-3 mb-2">
                <div className="inline-flex items-center rounded-full bg-gradient-to-r from-slate-100 to-slate-50 p-1 text-xs shadow-sm border border-slate-200 flex-wrap">
                  {(
                    [
                      { key: "all", label: "All" },
                      { key: "awaiting_remittance", label: "Pending remittance" },
                      { key: "matched", label: "Paid in full" },
                      { key: "partially_paid", label: "Paid partially" },
                      { key: "unpaid", label: "Not paid (0 paid)" },
                    ] as const
                  ).map((x) => (
                    <button
                      key={x.key}
                      type="button"
                      className={cn(
                        "px-4 py-2 rounded-full transition-all font-medium",
                        inventoryStatusFilter === x.key
                          ? x.key === "unpaid"
                            ? "bg-red-500 shadow-md text-white"
                            : x.key === "matched"
                            ? "bg-green-500 shadow-md text-white"
                            : x.key === "awaiting_remittance"
                            ? "bg-blue-500 shadow-md text-white"
                            : x.key === "partially_paid"
                            ? "bg-yellow-500 shadow-md text-white"
                            : "bg-white shadow-md text-slate-900"
                          : "text-slate-600 hover:text-slate-900"
                      )}
                      onClick={() => {
                        setInventoryStatusFilter(x.key);
                        setInventoryPage(1);
                      }}
                    >
                      {x.label}
                    </button>
                  ))}
                </div>
              </div>

              {periodsSummary.length > 0 && (
                <div className="mb-4 flex items-center gap-2">
                  <Label className="text-sm font-medium text-slate-700">Period:</Label>
                  <Select
                    value={inventoryPeriodFilter || "all"}
                    onValueChange={(value) => {
                      setInventoryPeriodFilter(value === "all" ? null : value);
                      setInventoryPage(1);
                    }}
                  >
                    <SelectTrigger className="w-[320px] bg-white">
                      <SelectValue placeholder="All periods" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All periods</SelectItem>
                      {periodsSummary.map((period) => {
                        const periodKey = `${period.periodYear}-${period.periodMonth}`;
                        return (
                          <SelectItem key={periodKey} value={periodKey}>
                            {formatPeriodLabel(period.periodYear, period.periodMonth)} ({period.totalClaims}{" "}
                            {pluralize(period.totalClaims, "claim")})
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>

                  {inventoryPeriodFilter && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-2"
                      onClick={() => {
                        setInventoryPeriodFilter(null);
                        setInventoryPage(1);
                      }}
                    >
                      <X className="w-4 h-4" />
                      Clear
                    </Button>
                  )}
                </div>
              )}

              {!summaryLoading && (
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4 p-4 bg-slate-50 rounded-lg">
                  <div>
                    <div className="text-xs text-slate-500 mb-1">Total Claims</div>
                    <div className="text-xl font-bold text-slate-900">{inventorySummaryStats.total}</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500 mb-1">Pending remittance</div>
                    <div className="text-xl font-bold text-blue-600">{inventorySummaryStats.awaiting}</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500 mb-1">Matched</div>
                    <div className="text-xl font-bold text-green-600">{inventorySummaryStats.matched}</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500 mb-1">Partially Paid</div>
                    <div className="text-xl font-bold text-yellow-600">{inventorySummaryStats.partial}</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500 mb-1">Unpaid</div>
                    <div className="text-xl font-bold text-red-600">{inventorySummaryStats.unpaid}</div>
                  </div>
                </div>
              )}

              {inventoryLoading ? (
                <p className="text-muted-foreground py-6 text-sm">Loading claims inventory…</p>
              ) : !claimsInventory || claimsInventory.claims.length === 0 ? (
                <div className="text-center py-8">
                  <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                  <p className="text-muted-foreground text-sm">
                    No claims found
                    {inventoryStatusFilter !== "all" ? ` with status "${inventoryStatusFilter}"` : ""}
                    {inventoryPeriodLabel ? ` for ${inventoryPeriodLabel}` : ""}
                  </p>
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-slate-50/50">
                          <TableHead>Member #</TableHead>
                          <TableHead>Patient Name</TableHead>
                          <TableHead>Service Date</TableHead>
                          <TableHead>Period</TableHead>
                          <TableHead>Billed Amount</TableHead>
                          <TableHead>Amount Paid</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {claimsInventory.claims.map((claim) => (
                          <TableRow key={claim.id} className="odd:bg-slate-50/40 hover:bg-slate-100/80 transition-colors">
                            <TableCell className="font-mono text-sm">{claim.memberNumber}</TableCell>
                            <TableCell>{claim.patientName || "N/A"}</TableCell>
                            <TableCell>{new Date(claim.serviceDate).toLocaleDateString()}</TableCell>
                            <TableCell className="text-sm">{formatPeriodLabel(claim.periodYear, claim.periodMonth)}</TableCell>
                            <TableCell>
                              {getCurrencyForDisplay(claim.providerName, claim.currency)}{" "}
                              {parseFloat(claim.billedAmount).toFixed(2)}
                            </TableCell>
                            <TableCell>
                              {getCurrencyForDisplay(claim.providerName, claim.currency)}{" "}
                              {parseFloat(claim.amountPaid || "0").toFixed(2)}
                            </TableCell>
                            <TableCell>{getStatusBadge(claim.status)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  {claimsInventory.pagination.totalPages > 1 && (
                    <div className="flex items-center justify-between mt-4 pt-4 border-t">
                      <div className="text-sm text-slate-600">
                        Showing {(claimsInventory.pagination.page - 1) * claimsInventory.pagination.limit + 1} to{" "}
                        {Math.min(
                          claimsInventory.pagination.page * claimsInventory.pagination.limit,
                          claimsInventory.pagination.total
                        )}{" "}
                        of {claimsInventory.pagination.total} claims
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setInventoryPage((p) => Math.max(1, p - 1))}
                          disabled={inventoryPage === 1}
                        >
                          Previous
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setInventoryPage((p) => p + 1)}
                          disabled={inventoryPage >= claimsInventory.pagination.totalPages}
                        >
                          Next
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          )}
        </Card>

        {/* Reconciliation history */}
        <Card id="reconciliation-history" className="border-2 border-slate-200/80 shadow-lg">
          <CardHeader className="pb-3 bg-gradient-to-r from-slate-50 to-white">
            <div className="flex items-center justify-between gap-2">
              <div>
                <CardTitle className="text-lg">Reconciliation history</CardTitle>
                <CardDescription>Previous reconciliation runs for all providers.</CardDescription>
              </div>
              {runsFetching && <span className="text-xs text-muted-foreground">Refreshing…</span>}
            </div>
          </CardHeader>

          <CardContent className="pt-0">
            {actualReconciliationRuns.length > 0 && (
              <div className="py-3 mb-2">
                <div className="inline-flex items-center rounded-full bg-gradient-to-r from-slate-100 to-slate-50 p-1 text-xs shadow-sm border border-slate-200">
                  <button
                    type="button"
                    className={cn(
                      "px-4 py-2 rounded-full transition-all font-medium",
                      statusFilter === "all" ? "bg-white shadow-md text-slate-900" : "text-slate-600 hover:text-slate-900"
                    )}
                    onClick={() => setStatusFilter("all")}
                  >
                    All ({actualReconciliationRuns.length})
                  </button>

                  <button
                    type="button"
                    className={cn(
                      "px-4 py-2 rounded-full transition-all font-medium flex items-center gap-1",
                      statusFilter === "needs_follow_up"
                        ? "bg-orange-500 shadow-md text-white"
                        : "text-slate-600 hover:text-slate-900"
                    )}
                    onClick={() => setStatusFilter("needs_follow_up")}
                  >
                    <AlertTriangle className="w-3 h-3" />
                    Needs follow-up (
                    {actualReconciliationRuns.filter((r) => runGroup(r) === "needs_follow_up").length})
                  </button>

                  <button
                    type="button"
                    className={cn(
                      "px-4 py-2 rounded-full transition-all font-medium flex items-center gap-1",
                      statusFilter === "completed"
                        ? "bg-green-500 shadow-md text-white"
                        : "text-slate-600 hover:text-slate-900"
                    )}
                    onClick={() => setStatusFilter("completed")}
                  >
                    <CheckCircle2 className="w-3 h-3" />
                    Completed ({actualReconciliationRuns.filter((r) => runGroup(r) === "completed").length})
                  </button>
                </div>
              </div>
            )}

            {runsLoading ? (
              <p className="text-muted-foreground py-6 text-sm">Loading reconciliation runs…</p>
            ) : actualReconciliationRuns.length === 0 ? (
              <p className="text-muted-foreground py-6 text-sm">No reconciliation runs yet.</p>
            ) : filteredRuns.length === 0 ? (
              <p className="text-muted-foreground py-6 text-sm">No runs match the selected filter.</p>
            ) : (
              <div className="w-full overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Provider</TableHead>
                      <TableHead>Period</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Claims</TableHead>
                      <TableHead>Remittances</TableHead>
                      <TableHead>Auto matched</TableHead>
                      <TableHead>Partial</TableHead>
                      <TableHead>Review</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>

                  <TableBody>
                    {filteredRuns.map((run) => {
                      const periodLabel = new Date(run.periodYear, run.periodMonth - 1).toLocaleString("default", {
                        month: "short",
                        year: "numeric",
                      });
                      const isLatest = stats.latestRunId === run.id;

                      return (
                        <TableRow
                          key={run.id}
                          onClick={() => {
                            touchPeriod();
                            setProviderName(run.providerName);
                            setPeriodYear(String(run.periodYear));
                            setPeriodMonth(String(run.periodMonth));
                            setSelectedRunId(run.id);
                            setAttentionFilter("follow_up");

                            window.setTimeout(() => {
                              document.getElementById("claims-details-section")?.scrollIntoView({ behavior: "smooth" });
                            }, 50);
                          }}
                          className={cn(
                            "odd:bg-slate-50/40 hover:bg-emerald-50/60 transition-colors cursor-pointer",
                            selectedRunId === run.id && "border-l-4 border-l-emerald-500 bg-emerald-50/80"
                          )}
                        >
                          <TableCell className="font-medium">{run.providerName}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <span>{periodLabel}</span>
                              {isLatest && (
                                <span className="rounded-full border-2 border-emerald-400 bg-gradient-to-r from-emerald-50 to-teal-50 px-2.5 py-0.5 text-[10px] font-bold text-emerald-700 shadow-sm">
                                  Latest
                                </span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>{getRunStatusBadge(run)}</TableCell>
                          <TableCell>{run.totalClaimRows}</TableCell>
                          <TableCell>{run.totalRemittanceRows}</TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className="text-xs font-semibold border-green-300 bg-green-50 text-green-700"
                            >
                              <CheckCircle className="w-3 h-3 mr-1" />
                              {run.autoMatched} Matched
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge className="bg-yellow-500 text-black hover:bg-yellow-500/90 text-xs font-semibold">
                              <Clock className="w-3 h-3 mr-1" />
                              {run.partialMatched} Partial
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge className="bg-orange-500 text-white hover:bg-orange-500/90 text-xs font-semibold">
                              <AlertCircle className="w-3 h-3 mr-1" />
                              {run.manualReview} Review
                            </Badge>
                          </TableCell>
                          <TableCell>{new Date(run.createdAt).toLocaleDateString()}</TableCell>

                          <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="w-8 h-8" disabled={isDeleting}>
                                  <span className="sr-only">Open menu</span>
                                  <MoreHorizontal className="w-4 h-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                  onClick={() => {
                                    setSelectedRunId(run.id);
                                    setAttentionFilter("follow_up");
                                  }}
                                  className={cn("cursor-pointer", selectedRunId === run.id && "bg-slate-100")}
                                >
                                  View details
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  className="text-red-600 focus:text-red-600 focus:bg-red-50 cursor-pointer"
                                  onClick={() => handleDeleteRun(run.id)}
                                  disabled={isDeleting && deleteMutation.variables === run.id}
                                >
                                  {isDeleting && deleteMutation.variables === run.id ? (
                                    <Loader2 className="w-3 h-3 animate-spin mr-2" />
                                  ) : (
                                    <Trash2 className="w-3 h-3 mr-2" />
                                  )}
                                  Delete Run
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Claims Details */}
        {selectedRunId && (
          <Card
            id="claims-details-section"
            className="border-2 border-slate-200/80 shadow-lg border-l-4 border-l-orange-400"
          >
            <CardHeader className="pb-3 bg-gradient-to-r from-orange-50 to-amber-50">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <div className="w-1 h-6 bg-gradient-to-b from-orange-500 to-amber-500 rounded-full" />
                    Claims details — Run #{selectedRunId}
                  </CardTitle>
                  <CardDescription>Detailed view of claims for the selected run.</CardDescription>
                </div>

                {selectedRun && (
                  <div className="text-xs text-muted-foreground text-right">
                    <div className="font-medium">
                      {selectedRun.providerName} ·{" "}
                      {new Date(selectedRun.periodYear, selectedRun.periodMonth - 1).toLocaleString("default", {
                        month: "short",
                        year: "numeric",
                      })}
                    </div>
                    <div>
                      {selectedRun.totalClaimRows} claims
                      {claims.length > 0 && claims.length !== selectedRun.totalClaimRows ? ` (${claims.length} shown)` : ""},{" "}
                      {selectedRun.totalRemittanceRows} remittances
                    </div>
                  </div>
                )}
              </div>
            </CardHeader>

            <CardContent className="pt-0">
              {claimsLoading ? (
                <p className="text-muted-foreground py-6 text-sm">Loading claims…</p>
              ) : claims.length === 0 ? (
                <p className="text-muted-foreground py-6 text-sm">No claims found for this run.</p>
              ) : (
                <>
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 py-3">
                    {/* B4) Updated pills */}
                    <div className="inline-flex items-center rounded-full bg-gradient-to-r from-slate-100 to-slate-50 p-1 text-xs shadow-sm border border-slate-200">
                      <button
                        type="button"
                        className={cn(
                          "px-4 py-2 rounded-full transition-all font-medium",
                          attentionFilter === "all"
                            ? "bg-white shadow-md text-slate-900"
                            : "text-slate-600 hover:text-slate-900"
                        )}
                        onClick={() => setAttentionFilter("all")}
                      >
                        Open claims ({claims.length})
                      </button>

                      <button
                        type="button"
                        className={cn(
                          "px-4 py-2 rounded-full transition-all font-medium flex items-center gap-1",
                          attentionFilter === "waiting"
                            ? "bg-blue-500 shadow-md text-white"
                            : "text-slate-600 hover:text-slate-900"
                        )}
                        onClick={() => setAttentionFilter("waiting")}
                      >
                        <Clock className="w-3 h-3" />
                        Not paid yet ({waitingCountForSelected})
                      </button>

                      <button
                        type="button"
                        className={cn(
                          "px-4 py-2 rounded-full transition-all font-medium flex items-center gap-1",
                          attentionFilter === "follow_up"
                            ? "bg-gradient-to-r from-orange-500 to-amber-500 shadow-md text-white"
                            : "text-slate-600 hover:text-slate-900"
                        )}
                        onClick={() => setAttentionFilter("follow_up")}
                      >
                        <AlertTriangle className="w-3 h-3" />
                        Needs follow-up ({followUpCountForSelected})
                      </button>
                    </div>

                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="gap-2"
                      onClick={handleExportIssues}
                      disabled={!selectedRunId || followUpCountForSelected === 0 || isExporting}
                    >
                      {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                      Export for {selectedRun?.providerName ?? providerName}
                    </Button>
                  </div>

                  {filteredClaims.length === 0 ? (
                    <p className="text-muted-foreground py-6 text-sm">
                      {attentionFilter === "follow_up"
                        ? "No needs follow-up items for this run."
                        : attentionFilter === "waiting"
                        ? "No not-paid-yet items for this run."
                        : "No claims to display."}
                    </p>
                  ) : (
                    <div className="w-full overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Member #</TableHead>
                            <TableHead>Patient name</TableHead>
                            <TableHead>Service date</TableHead>
                            <TableHead>Billed amount</TableHead>
                            <TableHead>Amount paid</TableHead>
                            <TableHead>Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredClaims.map((claim) => (
                            <TableRow
                              key={claim.id}
                              className="odd:bg-slate-50/40 hover:bg-slate-100/80 transition-colors"
                            >
                              <TableCell className="font-mono">{claim.memberNumber}</TableCell>
                              <TableCell>{claim.patientName || "N/A"}</TableCell>
                              <TableCell>{new Date(claim.serviceDate).toLocaleDateString()}</TableCell>
                              <TableCell>
                                {selectedRun ? getCurrencyForDisplay(selectedRun.providerName, claim.currency) : "USD"}{" "}
                                {parseFloat(claim.billedAmount).toFixed(2)}
                              </TableCell>
                              <TableCell>
                                {selectedRun ? getCurrencyForDisplay(selectedRun.providerName, claim.currency) : "USD"}{" "}
                                {parseFloat(claim.amountPaid || "0").toFixed(2)}
                              </TableCell>
                              <TableCell>{getStatusBadge(claim.status)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </>
  );
}
