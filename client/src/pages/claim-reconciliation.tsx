import { useState, useMemo, useCallback } from "react";
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
import { Input } from "@/components/ui/input";
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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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
} from "lucide-react";

/* -------------------------------------------------------------------------- */
/* Other Imports */
/* -------------------------------------------------------------------------- */
import { useToast } from "@/hooks/use-toast";
import { API_BASE_URL } from "@/lib/constants";
import PageHeader from "@/components/layout/PageHeader";
import HeaderAction from "@/components/layout/HeaderAction";

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
/* Re-usable FileDropzone Component */
/* -------------------------------------------------------------------------- */
interface FileDropzoneProps {
  file: File | null;
  onFileChange: (file: File | null) => void;
  label: string;
  description: string;
  disabled?: boolean;
}

function FileDropzone({
  file,
  onFileChange,
  label,
  description,
  disabled,
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
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [
        ".xlsx",
      ],
      "application/vnd.ms-excel": [".xls"],
    },
    maxFiles: 1,
    multiple: false,
    disabled,
  });

  // State 1: File is selected
  if (file) {
    return (
      <div className="space-y-2">
        <Label>{label}</Label>
        <div className="flex items-center gap-2 rounded-md border border-slate-200 bg-white/60 p-3">
          <FileSpreadsheet className="w-5 h-5 text-emerald-500 shrink-0" />
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

  // State 2: Empty / Dragging
  return (
    <div className="space-y-2">
      <Label htmlFor={label}>{label}</Label>
      <div
        {...getRootProps()}
        className={cn(
          "flex flex-col items-center justify-center w-full h-24 border-2 border-slate-300 border-dashed rounded-lg cursor-pointer bg-white/60 hover:bg-slate-50 transition-all relative group",
          isDragActive && "border-primary bg-primary/10",
          disabled && "cursor-not-allowed opacity-60"
        )}
      >
        {/* Gradient border effect on hover */}
        <div className="absolute inset-0 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity bg-gradient-to-r from-orange-400 via-amber-400 to-orange-400 -z-10 blur-sm" />
        <input {...getInputProps()} id={label} />
        {isDragActive ? (
          <p className="text-sm font-medium text-primary">
            Drop the file here...
          </p>
        ) : (
          <div className="text-center">
            <Upload className="w-5 h-5 text-slate-500 mx-auto mb-1" />
            <p className="text-sm text-slate-600">
              <span className="font-semibold">Click to upload</span> or drag &
              drop
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

  // Form state
  const [providerName, setProviderName] = useState("CIC");
  const [periodYear, setPeriodYear] = useState(
    new Date().getFullYear().toString()
  );
  const [periodMonth, setPeriodMonth] = useState(
    (new Date().getMonth() + 1).toString()
  );
  const [claimsFile, setClaimsFile] = useState<File | null>(null);
  const [remittanceFile, setRemittanceFile] = useState<File | null>(null);
  const [selectedRunId, setSelectedRunId] = useState<number | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  const [attentionFilter, setAttentionFilter] = useState<"all" | "issues">(
    "issues"
  );

  // Generate stable particle positions for header
  const particles = useMemo(() => {
    return Array.from({ length: 6 }, (_, i) => ({
      left: `${Math.random() * 100}%`,
      top: `${Math.random() * 100}%`,
      duration: 3 + Math.random() * 4,
      delay: Math.random() * 2,
    }));
  }, []);

  /* ------------------------------------------------------------------------ */
  /* Data loading */
  /* ------------------------------------------------------------------------ */

  const {
    data: runs = [],
    isLoading: runsLoading,
    isFetching: runsFetching,
  } = useQuery<ReconRun[]>({
    queryKey: ["/api/claim-reconciliation/runs"],
  });

  const { data: claims = [], isLoading: claimsLoading } = useQuery<
    ClaimDetail[]
  >({
    queryKey: [`/api/claim-reconciliation/runs/${selectedRunId}/claims`],
    enabled: !!selectedRunId,
  });

  /* ------------------------------------------------------------------------ */
  /* Simple derived stats for summary strip */
  /* ------------------------------------------------------------------------ */

  const stats = useMemo(() => {
    if (!runs.length) {
      return {
        totalRuns: 0,
        totalClaims: 0,
        problemClaims: 0,
        lastPeriodLabel: "—",
        latestRunId: null as number | null,
      };
    }

    const totalRuns = runs.length;
    const totalClaims = runs.reduce(
      (sum, r) => sum + (r.totalClaimRows || 0),
      0
    );

    // "Problem" = not fully paid = totalClaims - fullyPaid (autoMatched)
    const problemClaims = runs.reduce((sum, r) => {
      const total = r.totalClaimRows || 0;
      const fullyPaid = r.autoMatched || 0;
      return sum + Math.max(total - fullyPaid, 0);
    }, 0);

    // Sort runs to get the latest one reliably
    const sortedRuns = [...runs].sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    const latest = sortedRuns[0];
    const lastPeriodLabel = new Date(
      latest.periodYear,
      latest.periodMonth - 1
    ).toLocaleString("default", { month: "short", year: "numeric" });

    return {
      totalRuns,
      totalClaims,
      problemClaims,
      lastPeriodLabel,
      latestRunId: latest?.id ?? null,
    };
  }, [runs]);

  /* ------------------------------------------------------------------------ */
  /* Mutations */
  /* ------------------------------------------------------------------------ */

  // Upload & reconcile
  const uploadMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const uploadUrl = new URL(
        "/api/claim-reconciliation/upload",
        API_BASE_URL
      ).toString();

      const headers: HeadersInit = {};
      const backup = readSessionBackup();
      if (backup) {
        headers["x-session-token"] = backup;
      }

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
        } else {
          const text = await response.text();
          throw new Error(
            `Upload failed (${response.status}): ${text.substring(0, 120)}`
          );
        }
      }

      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Reconciliation completed",
        description: `Matched ${data.summary.autoMatched} claims automatically. ${data.summary.partialMatched} need manual review.`,
      });

      queryClient.invalidateQueries({
        queryKey: ["/api/claim-reconciliation/runs"],
      });

      setSelectedRunId(data.runId);
      setClaimsFile(null);
      setRemittanceFile(null);
      setAttentionFilter("issues");
    },
    onError: (error: Error) => {
      toast({
        title: "Upload failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Delete reconciliation run
  const deleteMutation = useMutation({
    mutationFn: async (runId: number) => {
      const url = new URL(
        `/api/claim-reconciliation/runs/${runId}`,
        API_BASE_URL
      ).toString();

      const headers: HeadersInit = {};
      const backup = readSessionBackup();
      if (backup) {
        headers["x-session-token"] = backup;
      }

      const response = await fetch(url, {
        method: "DELETE",
        credentials: "include",
        headers,
      });

      if (!response.ok) {
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          const error = await response.json();
          throw new Error(
            error.error || "Failed to delete reconciliation run"
          );
        } else {
          const text = await response.text();
          throw new Error(
            `Failed to delete reconciliation run (${response.status}): ${text.substring(
              0,
              120
            )}`
          );
        }
      }

      return response.json();
    },
    onSuccess: (_data, runId) => {
      toast({
        title: "Reconciliation deleted",
        description: "The run and its related data were removed.",
      });

      if (selectedRunId === runId) {
        setSelectedRunId(null);
      }

      queryClient.invalidateQueries({
        queryKey: ["/api/claim-reconciliation/runs"],
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Delete failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Export problem claims (partial / unpaid) for CIC
  const exportIssuesMutation = useMutation({
    mutationFn: async (runId: number) => {
      const url = new URL(
        `/api/claim-reconciliation/runs/${runId}/issues/export`,
        API_BASE_URL
      ).toString();

      const headers: HeadersInit = {};
      const backup = readSessionBackup();
      if (backup) {
        headers["x-session-token"] = backup;
      }

      const response = await fetch(url, {
        method: "GET",
        credentials: "include",
        headers,
      });

      if (!response.ok) {
        const contentType = response.headers.get("content-type") || "";
        if (contentType.includes("application/json")) {
          const error = await response.json();
          throw new Error(error.error || "Export failed");
        }
        const text = await response.text();
        throw new Error(
          `Export failed (${response.status}): ${text.substring(0, 120)}`
        );
      }

      const contentType = response.headers.get("content-type") || "";
      if (contentType.includes("application/json")) {
        const error = await response.json();
        throw new Error(error.error || "Export failed");
      }

      const blob = await response.blob();
      const disposition =
        response.headers.get("content-disposition") || "";
      let fileName = "claim_issues.xlsx";
      const match = disposition.match(/filename="?([^"]+)"?/i);
      if (match?.[1]) {
        fileName = match[1];
      }

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

      toast({
        title: "Export ready",
        description: "Problem claims were exported for CIC.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Export failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const isUploading = uploadMutation.isPending;
  const isDeleting = deleteMutation.isPending;
  const isExporting = exportIssuesMutation.isPending;

  /* ------------------------------------------------------------------------ */
  /* Handlers */
  /* ------------------------------------------------------------------------ */

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!claimsFile || !remittanceFile) {
      toast({
        title: "Missing files",
        description: "Please select both the claims and remittance files.",
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
  };

  const handleDeleteRun = (runId: number) => {
    const run = runs.find((r) => r.id === runId);
    const label = run
      ? `${run.providerName} – ${new Date(
          run.periodYear,
          run.periodMonth - 1
        ).toLocaleString("default", { month: "short", year: "numeric" })}`
      : `Run #${runId}`;

    const ok = window.confirm(
      `Delete reconciliation run "${label}"?\n\nThis will remove the run and all its claims/remittances. This cannot be undone.`
    );
    if (!ok) return;

    deleteMutation.mutate(runId);
  };

  const handleExportIssues = () => {
    if (!selectedRunId) return;
    if (issuesCountForSelected === 0) {
      toast({
        title: "Nothing to export",
        description: "All claims for this run are fully paid.",
      });
      return;
    }
    exportIssuesMutation.mutate(selectedRunId);
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
      case "submitted":
      default:
        return (
          <Badge className="bg-slate-500 text-white hover:bg-slate-600">
            <FileSpreadsheet className="w-3 h-3 mr-1" />
            Submitted
          </Badge>
        );
    }
  };

  /* ------------------------------------------------------------------------ */
  /* Derived data for current run                                             */
  /* ------------------------------------------------------------------------ */

  const selectedRun = runs.find((r) => r.id === selectedRunId) || null;
  const isFormDisabled = isUploading || isDeleting;
  const isSubmitDisabled =
    !claimsFile || !remittanceFile || isUploading || isDeleting;

  const issuesCountForSelected = useMemo(
    () => claims.filter((c) => c.status !== "paid").length,
    [claims]
  );

  const filteredClaims = useMemo(() => {
    if (attentionFilter === "all") return claims;
    return claims.filter((c) => c.status !== "paid");
  }, [claims, attentionFilter]);

  /* ------------------------------------------------------------------------ */
  /* Render */
  /* ------------------------------------------------------------------------ */

  return (
    <>
      {/* Premium Gradient Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-orange-600 via-amber-500 to-orange-400 p-8 shadow-2xl">
        {/* Animated mesh/dot pattern background */}
        <div className="absolute inset-0 opacity-20">
          <div className="absolute inset-0 reconciliation-header-pattern" />
        </div>

        {/* Floating particles effect */}
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

        {/* Glass layer with backdrop blur */}
        <div className="absolute inset-0 backdrop-blur-[2px] bg-white/5" />
        
        {/* Animated gradient accent line at bottom */}
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-orange-500 via-amber-500 to-orange-400 animate-pulse" />

        {/* Content */}
        <div className="relative z-10">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-white drop-shadow-2xl">
                Claim Reconciliation
              </h1>
              <p className="text-orange-100 mt-1 drop-shadow-lg">
                Upload claim and remittance files, then review matches, underpayments, and outstanding balances
              </p>
            </div>

            <button
              onClick={() => setShowHelp((v) => !v)}
              className="flex items-center gap-2 px-4 py-2 bg-white/95 backdrop-blur-md border-white/30 hover:bg-white transition-all hover:shadow-xl hover:scale-105 rounded-lg text-orange-700 font-medium text-sm"
            >
              <Info className="w-4 h-4" />
              <span className="hidden sm:inline">
                {showHelp ? "Hide help" : "Show help"}
              </span>
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto space-y-8 pb-10 pt-6">
        <section className="space-y-4">

        {/* Enhanced KPI Cards */}
        <div className="grid gap-4 md:grid-cols-3">
          {/* Reconciliations done */}
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
                  <span className="text-2xl font-bold text-gray-900">
                    {stats.totalRuns}
                  </span>
                  <span className="text-[11px] uppercase tracking-wide text-slate-500">
                    periods checked
                  </span>
                </div>
                <div className="mt-1 text-[11px] text-slate-500">
                  Latest period: {stats.lastPeriodLabel}
                </div>
              </div>
            </div>
          </div>

          {/* Claims processed */}
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
                  <span className="text-2xl font-bold text-gray-900">
                    {stats.totalClaims.toLocaleString()}
                  </span>
                  <span className="text-[11px] uppercase tracking-wide text-slate-500">
                    rows in total
                  </span>
                </div>
                <div className="mt-1 text-[11px] text-slate-500">
                  Across all uploads.
                </div>
              </div>
            </div>
          </div>

          {/* Claims to follow up - Warning Style */}
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
                  <span className="text-2xl font-bold text-orange-600">
                    {stats.problemClaims}
                  </span>
                  <span className="text-[11px] uppercase tracking-wide text-orange-500">
                    not fully paid
                  </span>
                </div>
                <div className="mt-1 text-[11px] text-slate-500">
                  Partial or unpaid claims to discuss with CIC.
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Collapsible Help Panel */}
        {showHelp && (
          <Card className="border border-dashed border-slate-300 bg-slate-50/80">
            <CardContent className="pt-4 text-sm text-slate-700 space-y-2">
              <div className="font-medium text-slate-800">
                How reconciliation works
              </div>
              <ul className="list-disc list-inside space-y-1">
                <li>
                  Upload one Claims Submitted file and one Remittance file.
                </li>
                <li>
                  Only Excel files are supported (<code>.xlsx</code> or{" "}
                  <code>.xls</code>).
                </li>
                <li>
                  Member numbers and service dates should match between the two
                  files.
                </li>
                <li>
                  Re-uploading for the same period will create a new run; older
                  runs stay available for audit.
                </li>
                <li>
                  Use the history table below to open a run, review unmatched
                  items, or delete test runs.
                </li>
              </ul>
            </CardContent>
          </Card>
        )}
      </section>

      {/* Upload Form */}
      <Card className="border-2 border-slate-200/80 shadow-lg hover:shadow-xl transition-shadow">
        <CardHeader className="space-y-1 pb-4 bg-gradient-to-r from-slate-50 to-white">
          <div>
            <CardTitle className="text-lg md:text-xl">
              Upload reconciliation files
            </CardTitle>
            <CardDescription>
              Choose the period and upload the Claims Submitted and Remittance
              Advice Excel exports.
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent className="space-y-6 pt-0">
          <TooltipProvider delayDuration={100}>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* 6-column grid for form fields */}
              <div className="grid grid-cols-1 md:grid-cols-6 gap-x-6 gap-y-6">
                {/* Row 1: Settings */}
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="provider">Insurance provider</Label>
                  <Select
                    value={providerName}
                    onValueChange={setProviderName}
                    disabled={isFormDisabled}
                  >
                    <SelectTrigger
                      id="provider"
                      className="bg-white/60 focus-visible:ring-slate-300"
                    >
                      <SelectValue placeholder="Select provider" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="CIC">CIC</SelectItem>
                      <SelectItem value="UAP">UAP</SelectItem>
                      <SelectItem value="CIGNA">CIGNA</SelectItem>
                      <SelectItem value="OTHER">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="year">Period year</Label>
                  <Input
                    id="year"
                    type="number"
                    value={periodYear}
                    onChange={(e) => setPeriodYear(e.target.value)}
                    min="2020"
                    max="2099"
                    disabled={isFormDisabled}
                    className="bg-white/60 focus-visible:ring-slate-300"
                  />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="month">Period month</Label>
                  <Select
                    value={periodMonth}
                    onValueChange={setPeriodMonth}
                    disabled={isFormDisabled}
                  >
                    <SelectTrigger
                      id="month"
                      className="bg-white/60 focus-visible:ring-slate-300"
                    >
                      <SelectValue placeholder="Select month" />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                        <SelectItem key={m} value={m.toString()}>
                          {new Date(2000, m - 1).toLocaleString("default", {
                            month: "long",
                          })}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Row 2: Files */}
                <div className="md:col-span-3">
                  <FileDropzone
                    label="Claims submitted file"
                    description="The billing export you send to CIC (one row per claim)."
                    file={claimsFile}
                    onFileChange={setClaimsFile}
                    disabled={isFormDisabled}
                  />
                </div>

                <div className="md:col-span-3">
                  <FileDropzone
                    label="Remittance advice file"
                    description="The payment / remittance report you receive back from CIC."
                    file={remittanceFile}
                    onFileChange={setRemittanceFile}
                    disabled={isFormDisabled}
                  />
                </div>
              </div>

              {/* Primary action */}
              <div className="flex flex-col gap-3 pt-1">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="inline-block">
                      <Button
                        type="submit"
                        size="lg"
                        disabled={isSubmitDisabled}
                        className="w-full md:w-auto font-semibold shadow-lg gap-2 px-6 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white border-0"
                      >
                        {isUploading ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Processing…
                          </>
                        ) : (
                          <>
                            <Upload className="w-4 h-4" />
                            Upload &amp; Reconcile
                          </>
                        )}
                      </Button>
                    </div>
                  </TooltipTrigger>
                  {isSubmitDisabled && !isUploading && (
                    <TooltipContent>
                      <p>Please upload both a Claims and Remittance file.</p>
                    </TooltipContent>
                  )}
                </Tooltip>

                <p className="text-xs text-muted-foreground max-w-md">
                  Uploading again for the same period will create a new run.
                  All runs are kept so you can compare and audit over time.
                </p>
              </div>
            </form>
          </TooltipProvider>
        </CardContent>
      </Card>

      {/* Reconciliation Runs List */}
      <Card className="border-2 border-slate-200/80 shadow-lg">
        <CardHeader className="pb-3 bg-gradient-to-r from-slate-50 to-white">
          <div className="flex items-center justify-between gap-2">
            <div>
              <CardTitle className="text-lg">Reconciliation history</CardTitle>
              <CardDescription>
                Previous reconciliation runs for all providers.
              </CardDescription>
            </div>
            {runsFetching && (
              <span className="text-xs text-muted-foreground">
                Refreshing…
              </span>
            )}
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {runsLoading ? (
            <p className="text-muted-foreground py-6 text-sm">
              Loading reconciliation runs…
            </p>
          ) : runs.length === 0 ? (
            <p className="text-muted-foreground py-6 text-sm">
              No reconciliation runs yet. Upload your first pair of files
              above.
            </p>
          ) : (
            <div className="w-full overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Provider</TableHead>
                    <TableHead>Period</TableHead>
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
                  {runs.map((run) => {
                    const periodLabel = new Date(
                      run.periodYear,
                      run.periodMonth - 1
                    ).toLocaleString("default", {
                      month: "short",
                      year: "numeric",
                    });
                    const isLatest = stats.latestRunId === run.id;

                    return (
                      <TableRow
                        key={run.id}
                        className={cn(
                          "odd:bg-slate-50/40 hover:bg-emerald-50/60 transition-colors cursor-pointer",
                          selectedRunId === run.id &&
                            "border-l-4 border-l-emerald-500 bg-emerald-50/80 hover:bg-emerald-50/90"
                        )}
                      >
                        <TableCell className="font-medium">
                          {run.providerName}
                        </TableCell>
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
                        <TableCell>
                          {new Date(run.createdAt).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="w-8 h-8"
                                disabled={isDeleting}
                              >
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
                                className={cn(
                                  "cursor-pointer",
                                  selectedRunId === run.id && "bg-slate-100"
                                )}
                              >
                                View details
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-red-600 focus:text-red-600 focus:bg-red-50 cursor-pointer"
                                onClick={() => handleDeleteRun(run.id)}
                                disabled={
                                  isDeleting &&
                                  deleteMutation.variables === run.id
                                }
                              >
                                {isDeleting &&
                                deleteMutation.variables === run.id ? (
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
                  Claims details &mdash; Run #{selectedRunId}
                </CardTitle>
                <CardDescription>
                  Detailed view of reconciled claims for the selected run.
                </CardDescription>
              </div>

              {selectedRun && (
                <div className="text-xs text-muted-foreground text-right">
                  <div className="font-medium">
                    {selectedRun.providerName} &middot;{" "}
                    {new Date(
                      selectedRun.periodYear,
                      selectedRun.periodMonth - 1
                    ).toLocaleString("default", {
                      month: "short",
                      year: "numeric",
                    })}
                  </div>
                  <div>
                    {selectedRun.totalClaimRows} claims,{" "}
                    {selectedRun.totalRemittanceRows} remittances
                  </div>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            {claimsLoading ? (
              <p className="text-muted-foreground py-6 text-sm">
                Loading claims…
              </p>
            ) : claims.length === 0 ? (
              <p className="text-muted-foreground py-6 text-sm">
                No claims found for this run.
              </p>
            ) : (
              <>
                {/* Filter + Export row */}
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
                      Needs attention ({issuesCountForSelected})
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="gap-2"
                      onClick={handleExportIssues}
                      disabled={
                        !selectedRunId ||
                        issuesCountForSelected === 0 ||
                        isExporting
                      }
                    >
                      {isExporting ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Download className="w-4 h-4" />
                      )}
                      Export for CIC
                    </Button>
                  </div>
                </div>

                {filteredClaims.length === 0 &&
                attentionFilter === "issues" ? (
                  <p className="text-muted-foreground py-6 text-sm">
                    All claims for this period are fully paid. There is nothing
                    to follow up.
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
                            <TableCell className="font-mono">
                              {claim.memberNumber}
                            </TableCell>
                            <TableCell>
                              {claim.patientName || "N/A"}
                            </TableCell>
                            <TableCell>
                              {new Date(
                                claim.serviceDate
                              ).toLocaleDateString()}
                            </TableCell>
                            <TableCell>
                              {/* Currency fallback to SSP if not available */}
                              {claim.currency || "SSP"} {parseFloat(claim.billedAmount).toFixed(2)}
                            </TableCell>
                            <TableCell>
                              {claim.currency || "SSP"} {parseFloat(claim.amountPaid).toFixed(2)}
                            </TableCell>
                            <TableCell>
                              {getStatusBadge(claim.status)}
                            </TableCell>
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
