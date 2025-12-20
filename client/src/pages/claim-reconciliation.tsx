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
import { cn, formatNumber } from "@/lib/utils";

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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

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
  LayoutGrid,
  Table as TableIcon,
  ChevronDown,
  Lightbulb,
  ArrowRight,
  Search,
  Zap,
  HelpCircle,
  TrendingUp,
  Calculator,
} from "lucide-react";

/* -------------------------------------------------------------------------- */
/* Other Imports */
/* -------------------------------------------------------------------------- */
import { useToast } from "@/hooks/use-toast";
import { API_BASE_URL } from "@/lib/constants";
import { ReconciliationStepper } from "@/components/ui/reconciliation-stepper";
import { formatDate, formatPeriod } from "@/lib/dateFormat";

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
  unpaidCount: number;
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
  summary: {
    total: number;
    awaiting_remittance: number;
    matched: number;
    partially_paid: number;
    unpaid: number;
  };
}

interface AvailablePeriodsResponse {
  years: number[];
  monthsByYear: { [year: number]: number[] };
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
/* Constants */
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

const MAX_CARDS_DEFAULT = 6;  // Issue 3: Show max 6 cards by default

// Requirement 3: Default history view shows Jan-Apr of current year
const HISTORY_DEFAULT_MONTH_START = 1;  // January
const HISTORY_DEFAULT_MONTH_END = 4;    // April

function formatPeriodLabel(year: number, month: number): string {
  return formatPeriod(year, month);
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
 * Status label with correct terminology
 * CRITICAL: "Not paid (0 paid)" only for claims that WERE in a remittance with $0 paid
 */
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
      return "Needs manual check";
    case "awaiting_remittance":
    case "submitted":
    default:
      return "Pending remittance";
  }
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
  return "Upload remittance file from insurance";
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
/* D) Reconciliation history run grouping - ISSUE 2 FIX */
/* -------------------------------------------------------------------------- */

function runGroup(run: ReconRun): "needs_follow_up" | "completed" {
  const hasIssues = (run.partialMatched > 0) || (run.manualReview > 0) || (run.unpaidCount > 0);
  return hasIssues ? "needs_follow_up" : "completed";
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

  // Capture current year and month at component mount (won't change during component lifecycle)
  const [currentYear] = useState(() => new Date().getFullYear());
  const [currentMonth] = useState(() => new Date().getMonth() + 1); // 1-12
  const didUserTouchPeriod = useRef(false);

  /* ------------------------------------------------------------------------ */
  /* Active Period Controls */
  /* ------------------------------------------------------------------------ */
  const [providerName, setProviderName] = useState("CIC");
  const [periodYear, setPeriodYear] = useState(currentYear.toString());
  const [periodMonth, setPeriodMonth] = useState(currentMonth.toString());

  const activePeriodLabel = useMemo(() => {
    return formatPeriodLabel(parseInt(periodYear, 10), parseInt(periodMonth, 10));
  }, [periodYear, periodMonth]);

  const activePeriodYear = useMemo(() => {
    return parseInt(periodYear, 10);
  }, [periodYear]);

  /* ------------------------------------------------------------------------ */
  /* UI State */
  /* ------------------------------------------------------------------------ */
  const [periodYearFilter, setPeriodYearFilter] = useState<number | null>(null);
  const didUserTouchYearFilter = useRef(false);
  const [viewMode, setViewMode] = useState<"cards" | "table">("cards");
  const [showAllCards, setShowAllCards] = useState(false);

  const [claimsFile, setClaimsFile] = useState<File | null>(null);
  const [paymentStatementFile, setPaymentStatementFile] = useState<File | null>(null);

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

  // Requirement 3: History view toggle - "last_4_months" vs "all_months"
  const [historyViewMode, setHistoryViewMode] = useState<"last_4_months" | "all_months">("last_4_months");

  /* ------------------------------------------------------------------------ */
  /* Claims Inventory Filters (VIEW-ONLY - Do NOT affect matching)           */
  /* ------------------------------------------------------------------------ */
  // IMPORTANT: These filters are for the Claims Inventory VIEW ONLY.
  // They do NOT affect claim-remittance matching/reconciliation logic.
  // Matching always runs across ALL outstanding claims regardless of these filters.
  // 
  // Filter design:
  // - Year filter: can be set independently (e.g., "2024 + All months" shows all 2024 claims)
  // - Month filter: can be set independently (e.g., "All years + March" shows all March claims across years)
  // - Both can be combined (e.g., "2024 + March" shows only March 2024 claims)
  const [inventoryStatusFilter, setInventoryStatusFilter] = useState<
    "all" | "awaiting_remittance" | "matched" | "partially_paid" | "unpaid"
  >("all");
  const [inventoryYearFilter, setInventoryYearFilter] = useState<number | null>(null);
  const [inventoryMonthFilter, setInventoryMonthFilter] = useState<number | null>(null);
  const [inventoryPage, setInventoryPage] = useState(1);
  const [showInventory, setShowInventory] = useState(false);
  const didUserTouchInventoryFilters = useRef(false);
  
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
    // Don't override user's explicit choice
    if (didUserTouchYearFilter.current) return;
    
    if (periodYearFilter === null && availableYears.length > 0) {
      // Default to current year instead of oldest year
      const currentYear = new Date().getFullYear();
      if (availableYears.includes(currentYear)) {
        setPeriodYearFilter(currentYear);
      } else {
        setPeriodYearFilter(availableYears[0]);
      }
    }
    // REMOVED: Auto-switch to table view when periodYearFilter is null and periodsSummary.length > MAX_CARDS_DEFAULT
    // This was causing the cards view to automatically switch to table view, preventing cards from being the default
  }, [availableYears, periodYearFilter]);

  const filteredPeriods = useMemo(() => {
    let filtered = periodsSummary;
    
    // Filter by year
    if (periodYearFilter !== null) {
      filtered = filtered.filter((p) => p.periodYear === periodYearFilter);
    }
    
    // Sort periods chronologically
    const sorted = [...filtered].sort((a, b) => {
      if (periodYearFilter === null) {
        // For "All" years: Sort by year descending (2025, 2024, ...), then by month ascending within each year
        if (a.periodYear !== b.periodYear) {
          return b.periodYear - a.periodYear; // Descending by year
        }
        return a.periodMonth - b.periodMonth; // Ascending by month within year
      } else {
        // For specific year: Sort by month ascending (Jan → Dec)
        return a.periodMonth - b.periodMonth;
      }
    });
    
    // Limit to 6 cards in cards view when not expanded, show all when expanded or in table view
    if (viewMode === "cards" && !showAllCards) {
      return sorted.slice(0, MAX_CARDS_DEFAULT);
    }
    return sorted;
  }, [periodsSummary, periodYearFilter, viewMode, showAllCards]);

  /* ------------------------------------------------------------------------ */
  /* Claims Inventory query */
  /* ------------------------------------------------------------------------ */

  const { data: claimsInventory, isLoading: inventoryLoading } = useQuery<ClaimsInventoryResponse>({
    queryKey: [
      "/api/claim-reconciliation/claims",
      providerName,
      inventoryStatusFilter === "all" ? undefined : inventoryStatusFilter,
      inventoryYearFilter,
      inventoryMonthFilter,
      inventoryPage,
    ],
    queryFn: async () => {
      const params = new URLSearchParams({
        providerName,
        page: inventoryPage.toString(),
        limit: "50",
      });

      if (inventoryStatusFilter !== "all") params.append("status", inventoryStatusFilter);

      // Use new year/month parameters
      if (inventoryYearFilter !== null) {
        params.append("year", String(inventoryYearFilter));
      }
      
      if (inventoryMonthFilter !== null) {
        params.append("month", String(inventoryMonthFilter));
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

  // Query for available years and months (for Year/Month filter dropdowns)
  const { data: availablePeriods } = useQuery<AvailablePeriodsResponse>({
    queryKey: ["/api/claim-reconciliation/available-periods", providerName],
    queryFn: async () => {
      const params = new URLSearchParams({ providerName });
      const url = new URL(`/api/claim-reconciliation/available-periods?${params.toString()}`, API_BASE_URL).toString();

      const headers: HeadersInit = {};
      const backup = readSessionBackup();
      if (backup) headers["x-session-token"] = backup;

      const response = await fetch(url, { method: "GET", credentials: "include", headers });
      if (!response.ok) throw new Error("Failed to fetch available periods");
      return response.json();
    },
    enabled: showInventory,
  });

  // Initialize inventory filters to current year/month when opening Claims Inventory
  useEffect(() => {
    // Don't override user's manual filter selections
    if (didUserTouchInventoryFilters.current) return;
    
    // Only initialize when Claims Inventory is opened and we have available periods data
    if (!showInventory || !availablePeriods) return;
    
    // Helper function to set filters and reset page
    const setFilters = (year: number, month: number) => {
      setInventoryYearFilter(year);
      setInventoryMonthFilter(month);
      setInventoryPage(1);
    };
    
    // Try to set current year and month if available
    if (availablePeriods.years.includes(currentYear)) {
      const monthsForCurrentYear = availablePeriods.monthsByYear[currentYear] || [];
      
      if (monthsForCurrentYear.includes(currentMonth)) {
        // Current year and month are available
        setFilters(currentYear, currentMonth);
        return;
      }
      
      // Current year exists but not current month - use current year with newest month
      if (monthsForCurrentYear.length > 0) {
        const newestMonth = Math.max(...monthsForCurrentYear);
        setFilters(currentYear, newestMonth);
        return;
      }
    }
    
    // Current year not available - fallback to newest available year and month
    if (availablePeriods.years.length > 0) {
      const newestYear = Math.max(...availablePeriods.years);
      const monthsForNewestYear = availablePeriods.monthsByYear[newestYear] || [];
      
      if (monthsForNewestYear.length > 0) {
        const newestMonth = Math.max(...monthsForNewestYear);
        setFilters(newestYear, newestMonth);
      }
    }
    // Note: currentYear and currentMonth are stable values (captured at mount),
    // but included in deps for ESLint exhaustive-deps rule compliance
  }, [showInventory, availablePeriods, currentYear, currentMonth]);

  const inventorySummaryStats = useMemo(() => {
    // Primary: Use summary from API response (server-side calculation)
    if (claimsInventory?.summary) {
      return {
        total: claimsInventory.summary.total,
        awaiting: claimsInventory.summary.awaiting_remittance,
        matched: claimsInventory.summary.matched,
        unpaid: claimsInventory.summary.unpaid,
        partial: claimsInventory.summary.partially_paid,
      };
    }

    // Fallback: Client-side calculation from periodsSummary
    // This fallback ensures summary stats are always available even if:
    // 1. Claims Inventory is collapsed (showInventory=false, so claimsInventory is undefined)
    // 2. API request fails or is pending
    if (!periodsSummary || periodsSummary.length === 0) {
      return { total: 0, awaiting: 0, matched: 0, unpaid: 0, partial: 0 };
    }

    // Filter periods based on year/month filters
    let filteredPeriods = periodsSummary;
    
    if (inventoryYearFilter !== null) {
      filteredPeriods = filteredPeriods.filter(p => p.periodYear === inventoryYearFilter);
    }
    
    if (inventoryMonthFilter !== null) {
      filteredPeriods = filteredPeriods.filter(p => p.periodMonth === inventoryMonthFilter);
    }

    return {
      total: filteredPeriods.reduce((sum, p) => sum + p.totalClaims, 0),
      awaiting: filteredPeriods.reduce((sum, p) => sum + p.awaitingRemittance, 0),
      matched: filteredPeriods.reduce((sum, p) => sum + p.matched, 0),
      unpaid: filteredPeriods.reduce((sum, p) => sum + p.unpaid, 0),
      partial: filteredPeriods.reduce((sum, p) => sum + p.partiallyPaid, 0),
    };
  }, [claimsInventory, periodsSummary, inventoryYearFilter, inventoryMonthFilter]);

  // Generate a human-readable label for the current inventory filter selection
  const inventoryPeriodLabel = useMemo(() => {
    // No label when showing all periods
    if (inventoryYearFilter === null && inventoryMonthFilter === null) {
      return null;
    }
    
    // Both year and month selected: "January 2025"
    if (inventoryYearFilter !== null && inventoryMonthFilter !== null) {
      return formatPeriodLabel(inventoryYearFilter, inventoryMonthFilter);
    }
    
    // Only year selected: "2025"
    if (inventoryYearFilter !== null) {
      return String(inventoryYearFilter);
    }
    
    // Only month selected: "January"
    if (inventoryMonthFilter !== null) {
      const monthObj = MONTHS.find(m => m.value === String(inventoryMonthFilter));
      return monthObj?.label || "";
    }
    
    return null;
  }, [inventoryYearFilter, inventoryMonthFilter]);

  /* ------------------------------------------------------------------------ */
  /* KPI strip stats */
  /* ------------------------------------------------------------------------ */

  const stats = useMemo(() => {
    // Requirement 5: Rename KPI to clarify it counts statement uploads
    const paymentStatementUploads = runs.filter(run => run.totalRemittanceRows > 0).length;
    
    // Requirement 5: Add new KPI for claim months uploaded
    // Count unique periods with claims (unique provider+year+month from periodsSummary where totalClaims > 0)
    const claimMonthsUploaded = periodsSummary.filter(p => p.totalClaims > 0).length;

    const totalClaims = periodsSummary.reduce((sum, p) => sum + p.totalClaims, 0);
    // Claims to follow up: partially paid, unpaid (with remittance), and manual review
    // EXCLUDES awaiting_remittance (not yet in any remittance)
    const problemClaims = periodsSummary.reduce(
      (sum, p) => sum + p.unpaid + p.partiallyPaid + (p.manualReview || 0), 
      0
    );
    const awaitingPaymentStatement = periodsSummary.reduce((sum, p) => sum + p.awaitingRemittance, 0);

    // Requirement 2: Add claim status breakdown for new KPI card
    const paidInFull = periodsSummary.reduce((sum, p) => sum + p.matched, 0);
    const followUpNeeded = periodsSummary.reduce((sum, p) => sum + p.unpaid + p.partiallyPaid, 0);
    const waitingForPaymentStatement = awaitingPaymentStatement;
    const outstandingTotal = followUpNeeded + waitingForPaymentStatement;

    // Get the most recent reconciliation run (with remittances) based on createdAt
    const runsWithPaymentStatements = runs.filter(run => run.totalRemittanceRows > 0);
    const sortedRuns = [...runsWithPaymentStatements].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    const latest = sortedRuns[0];

    const lastPeriodLabel = latest
      ? formatPeriodLabel(latest.periodYear, latest.periodMonth)
      : periodsSummary.length > 0
      ? formatPeriodLabel(periodsSummary[0].periodYear, periodsSummary[0].periodMonth)
      : "—";

    return {
      paymentStatementUploads,
      claimMonthsUploaded,
      totalClaims,
      problemClaims,
      awaitingPaymentStatement,
      paidInFull,
      followUpNeeded,
      waitingForPaymentStatement,
      outstandingTotal,
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
      setPaymentStatementFile(null);
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
        description: `${data.claimsStored} claims uploaded – pending remittance`,
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

      setPaymentStatementFile(null);
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
      
      // CRITICAL FIX: Check if we got JSON when we expected Excel (indicates an error)
      if (contentType.includes("application/json")) {
        const error = await response.json();
        throw new Error(error.error || "Export failed - received JSON instead of Excel file");
      }
      
      // CRITICAL FIX: Validate we got an Excel file
      if (!contentType.includes("spreadsheetml") && !contentType.includes("excel")) {
        throw new Error(`Export failed - unexpected content type: ${contentType}`);
      }

      const blob = await response.blob();
      
      // CRITICAL FIX: Validate blob size
      if (blob.size === 0) {
        throw new Error("Export failed - received empty file");
      }
      
      const disposition = response.headers.get("content-disposition") || "";
      let fileName = "claim_issues.xlsx";
      const match = disposition.match(/filename="?([^"]+)"?/i);
      if (match?.[1]) fileName = match[1];

      return { blob, fileName };
    },
    onSuccess: ({ blob, fileName }) => {
      try {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);

        toast({ 
          title: "Export ready", 
          description: "Follow-up items exported successfully. Check your downloads folder." 
        });
      } catch (error: any) {
        toast({ 
          title: "Download failed", 
          description: "File was created but couldn't be downloaded. Please try again.", 
          variant: "destructive" 
        });
      }
    },
    onError: (error: Error) => {
      // Enhanced error messages for better debugging
      let errorMessage = error.message;
      
      if (errorMessage.includes("JSON instead of Excel")) {
        errorMessage = "Export failed - the server returned an error. Please try again or contact support if the issue persists.";
      } else if (errorMessage.includes("empty file")) {
        errorMessage = "Export failed - no data to export. This might happen if there are no follow-up items.";
      } else if (errorMessage.includes("content type")) {
        errorMessage = "Export failed - received unexpected file format. Please try again.";
      }
      
      toast({ 
        title: "Export failed", 
        description: errorMessage, 
        variant: "destructive" 
      });
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
      details: hasRemittance ? `${periodStatus.remittances.total} remittance lines` : undefined,
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
      primaryDisabled = !paymentStatementFile;
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
  }, [periodStatus, claimsFile, paymentStatementFile]);

  /* ------------------------------------------------------------------------ */
  /* Smart action */
  /* ------------------------------------------------------------------------ */

  const uploadAction = useMemo(() => {
    const hasClaims = !!claimsFile;
    const hasRemittance = !!paymentStatementFile;
    const periodLabel = formatPeriodLabel(parseInt(periodYear, 10), parseInt(periodMonth, 10));

    if (!hasClaims && !hasRemittance) {
      return { type: "disabled" as const, label: "Select files to continue", disabled: true };
    }
    if (hasClaims && !hasRemittance) {
      return { type: "claims-only" as const, label: `Upload Claims`, disabled: false };
    }
    if (!hasClaims && hasRemittance) {
      return { type: "remittance-only" as const, label: `Upload Remittance to ${periodLabel}`, disabled: false };
    }
    return { type: "both" as const, label: `Upload & Reconcile`, disabled: false };
  }, [claimsFile, paymentStatementFile, periodYear, periodMonth]);

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
    if (!paymentStatementFile) {
      toast({ title: "Missing file", description: "Please select a remittance file.", variant: "destructive" });
      return;
    }

    const formData = new FormData();
    // Backend expects 'remittanceFile' field name for API compatibility
    formData.append("remittanceFile", paymentStatementFile);
    formData.append("providerName", providerName);
    formData.append("periodYear", periodYear);
    formData.append("periodMonth", periodMonth);
    uploadRemittanceMutation.mutate(formData);
  }, [paymentStatementFile, providerName, periodYear, periodMonth, toast, uploadRemittanceMutation]);

  const submitBoth = useCallback(() => {
    if (!claimsFile || !paymentStatementFile) {
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
    // Backend expects 'remittanceFile' field name for API compatibility
    formData.append("remittanceFile", paymentStatementFile);
    formData.append("providerName", providerName);
    formData.append("periodYear", periodYear);
    formData.append("periodMonth", periodMonth);
    uploadMutation.mutate(formData);
  }, [claimsFile, paymentStatementFile, providerName, periodYear, periodMonth, toast, uploadMutation, claimsPeriodMismatch, inferredClaimsPeriod]);

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
    if (!paymentStatementFile || claimsFile) return false;
    if (!periodStatus) return false;
    return periodStatus.claims.total === 0;
  }, [paymentStatementFile, claimsFile, periodStatus]);

  /* ------------------------------------------------------------------------ */
  /* Contextual help text */
  /* ------------------------------------------------------------------------ */

  const helpText = useMemo(() => {
    const hasClaims = !!claimsFile;
    const hasRemittance = !!paymentStatementFile;
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
  }, [claimsFile, paymentStatementFile, periodStatus]);

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
          <Badge className="bg-sky-500 text-white hover:bg-sky-600 border-0 px-3 py-1.5 font-semibold shadow-md whitespace-nowrap inline-flex items-center gap-1.5 min-w-[140px] transition-all duration-200">
            <Clock className="w-3.5 h-3.5" />
            Pending payment
          </Badge>
        );
      case "pending_review":
        return (
          <Badge className="bg-orange-500 text-white hover:bg-orange-600 border-0 px-3 py-1.5 font-semibold shadow-md whitespace-nowrap inline-flex items-center gap-1.5 min-w-[140px] transition-all duration-200">
            <AlertTriangle className="w-3.5 h-3.5" />
            Pending Review
          </Badge>
        );
      case "reconciled":
      default:
        return (
          <Badge className="bg-emerald-500 text-white hover:bg-emerald-600 border-0 px-3 py-1.5 font-semibold shadow-md whitespace-nowrap inline-flex items-center gap-1.5 min-w-[140px] transition-all duration-200">
            <CheckCircle className="w-3.5 h-3.5" />
            Reconciled
          </Badge>
        );
    }
  };

  // D) Updated filteredRuns: Show periods in ASCENDING order (oldest → newest)
  const filteredRuns = useMemo(() => {
    let filtered = actualReconciliationRuns;

    // Apply status filter
    if (statusFilter !== "all") {
      filtered = filtered.filter((run) => runGroup(run) === statusFilter);
    }

    // Apply date range filter based on historyViewMode
    if (historyViewMode === "last_4_months") {
      const currentYear = new Date().getFullYear();
      // Show only Jan-Apr (months defined by constants) of the currently selected year
      filtered = filtered.filter((run) => {
        return run.periodYear === currentYear && run.periodMonth >= HISTORY_DEFAULT_MONTH_START && run.periodMonth <= HISTORY_DEFAULT_MONTH_END;
      });
      // Sort in ascending order (Jan → Apr)
      filtered = [...filtered].sort((a, b) => {
        if (a.periodYear !== b.periodYear) return a.periodYear - b.periodYear;
        return a.periodMonth - b.periodMonth;
      });
    } else {
      // "all_months" mode: show all runs in ascending order
      filtered = [...filtered].sort((a, b) => {
        if (a.periodYear !== b.periodYear) return a.periodYear - b.periodYear;
        return a.periodMonth - b.periodMonth;
      });
    }

    return filtered;
  }, [actualReconciliationRuns, statusFilter, historyViewMode]);

  // Issue 7: Create lookup map for period claims to avoid O(n²) complexity
  const periodClaimsLookup = useMemo(() => {
    const map = new Map<string, number>();
    periodsSummary.forEach(p => {
      // Use pipe delimiter to avoid collisions (unlikely in provider names)
      const key = `${p.providerName}|${p.periodYear}|${p.periodMonth}`;
      map.set(key, p.totalClaims);
    });
    return map;
  }, [periodsSummary]);

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
          <Badge className="bg-emerald-500 text-white hover:bg-emerald-600 border-0 px-3 py-1.5 font-semibold shadow-md whitespace-nowrap inline-flex items-center gap-1.5 transition-all duration-200">
            <CheckCircle className="w-3.5 h-3.5" />
            {label}
          </Badge>
        );
      case "partially_paid":
        return (
          <Badge className="bg-amber-500 text-white hover:bg-amber-600 border-0 px-3 py-1.5 font-semibold shadow-md whitespace-nowrap inline-flex items-center gap-1.5 transition-all duration-200">
            <AlertCircle className="w-3.5 h-3.5" />
            {label}
          </Badge>
        );
      case "manual_review":
        return (
          <Badge className="bg-orange-500 text-white hover:bg-orange-600 border-0 px-3 py-1.5 font-semibold shadow-md whitespace-nowrap inline-flex items-center gap-1.5 transition-all duration-200">
            <AlertTriangle className="w-3.5 h-3.5" />
            {label}
          </Badge>
        );
      case "unpaid":
        return (
          <Badge className="bg-rose-500 text-white hover:bg-rose-600 border-0 px-3 py-1.5 font-semibold shadow-md whitespace-nowrap inline-flex items-center gap-1.5 transition-all duration-200">
            <X className="w-3.5 h-3.5" />
            {label}
          </Badge>
        );
      case "awaiting_remittance":
      case "submitted":
      default:
        return (
          <Badge className="bg-sky-500 text-white hover:bg-sky-600 border-0 px-3 py-1.5 font-semibold shadow-md whitespace-nowrap inline-flex items-center gap-1.5 transition-all duration-200">
            <Clock className="w-3.5 h-3.5" />
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

  const handleExportClaims = async (status: string) => {
    const params = new URLSearchParams();
    params.append("providerName", providerName);
    if (status !== "all") {
      params.append("status", status);
    }
    // Use new year/month filters
    if (inventoryYearFilter !== null) {
      params.append("year", String(inventoryYearFilter));
    }
    if (inventoryMonthFilter !== null) {
      params.append("month", String(inventoryMonthFilter));
    }

    const url = `${API_BASE_URL}/api/claim-reconciliation/export-claims?${params.toString()}`;
    
    const headers: HeadersInit = {};
    const backup = readSessionBackup();
    if (backup) headers["x-session-token"] = backup;

    try {
      const response = await fetch(url, { 
        method: "GET", 
        credentials: "include", 
        headers 
      });

      if (!response.ok) {
        const contentType = response.headers.get("content-type") || "";
        if (contentType.includes("application/json")) {
          const error = await response.json();
          throw new Error(error.error || "Export failed");
        }
        throw new Error(`Export failed (${response.status})`);
      }

      const blob = await response.blob();
      const disposition = response.headers.get("content-disposition") || "";
      let fileName = `${providerName}_Claims_${status}_${new Date().toISOString().slice(0, 10)}.xlsx`;
      const match = disposition.match(/filename="?([^"]+)"?/i);
      if (match?.[1]) fileName = match[1];

      const downloadUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(downloadUrl);

      toast({ title: "Export ready", description: "Claims exported successfully." });
    } catch (error: any) {
      toast({ title: "Export failed", description: error.message, variant: "destructive" });
    }
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
        setPaymentStatementFile(file);
        const formData = new FormData();
        // Backend expects 'remittanceFile' field name for API compatibility
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
    <TooltipProvider>
      {/* PREMIUM HEADER - Luxury SaaS design with refined elegance */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-800 via-slate-700 to-slate-900 border border-slate-600/30 mb-8 shadow-2xl shadow-slate-900/10">
        {/* Subtle premium texture with noise and highlight */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_40%,rgba(16,185,129,0.08),transparent_50%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_60%,rgba(59,130,246,0.08),transparent_50%)]" />
        <div className="absolute inset-0" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' opacity='0.03'/%3E%3C/svg%3E")`,
          backgroundSize: '200px 200px'
        }} />
        
        {/* Subtle highlight accent */}
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-emerald-400/20 to-transparent" />
        
        {/* Content with refined spacing */}
        <div className="relative px-8 py-7 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="space-y-1.5">
            <h1 className="text-3xl md:text-4xl font-bold text-white tracking-tight">
              Claim Reconciliation
            </h1>
            <p className="text-slate-300 text-base font-medium">
              Match payments to claims instantly
            </p>
          </div>
          
          {/* Elegant Help Button - Refined styling */}
          <Sheet open={showHelp} onOpenChange={setShowHelp}>
            <SheetTrigger asChild>
              <Button 
                variant="outline" 
                size="default"
                className="gap-2 bg-white/10 hover:bg-white/20 text-white border-white/20 hover:border-white/30 shadow-lg hover:shadow-xl transition-all duration-200 font-medium backdrop-blur-sm"
              >
                <HelpCircle className="w-4 h-4" />
                Help & Guide
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
              <SheetHeader>
                <SheetTitle className="text-2xl font-bold text-slate-800">Reconciliation Help & Guide</SheetTitle>
                <SheetDescription>
                  Everything you need to know about claim reconciliation
                </SheetDescription>
              </SheetHeader>

              <div className="mt-6 space-y-6">
                {/* Quick Start Guide */}
                <Card className="border border-slate-200/50 shadow-lg">
                  <CardHeader className="pb-4 border-b border-slate-200/50">
                    <CardTitle className="text-lg font-bold text-slate-800 flex items-center gap-2">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center shadow-lg">
                        <ArrowRight className="w-5 h-5 text-white" />
                      </div>
                      Quick Start Guide
                    </CardTitle>
                    <CardDescription>Follow these 4 steps to reconcile your claims</CardDescription>
                  </CardHeader>
                  <CardContent className="pt-6">
                    <div className="grid grid-cols-1 gap-4">
                      {/* Step 1 */}
                      <div className="flex items-start gap-4 p-4 rounded-xl bg-blue-50 border border-blue-200">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-md shrink-0">
                          <FileText className="w-6 h-6 text-white" />
                        </div>
                        <div className="space-y-1">
                          <div className="text-xs font-bold text-blue-700 uppercase tracking-wide">Step 1</div>
                          <div className="text-base font-bold text-slate-800">Upload Claims</div>
                          <div className="text-xs text-slate-600 leading-relaxed">Upload your claims file for a specific month</div>
                        </div>
                      </div>

                      {/* Step 2 */}
                      <div className="flex items-start gap-4 p-4 rounded-xl bg-emerald-50 border border-emerald-200">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center shadow-md shrink-0">
                          <DollarSign className="w-6 h-6 text-white" />
                        </div>
                        <div className="space-y-1">
                          <div className="text-xs font-bold text-emerald-700 uppercase tracking-wide">Step 2</div>
                          <div className="text-base font-bold text-slate-800">Upload Remittance</div>
                          <div className="text-xs text-slate-600 leading-relaxed">Upload the remittance file from insurance</div>
                        </div>
                      </div>

                      {/* Step 3 */}
                      <div className="flex items-start gap-4 p-4 rounded-xl bg-amber-50 border border-amber-200">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center shadow-md shrink-0">
                          <Zap className="w-6 h-6 text-white" />
                        </div>
                        <div className="space-y-1">
                          <div className="text-xs font-bold text-amber-700 uppercase tracking-wide">Step 3</div>
                          <div className="text-base font-bold text-slate-800">Auto-Reconciliation</div>
                          <div className="text-xs text-slate-600 leading-relaxed">System automatically matches claims to payments</div>
                        </div>
                      </div>

                      {/* Step 4 */}
                      <div className="flex items-start gap-4 p-4 rounded-xl bg-purple-50 border border-purple-200">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center shadow-md shrink-0">
                          <Search className="w-6 h-6 text-white" />
                        </div>
                        <div className="space-y-1">
                          <div className="text-xs font-bold text-purple-700 uppercase tracking-wide">Step 4</div>
                          <div className="text-base font-bold text-slate-800">Review Results</div>
                          <div className="text-xs text-slate-600 leading-relaxed">Check paid, partial, and unpaid claims</div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Status Legend - Issue 2: Updated terminology */}
                <Card className="border border-slate-200/50 shadow-lg">
                  <CardHeader className="pb-4 border-b border-slate-200/50">
                    <CardTitle className="text-lg font-bold text-slate-800 flex items-center gap-2">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-sky-500 to-blue-500 flex items-center justify-center shadow-lg">
                        <Info className="w-5 h-5 text-white" />
                      </div>
                      Status Legend
                    </CardTitle>
                    <CardDescription>Understanding claim status colors</CardDescription>
                  </CardHeader>
                  <CardContent className="pt-6 space-y-3">
                    <div className="flex items-center gap-3 p-3 rounded-xl bg-sky-50/50 border border-sky-200/50">
                      <Badge className="bg-sky-400 text-white hover:bg-sky-500 border-0 px-3 py-1">
                        <Clock className="w-3 h-3 mr-1" />
                        Pending remittance
                      </Badge>
                      <div className="text-sm text-slate-600">Claims uploaded, waiting for remittance</div>
                    </div>
                    
                    <div className="flex items-center gap-3 p-3 rounded-xl bg-emerald-50/50 border border-emerald-200/50">
                      <Badge className="bg-emerald-400 text-white hover:bg-emerald-500 border-0 px-3 py-1">
                        <CheckCircle2 className="w-3 h-3 mr-1" />
                        Paid in full
                      </Badge>
                      <div className="text-sm text-slate-600">Payment received matches billed amount</div>
                    </div>
                    
                    <div className="flex items-center gap-3 p-3 rounded-xl bg-amber-50/50 border border-amber-200/50">
                      <Badge className="bg-amber-400 text-white hover:bg-amber-500 border-0 px-3 py-1">
                        <Clock className="w-3 h-3 mr-1" />
                        Paid partially
                      </Badge>
                      <div className="text-sm text-slate-600">Payment received is less than billed amount</div>
                    </div>
                    
                    <div className="flex items-center gap-3 p-3 rounded-xl bg-rose-50/50 border border-rose-200/50">
                      <Badge className="bg-rose-400 text-white hover:bg-rose-500 border-0 px-3 py-1">
                        <AlertCircle className="w-3 h-3 mr-1" />
                        Not paid (0 paid)
                      </Badge>
                      <div className="text-sm text-slate-600">Claim was in remittance but $0 paid</div>
                    </div>
                    
                    <div className="flex items-center gap-3 p-3 rounded-xl bg-orange-50/50 border border-orange-200/50">
                      <Badge className="bg-orange-400 text-white hover:bg-orange-500 border-0 px-3 py-1">
                        <AlertCircle className="w-3 h-3 mr-1" />
                        Needs manual check
                      </Badge>
                      <div className="text-sm text-slate-600">Requires manual attention</div>
                    </div>
                  </CardContent>
                </Card>

                {/* Understanding the Metrics - Issue 2: Updated formulas */}
                <Card className="border border-slate-200/50 shadow-lg">
                  <CardHeader className="pb-4 border-b border-slate-200/50">
                    <CardTitle className="text-lg font-bold text-slate-800 flex items-center gap-2">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-500 flex items-center justify-center shadow-lg">
                        <Calculator className="w-5 h-5 text-white" />
                      </div>
                      Understanding the Metrics
                    </CardTitle>
                    <CardDescription>How we calculate key performance indicators</CardDescription>
                  </CardHeader>
                  <CardContent className="pt-6 space-y-4">
                    <div className="rounded-xl bg-gradient-to-br from-emerald-50 to-emerald-100/50 border-2 border-emerald-200/50 p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <TrendingUp className="w-5 h-5 text-emerald-600" />
                        <div className="font-bold text-slate-800">Paid in full %</div>
                      </div>
                      <div className="text-sm text-slate-600 mb-2">Percentage of claims fully paid</div>
                      <div className="text-xs font-mono bg-white/80 rounded-lg px-3 py-2 text-slate-700 border border-emerald-200">
                        (Paid in full ÷ Total claims) × 100
                      </div>
                    </div>

                    <div className="rounded-xl bg-gradient-to-br from-sky-50 to-sky-100/50 border-2 border-sky-200/50 p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <TrendingUp className="w-5 h-5 text-sky-600" />
                        <div className="font-bold text-slate-800">Seen in remittance %</div>
                      </div>
                      <div className="text-sm text-slate-600 mb-2">Percentage of claims appearing in remittance</div>
                      <div className="text-xs font-mono bg-white/80 rounded-lg px-3 py-2 text-slate-700 border border-sky-200">
                        ((Total - Pending) ÷ Total claims) × 100
                      </div>
                    </div>

                    <div className="rounded-xl bg-gradient-to-br from-amber-50 to-amber-100/50 border-2 border-amber-200/50 p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <AlertTriangle className="w-5 h-5 text-amber-600" />
                        <div className="font-bold text-slate-800">Claims to follow up</div>
                      </div>
                      <div className="text-sm text-slate-600 mb-2">Count of claims requiring attention</div>
                      <div className="text-xs font-mono bg-white/80 rounded-lg px-3 py-2 text-slate-700 border border-amber-200">
                        Partially paid + Not paid claims
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Pro Tips */}
                <Card className="border border-slate-200/50 shadow-lg">
                  <CardHeader className="pb-4 border-b border-slate-200/50">
                    <CardTitle className="text-lg font-bold text-slate-800 flex items-center gap-2">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center shadow-lg">
                        <Lightbulb className="w-5 h-5 text-white" />
                      </div>
                      Pro Tips for Staff
                    </CardTitle>
                    <CardDescription>Best practices to streamline your workflow</CardDescription>
                  </CardHeader>
                  <CardContent className="pt-6 space-y-3">
                    <div className="flex items-start gap-3 p-3 rounded-xl bg-amber-50/50 border border-amber-200/50">
                      <Lightbulb className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                      <div className="text-sm text-slate-700 leading-relaxed">
                        Upload claims as soon as you submit them to insurance - don't wait for remittance
                      </div>
                    </div>

                    <div className="flex items-start gap-3 p-3 rounded-xl bg-blue-50/50 border border-blue-200/50">
                      <Lightbulb className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                      <div className="text-sm text-slate-700 leading-relaxed">
                        Remittances are matched against ALL outstanding claims, not just the selected month
                      </div>
                    </div>

                    <div className="flex items-start gap-3 p-3 rounded-xl bg-purple-50/50 border border-purple-200/50">
                      <Lightbulb className="w-5 h-5 text-purple-600 shrink-0 mt-0.5" />
                      <div className="text-sm text-slate-700 leading-relaxed">
                        Click any period card to quickly switch to that month's data
                      </div>
                    </div>

                    <div className="flex items-start gap-3 p-3 rounded-xl bg-rose-50/50 border border-rose-200/50">
                      <Lightbulb className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                      <div className="text-sm text-slate-700 leading-relaxed">
                        <span className="font-semibold">"Paid partially"</span> claims are your priority - these need investigation
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Common Questions - Issue 2: Updated terminology */}
                <Card className="border border-slate-200/50 shadow-lg">
                  <CardHeader className="pb-4 border-b border-slate-200/50">
                    <CardTitle className="text-lg font-bold text-slate-800 flex items-center gap-2">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-blue-500 flex items-center justify-center shadow-lg">
                        <HelpCircle className="w-5 h-5 text-white" />
                      </div>
                      Common Questions
                    </CardTitle>
                    <CardDescription>Frequently asked questions about reconciliation</CardDescription>
                  </CardHeader>
                  <CardContent className="pt-6 space-y-4">
                    <div className="rounded-xl border border-slate-200 overflow-hidden">
                      <div className="bg-gradient-to-r from-slate-50 to-white px-4 py-3 border-b border-slate-200">
                        <div className="font-semibold text-slate-800 text-sm">❓ Why do my claims show "Pending remittance"?</div>
                      </div>
                      <div className="px-4 py-3 text-sm text-slate-600 leading-relaxed">
                        Claims show as "Pending remittance" when they've been uploaded but no matching remittance file has been processed yet. Once you upload a remittance, the system will automatically match them.
                      </div>
                    </div>

                    <div className="rounded-xl border border-slate-200 overflow-hidden">
                      <div className="bg-gradient-to-r from-slate-50 to-white px-4 py-3 border-b border-slate-200">
                        <div className="font-semibold text-slate-800 text-sm">❓ What should I do with "Paid partially" claims?</div>
                      </div>
                      <div className="px-4 py-3 text-sm text-slate-600 leading-relaxed">
                        "Paid partially" claims require follow-up with the insurance company. Export these claims using the Export button, review the payment amounts, and contact the insurer to clarify why the full amount wasn't paid.
                      </div>
                    </div>

                    <div className="rounded-xl border border-slate-200 overflow-hidden">
                      <div className="bg-gradient-to-r from-slate-50 to-white px-4 py-3 border-b border-slate-200">
                        <div className="font-semibold text-slate-800 text-sm">❓ How do I fix a claim that was matched incorrectly?</div>
                      </div>
                      <div className="px-4 py-3 text-sm text-slate-600 leading-relaxed">
                        If a claim was matched incorrectly, you can delete the reconciliation run from the History section and re-upload the files. Make sure the member numbers and claim identifiers match exactly between your claims and remittance files.
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>

      <div className="max-w-[1400px] mx-auto pb-12 pt-6 px-4 md:px-6 lg:px-8">{/* Widened from max-w-6xl (1152px) to max-w-[1400px] for better desktop space usage */}
        {/* Section Spacing: Use consistent larger gaps between major sections */}
        <div className="space-y-10">
        {/* UNIFIED KPI GRID - ONE cohesive section consolidating all metrics */}
        <section>
          {/* Premium Card with Glass-morphism */}
          <div className="premium-card relative overflow-hidden rounded-3xl border border-slate-200/60 shadow-2xl shadow-slate-300/50 bg-white/95 backdrop-blur-sm transition-all duration-300">
            {/* Subtle gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-br from-blue-50/30 via-transparent to-emerald-50/30 pointer-events-none" />
            
            {/* Content */}
            <div className="relative p-8">
              {/* Section Header */}
              <div className="mb-8">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-1.5 h-8 bg-gradient-to-b from-blue-500 to-emerald-500 rounded-full" />
                  <h2 className="text-2xl font-bold text-slate-900">Key Metrics Overview</h2>
                </div>
                <p className="text-sm text-slate-600 ml-5">Consolidated view of claims, payments, and outstanding balances</p>
              </div>

              {/* 2×3 Grid of KPI Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
                {/* Remittance Uploads */}
                <button
                  type="button"
                  onClick={() => {
                    if (stats.latestRunId) {
                      setSelectedRunId(stats.latestRunId);
                      setTimeout(() => {
                        document.getElementById("claims-details-section")?.scrollIntoView({ behavior: "smooth" });
                      }, 100);
                    }
                  }}
                  className="group relative overflow-hidden rounded-xl border-l-4 border-l-emerald-500 bg-white p-6 shadow-lg shadow-slate-200/50 hover:shadow-xl hover:scale-[1.02] transition-all duration-200 text-left cursor-pointer"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="p-3 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 shadow-lg group-hover:scale-110 transition-transform duration-200">
                      <CheckCircle className="w-6 h-6 text-white" />
                    </div>
                    <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-slate-500 transition-colors duration-200" />
                  </div>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Remittance Uploads</p>
                  <p className="text-3xl font-bold text-slate-900 mb-1">{stats.paymentStatementUploads}</p>
                  <p className="text-xs text-slate-500">Latest: {stats.lastPeriodLabel}</p>
                </button>

                {/* Claim Periods Uploaded */}
                <button
                  type="button"
                  onClick={() => {
                    setShowInventory(true);
                    setTimeout(() => {
                      document.getElementById("exceptions-section")?.scrollIntoView({ behavior: "smooth" });
                    }, 100);
                  }}
                  className="group relative overflow-hidden rounded-xl border-l-4 border-l-purple-500 bg-white p-6 shadow-lg shadow-slate-200/50 hover:shadow-xl hover:scale-[1.02] transition-all duration-200 text-left cursor-pointer"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="p-3 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 shadow-lg group-hover:scale-110 transition-transform duration-200">
                      <Calculator className="w-6 h-6 text-white" />
                    </div>
                    <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-slate-500 transition-colors duration-200" />
                  </div>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Claim Periods</p>
                  <p className="text-3xl font-bold text-slate-900 mb-1">{stats.claimMonthsUploaded}</p>
                  <p className="text-xs text-slate-500">Unique months uploaded</p>
                </button>

                {/* Total Claims Uploaded */}
                <button
                  type="button"
                  onClick={() => {
                    setShowInventory(true);
                    setInventoryStatusFilter("all");
                    setTimeout(() => {
                      document.getElementById("exceptions-section")?.scrollIntoView({ behavior: "smooth" });
                    }, 100);
                  }}
                  className="group relative overflow-hidden rounded-xl border-l-4 border-l-blue-500 bg-white p-6 shadow-lg shadow-slate-200/50 hover:shadow-xl hover:scale-[1.02] transition-all duration-200 text-left cursor-pointer"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="p-3 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-600 shadow-lg group-hover:scale-110 transition-transform duration-200">
                      <FileStack className="w-6 h-6 text-white" />
                    </div>
                    <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-slate-500 transition-colors duration-200" />
                  </div>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Total Claims</p>
                  <p className="text-3xl font-bold text-slate-900 mb-1">{formatNumber(stats.totalClaims)}</p>
                  <p className="text-xs text-slate-500">Uploaded across all periods</p>
                </button>

                {/* Paid in Full */}
                <button
                  type="button"
                  onClick={() => {
                    setShowInventory(true);
                    setInventoryStatusFilter("matched");
                    setTimeout(() => {
                      document.getElementById("exceptions-section")?.scrollIntoView({ behavior: "smooth" });
                    }, 100);
                  }}
                  className="group relative overflow-hidden rounded-xl border-l-4 border-l-emerald-500 bg-white p-6 shadow-lg shadow-slate-200/50 hover:shadow-xl hover:scale-[1.02] transition-all duration-200 text-left cursor-pointer"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="p-3 rounded-xl bg-gradient-to-br from-emerald-500 to-green-600 shadow-lg group-hover:scale-110 transition-transform duration-200">
                      <CheckCircle2 className="w-6 h-6 text-white" />
                    </div>
                    <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-slate-500 transition-colors duration-200" />
                  </div>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Paid in Full</p>
                  <p className="text-3xl font-bold text-emerald-600 mb-1">{formatNumber(stats.paidInFull)}</p>
                  <p className="text-xs text-slate-500">Claims fully reconciled</p>
                </button>

                {/* Follow-up Needed */}
                <button
                  type="button"
                  onClick={() => {
                    setShowInventory(true);
                    setInventoryStatusFilter("partially_paid");
                    setTimeout(() => {
                      document.getElementById("exceptions-section")?.scrollIntoView({ behavior: "smooth" });
                    }, 100);
                  }}
                  className="group relative overflow-hidden rounded-xl border-l-4 border-l-orange-500 bg-white p-6 shadow-lg shadow-slate-200/50 hover:shadow-xl hover:scale-[1.02] transition-all duration-200 text-left cursor-pointer"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="p-3 rounded-xl bg-gradient-to-br from-orange-500 to-red-600 shadow-lg group-hover:scale-110 transition-transform duration-200">
                      <AlertTriangle className="w-6 h-6 text-white" />
                    </div>
                    <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-slate-500 transition-colors duration-200" />
                  </div>
                  <div className="flex items-center gap-1.5 mb-2">
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Follow-up Needed</p>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="w-3.5 h-3.5 text-slate-400 hover:text-slate-600 cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs">
                          <p className="text-xs font-semibold mb-1">What's included:</p>
                          <p className="text-xs">Follow-up = Paid partially + Not paid (0 paid) + Manual review</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  <p className="text-3xl font-bold text-orange-600 mb-1">{formatNumber(stats.followUpNeeded)}</p>
                  <p className="text-xs text-slate-500">Partial/unpaid claims</p>
                </button>

                {/* Pending Remittance */}
                <button
                  type="button"
                  onClick={() => {
                    setShowInventory(true);
                    setInventoryStatusFilter("awaiting_remittance");
                    setTimeout(() => {
                      document.getElementById("exceptions-section")?.scrollIntoView({ behavior: "smooth" });
                    }, 100);
                  }}
                  className="group relative overflow-hidden rounded-xl border-l-4 border-l-sky-500 bg-white p-6 shadow-lg shadow-slate-200/50 hover:shadow-xl hover:scale-[1.02] transition-all duration-200 text-left cursor-pointer"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="p-3 rounded-xl bg-gradient-to-br from-sky-500 to-blue-600 shadow-lg group-hover:scale-110 transition-transform duration-200">
                      <Clock className="w-6 h-6 text-white" />
                    </div>
                    <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-slate-500 transition-colors duration-200" />
                  </div>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Pending Remittance</p>
                  <p className="text-3xl font-bold text-sky-600 mb-1">{formatNumber(stats.waitingForPaymentStatement)}</p>
                  <p className="text-xs text-slate-500">Awaiting remittance data</p>
                </button>
              </div>

              {/* Outstanding Total - Subtle Summary Bar */}
              <div className="mt-6 px-6 py-4 bg-gradient-to-r from-slate-50/80 via-slate-100/80 to-slate-50/80 rounded-2xl border border-slate-200/60 shadow-inner">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-white shadow-sm">
                      <TrendingUp className="w-5 h-5 text-slate-600" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-700">Outstanding Total</p>
                      <p className="text-xs text-slate-500">Awaiting + Follow-up</p>
                    </div>
                  </div>
                  <p className="text-3xl font-bold text-slate-900 tabular-nums">{formatNumber(stats.outstandingTotal)}</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Period cards - Premium Design */}
        {periodsSummary.length > 0 && (
          <Card className="premium-card border border-slate-200/30 shadow-2xl backdrop-blur-sm bg-white/90">
            <CardHeader className="pb-4 glass-header border-b border-slate-200/50">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <div>
                  <CardTitle className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                    <div className="w-1.5 h-8 bg-gradient-to-b from-orange-500 to-amber-500 rounded-full" />
                    Your Claim Periods
                  </CardTitle>
                  <CardDescription className="mt-1 text-slate-600">Click a period card to set the active month/year.</CardDescription>
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

                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="flex items-center gap-1.5">
                          <Badge className="bg-orange-500 text-white">Active: {activePeriodLabel}</Badge>
                          <Info className="w-4 h-4 text-slate-500 cursor-help" />
                        </div>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <p>Active period is used for uploads & runs. Browsing years does not change it.</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              </div>

              {/* Year Tabs and View Toggle Row */}
              {availableYears.length > 0 && (
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mt-4">
                  {/* Year Filter Tabs */}
                  <div className="flex items-center gap-2 flex-wrap">
                    {availableYears.map((year) => (
                      <button
                        key={year}
                        type="button"
                        onClick={() => {
                          didUserTouchYearFilter.current = true;
                          setPeriodYearFilter(year);
                          setShowAllCards(false); // Reset to collapsed view when filter changes
                        }}
                        className={cn(
                          "px-4 py-2 rounded-lg font-medium text-sm transition-all duration-200",
                          periodYearFilter === year
                            ? "bg-orange-500 text-white shadow-md"
                            : "bg-white text-slate-700 hover:bg-orange-50 border border-slate-200"
                        )}
                      >
                        {year}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => {
                        didUserTouchYearFilter.current = true;
                        setPeriodYearFilter(null);
                        setShowAllCards(false); // Reset to collapsed view when filter changes
                      }}
                      className={cn(
                        "px-4 py-2 rounded-lg font-medium text-sm transition-all duration-200",
                        periodYearFilter === null
                          ? "bg-orange-500 text-white shadow-md"
                          : "bg-white text-slate-700 hover:bg-orange-50 border border-slate-200"
                      )}
                    >
                      All
                    </button>
                  </div>

                  {/* View Toggle */}
                  <div className="inline-flex items-center gap-1 p-1 rounded-lg bg-white border border-slate-200">
                    <button
                      type="button"
                      onClick={() => setViewMode("cards")}
                      className={cn(
                        "px-3 py-1.5 rounded-md font-medium text-sm transition-all duration-200 flex items-center gap-1.5",
                        viewMode === "cards"
                          ? "bg-orange-500 text-white shadow-sm"
                          : "text-slate-600 hover:text-slate-900"
                      )}
                    >
                      <LayoutGrid className="w-4 h-4" />
                      Cards
                    </button>
                    <button
                      type="button"
                      onClick={() => setViewMode("table")}
                      className={cn(
                        "px-3 py-1.5 rounded-md font-medium text-sm transition-all duration-200 flex items-center gap-1.5",
                        viewMode === "table"
                          ? "bg-orange-500 text-white shadow-sm"
                          : "text-slate-600 hover:text-slate-900"
                      )}
                    >
                      <TableIcon className="w-4 h-4" />
                      Table
                    </button>
                  </div>
                </div>
              )}

              {/* Warning banner when browsing year differs from active period year */}
              {periodYearFilter !== null && periodYearFilter !== activePeriodYear && (
                <div className="flex items-start gap-2 px-4 py-3 mt-4 bg-amber-50 border border-amber-200 rounded-lg">
                  <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  <div className="text-sm text-amber-900">
                    <span className="font-semibold">You're viewing {periodYearFilter}, but the active period is {activePeriodLabel}.</span>
                    {" "}Uploads will apply to the active period.
                  </div>
                </div>
              )}
            </CardHeader>

            <CardContent className="pt-6">
              {/* Visible Legend for Progress Bar Colors */}
              <div className="mb-6 p-5 rounded-xl bg-gradient-to-br from-slate-50 to-white border border-slate-200/50 shadow-sm">
                <div className="flex items-center gap-2 mb-3">
                  <Info className="w-5 h-5 text-slate-600" />
                  <h4 className="font-bold text-slate-800 text-sm">Progress Bar Legend</h4>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded bg-emerald-400 shadow-sm" />
                    <span className="text-xs text-slate-700 font-medium">Paid in full</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded bg-amber-400 shadow-sm" />
                    <span className="text-xs text-slate-700 font-medium">Paid partially</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded bg-rose-400 shadow-sm" />
                    <span className="text-xs text-slate-700 font-medium">Not paid (0 paid)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded bg-sky-300 shadow-sm" />
                    <span className="text-xs text-slate-700 font-medium">Pending remittance</span>
                  </div>
                </div>
              </div>

              {viewMode === "cards" ? (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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

                  // Priority: issues > awaiting
                  const cardState: "complete" | "needs_review" | "awaiting" | "processing" =
                    isComplete ? "complete" : hasIssues ? "needs_review" : hasAwaiting ? "awaiting" : "processing";

                  // Calculate metrics
                  // Paid in full % = (matched / totalClaims) * 100
                  const paidInFullPercent = period.totalClaims > 0 
                    ? ((period.matched / period.totalClaims) * 100).toFixed(1) 
                    : "0";
                  
                  // Seen in remittance % = ((totalClaims - pendingRemittance) / totalClaims) * 100
                  // This includes matched, partially paid, and unpaid (excludes only awaiting_remittance)
                  const seenInRemittanceCount = period.totalClaims - period.awaitingRemittance;
                  const seenInRemittancePercent = period.totalClaims > 0
                    ? ((seenInRemittanceCount / period.totalClaims) * 100).toFixed(1)
                    : "0";

                  return (
                    <div
                      key={`${period.periodYear}-${period.periodMonth}`}
                      onClick={() => handleSelectPeriodCard(period.periodYear, period.periodMonth)}
                      className={cn(
                        "premium-card interactive-card group relative overflow-hidden p-6 cursor-pointer",
                        isActive
                          ? "border-l-4 border-l-orange-500 bg-gradient-to-br from-orange-50/80 via-white to-amber-50/80 shadow-2xl shadow-orange-200/50 ring-2 ring-orange-300/20"
                          : "border-l-4 border-l-slate-200 hover:border-l-orange-400"
                      )}
                    >
                      {/* Subtle gradient overlay on hover */}
                      <div className="absolute inset-0 bg-gradient-to-br from-white/30 via-transparent to-white/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
                      
                      {/* Floating gradient orb */}
                      <div
                        className={cn(
                          "absolute -top-12 -right-12 w-32 h-32 rounded-full blur-3xl transition-all duration-500 group-hover:scale-125",
                          cardState === "complete"
                            ? "bg-emerald-400/20"
                            : cardState === "awaiting"
                            ? "bg-sky-400/20"
                            : cardState === "needs_review"
                            ? "bg-orange-400/20"
                            : "bg-slate-400/15"
                        )}
                      />

                      <div className="relative space-y-4">
                        {/* Header - Month + Status Icon + Actions */}
                        <div className="flex items-start justify-between gap-3">
                          <h3 className="font-bold text-2xl text-slate-800 group-hover:text-orange-600 transition-colors duration-200 flex items-center gap-2">
                            {formatPeriodLabel(period.periodYear, period.periodMonth)}
                            {/* Status Icon inline */}
                            <div className={cn(
                              "w-8 h-8 rounded-lg flex items-center justify-center shadow-sm transition-all duration-300",
                              cardState === "complete"
                                ? "bg-emerald-400"
                                : cardState === "awaiting"
                                ? "bg-sky-400"
                                : cardState === "needs_review"
                                ? "bg-orange-400"
                                : "bg-slate-400"
                            )}>
                              {cardState === "complete" ? (
                                <CheckCircle2 className="w-4 h-4 text-white" />
                              ) : cardState === "awaiting" ? (
                                <Clock className="w-4 h-4 text-white" />
                              ) : cardState === "needs_review" ? (
                                <AlertTriangle className="w-4 h-4 text-white" />
                              ) : (
                                <FileText className="w-4 h-4 text-white" />
                              )}
                            </div>
                          </h3>

                          {/* Actions Menu */}
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="w-8 h-8 min-w-[32px] min-h-[32px] rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 hover:text-slate-900 shadow hover:shadow-md transition-all duration-200 hover:border-slate-400"
                                onClick={(e) => e.stopPropagation()}
                                disabled={isDeleting || isUploading}
                              >
                                <MoreHorizontal className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="bg-white border border-slate-200 shadow-xl rounded-md z-50">
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

                        {/* Progress Bar - Full width, prominent */}
                        <div className="h-4 bg-slate-200/80 rounded-full overflow-hidden flex shadow-inner">
                          {period.matched > 0 && (
                            <div 
                              className="bg-gradient-to-r from-emerald-400 to-emerald-500 transition-all duration-500" 
                              style={{ width: `${(period.matched / period.totalClaims) * 100}%` }}
                              title={`Paid in full: ${period.matched}`}
                            />
                          )}
                          {period.partiallyPaid > 0 && (
                            <div 
                              className="bg-gradient-to-r from-amber-400 to-amber-500 transition-all duration-500" 
                              style={{ width: `${(period.partiallyPaid / period.totalClaims) * 100}%` }}
                              title={`Paid partially: ${period.partiallyPaid}`}
                            />
                          )}
                          {period.unpaid > 0 && (
                            <div 
                              className="bg-gradient-to-r from-rose-400 to-rose-500 transition-all duration-500" 
                              style={{ width: `${(period.unpaid / period.totalClaims) * 100}%` }}
                              title={`Not paid: ${period.unpaid}`}
                            />
                          )}
                          {period.awaitingRemittance > 0 && (
                            <div 
                              className="bg-gradient-to-r from-sky-300 to-sky-400 transition-all duration-500" 
                              style={{ width: `${(period.awaitingRemittance / period.totalClaims) * 100}%` }}
                              title={`Pending remittance: ${period.awaitingRemittance}`}
                            />
                          )}
                        </div>

                        {/* Single-line Summary with Total & Billed */}
                        <div className="flex items-center gap-3 text-sm flex-wrap">
                          <span className="font-medium text-slate-600">
                            {formatNumber(period.totalClaims)} {pluralize(period.totalClaims, "claim")}
                          </span>
                          <span className="text-slate-400">•</span>
                          <span className="font-medium text-slate-600">
                            {getCurrencyForDisplay(period.providerName, period.currency)} {formatNumber(parseFloat(period.totalBilled))}
                          </span>
                        </div>

                        {/* Mini breakdown row with colored dots/pills - Premium & Compact */}
                        {period.totalClaims > 0 && (
                          <div className="flex items-center gap-3 flex-wrap text-xs">
                            {/* Paid in full */}
                            {period.matched > 0 && (
                              <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-emerald-50 border border-emerald-200">
                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                <span className="font-semibold text-emerald-700">
                                  Paid in full: {period.matched}
                                </span>
                              </div>
                            )}
                            
                            {/* Pending remittance */}
                            {period.awaitingRemittance > 0 && (
                              <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-sky-50 border border-sky-200">
                                <div className="w-1.5 h-1.5 rounded-full bg-sky-500" />
                                <span className="font-semibold text-sky-700">
                                  Pending: {period.awaitingRemittance}
                                </span>
                              </div>
                            )}
                            
                            {/* Follow-up needed (partial + unpaid) */}
                            {(period.unpaid + period.partiallyPaid) > 0 && (
                              <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-orange-50 border border-orange-200">
                                <div className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse" />
                                <span className="font-semibold text-orange-700">
                                  Follow-up: {(period.unpaid + period.partiallyPaid)}
                                </span>
                              </div>
                            )}
                            
                            {/* All complete status when fully reconciled */}
                            {cardState === "complete" && (
                              <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-emerald-50 border border-emerald-200">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                <span className="font-semibold text-emerald-700">
                                  All reconciled
                                </span>
                              </div>
                            )}
                          </div>
                        )}
                        
                        {/* Empty state message */}
                        {period.totalClaims === 0 && (
                          <div className="flex items-center gap-2 text-xs">
                            <div className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                            <span className="text-slate-500">No claims uploaded</span>
                          </div>
                        )}
                      </div>

                      {/* Bottom gradient accent */}
                      <div className={cn(
                        "absolute bottom-0 left-0 right-0 h-1 transition-all duration-300",
                        isActive 
                          ? "bg-gradient-to-r from-orange-500 via-amber-500 to-orange-500"
                          : "bg-gradient-to-r from-transparent via-slate-300/50 to-transparent group-hover:via-orange-500/50"
                      )} />
                    </div>
                  );
                })}
              </div>
              
              {/* Show "View all X periods" button when more than 6 exist and not expanded */}
              {/* Show "Show less" button when expanded */}
              {(() => {
                const filteredPeriodsCount = periodsSummary.filter(p => periodYearFilter === null || p.periodYear === periodYearFilter).length;
                
                if (filteredPeriodsCount > MAX_CARDS_DEFAULT) {
                  return (
                    <div className="mt-6 flex justify-center">
                      {!showAllCards ? (
                        <Button
                          variant="outline"
                          size="lg"
                          onClick={() => setShowAllCards(true)}
                          className="gap-2 hover:bg-orange-50 hover:border-orange-300 transition-all shadow-sm"
                        >
                          <LayoutGrid className="w-5 h-5" />
                          View all {filteredPeriodsCount} periods
                        </Button>
                      ) : (
                        <Button
                          variant="outline"
                          size="lg"
                          onClick={() => setShowAllCards(false)}
                          className="gap-2 hover:bg-orange-50 hover:border-orange-300 transition-all shadow-sm"
                        >
                          <LayoutGrid className="w-5 h-5" />
                          Show less
                        </Button>
                      )}
                    </div>
                  );
                }
                return null;
              })()}
                </>
              ) : (
                <div className="relative overflow-x-auto rounded-xl border border-slate-200/50 shadow-inner">
                  {/* Table View with improved responsiveness */}
                  {/* Scroll hint indicator */}
                  <div className="absolute top-0 right-0 bottom-0 w-12 bg-gradient-to-l from-white/90 to-transparent pointer-events-none z-20 md:hidden" />
                  
                  <div className="min-w-full overflow-x-auto">
                    <Table className="min-w-[900px]">
                      <TableHeader className="sticky top-0 z-10 glass-header border-b border-slate-200">
                        <TableRow className="hover:bg-slate-50/90">
                          <TableHead className="font-bold text-slate-700 min-w-[140px] sticky left-0 bg-slate-50/95 z-20">Period</TableHead>
                          <TableHead className="font-bold text-slate-700 min-w-[100px] sticky left-[140px] bg-slate-50/95 z-20">Claims</TableHead>
                          <TableHead className="font-bold text-slate-700 min-w-[120px]">Billed</TableHead>
                          <TableHead className="font-bold text-slate-700 min-w-[200px]">Metrics</TableHead>
                          <TableHead className="font-bold text-slate-700 min-w-[140px]">Status</TableHead>
                          <TableHead className="font-bold text-slate-700 text-right min-w-[100px]">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                      {filteredPeriods.map((period) => {
                        const isActive =
                          period.periodYear === parseInt(periodYear, 10) &&
                          period.periodMonth === parseInt(periodMonth, 10);

                        const isComplete =
                          period.totalClaims > 0 &&
                          period.awaitingRemittance === 0 &&
                          period.unpaid === 0 &&
                          period.partiallyPaid === 0;

                        const hasIssues = period.unpaid > 0 || period.partiallyPaid > 0;
                        const hasAwaiting = period.awaitingRemittance > 0;

                        const cardState: "complete" | "needs_review" | "awaiting" | "processing" =
                          isComplete ? "complete" : hasIssues ? "needs_review" : hasAwaiting ? "awaiting" : "processing";

                        // Calculate metrics
                        const paidInFullPercent = period.totalClaims > 0 
                          ? ((period.matched / period.totalClaims) * 100).toFixed(1) 
                          : "0";
                        
                        const seenInRemittanceCount = period.totalClaims - period.awaitingRemittance;
                        const seenInRemittancePercent = period.totalClaims > 0
                          ? ((seenInRemittanceCount / period.totalClaims) * 100).toFixed(1)
                          : "0";

                        return (
                          <TableRow
                            key={`${period.periodYear}-${period.periodMonth}`}
                            onClick={() => handleSelectPeriodCard(period.periodYear, period.periodMonth)}
                            className={cn(
                              "cursor-pointer transition-all duration-200",
                              isActive
                                ? "bg-orange-50/50 hover:bg-orange-50/70"
                                : "hover:bg-slate-50/50"
                            )}
                          >
                            <TableCell className="font-semibold sticky left-0 bg-white z-10">
                              {formatPeriodLabel(period.periodYear, period.periodMonth)}
                            </TableCell>
                            <TableCell className="sticky left-[140px] bg-white z-10">
                              <div className="flex flex-col">
                                <span className="font-semibold">{period.totalClaims}</span>
                                <span className="text-xs text-slate-500">{pluralize(period.totalClaims, "claim")}</span>
                              </div>
                            </TableCell>
                            <TableCell className="font-semibold">
                              {getCurrencyForDisplay(period.providerName, period.currency)}{" "}
                              {formatNumber(parseFloat(period.totalBilled))}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-3">
                                <div className="flex-1 space-y-1">
                                  {/* Stacked bar visualization */}
                                  <div className="h-2.5 bg-slate-200 rounded-full overflow-hidden flex">
                                    {period.matched > 0 && (
                                      <div 
                                        className="bg-emerald-400 transition-all duration-500" 
                                        style={{ width: `${(period.matched / period.totalClaims) * 100}%` }}
                                        title={`Paid in full: ${period.matched}`}
                                      />
                                    )}
                                    {period.partiallyPaid > 0 && (
                                      <div 
                                        className="bg-amber-400 transition-all duration-500" 
                                        style={{ width: `${(period.partiallyPaid / period.totalClaims) * 100}%` }}
                                        title={`Paid partially: ${period.partiallyPaid}`}
                                      />
                                    )}
                                    {period.unpaid > 0 && (
                                      <div 
                                        className="bg-rose-400 transition-all duration-500" 
                                        style={{ width: `${(period.unpaid / period.totalClaims) * 100}%` }}
                                        title={`Not paid: ${period.unpaid}`}
                                      />
                                    )}
                                    {period.awaitingRemittance > 0 && (
                                      <div 
                                        className="bg-sky-300 transition-all duration-500" 
                                        style={{ width: `${(period.awaitingRemittance / period.totalClaims) * 100}%` }}
                                        title={`Pending remittance: ${period.awaitingRemittance}`}
                                      />
                                    )}
                                  </div>
                                  {/* Metrics text */}
                                  <div className="flex items-center gap-3 text-xs">
                                    <span className="text-slate-600">Paid in full: <span className="font-semibold text-slate-800">{paidInFullPercent}%</span></span>
                                    <span className="text-slate-400">•</span>
                                    <span className="text-slate-600">Seen: <span className="font-semibold text-slate-800">{seenInRemittancePercent}%</span></span>
                                  </div>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              {cardState === "complete" ? (
                                <Badge className="bg-emerald-400 text-white hover:bg-emerald-500 border-0">
                                  <CheckCircle2 className="w-3 h-3 mr-1" />
                                  Complete
                                </Badge>
                              ) : cardState === "needs_review" ? (
                                <Badge className="bg-orange-400 text-white hover:bg-orange-500 border-0">
                                  <AlertTriangle className="w-3 h-3 mr-1" />
                                  Needs review
                                </Badge>
                              ) : cardState === "awaiting" ? (
                                <Badge className="bg-sky-400 text-white hover:bg-sky-500 border-0">
                                  <Clock className="w-3 h-3 mr-1" />
                                  Pending remittance
                                </Badge>
                              ) : (
                                <Badge className="bg-slate-400 text-white hover:bg-slate-500 border-0">Processing</Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="w-9 h-9 min-w-[36px] min-h-[36px] rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 hover:text-slate-900 shadow hover:shadow-md transition-all duration-200 hover:border-slate-400"
                                    onClick={(e) => e.stopPropagation()}
                                    disabled={isDeleting || isUploading}
                                  >
                                    <MoreHorizontal className="w-5 h-5" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="bg-white border border-slate-200 shadow-xl rounded-md z-50">
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
                                    Delete claims
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
                                    Replace remittance
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
                                    Delete remittances
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
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Workflow - Premium Card */}
        <Card id="workflow-section" className="premium-card border border-slate-200/30 shadow-2xl backdrop-blur-sm bg-white/90">
          <CardHeader className="pb-4 glass-header border-b border-slate-200/50">
            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
              <div>
                <CardTitle className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                  <div className="w-1.5 h-8 bg-gradient-to-b from-orange-500 to-amber-500 rounded-full" />
                  Reconciliation Workflow
                </CardTitle>
                <CardDescription className="mt-2 text-slate-600">{getWorkflowDescription(providerName, activePeriodLabel)}</CardDescription>
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
                        const y = String(currentYear - 4 + i);
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
                    {periodStatus.claims.total} claims • {periodStatus.remittances.total} remittance lines
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
                  file={paymentStatementFile}
                  onFileChange={setPaymentStatementFile}
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
                className={cn(
                  "w-full h-12 text-base font-semibold transition-all duration-200 shadow-lg active:scale-[0.98] active:shadow-md",
                  uploadAction.type === "disabled" && "bg-slate-400 hover:bg-slate-400 cursor-not-allowed text-white",
                  uploadAction.type === "claims-only" && "bg-blue-500 hover:bg-blue-600 active:bg-blue-700 text-white shadow-blue-500/30",
                  uploadAction.type === "remittance-only" && "bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-white shadow-emerald-500/30",
                  uploadAction.type === "both" && "bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-white shadow-amber-500/30"
                )}
                onClick={runSmartAction}
                disabled={isUploading || isDeleting || uploadAction.disabled}
              >
                {isUploading ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    {uploadAction.type !== "disabled" && <Upload className="w-5 h-5 mr-2" />}
                    {uploadAction.label}
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Claims Inventory - Premium Card */}
        <Card id="exceptions-section" className="premium-card border border-slate-200/30 shadow-2xl backdrop-blur-sm bg-white/90">
          <CardHeader className="pb-3 glass-header border-b border-slate-200/50">
            <div className="flex items-center justify-between gap-2">
              <div>
                <CardTitle className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                  <div className="w-1.5 h-8 bg-gradient-to-b from-blue-500 to-cyan-600 rounded-full" />
                  Claims Inventory
                </CardTitle>
                <CardDescription className="mt-2 text-slate-600">All claims submitted to {providerName} across all periods</CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowInventory(!showInventory)}
                className="gap-2 hover:bg-blue-50 hover:border-blue-300 transition-all shadow-sm hover:shadow-md"
              >
                <FileStack className="w-4 h-4" />
                {showInventory ? "Hide" : "View All Claims"}
              </Button>
            </div>
          </CardHeader>

          {showInventory && (
            <CardContent className="pt-4 space-y-6">
              <div className="overflow-x-auto pb-2">
                <div className="inline-flex items-center gap-2 p-1.5 rounded-2xl bg-gradient-to-r from-slate-100 via-slate-50 to-slate-100 shadow-md border border-slate-200/50">
                  {(
                    [
                      { key: "all", label: "All", icon: null },
                      { key: "awaiting_remittance", label: "Pending remittance", icon: Clock },
                      { key: "matched", label: "Paid in full", icon: CheckCircle2 },
                      { key: "partially_paid", label: "Paid partially", icon: AlertCircle },
                      { key: "unpaid", label: "Not paid (0 paid)", icon: X },
                    ] as const
                  ).map((x) => {
                    const Icon = x.icon;
                    return (
                      <button
                        key={x.key}
                        type="button"
                        className={cn(
                          "px-5 py-2.5 rounded-xl transition-all duration-200 font-semibold text-sm whitespace-nowrap flex items-center gap-2 hover:scale-[1.02]",
                          inventoryStatusFilter === x.key
                            ? x.key === "unpaid"
                              ? "bg-rose-500 shadow-lg shadow-rose-500/30 text-white scale-105"
                              : x.key === "matched"
                              ? "bg-emerald-500 shadow-lg shadow-emerald-500/30 text-white scale-105"
                              : x.key === "awaiting_remittance"
                              ? "bg-sky-500 shadow-lg shadow-sky-500/30 text-white scale-105"
                              : x.key === "partially_paid"
                              ? "bg-amber-500 shadow-lg shadow-amber-500/30 text-white scale-105"
                              : "bg-white shadow-lg text-slate-900 scale-105"
                            : "text-slate-600 hover:text-slate-900 hover:bg-white/60 hover:shadow-sm"
                        )}
                        onClick={() => {
                          setInventoryStatusFilter(x.key);
                          setInventoryPage(1);
                        }}
                      >
                        {Icon && <Icon className="w-4 h-4" />}
                        {x.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* NEW: Year and Month filters with quick filter buttons */}
              {availablePeriods && availablePeriods.years.length > 0 && (
                <div className="mb-6 space-y-3 p-4 rounded-xl bg-gradient-to-br from-slate-50/50 to-white border border-slate-200/50">
                  {/* Filter selectors */}
                  <div className="flex flex-wrap items-center gap-3">
                    <Label className="text-sm font-semibold text-slate-700">Period:</Label>
                    
                    {/* Year selector */}
                    <Select
                      value={inventoryYearFilter?.toString() || "all"}
                      onValueChange={(value) => {
                        didUserTouchInventoryFilters.current = true;
                        setInventoryYearFilter(value === "all" ? null : parseInt(value, 10));
                        setInventoryPage(1);
                      }}
                    >
                      <SelectTrigger className="w-[140px] bg-white border-slate-300 hover:border-slate-400 transition-colors">
                        <SelectValue placeholder="All years" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All years</SelectItem>
                        {availablePeriods.years.map((year) => (
                          <SelectItem key={year} value={year.toString()}>
                            {year}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    {/* Month selector */}
                    <Select
                      value={inventoryMonthFilter?.toString() || "all"}
                      onValueChange={(value) => {
                        didUserTouchInventoryFilters.current = true;
                        setInventoryMonthFilter(value === "all" ? null : parseInt(value, 10));
                        setInventoryPage(1);
                      }}
                    >
                      <SelectTrigger className="w-[160px] bg-white border-slate-300 hover:border-slate-400 transition-colors">
                        <SelectValue placeholder="All months" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All months</SelectItem>
                        {MONTHS.map((m) => (
                          <SelectItem key={m.value} value={m.value}>
                            {m.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    {/* Clear filters button */}
                    {(inventoryYearFilter !== null || inventoryMonthFilter !== null) && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-2 hover:bg-rose-50 hover:border-rose-300 hover:text-rose-700 transition-all"
                        onClick={() => {
                          didUserTouchInventoryFilters.current = true;
                          setInventoryYearFilter(null);
                          setInventoryMonthFilter(null);
                          setInventoryPage(1);
                        }}
                      >
                        <X className="w-4 h-4" />
                        Clear filters
                      </Button>
                    )}

                    {/* Export Button */}
                    <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-2 ml-auto hover:bg-green-50 hover:border-green-300 transition-all"
                      >
                        <Download className="w-4 h-4" />
                        Export
                        <ChevronDown className="w-3 h-3" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-64 bg-white shadow-xl border border-slate-200 p-1 z-50">
                      <DropdownMenuItem
                        onClick={() => handleExportClaims("all")}
                        className="cursor-pointer px-3 py-2.5 hover:bg-slate-100 rounded-md transition-colors"
                      >
                        <Download className="w-4 h-4 mr-2 text-slate-600" />
                        <span className="flex-1">Export all claims</span>
                        <span className="text-xs text-slate-500 ml-2">({formatNumber(inventorySummaryStats.total)})</span>
                      </DropdownMenuItem>
                      <DropdownMenuSeparator className="my-1" />
                      <DropdownMenuItem
                        onClick={() => handleExportClaims("awaiting_remittance")}
                        className="cursor-pointer px-3 py-2.5 hover:bg-sky-50 rounded-md transition-colors"
                      >
                        <Clock className="w-4 h-4 mr-2 text-sky-600" />
                        <span className="flex-1">Pending remittance</span>
                        <span className="text-xs text-slate-500 ml-2">({formatNumber(inventorySummaryStats.awaiting)})</span>
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => handleExportClaims("matched")}
                        className="cursor-pointer px-3 py-2.5 hover:bg-emerald-50 rounded-md transition-colors"
                      >
                        <CheckCircle2 className="w-4 h-4 mr-2 text-emerald-600" />
                        <span className="flex-1">Paid in full</span>
                        <span className="text-xs text-slate-500 ml-2">({formatNumber(inventorySummaryStats.matched)})</span>
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => handleExportClaims("partially_paid")}
                        className="cursor-pointer px-3 py-2.5 hover:bg-amber-50 rounded-md transition-colors"
                      >
                        <AlertCircle className="w-4 h-4 mr-2 text-amber-600" />
                        <span className="flex-1">Paid partially</span>
                        <span className="text-xs text-slate-500 ml-2">({formatNumber(inventorySummaryStats.partial)})</span>
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => handleExportClaims("unpaid")}
                        className="cursor-pointer px-3 py-2.5 hover:bg-rose-50 rounded-md transition-colors"
                      >
                        <X className="w-4 h-4 mr-2 text-rose-600" />
                        <span className="flex-1">Not paid (0 paid)</span>
                        <span className="text-xs text-slate-500 ml-2">({formatNumber(inventorySummaryStats.unpaid)})</span>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  </div>

                  {/* Quick filter buttons */}
                  <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-200/60">
                    <Label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Quick filters:</Label>
                    
                    <button
                      type="button"
                      className={cn(
                        "px-4 py-2 rounded-lg transition-all duration-200 font-semibold text-xs whitespace-nowrap flex items-center gap-1.5 hover:scale-[1.02]",
                        inventoryYearFilter === currentYear && inventoryMonthFilter === null
                          ? "bg-blue-500 shadow-lg shadow-blue-500/30 text-white scale-105"
                          : "text-slate-600 hover:text-slate-900 hover:bg-blue-50 hover:shadow-sm"
                      )}
                      onClick={() => {
                        // This year
                        didUserTouchInventoryFilters.current = true;
                        setInventoryYearFilter(currentYear);
                        setInventoryMonthFilter(null);
                        setInventoryPage(1);
                      }}
                    >
                      <Zap className="w-3 h-3" />
                      This year
                    </button>

                    <button
                      type="button"
                      className={cn(
                        "px-4 py-2 rounded-lg transition-all duration-200 font-semibold text-xs whitespace-nowrap flex items-center gap-1.5 hover:scale-[1.02]",
                        inventoryYearFilter === null && inventoryMonthFilter === null
                          ? "bg-slate-500 shadow-lg shadow-slate-500/30 text-white scale-105"
                          : "text-slate-600 hover:text-slate-900 hover:bg-slate-50 hover:shadow-sm"
                      )}
                      onClick={() => {
                        // All years - clear all filters
                        didUserTouchInventoryFilters.current = true;
                        setInventoryYearFilter(null);
                        setInventoryMonthFilter(null);
                        setInventoryPage(1);
                      }}
                    >
                      <Zap className="w-3 h-3" />
                      All years
                    </button>
                  </div>
                </div>
              )}

              {!summaryLoading && (
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6 p-5 rounded-xl bg-gradient-to-br from-slate-50 to-white border border-slate-200/50 shadow-sm">
                  <div className="space-y-1">
                    <div className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Total Claims</div>
                    <div className="text-2xl font-bold text-slate-900">{formatNumber(inventorySummaryStats.total)}</div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Pending remittance</div>
                    <div className="text-2xl font-bold text-sky-400">{formatNumber(inventorySummaryStats.awaiting)}</div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Paid in full</div>
                    <div className="text-2xl font-bold text-emerald-400">{formatNumber(inventorySummaryStats.matched)}</div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Paid partially</div>
                    <div className="text-2xl font-bold text-amber-400">{formatNumber(inventorySummaryStats.partial)}</div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Not paid (0 paid)</div>
                    <div className="text-2xl font-bold text-rose-400">{formatNumber(inventorySummaryStats.unpaid)}</div>
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
                  <div className="overflow-x-auto rounded-xl border border-slate-200/50">
                    <Table>
                      <TableHeader className="sticky top-0 z-10 backdrop-blur-md bg-slate-50/90 border-b border-slate-200">
                        <TableRow className="hover:bg-slate-50/90">
                          <TableHead className="font-bold text-slate-700">Member #</TableHead>
                          <TableHead className="font-bold text-slate-700">Patient Name</TableHead>
                          <TableHead className="font-bold text-slate-700">Service Date</TableHead>
                          <TableHead className="font-bold text-slate-700">Period</TableHead>
                          <TableHead className="font-bold text-slate-700">Billed Amount</TableHead>
                          <TableHead className="font-bold text-slate-700">Amount Paid</TableHead>
                          <TableHead className="font-bold text-slate-700">Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {claimsInventory.claims.map((claim, idx) => (
                          <TableRow 
                            key={claim.id} 
                            className={cn(
                              "transition-all duration-200",
                              idx % 2 === 0 ? "bg-white" : "bg-slate-50/40",
                              "hover:bg-orange-50/50 hover:shadow-sm"
                            )}
                          >
                            <TableCell className="font-mono text-sm font-medium">{claim.memberNumber}</TableCell>
                            <TableCell className="font-medium">{claim.patientName || "N/A"}</TableCell>
                            <TableCell>{formatDate(claim.serviceDate)}</TableCell>
                            <TableCell className="text-sm">{formatPeriodLabel(claim.periodYear, claim.periodMonth)}</TableCell>
                            <TableCell className="font-semibold">
                              {getCurrencyForDisplay(claim.providerName, claim.currency)}{" "}
                              {parseFloat(claim.billedAmount).toFixed(2)}
                            </TableCell>
                            <TableCell className="font-semibold">
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

        {/* Reconciliation history - Premium Card */}
        <Card id="reconciliation-history" className="premium-card border border-slate-200/30 shadow-2xl backdrop-blur-sm bg-white/90">
          <CardHeader className="pb-3 glass-header border-b border-slate-200/50">
            <div className="flex items-center justify-between gap-2">
              <div className="flex-1">
                <CardTitle className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                  <div className="w-1.5 h-8 bg-gradient-to-b from-emerald-500 to-teal-600 rounded-full" />
                  Reconciliation History
                </CardTitle>
                <CardDescription className="mt-2 text-slate-600">Previous reconciliation runs for all providers</CardDescription>
              </div>
              
              {/* Requirement 3: Toggle for Last 4 months vs All months */}
              <div className="flex items-center gap-2">
                {runsFetching && (
                  <div className="flex items-center gap-2 text-xs text-slate-600">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    <span>Refreshing…</span>
                  </div>
                )}
                <div className="inline-flex items-center gap-1 p-1 rounded-lg bg-slate-100 border border-slate-200">
                  <button
                    type="button"
                    className={cn(
                      "px-3 py-1.5 text-xs font-semibold rounded-md transition-all",
                      historyViewMode === "last_4_months"
                        ? "bg-white text-slate-900 shadow-sm"
                        : "text-slate-600 hover:text-slate-900"
                    )}
                    onClick={() => setHistoryViewMode("last_4_months")}
                  >
                    Latest 4 periods
                  </button>
                  <button
                    type="button"
                    className={cn(
                      "px-3 py-1.5 text-xs font-semibold rounded-md transition-all",
                      historyViewMode === "all_months"
                        ? "bg-white text-slate-900 shadow-sm"
                        : "text-slate-600 hover:text-slate-900"
                    )}
                    onClick={() => setHistoryViewMode("all_months")}
                  >
                    All months
                  </button>
                </div>
              </div>
            </div>
          </CardHeader>

          <CardContent className="pt-4 space-y-4">
            {/* Requirement 3: Add explanatory note above History table */}
            {actualReconciliationRuns.length > 0 && (
              <div className="flex items-start gap-2 px-4 py-3 bg-blue-50 border border-blue-200 rounded-lg mb-4">
                <Info className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm text-blue-900">
                    <strong>Note:</strong> A remittance can include multiple months. Each upload is matched against all outstanding claims.
                  </p>
                </div>
              </div>
            )}
            
            {actualReconciliationRuns.length > 0 && (
              <div className="overflow-x-auto pb-2">
                <div className="inline-flex items-center gap-2 p-1.5 rounded-2xl bg-gradient-to-r from-slate-100 via-slate-50 to-slate-100 shadow-md border border-slate-200/50">
                  <button
                    type="button"
                    className={cn(
                      "px-5 py-2.5 rounded-xl transition-all duration-200 font-semibold text-sm whitespace-nowrap hover:scale-[1.02]",
                      statusFilter === "all" 
                        ? "bg-white shadow-lg shadow-slate-300/50 text-slate-900 scale-105" 
                        : "text-slate-600 hover:text-slate-900 hover:bg-white/60 hover:shadow-sm"
                    )}
                    onClick={() => setStatusFilter("all")}
                  >
                    All ({actualReconciliationRuns.length})
                  </button>

                  <button
                    type="button"
                    className={cn(
                      "px-5 py-2.5 rounded-xl transition-all duration-200 font-semibold text-sm flex items-center gap-2 whitespace-nowrap hover:scale-[1.02]",
                      statusFilter === "needs_follow_up"
                        ? "bg-orange-500 shadow-lg shadow-orange-500/30 text-white scale-105"
                        : "text-slate-600 hover:text-slate-900 hover:bg-white/60 hover:shadow-sm"
                    )}
                    onClick={() => setStatusFilter("needs_follow_up")}
                  >
                    <AlertTriangle className="w-4 h-4" />
                    Runs with follow-up ({actualReconciliationRuns.filter((r) => runGroup(r) === "needs_follow_up").length})
                  </button>

                  <button
                    type="button"
                    className={cn(
                      "px-5 py-2.5 rounded-xl transition-all duration-200 font-semibold text-sm flex items-center gap-2 whitespace-nowrap hover:scale-[1.02]",
                      statusFilter === "completed"
                        ? "bg-emerald-500 shadow-lg shadow-emerald-500/30 text-white scale-105"
                        : "text-slate-600 hover:text-slate-900 hover:bg-white/60 hover:shadow-sm"
                    )}
                    onClick={() => setStatusFilter("completed")}
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    Fully reconciled ({actualReconciliationRuns.filter((r) => runGroup(r) === "completed").length})
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
              <div className="w-full overflow-x-auto rounded-xl border border-slate-200/50">
                <Table>
                  <TableHeader className="sticky top-0 z-10 backdrop-blur-md bg-slate-50/90 border-b border-slate-200">
                    <TableRow className="hover:bg-slate-50/90">
                      <TableHead className="font-bold text-slate-700">Provider</TableHead>
                      <TableHead className="font-bold text-slate-700">Period</TableHead>
                      <TableHead className="font-bold text-slate-700">Status</TableHead>
                      {/* Issue 7: Period claims column */}
                      <TableHead className="font-bold text-slate-700">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="flex items-center gap-1 cursor-help">
                                <span>Period claims</span>
                                <Info className="w-3 h-3 text-slate-400" />
                              </div>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs">
                              <p className="text-xs">Claims uploaded for this specific period only</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </TableHead>
                      {/* Requirement 1: Renamed to "Outstanding checked" */}
                      <TableHead className="font-bold text-slate-700">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="flex items-center gap-1 cursor-help">
                                <span>Outstanding checked</span>
                                <Info className="w-3 h-3 text-slate-400" />
                              </div>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs">
                              <p className="text-xs">Matched against all outstanding claims across all months (not just this period).</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </TableHead>
                      {/* Remittance lines column */}
                      <TableHead className="font-bold text-slate-700">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="flex items-center gap-1 cursor-help">
                                <span>Remittance lines</span>
                                <Info className="w-3 h-3 text-slate-400" />
                              </div>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs">
                              <p className="text-xs">Number of rows in the uploaded remittance file</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </TableHead>
                      {/* Tooltips explaining cross-month matching */}
                      <TableHead className="font-bold text-slate-700">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="flex items-center gap-1 cursor-help">
                                <span>Paid in full</span>
                                <Info className="w-3 h-3 text-slate-400" />
                              </div>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs">
                              <p className="text-xs">Claims found in the uploaded remittance with full payment. Can include claims from any month.</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </TableHead>
                      <TableHead className="font-bold text-slate-700">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="flex items-center gap-1 cursor-help">
                                <span>Partial</span>
                                <Info className="w-3 h-3 text-slate-400" />
                              </div>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs">
                              <p className="text-xs">Claims found in the uploaded remittance with partial payment. Can include claims from any month.</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </TableHead>
                      <TableHead className="font-bold text-slate-700">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="flex items-center gap-1 cursor-help">
                                <span>Not paid</span>
                                <Info className="w-3 h-3 text-slate-400" />
                              </div>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs">
                              <p className="text-xs">Claims found in the uploaded remittance with $0 paid. Can include claims from any month.</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </TableHead>
                      <TableHead className="font-bold text-slate-700">Date</TableHead>
                      <TableHead className="text-right font-bold text-slate-700">Actions</TableHead>
                    </TableRow>
                  </TableHeader>

                  <TableBody>
                    {filteredRuns.map((run, idx) => {
                      const periodLabel = new Date(run.periodYear, run.periodMonth - 1).toLocaleString("default", {
                        month: "short",
                        year: "numeric",
                      });
                      const isLatest = stats.latestRunId === run.id;
                      
                      // Issue 7: Get period-specific claims count using lookup map for O(1) performance
                      const periodKey = `${run.providerName}|${run.periodYear}|${run.periodMonth}`;
                      const periodClaimsCount = periodClaimsLookup.get(periodKey) ?? 0;

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
                            "transition-all duration-200 cursor-pointer",
                            idx % 2 === 0 ? "bg-white" : "bg-slate-50/40",
                            "hover:bg-emerald-50/60 hover:shadow-sm",
                            selectedRunId === run.id && "border-l-4 border-l-emerald-500 bg-emerald-50/80 shadow-md"
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
                          {/* Issue 7: Period claims - claims for this specific period only */}
                          <TableCell>{periodClaimsCount}</TableCell>
                          {/* Issue 4: Claims checked (cross-period) */}
                          <TableCell>{run.totalClaimRows}</TableCell>
                          {/* Remittances */}
                          <TableCell>{run.totalRemittanceRows}</TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className="text-xs font-bold border-emerald-500/60 bg-emerald-50 text-emerald-700 px-2.5 py-1 shadow-sm inline-flex items-center gap-1.5 min-w-[52px] justify-center transition-all duration-200 hover:shadow-md"
                            >
                              <CheckCircle className="w-3.5 h-3.5" />
                              {run.autoMatched}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge className="bg-amber-500 text-white hover:bg-amber-600 text-xs font-bold px-2.5 py-1 shadow-sm inline-flex items-center gap-1.5 min-w-[52px] justify-center transition-all duration-200 hover:shadow-md">
                              <Clock className="w-3.5 h-3.5" />
                              {run.partialMatched}
                            </Badge>
                          </TableCell>
                          {/* Issue 4: Not paid (replaced Review) - shows unpaid claims with $0 paid */}
                          <TableCell>
                            <Badge className="bg-rose-500 text-white hover:bg-rose-600 text-xs font-bold px-2.5 py-1 shadow-sm inline-flex items-center gap-1.5 min-w-[52px] justify-center transition-all duration-200 hover:shadow-md">
                              <X className="w-3.5 h-3.5" />
                              {run.unpaidCount}
                            </Badge>
                          </TableCell>
                          {/* Requirement 4: Enhanced Date column with tooltip showing full context */}
                          <TableCell>
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div className="cursor-help">
                                    {new Date(run.createdAt).toLocaleDateString()}
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent className="max-w-xs">
                                  <p className="text-xs font-semibold mb-1">Upload Context</p>
                                  <p className="text-xs">Date: {new Date(run.createdAt).toLocaleString()}</p>
                                  <p className="text-xs">Period: {periodLabel}</p>
                                  <p className="text-xs">Remittance lines: {run.totalRemittanceRows}</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </TableCell>

                          <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="w-9 h-9 min-w-[36px] min-h-[36px] rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 hover:text-slate-900 shadow hover:shadow-md transition-all duration-200 hover:border-slate-400" disabled={isDeleting}>
                                  <span className="sr-only">Open menu</span>
                                  <MoreHorizontal className="w-5 h-5" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="bg-white border border-slate-200 shadow-xl rounded-md z-50">
                                {/* Requirement 4: Add remittance context info */}
                                <div className="px-3 py-2 text-xs border-b border-slate-200 bg-slate-50">
                                  <p className="font-semibold text-slate-700">Remittance Context</p>
                                  <p className="text-slate-600 mt-1">Uploaded: {new Date(run.createdAt).toLocaleString()}</p>
                                  <p className="text-slate-600">Lines: {run.totalRemittanceRows}</p>
                                </div>
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

        {/* Claims Details - Premium Card with Orange Accent */}
        {selectedRunId && (
          <Card
            id="claims-details-section"
            className="premium-card border border-slate-200/30 shadow-2xl backdrop-blur-sm bg-white/90 border-l-4 border-l-orange-500"
          >
            <CardHeader className="pb-3 glass-header border-b border-slate-200/50">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                    <div className="w-1.5 h-8 bg-gradient-to-b from-orange-500 to-amber-500 rounded-full" />
                    Claims Details — Run #{selectedRunId}
                  </CardTitle>
                  <CardDescription className="mt-2 text-slate-600">Detailed view of claims for the selected run</CardDescription>
                </div>

                {selectedRun && (
                  <div className="text-right space-y-1">
                    <div className="text-sm font-bold text-slate-800">
                      {selectedRun.providerName} ·{" "}
                      {new Date(selectedRun.periodYear, selectedRun.periodMonth - 1).toLocaleString("default", {
                        month: "short",
                        year: "numeric",
                      })}
                    </div>
                    <div className="text-base font-bold text-slate-900">
                      {selectedRun.totalClaimRows} claims
                      {claims.length > 0 && claims.length !== selectedRun.totalClaimRows ? ` (${claims.length} shown)` : ""}
                      <span className="text-slate-400 font-normal mx-2">•</span>
                      <span className="font-bold text-slate-900">{selectedRun.totalRemittanceRows}</span> <span className="text-sm font-medium text-slate-600">remittance lines</span>
                    </div>
                  </div>
                )}
              </div>
            </CardHeader>

            <CardContent className="pt-4 space-y-6">
              {claimsLoading ? (
                <p className="text-muted-foreground py-6 text-sm">Loading claims…</p>
              ) : claims.length === 0 ? (
                <p className="text-muted-foreground py-6 text-sm">No claims found for this run.</p>
              ) : (
                <>
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 py-4">
                    {/* Enhanced tabs with premium styling */}
                    <div className="overflow-x-auto pb-2">
                      <div className="inline-flex items-center gap-2 p-1.5 rounded-2xl bg-gradient-to-r from-slate-100 via-slate-50 to-slate-100 shadow-md border border-slate-200/50">
                        <button
                          type="button"
                          className={cn(
                            "px-5 py-2.5 rounded-xl transition-all duration-200 font-semibold text-sm whitespace-nowrap hover:scale-[1.02]",
                            attentionFilter === "all"
                              ? "bg-white shadow-lg shadow-slate-300/50 text-slate-900 scale-105"
                              : "text-slate-600 hover:text-slate-900 hover:bg-white/60 hover:shadow-sm"
                          )}
                          onClick={() => setAttentionFilter("all")}
                        >
                          All Claims ({claims.length})
                        </button>

                        <button
                          type="button"
                          className={cn(
                            "px-5 py-2.5 rounded-xl transition-all duration-200 font-semibold text-sm flex items-center gap-2 whitespace-nowrap hover:scale-[1.02]",
                            attentionFilter === "waiting"
                              ? "bg-sky-500 shadow-lg shadow-sky-500/30 text-white scale-105"
                              : "text-slate-600 hover:text-slate-900 hover:bg-white/60 hover:shadow-sm"
                          )}
                          onClick={() => setAttentionFilter("waiting")}
                        >
                          <Clock className="w-4 h-4" />
                          Not paid yet ({waitingCountForSelected})
                        </button>

                        <button
                          type="button"
                          className={cn(
                            "px-5 py-2.5 rounded-xl transition-all duration-200 font-semibold text-sm flex items-center gap-2 whitespace-nowrap hover:scale-[1.02]",
                            attentionFilter === "follow_up"
                              ? "bg-orange-500 shadow-lg shadow-orange-500/30 text-white scale-105"
                              : "text-slate-600 hover:text-slate-900 hover:bg-white/60 hover:shadow-sm"
                          )}
                          onClick={() => setAttentionFilter("follow_up")}
                        >
                          <AlertTriangle className="w-4 h-4" />
                          Needs follow-up ({followUpCountForSelected})
                        </button>
                      </div>
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
                    <div className="w-full overflow-x-auto rounded-xl border border-slate-200/50">
                      <Table>
                        <TableHeader className="sticky top-0 z-10 backdrop-blur-md bg-slate-50/90 border-b border-slate-200">
                          <TableRow className="hover:bg-slate-50/90">
                            <TableHead className="font-bold text-slate-700">Member #</TableHead>
                            <TableHead className="font-bold text-slate-700">Patient name</TableHead>
                            <TableHead className="font-bold text-slate-700">Service date</TableHead>
                            <TableHead className="font-bold text-slate-700">Billed amount</TableHead>
                            <TableHead className="font-bold text-slate-700">Amount paid</TableHead>
                            <TableHead className="font-bold text-slate-700">Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredClaims.map((claim, idx) => (
                            <TableRow
                              key={claim.id}
                              className={cn(
                                "transition-all duration-200",
                                idx % 2 === 0 ? "bg-white" : "bg-slate-50/40",
                                "hover:bg-orange-50/50 hover:shadow-sm"
                              )}
                            >
                              <TableCell className="font-mono font-medium">{claim.memberNumber}</TableCell>
                              <TableCell className="font-medium">{claim.patientName || "N/A"}</TableCell>
                              <TableCell>{formatDate(claim.serviceDate)}</TableCell>
                              <TableCell className="font-semibold">
                                {selectedRun ? getCurrencyForDisplay(selectedRun.providerName, claim.currency) : "USD"}{" "}
                                {parseFloat(claim.billedAmount).toFixed(2)}
                              </TableCell>
                              <TableCell className="font-semibold">
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
      </div>
    </TooltipProvider>
  );
}
