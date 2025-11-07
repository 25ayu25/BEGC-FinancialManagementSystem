// client/src/pages/claim-reconciliation.tsx

import { useState, useMemo, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useDropzone } from "react-dropzone";
import { cn } from "@/lib/utils";

/* -------------------------------------------------------------------------- */
/* Shadcn/UI Components
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
/* Icons (from lucide-react)
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
} from "lucide-react";

/* -------------------------------------------------------------------------- */
/* Other Imports
/* -------------------------------------------------------------------------- */
import { useToast } from "@/hooks/use-toast";
import { API_BASE_URL } from "@/lib/constants";

/* -------------------------------------------------------------------------- */
/* Types
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
}

/* -------------------------------------------------------------------------- */
/* Session backup helper
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
/* Re-usable FileDropzone Component
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
          "flex flex-col items-center justify-center w-full h-24 border-2 border-slate-300 border-dashed rounded-lg cursor-pointer bg-white/60 hover:bg-slate-50 transition-colors",
          isDragActive && "border-primary bg-primary/10",
          disabled && "cursor-not-allowed opacity-60"
        )}
      >
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
/* Main Component
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

  /* ------------------------------------------------------------------------ */
  /* Data loading
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
  /* Simple derived stats for summary strip
  /* ------------------------------------------------------------------------ */

  const stats = useMemo(() => {
    if (!runs.length) {
      return {
        totalRuns: 0,
        totalClaims: 0,
        openItems: 0,
        lastPeriodLabel: "—",
      };
    }

    const totalRuns = runs.length;
    const totalClaims = runs.reduce(
      (sum, r) => sum + (r.totalClaimRows || 0),
      0
    );
    const openItems = runs.reduce(
      (sum, r) => sum + (r.partialMatched || 0) + (r.manualReview || 0),
      0
    );
    // Sort runs to get the latest one reliably
    const sortedRuns = [...runs].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    const latest = sortedRuns[0];
    const lastPeriodLabel = new Date(
      latest.periodYear,
      latest.periodMonth - 1
    ).toLocaleString("default", { month: "short", year: "numeric" });

    return { totalRuns, totalClaims, openItems, lastPeriodLabel };
  }, [runs]);

  /* ------------------------------------------------------------------------ */
  /* Mutations
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
          throw new Error(error.error || "Failed to delete reconciliation run");
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

  const isUploading = uploadMutation.isPending;
  const isDeleting = deleteMutation.isPending;

  /* ------------------------------------------------------------------------ */
  /* Handlers
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

  /* ====================================================================
   * ✨ FIX: Corrected the closing </Data_Card> to </Badge>
   * ====================================================================
  */
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "paid":
        return (
          <Badge className="bg-green-500 text-white">
            <CheckCircle2 className="w-3 h-3 mr-1" />
            Paid
          </Badge>
        );
      case "partially_paid":
        return (
          <Badge className="bg-yellow-500 text-black">
            <Clock className="w-3 h-3 mr-1" />
            Partial
          </Badge>
        );
      case "manual_review":
        return (
          <Badge className="bg-orange-500 text-white">
            <AlertCircle className="w-3 h-3 mr-1" />
            Review
          </Badge>
        );
      case "submitted":
      default:
        return <Badge variant="secondary">Submitted</Badge>;
    }
  };

  /* ------------------------------------------------------------------------ */
  /* Render
  /* ------------------------------------------------------------------------ */

  const selectedRun = runs.find((r) => r.id === selectedRunId) || null;
  const isFormDisabled = isUploading || isDeleting;
  const isSubmitDisabled =
    !claimsFile || !remittanceFile || isUploading || isDeleting;

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-10">
      {/* Page title + summary */}
      <section className="space-y-4 pt-2">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-2">
          <div>
            <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">
              Claim Reconciliation
            </h1>
            <p className="text-sm md:text-base text-muted-foreground max-w-2xl">
              Upload the claims you sent to the insurer and their remittance
              report, then review matches, underpayments, and outstanding
              balances.
            </p>
          </div>

          <div className="hidden md:flex flex-col items-end text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              Reconciliation workspace
            </span>
            {runsFetching && (
              <span className="mt-1 text-[11px] uppercase tracking-wide">
                Refreshing data…
              </span>
            )}
          </div>
        </div>

        {/* KPI strip */}
        <div className="grid gap-3 md:grid-cols-3">
          {/* Runs Card */}
          <div className="rounded-xl border bg-white px-4 py-3">
            <div className="text-xs font-medium text-slate-500">Runs</div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-lg font-semibold">{stats.totalRuns}</span>
              <span className="text-[11px] uppercase tracking-wide text-slate-500">
                total
              </span>
            </div>
            <div className="mt-1 text-[11px] text-slate-500">
              Latest period: {stats.lastPeriodLabel}
            </div>
          </div>

          {/* Claims Reconciled Card */}
          <div className="rounded-xl border bg-white px-4 py-3">
            <div className="text-xs font-medium text-slate-500">
              Claims reconciled
            </div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-lg font-semibold">
                {stats.totalClaims.toLocaleString()}
              </span>
              <span className="text-[11px] uppercase tracking-wide text-slate-500">
                rows processed
              </span>
            </div>
            <div className="mt-1 text-[11px] text-slate-500">
              Across all uploaded periods.
            </div>
          </div>

          {/* Items Needing Attention Card */}
          <div className="rounded-xl border bg-white px-4 py-3">
            <div className="text-xs font-medium text-slate-500">
              Items needing attention
            </div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-lg font-semibold text-orange-500">
                {stats.openItems}
              </span>
              <span className="text-[11px] uppercase tracking-wide text-orange-500">
                open
              </span>
            </div>
            <div className="mt-1 text-[11px] text-slate-500">
              Partial or manual-review claims.
            </div>
          </div>
        </div>
      </section>

      {/* Upload Form */}
      <Card className="border border-slate-200/80 shadow-sm">
        <CardHeader className="space-y-1 pb-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle className="text-lg md:text-xl">
                Upload reconciliation files
              </CardTitle>
              <CardDescription>
                Step 1 &mdash; choose the period and upload the Claims Submitted
                and Remittance Advice Excel files.
              </CardDescription>
            </div>
            <div className="hidden md:flex flex-col items-end text-xs text-muted-foreground">
              <span>• Only Excel files (.xlsx, .xls).</span>
              <span>• Member numbers &amp; dates should align.</span>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6 pt-0">
          <TooltipProvider delayDuration={100}>
            <form onSubmit={handleSubmit} className="space-y-6">
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

              {/* Submit Button Row */}
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 pt-1">
                <Tooltip>
                  <TooltipTrigger asChild>
                    {/* This span wrapper is needed for the tooltip to work on a disabled button */}
                    <div className="inline-block">
                      <Button
                        type="submit"
                        size="lg"
                        disabled={isSubmitDisabled}
                        className="w-full md:w-auto font-semibold shadow-md gap-2 px-6"
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
                      <p>
                        Please upload both a Claims and Remittance file.
                      </p>
                    </TooltipContent>
                  )}
                </Tooltip>

                <p className="text-xs text-muted-foreground md:text-right max-w-md">
                  Uploading again for the same period will create a new run.
                  All runs are kept so you can compare and audit over time.
                </p>
              </div>
            </form>
          </TooltipProvider>
        </CardContent>
      </Card>

      {/* Reconciliation Runs List */}
      <Card className="border border-slate-200/80 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <CardTitle className="text-lg">Reconciliation history</CardTitle>
              <CardDescription>
                Previous reconciliation runs for all providers.
              </CardDescription>
            </div>
            {runsFetching && (
              <span className="text-xs text-muted-foreground">Refreshing…</span>
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
                  {runs.map((run) => (
                    <TableRow
                      key={run.id}
                      className={
                        selectedRunId === run.id
                          ? "bg-slate-50/80 hover:bg-slate-100"
                          : undefined
                      }
                    >
                      <TableCell className="font-medium">
                        {run.providerName}
                      </TableCell>
                      <TableCell>
                        {new Date(
                          run.periodYear,
                          run.periodMonth - 1
                        ).toLocaleString("default", {
                          month: "short",
                          year: "numeric",
                        })}
                      </TableCell>
                      <TableCell>{run.totalClaimRows}</TableCell>
                      <TableCell>{run.totalRemittanceRows}</TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className="text-xs font-semibold"
                        >
                          {run.autoMatched} Matched
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className="bg-yellow-500 text-black hover:bg-yellow-500/90 text-xs font-semibold">
                          {run.partialMatched} Partial
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className="bg-orange-500 text-white hover:bg-orange-500/90 text-xs font-semibold">
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
                              onClick={() => setSelectedRunId(run.id)}
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
                                isDeleting && deleteMutation.variables === run.id
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
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Claims Details */}
      {selectedRunId && (
        <Card className="border border-slate-200/80 shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <CardTitle className="text-lg">
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
                    {claims.map((claim) => (
                      <TableRow key={claim.id}>
                        <TableCell className="font-mono">
                          {claim.memberNumber}
                        </TableCell>
                        <TableCell>{claim.patientName || "N/A"}</TableCell>
                        <TableCell>
                          {new Date(claim.serviceDate).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          SSP {parseFloat(claim.billedAmount).toFixed(2)}
                        </TableCell>
                        <TableCell>
                          SSP {parseFloat(claim.amountPaid).toFixed(2)}
                        </TableCell>
                        <TableCell>{getStatusBadge(claim.status)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
