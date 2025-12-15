// client/src/pages/claim-reconciliation.tsx

import { useState, useMemo, useCallback, useEffect } from "react";
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
/* Icons (from lucide-react) */
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
 * Get currency display for a provider/claim
 * CIC should always display USD, even if stored as SSP
 */
function getCurrencyForDisplay(providerName: string, currency?: string): string {
  if (providerName === "CIC") {
    return "USD";
  }
  return currency || "USD";
}

/**
 * Workflow subtitle clarifying cross-period matching behavior.
 */
function getWorkflowDescription(providerName: string, periodLabel: string): string {
  return `Working on: ${providerName} – ${periodLabel} (claims for this month). Remittance uploads will be matched against all outstanding ${providerName} claims across all months.`;
}

/**
 * Remittance helper text.
 */
function getRemittanceUploadDescription(providerName: string): string {
  if (providerName === "CIC") {
    return "This remittance will be matched against all CIC claims that are still awaiting remittance, not just this month";
  }
  return "Upload remittance advice from insurance";
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
  icon?: React.ReactNode;
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
      if (acceptedFiles.length > 0) {
        onFileChange(acceptedFiles[0]);
      }
    },
    [onFileChange]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
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

  // File selected
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
          <span className="text-sm font-medium text-slate-800 truncate" title={file.name}>
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

  // Empty / Dragging
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
              <span className="font-semibold">Click to upload</span> or drag &amp; drop
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

  // Selection
  const [selectedPeriodKey, setSelectedPeriodKey] = useState<string | null>(null); // "YYYY-M"
  const [periodYearFilter, setPeriodYearFilter] = useState<number | null>(null);

  // Form / working context
  const [providerName, setProviderName] = useState("CIC");
  const [periodYear, setPeriodYear] = useState(new Date().getFullYear().toString());
  const [periodMonth, setPeriodMonth] = useState((new Date().getMonth() + 1).toString());

  const [claimsFile, setClaimsFile] = useState<File | null>(null);
  const [remittanceFile, setRemittanceFile] = useState<File | null>(null);

  // Runs details
  const [selectedRunId, setSelectedRunId] = useState<number | null>(null);
  const [showHelp, setShowHelp] = useState(false);

  const [attentionFilter, setAttentionFilter] = useState<"all" | "issues">("issues");
  const [statusFilter, setStatusFilter] = useState<"all" | "awaiting_remittance" | "reconciled">("all");

  // Inventory
  const [inventoryStatusFilter, setInventoryStatusFilter] = useState<
    "all" | "awaiting_remittance" | "matched" | "partially_paid" | "unpaid"
  >("unpaid");
  const [inventoryPeriodFilter, setInventoryPeriodFilter] = useState<string | null>(null); // "YYYY-M"
  const [inventoryPage, setInventoryPage] = useState(1);
  const [showInventory, setShowInventory] = useState(false);

  // Header particles
  const particles = useMemo(() => {
    return Array.from({ length: 6 }, () => ({
      left: `${Math.random() * 100}%`,
      top: `${Math.random() * 100}%`,
      duration: 3 + Math.random() * 4,
      delay: Math.random() * 2,
    }));
  }, []);

  /* ------------------------------------------------------------------------ */
  /* Queries                                                                   */
  /* ------------------------------------------------------------------------ */

  const {
    data: runs = [],
    isLoading: runsLoading,
    isFetching: runsFetching,
  } = useQuery<ReconRun[]>({
    queryKey: ["/api/claim-reconciliation/runs"],
  });

  const { data: claims = [], isLoading: claimsLoading } = useQuery<ClaimDetail[]>({
    queryKey: [`/api/claim-reconciliation/runs/${selectedRunId}/claims`],
    enabled: !!selectedRunId,
  });

  const {
    data: periodsSummary = [],
    isLoading: summaryLoading,
  } = useQuery<PeriodSummary[]>({
    queryKey: ["/api/claim-reconciliation/periods-summary", providerName],
    queryFn: async () => {
      const params = new URLSearchParams({ providerName });
      const url = new URL(
        `/api/claim-reconciliation/periods-summary?${params.toString()}`,
        API_BASE_URL
      ).toString();

      const headers: HeadersInit = {};
      const backup = readSessionBackup();
      if (backup) headers["x-session-token"] = backup;

      const response = await fetch(url, { method: "GET", credentials: "include", headers });
      if (!response.ok) throw new Error("Failed to fetch periods summary");
      return response.json();
    },
  });

  const providerTotalClaims = useMemo(() => {
    return periodsSummary.reduce((sum, p) => sum + p.totalClaims, 0);
  }, [periodsSummary]);

  const providerHasAnyClaims = providerTotalClaims > 0;

  const {
    data: periodStatus,
    isFetching: periodStatusFetching,
  } = useQuery<PeriodStatus>({
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
            params.append("periodYear", year.toString());
            params.append("periodMonth", month.toString());
          }
        }
      }

      const url = new URL(
        `/api/claim-reconciliation/claims?${params.toString()}`,
        API_BASE_URL
      ).toString();

      const headers: HeadersInit = {};
      const backup = readSessionBackup();
      if (backup) headers["x-session-token"] = backup;

      const response = await fetch(url, { method: "GET", credentials: "include", headers });
      if (!response.ok) throw new Error("Failed to fetch claims inventory");
      return response.json();
    },
    enabled: showInventory,
  });

  /* ------------------------------------------------------------------------ */
  /* Period card filtering                                                     */
  /* ------------------------------------------------------------------------ */

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

  // Auto-select latest period for this provider (so the page is never “empty”)
  useEffect(() => {
    if (periodsSummary.length === 0) return;

    // If current selection is not present for this provider, select most recent summary period
    const currentKey = `${periodYear}-${parseInt(periodMonth, 10)}`;
    const exists = periodsSummary.some((p) => `${p.periodYear}-${p.periodMonth}` === currentKey);

    if (!selectedPeriodKey || !exists) {
      const latest = periodsSummary[0]; // already sorted most recent first in API
      const key = `${latest.periodYear}-${latest.periodMonth}`;
      setSelectedPeriodKey(key);
      setPeriodYear(latest.periodYear.toString());
      setPeriodMonth(latest.periodMonth.toString());
      setInventoryPeriodFilter(key);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [providerName, periodsSummary]);

  /* ------------------------------------------------------------------------ */
  /* Stats strip                                                               */
  /* ------------------------------------------------------------------------ */

  const stats = useMemo(() => {
    const totalRuns = runs.length;

    const totalClaims = periodsSummary.reduce((sum, p) => sum + p.totalClaims, 0);

    const problemClaims = periodsSummary.reduce((sum, p) => {
      return sum + p.awaitingRemittance + p.unpaid + p.partiallyPaid;
    }, 0);

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
      totalRuns,
      totalClaims,
      problemClaims,
      lastPeriodLabel,
      latestRunId: latest?.id ?? null,
    };
  }, [runs, periodsSummary]);

  /* ------------------------------------------------------------------------ */
  /* Mutations                                                                 */
  /* ------------------------------------------------------------------------ */

  const uploadClaimsMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const uploadUrl = new URL("/api/claim-reconciliation/upload-claims", API_BASE_URL).toString();

      const headers: HeadersInit = {};
      const backup = readSessionBackup();
      if (backup) headers["x-session-token"] = backup;

      const response = await fetch(uploadUrl, { method: "POST", body: formData, credentials: "include", headers });

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

      queryClient.invalidateQueries({ queryKey: ["/api/claim-reconciliation/periods-summary"], exact: false });
      queryClient.invalidateQueries({ queryKey: ["/api/claim-reconciliation/period"], exact: false });
      queryClient.invalidateQueries({ queryKey: ["/api/claim-reconciliation/claims"], exact: false });

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

      const response = await fetch(uploadUrl, { method: "POST", body: formData, credentials: "include", headers });

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

      toast({
        title: "Reconciliation complete",
        description: `${reconciliation.totalClaims} claims searched, ${reconciliation.autoMatched} matched, ${reconciliation.partialMatched} partial, ${unpaidCount} unpaid/review`,
      });

      queryClient.invalidateQueries({ queryKey: ["/api/claim-reconciliation/runs"], exact: false });
      queryClient.invalidateQueries({ queryKey: ["/api/claim-reconciliation/periods-summary"], exact: false });
      queryClient.invalidateQueries({ queryKey: ["/api/claim-reconciliation/period"], exact: false });
      queryClient.invalidateQueries({ queryKey: ["/api/claim-reconciliation/claims"], exact: false });

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
      queryClient.invalidateQueries({ queryKey: ["/api/claim-reconciliation/runs"], exact: false });
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

      toast({ title: "Export ready", description: "Problem claims were exported for CIC." });
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
      queryClient.invalidateQueries({ queryKey: ["/api/claim-reconciliation/periods-summary"], exact: false });
      queryClient.invalidateQueries({ queryKey: ["/api/claim-reconciliation/period"], exact: false });
      queryClient.invalidateQueries({ queryKey: ["/api/claim-reconciliation/claims"], exact: false });
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
      queryClient.invalidateQueries({ queryKey: ["/api/claim-reconciliation/periods-summary"], exact: false });
      queryClient.invalidateQueries({ queryKey: ["/api/claim-reconciliation/period"], exact: false });
      queryClient.invalidateQueries({ queryKey: ["/api/claim-reconciliation/claims"], exact: false });
    },
    onError: (error: Error) => {
      toast({ title: "Delete failed", description: error.message, variant: "destructive" });
    },
  });

  const isUploading = uploadClaimsMutation.isPending || uploadRemittanceMutation.isPending;
  const isDeleting = deleteMutation.isPending || deletePeriodClaimsMutation.isPending || deletePeriodRemittancesMutation.isPending;
  const isExporting = exportIssuesMutation.isPending;

  /* ------------------------------------------------------------------------ */
  /* Stepper logic                                                             */
  /* ------------------------------------------------------------------------ */

  const selectedPeriodSummary = useMemo(() => {
    if (!selectedPeriodKey) return null;
    return periodsSummary.find((p) => `${p.periodYear}-${p.periodMonth}` === selectedPeriodKey) || null;
  }, [periodsSummary, selectedPeriodKey]);

  const stepperState = useMemo(() => {
    const periodLabel = formatPeriodLabel(parseInt(periodYear, 10), parseInt(periodMonth, 10));

    // Step 1 should reflect "Do we have claims inventory for provider at all?"
    const hasAnyClaimsForProvider = providerHasAnyClaims;

    const hasRemittanceForThisPeriod = !!periodStatus && periodStatus.remittances.total > 0;
    const isReconciled = !!periodStatus && periodStatus.isReconciled;

    const issuesCount =
      (periodStatus?.claims.partiallyPaid || 0) + (periodStatus?.claims.unpaid || 0);

    const step1 = {
      completed: hasAnyClaimsForProvider,
      details: hasAnyClaimsForProvider
        ? `${providerTotalClaims} ${pluralize(providerTotalClaims, "claim")} (all periods)`
        : undefined,
    };

    const step2 = {
      completed: hasRemittanceForThisPeriod,
      details: hasRemittanceForThisPeriod ? `${periodStatus?.remittances.total} remittances` : undefined,
    };

    // Reconciliation happens automatically on remittance upload
    const step3 = {
      completed: isReconciled || hasRemittanceForThisPeriod,
      details: (isReconciled || hasRemittanceForThisPeriod) ? "Auto-run" : undefined,
    };

    const step4 = {
      completed: (isReconciled || hasRemittanceForThisPeriod) && issuesCount === 0,
      details:
        (isReconciled || hasRemittanceForThisPeriod)
          ? issuesCount > 0
            ? `${issuesCount} issues`
            : "No issues"
          : undefined,
    };

    let currentStep: 1 | 2 | 3 | 4 = 1;
    let primaryAction = "";
    let primaryDisabled = false;

    if (!hasAnyClaimsForProvider) {
      currentStep = 1;
      primaryAction = "📄 Upload Claims File";
      primaryDisabled = !claimsFile;
    } else if (!hasRemittanceForThisPeriod) {
      currentStep = 2;
      primaryAction = "💰 Upload Remittance File";
      primaryDisabled = !remittanceFile;
    } else if (!(isReconciled || hasRemittanceForThisPeriod)) {
      currentStep = 3;
      primaryAction = "▶️ Reconciliation runs automatically";
      primaryDisabled = true;
    } else {
      currentStep = 4;
      primaryAction = issuesCount > 0 ? "🔍 Review Exceptions" : "✅ All Complete";
      primaryDisabled = false;
    }

    return {
      periodLabel,
      steps: {
        claimsUploaded: step1,
        remittanceUploaded: step2,
        reconciliationRun: step3,
        reviewExceptions: step4,
      },
      currentStep,
      primaryAction,
      primaryDisabled,
      issuesCount,
    };
  }, [
    periodStatus,
    claimsFile,
    remittanceFile,
    providerHasAnyClaims,
    providerTotalClaims,
    periodYear,
    periodMonth,
  ]);

  /* ------------------------------------------------------------------------ */
  /* Handlers                                                                  */
  /* ------------------------------------------------------------------------ */

  const handleSelectPeriod = useCallback(
    (provider: string, year: number, month: number) => {
      const key = `${year}-${month}`;
      setProviderName(provider);
      setSelectedPeriodKey(key);
      setPeriodYear(year.toString());
      setPeriodMonth(month.toString());
      setInventoryPeriodFilter(key);

      setClaimsFile(null);
      setRemittanceFile(null);
    },
    []
  );

  const handleStepperAction = useCallback(() => {
    // Step 4: scroll to exceptions/inventory
    if (stepperState.currentStep === 4) {
      const exceptionsSection = document.getElementById("exceptions-section");
      if (exceptionsSection) exceptionsSection.scrollIntoView({ behavior: "smooth" });
      else {
        setShowInventory(true);
        setInventoryStatusFilter("unpaid");
      }
      return;
    }

    // Step 1: upload claims (provider-level “inventory ready”)
    if (!providerHasAnyClaims) {
      if (!claimsFile) {
        toast({
          title: "No file selected",
          description: "Please select a claims file to upload.",
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
      return;
    }

    // Step 2: upload remittance (allowed even if THIS period has 0 claims; cross-period matching)
    if (!periodStatus || periodStatus.remittances.total === 0) {
      if (!remittanceFile) {
        toast({
          title: "No file selected",
          description: "Please select a remittance file to upload.",
          variant: "destructive",
        });
        return;
      }

      // Defensive: backend requires at least one claim for provider (any period)
      if (!providerHasAnyClaims) {
        toast({
          title: "Upload claims first",
          description: `No claims exist yet for ${providerName}. Upload claims before uploading a remittance file.`,
          variant: "destructive",
        });
        return;
      }

      const formData = new FormData();
      formData.append("remittanceFile", remittanceFile);
      formData.append("providerName", providerName);
      formData.append("periodYear", periodYear);
      formData.append("periodMonth", periodMonth);
      uploadRemittanceMutation.mutate(formData);
      return;
    }

    // Step 3: (should not be needed)
    toast({
      title: "Reconciliation",
      description: "Reconciliation runs automatically when you upload a remittance file.",
    });
  }, [
    stepperState.currentStep,
    providerHasAnyClaims,
    claimsFile,
    remittanceFile,
    providerName,
    periodYear,
    periodMonth,
    periodStatus,
    toast,
    uploadClaimsMutation,
    uploadRemittanceMutation,
  ]);

  const handleDeleteRun = (runId: number) => {
    const run = runs.find((r) => r.id === runId);
    const label = run
      ? `${run.providerName} – ${formatPeriodLabel(run.periodYear, run.periodMonth)}`
      : `Run #${runId}`;

    const ok = window.confirm(
      `Delete reconciliation run "${label}"?\n\nThis will remove the run and all its claims/remittances. This cannot be undone.`
    );
    if (!ok) return;
    deleteMutation.mutate(runId);
  };

  const issuesCountForSelectedRun = useMemo(() => {
    return claims.filter((c) => c.status !== "paid").length;
  }, [claims]);

  const handleExportIssues = () => {
    if (!selectedRunId) return;
    if (issuesCountForSelectedRun === 0) {
      toast({ title: "Nothing to export", description: "All claims for this run are fully paid." });
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
      const ok = window.confirm(
        `Delete all remittances for ${periodLabel}?\n\nThis cannot be undone.`
      );
      if (!ok) return;

      deletePeriodRemittancesMutation.mutate({
        providerName: period.providerName,
        year: period.periodYear,
        month: period.periodMonth,
      });
    }
  };

  const handleReplacePeriodFile = (period: PeriodSummary, type: "claims" | "remittances") => {
    setProviderName(period.providerName);
    setSelectedPeriodKey(`${period.periodYear}-${period.periodMonth}`);
    setPeriodYear(period.periodYear.toString());
    setPeriodMonth(period.periodMonth.toString());

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

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "paid":
        return (
          <Badge className="bg-green-500 text-white hover:bg-green-600">
            <CheckCircle2 className="w-3 h-3 mr-1" />
            Paid
          </Badge>
        );
      case "matched":
        return (
          <Badge className="bg-green-500 text-white hover:bg-green-600">
            <CheckCircle2 className="w-3 h-3 mr-1" />
            Matched
          </Badge>
        );
      case "partially_paid":
        return (
          <Badge className="bg-yellow-500 text-black hover:bg-yellow-600">
            <Clock className="w-3 h-3 mr-1" />
            Partial
          </Badge>
        );
      case "manual_review":
        return (
          <Badge className="bg-orange-500 text-white hover:bg-orange-600">
            <AlertCircle className="w-3 h-3 mr-1" />
            Review
          </Badge>
        );
      case "unpaid":
        return (
          <Badge className="bg-red-500 text-white hover:bg-red-600">
            <AlertCircle className="w-3 h-3 mr-1" />
            Unpaid
          </Badge>
        );
      case "awaiting_remittance":
      case "submitted":
      default:
        return (
          <Badge className="bg-blue-500 text-white hover:bg-blue-600">
            <Clock className="w-3 h-3 mr-1" />
            Awaiting Remittance
          </Badge>
        );
    }
  };

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

  const filteredRuns = useMemo(() => {
    if (statusFilter === "all") return runs;
    return runs.filter((run) => {
      const status = getRunStatus(run);
      if (statusFilter === "awaiting_remittance") return status === "awaiting_remittance";
      return status === "reconciled" || status === "pending_review";
    });
  }, [runs, statusFilter]);

  const filteredClaimsForRun = useMemo(() => {
    if (attentionFilter === "all") return claims;
    return claims.filter((c) => c.status !== "paid");
  }, [claims, attentionFilter]);

  // Cross-period clarifier UI states
  const showRemittanceBlockingWarning = useMemo(() => {
    return !!remittanceFile && !providerHasAnyClaims;
  }, [remittanceFile, providerHasAnyClaims]);

  const showCrossPeriodInfo = useMemo(() => {
    // If they’re uploading remittance for a period that has 0 claims, that’s OK
    if (!remittanceFile) return false;
    if (!selectedPeriodSummary) return false;
    return selectedPeriodSummary.totalClaims === 0 && providerHasAnyClaims;
  }, [remittanceFile, selectedPeriodSummary, providerHasAnyClaims]);

  /* ------------------------------------------------------------------------ */
  /* Render                                                                    */
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
              <h1 className="text-3xl font-bold text-white drop-shadow-2xl">
                Claim Reconciliation
              </h1>
              <p className="text-orange-100 mt-1 drop-shadow-lg">
                Upload claims and remittance files, then review matches, underpayments, and outstanding balances
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
        {/* KPI Cards */}
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
                    <span className="text-2xl font-bold text-gray-900">{stats.totalRuns}</span>
                    <span className="text-[11px] uppercase tracking-wide text-slate-500">runs</span>
                  </div>
                  <div className="mt-1 text-[11px] text-slate-500">
                    Latest period: {stats.lastPeriodLabel}
                  </div>
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
                    <span className="text-[11px] uppercase tracking-wide text-slate-500">rows</span>
                  </div>
                  <div className="mt-1 text-[11px] text-slate-500">Across all periods.</div>
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
                    <span className="text-[11px] uppercase tracking-wide text-orange-500">not fully paid</span>
                  </div>
                  <div className="mt-1 text-[11px] text-slate-500">Partial or unpaid claims.</div>
                </div>
              </div>
            </div>
          </div>

          {showHelp && (
            <Card className="border border-dashed border-slate-300 bg-slate-50/80">
              <CardContent className="pt-4 text-sm text-slate-700 space-y-2">
                <div className="font-medium text-slate-800">How the workflow works</div>
                <ul className="list-disc list-inside space-y-1">
                  <li>
                    <strong>Upload claims anytime:</strong> Claims are stored with <em>awaiting remittance</em>.
                  </li>
                  <li>
                    <strong>Upload remittance when it arrives:</strong> It will be matched against <strong>all outstanding claims across all months</strong>.
                  </li>
                  <li>
                    <strong>Review exceptions:</strong> Focus on <em>partial</em> and <em>unpaid</em> claims.
                  </li>
                </ul>
              </CardContent>
            </Card>
          )}
        </section>

        {/* Period Overview Cards */}
        {periodsSummary.length > 0 && (
          <Card className="border-2 border-slate-200/80 shadow-lg">
            <CardHeader className="pb-4 bg-gradient-to-r from-slate-50 to-white">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <CardTitle className="text-lg">Your Claim Periods</CardTitle>
                  <CardDescription>Click a period to work on uploads for that month</CardDescription>
                </div>

                <div className="flex items-center gap-3 flex-wrap">
                  <div className="flex items-center gap-2">
                    <Label className="text-sm font-medium text-slate-700">Provider:</Label>
                    <Select
                      value={providerName}
                      onValueChange={(value) => {
                        setProviderName(value);
                        setSelectedPeriodKey(null);
                        setInventoryPeriodFilter(null);
                        setInventoryPage(1);
                        setSelectedRunId(null);
                        setClaimsFile(null);
                        setRemittanceFile(null);
                      }}
                    >
                      <SelectTrigger className="w-[160px] bg-white">
                        <SelectValue placeholder="Select provider" />
                      </SelectTrigger>
                      <SelectContent>
                        {/* Keep simple but not “hard-coded” to only CIC */}
                        {Array.from(new Set(["CIC", ...runs.map((r) => r.providerName)])).map((p) => (
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
                        onValueChange={(value) => {
                          setPeriodYearFilter(value === "all" ? null : parseInt(value, 10));
                        }}
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

                  {selectedPeriodKey && (
                    <Badge className="bg-orange-500 text-white">
                      Selected: {formatPeriodLabel(parseInt(periodYear, 10), parseInt(periodMonth, 10))}
                    </Badge>
                  )}
                </div>
              </div>
            </CardHeader>

            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredPeriods.map((period) => {
                  const periodKey = `${period.periodYear}-${period.periodMonth}`;
                  const isSelected = selectedPeriodKey === periodKey;

                  const isReconciled = period.awaitingRemittance === 0 && period.totalClaims > 0;
                  const hasAwaitingClaims = period.awaitingRemittance > 0;

                  return (
                    <div
                      key={periodKey}
                      onClick={() => handleSelectPeriod(period.providerName, period.periodYear, period.periodMonth)}
                      className={cn(
                        "relative overflow-hidden rounded-xl border-2 p-4 transition-all hover:shadow-lg hover:-translate-y-1 group cursor-pointer",
                        isSelected
                          ? "border-orange-400 bg-orange-50/50 shadow-md ring-2 ring-orange-300"
                          : "border-slate-200 bg-white hover:border-slate-300"
                      )}
                    >
                      <div
                        className={cn(
                          "absolute top-0 right-0 w-24 h-24 rounded-full blur-2xl transition-all",
                          isReconciled
                            ? "bg-gradient-to-br from-green-400/20 to-emerald-500/20"
                            : hasAwaitingClaims
                            ? "bg-gradient-to-br from-blue-400/20 to-cyan-500/20"
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
                            <div className="text-xs text-slate-500">{period.providerName}</div>
                          </div>

                          <div className="flex items-center gap-2">
                            {isReconciled ? (
                              <CheckCircle2 className="w-5 h-5 text-green-600" />
                            ) : hasAwaitingClaims ? (
                              <Clock className="w-5 h-5 text-blue-600" />
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
                          {isReconciled ? (
                            <Badge className="bg-green-500 text-white hover:bg-green-600">
                              <CheckCircle2 className="w-3 h-3 mr-1" />
                              Reconciled
                            </Badge>
                          ) : hasAwaitingClaims ? (
                            <Badge className="bg-blue-500 text-white hover:bg-blue-600">
                              <Clock className="w-3 h-3 mr-1" />
                              Awaiting Remittance
                            </Badge>
                          ) : (
                            <Badge className="bg-slate-500 text-white hover:bg-slate-600">Processing</Badge>
                          )}
                        </div>

                        {!isReconciled && (
                          <div className="text-xs text-slate-500 space-y-1">
                            {period.awaitingRemittance > 0 && <div>• {period.awaitingRemittance} awaiting remittance</div>}
                            {period.matched > 0 && <div>• {period.matched} matched</div>}
                            {period.partiallyPaid > 0 && <div>• {period.partiallyPaid} partially paid</div>}
                            {period.unpaid > 0 && <div>• {period.unpaid} unpaid</div>}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {inventoryPeriodFilter && (
                <div className="mt-4 flex items-center justify-center">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setInventoryPeriodFilter(null);
                      setInventoryPage(1);
                    }}
                    className="gap-2"
                  >
                    <X className="w-4 h-4" />
                    Clear period filter
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Reconciliation Workflow */}
        <Card id="workflow-section" className="border-2 border-slate-200/80 shadow-lg">
          <CardHeader className="pb-4 bg-gradient-to-r from-orange-50 to-amber-50">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <CardTitle className="text-lg md:text-xl flex items-center gap-2">
                  <div className="w-1 h-6 bg-gradient-to-b from-orange-500 to-amber-500 rounded-full" />
                  Reconciliation Workflow
                </CardTitle>
                <CardDescription>
                  {selectedPeriodKey
                    ? getWorkflowDescription(providerName, formatPeriodLabel(parseInt(periodYear, 10), parseInt(periodMonth, 10)))
                    : "Select a period above to begin"}
                </CardDescription>
              </div>

              {selectedPeriodKey && (
                <div className="flex items-center gap-2 text-xs text-slate-600">
                  {periodStatusFetching ? (
                    <>
                      <Loader2 className="w-3 h-3 animate-spin" />
                      Refreshing…
                    </>
                  ) : null}
                </div>
              )}
            </div>
          </CardHeader>

          <CardContent className="space-y-6 pt-4">
            {selectedPeriodKey ? (
              <>
                <ReconciliationStepper
                  steps={stepperState.steps}
                  currentStep={stepperState.currentStep}
                  primaryActionLabel={stepperState.primaryAction}
                  primaryActionDisabled={
                    isUploading ||
                    isDeleting ||
                    stepperState.primaryDisabled ||
                    // block remittance upload if provider has zero claims
                    (stepperState.currentStep === 2 && !providerHasAnyClaims)
                  }
                  primaryActionLoading={isUploading}
                  onPrimaryAction={handleStepperAction}
                />

                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-slate-700">File Upload</h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FileDropzone
                      label="Claims File"
                      description="Upload claims submitted to insurance"
                      file={claimsFile}
                      onFileChange={setClaimsFile}
                      disabled={isUploading || isDeleting}
                      tintColor="blue"
                      icon={<FileText className="w-4 h-4" />}
                    />

                    <FileDropzone
                      label="Remittance File"
                      description={getRemittanceUploadDescription(providerName)}
                      file={remittanceFile}
                      onFileChange={setRemittanceFile}
                      disabled={isUploading || isDeleting}
                      tintColor="green"
                      icon={<DollarSign className="w-4 h-4" />}
                    />
                  </div>

                  {/* Blocking warning: no claims exist at all for provider */}
                  {showRemittanceBlockingWarning && (
                    <div className="flex items-start gap-3 px-4 py-3 bg-red-50 border-2 border-red-300 rounded-lg">
                      <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <div className="font-semibold text-sm text-red-800 mb-1">
                          No claims exist yet for {providerName}
                        </div>
                        <div className="text-xs text-red-700">
                          Upload claims first. Remittances can only be matched if there are stored claims.
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Non-blocking info: this period has 0 claims, but cross-period matching is OK */}
                  {showCrossPeriodInfo && (
                    <div className="flex items-start gap-3 px-4 py-3 bg-blue-50 border-2 border-blue-300 rounded-lg">
                      <Info className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <div className="font-semibold text-sm text-blue-800 mb-1">
                          No claims were submitted in this period — that’s OK
                        </div>
                        <div className="text-xs text-blue-700">
                          This remittance will still be matched against all outstanding {providerName} claims across all months.
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="text-center py-12">
                <AlertCircle className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                <p className="text-muted-foreground text-sm">
                  Click a period card above to select it and begin.
                </p>
              </div>
            )}
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
                      ["all", "All", ""],
                      ["awaiting_remittance", "Awaiting Remittance", "bg-blue-500 text-white"],
                      ["matched", "Matched", "bg-green-500 text-white"],
                      ["partially_paid", "Partially Paid", "bg-yellow-500 text-white"],
                      ["unpaid", "Unpaid", "bg-red-500 text-white"],
                    ] as const
                  ).map(([value, labelText, activeClass]) => (
                    <button
                      key={value}
                      type="button"
                      className={cn(
                        "px-4 py-2 rounded-full transition-all font-medium",
                        inventoryStatusFilter === value
                          ? value === "all"
                            ? "bg-white shadow-md text-slate-900"
                            : `shadow-md ${activeClass}`
                          : "text-slate-600 hover:text-slate-900"
                      )}
                      onClick={() => {
                        setInventoryStatusFilter(value as any);
                        setInventoryPage(1);
                      }}
                    >
                      {labelText}
                    </button>
                  ))}
                </div>
              </div>

              {periodsSummary.length > 0 && (
                <div className="mb-4 flex items-center gap-2 flex-wrap">
                  <Label className="text-sm font-medium text-slate-700">Period:</Label>
                  <Select
                    value={inventoryPeriodFilter || "all"}
                    onValueChange={(value) => {
                      setInventoryPeriodFilter(value === "all" ? null : value);
                      setInventoryPage(1);
                    }}
                  >
                    <SelectTrigger className="w-[280px] bg-white">
                      <SelectValue placeholder="All periods" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All periods</SelectItem>
                      {periodsSummary.map((period) => {
                        const key = `${period.periodYear}-${period.periodMonth}`;
                        return (
                          <SelectItem key={key} value={key}>
                            {formatPeriodLabel(period.periodYear, period.periodMonth)} ({period.totalClaims}{" "}
                            {pluralize(period.totalClaims, "claim")})
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {!summaryLoading && periodsSummary.length > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4 p-4 bg-slate-50 rounded-lg">
                  <div>
                    <div className="text-xs text-slate-500 mb-1">Total Claims</div>
                    <div className="text-xl font-bold text-slate-900">
                      {periodsSummary.reduce((sum, p) => sum + p.totalClaims, 0)}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500 mb-1">Awaiting Remittance</div>
                    <div className="text-xl font-bold text-blue-600">
                      {periodsSummary.reduce((sum, p) => sum + p.awaitingRemittance, 0)}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500 mb-1">Matched</div>
                    <div className="text-xl font-bold text-green-600">
                      {periodsSummary.reduce((sum, p) => sum + p.matched, 0)}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500 mb-1">Unpaid</div>
                    <div className="text-xl font-bold text-red-600">
                      {periodsSummary.reduce((sum, p) => sum + p.unpaid, 0)}
                    </div>
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
                          <TableRow
                            key={claim.id}
                            className="odd:bg-slate-50/40 hover:bg-slate-100/80 transition-colors"
                          >
                            <TableCell className="font-mono text-sm">{claim.memberNumber}</TableCell>
                            <TableCell>{claim.patientName || "N/A"}</TableCell>
                            <TableCell>{new Date(claim.serviceDate).toLocaleDateString()}</TableCell>
                            <TableCell className="text-sm">
                              {formatPeriodLabel(claim.periodYear, claim.periodMonth)}
                            </TableCell>
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

        {/* Reconciliation Runs List */}
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
            {runs.length > 0 && (
              <div className="py-3 mb-2">
                <div className="inline-flex items-center rounded-full bg-gradient-to-r from-slate-100 to-slate-50 p-1 text-xs shadow-sm border border-slate-200">
                  <button
                    type="button"
                    className={cn(
                      "px-4 py-2 rounded-full transition-all font-medium",
                      statusFilter === "all"
                        ? "bg-white shadow-md text-slate-900"
                        : "text-slate-600 hover:text-slate-900"
                    )}
                    onClick={() => setStatusFilter("all")}
                  >
                    All ({runs.length})
                  </button>
                  <button
                    type="button"
                    className={cn(
                      "px-4 py-2 rounded-full transition-all font-medium flex items-center gap-1",
                      statusFilter === "awaiting_remittance"
                        ? "bg-blue-500 shadow-md text-white"
                        : "text-slate-600 hover:text-slate-900"
                    )}
                    onClick={() => setStatusFilter("awaiting_remittance")}
                  >
                    <Clock className="w-3 h-3" />
                    Awaiting remittance ({runs.filter((r) => getRunStatus(r) === "awaiting_remittance").length})
                  </button>
                  <button
                    type="button"
                    className={cn(
                      "px-4 py-2 rounded-full transition-all font-medium flex items-center gap-1",
                      statusFilter === "reconciled"
                        ? "bg-green-500 shadow-md text-white"
                        : "text-slate-600 hover:text-slate-900"
                    )}
                    onClick={() => setStatusFilter("reconciled")}
                  >
                    <CheckCircle2 className="w-3 h-3" />
                    Reconciled (
                    {
                      runs.filter((r) => {
                        const s = getRunStatus(r);
                        return s === "reconciled" || s === "pending_review";
                      }).length
                    }
                    )
                  </button>
                </div>
              </div>
            )}

            {runsLoading ? (
              <p className="text-muted-foreground py-6 text-sm">Loading reconciliation runs…</p>
            ) : runs.length === 0 ? (
              <p className="text-muted-foreground py-6 text-sm">
                No reconciliation runs yet. Upload claims and remittances above.
              </p>
            ) : filteredRuns.length === 0 ? (
              <p className="text-muted-foreground py-6 text-sm">No runs match the selected status filter.</p>
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
                            // ✅ fix: clicking run selects provider + period AND opens run details
                            handleSelectPeriod(run.providerName, run.periodYear, run.periodMonth);
                            setSelectedRunId(run.id);
                            setAttentionFilter("issues");

                            const workflowSection = document.getElementById("workflow-section");
                            if (workflowSection) workflowSection.scrollIntoView({ behavior: "smooth" });
                          }}
                          className={cn(
                            "odd:bg-slate-50/40 hover:bg-emerald-50/60 transition-colors cursor-pointer",
                            selectedRunId === run.id &&
                              "border-l-4 border-l-emerald-500 bg-emerald-50/80 hover:bg-emerald-50/90"
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
                          <TableCell className="text-right">
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
                                    setAttentionFilter("issues");
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
          <Card className="border-2 border-slate-200/80 shadow-lg border-l-4 border-l-orange-400">
            <CardHeader className="pb-3 bg-gradient-to-r from-orange-50 to-amber-50">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <div className="w-1 h-6 bg-gradient-to-b from-orange-500 to-amber-500 rounded-full" />
                    Claims details — Run #{selectedRunId}
                  </CardTitle>
                  <CardDescription>Detailed view of reconciled claims for the selected run.</CardDescription>
                </div>
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
                        All claims ({claims.length})
                      </button>
                      <button
                        type="button"
                        className={cn(
                          "px-4 py-2 rounded-full transition-all font-medium flex items-center gap-1",
                          attentionFilter === "issues"
                            ? "bg-gradient-to-r from-orange-500 to-amber-500 shadow-md text-white"
                            : "text-slate-600 hover:text-slate-900"
                        )}
                        onClick={() => setAttentionFilter("issues")}
                      >
                        <AlertTriangle className="w-3 h-3" />
                        Needs attention ({issuesCountForSelectedRun})
                      </button>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="gap-2"
                        onClick={handleExportIssues}
                        disabled={!selectedRunId || issuesCountForSelectedRun === 0 || isExporting}
                      >
                        {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                        Export for CIC
                      </Button>
                    </div>
                  </div>

                  {filteredClaimsForRun.length === 0 && attentionFilter === "issues" ? (
                    <p className="text-muted-foreground py-6 text-sm">
                      All claims for this run are fully paid. There is nothing to follow up.
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
                          {filteredClaimsForRun.map((claim) => (
                            <TableRow
                              key={claim.id}
                              className="odd:bg-slate-50/40 hover:bg-slate-100/80 transition-colors"
                            >
                              <TableCell className="font-mono">{claim.memberNumber}</TableCell>
                              <TableCell>{claim.patientName || "N/A"}</TableCell>
                              <TableCell>{new Date(claim.serviceDate).toLocaleDateString()}</TableCell>
                              <TableCell>
                                {getCurrencyForDisplay(providerName, claim.currency)}{" "}
                                {parseFloat(claim.billedAmount).toFixed(2)}
                              </TableCell>
                              <TableCell>
                                {getCurrencyForDisplay(providerName, claim.currency)}{" "}
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
