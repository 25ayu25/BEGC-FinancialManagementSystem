// client/src/pages/claim-reconciliation.tsx

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  Clock,
  Trash2,
  Loader2,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { API_BASE_URL } from "@/lib/constants";

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
/* Session backup helper (same key as in queryClient.ts)                      */
/* -------------------------------------------------------------------------- */

const BACKUP_KEY = "user_session_backup";

function readSessionBackup(): string | null {
  try {
    return localStorage.getItem(BACKUP_KEY);
  } catch {
    return null;
  }
}

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
  /* Data loading                                                             */
  /* ------------------------------------------------------------------------ */

  // All reconciliation runs
  const {
    data: runs = [],
    isLoading: runsLoading,
    isFetching: runsFetching,
  } = useQuery<ReconRun[]>({
    queryKey: ["/api/claim-reconciliation/runs"],
  });

  // Claims for selected run
  const { data: claims = [], isLoading: claimsLoading } = useQuery<
    ClaimDetail[]
  >({
    queryKey: [`/api/claim-reconciliation/runs/${selectedRunId}/claims`],
    enabled: !!selectedRunId,
  });

  /* ------------------------------------------------------------------------ */
  /* Mutations                                                                */
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
        // Same fallback header that axios sends
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
  /* Handlers                                                                 */
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

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "paid":
        return (
          <Badge className="bg-green-500">
            <CheckCircle2 className="w-3 h-3 mr-1" />
            Paid
          </Badge>
        );
      case "partially_paid":
        return (
          <Badge className="bg-yellow-500">
            <Clock className="w-3 h-3 mr-1" />
            Partial
          </Badge>
        );
      case "manual_review":
        return (
          <Badge className="bg-orange-500">
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
  /* Render                                                                   */
  /* ------------------------------------------------------------------------ */

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Claim Reconciliation
          </h1>
          <p className="text-muted-foreground">
            Upload the claims you sent to the insurer and their remittance
            report, then review matches and outstanding balances.
          </p>
        </div>

        <div className="text-xs md:text-sm text-muted-foreground md:text-right">
          <div className="font-medium">Tips</div>
          <div>• Only Excel files (.xlsx, .xls) are supported.</div>
          <div>• Make sure member numbers and dates match between files.</div>
        </div>
      </div>

      {/* Upload Form */}
      <Card className="border border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle>Upload Reconciliation Files</CardTitle>
          <CardDescription>
            Select the Claims Submitted and Remittance Advice Excel files. The
            system will create a reconciliation run for the chosen period.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="provider">Insurance Provider</Label>
                <Select
                  value={providerName}
                  onValueChange={setProviderName}
                  disabled={isUploading || isDeleting}
                >
                  <SelectTrigger id="provider">
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

              <div className="space-y-2">
                <Label htmlFor="year">Period Year</Label>
                <Input
                  id="year"
                  type="number"
                  value={periodYear}
                  onChange={(e) => setPeriodYear(e.target.value)}
                  min="2020"
                  max="2099"
                  disabled={isUploading || isDeleting}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="month">Period Month</Label>
                <Select
                  value={periodMonth}
                  onValueChange={setPeriodMonth}
                  disabled={isUploading || isDeleting}
                >
                  <SelectTrigger id="month">
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
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="claims-file">Claims Submitted File</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="claims-file"
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={(e) =>
                      setClaimsFile(e.target.files?.[0] || null)
                    }
                    disabled={isUploading || isDeleting}
                  />
                  {claimsFile && (
                    <FileSpreadsheet className="w-5 h-5 text-green-500" />
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  The billing export you send to CIC (one row per claim).
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="remittance-file">Remittance Advice File</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="remittance-file"
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={(e) =>
                      setRemittanceFile(e.target.files?.[0] || null)
                    }
                    disabled={isUploading || isDeleting}
                  />
                  {remittanceFile && (
                    <FileSpreadsheet className="w-5 h-5 text-green-500" />
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  The payment / remittance report you receive back from CIC.
                </p>
              </div>
            </div>

            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <Button
                type="submit"
                size="lg"
                disabled={
                  !claimsFile ||
                  !remittanceFile ||
                  isUploading ||
                  isDeleting
                }
                className="w-full md:w-auto font-semibold shadow-md gap-2"
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

              <p className="text-xs text-muted-foreground md:text-right">
                Uploading again for the same period will create a new run.
                Historical runs are kept so you can compare or audit later.
              </p>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Reconciliation Runs List */}
      <Card className="border border-slate-200 shadow-sm">
        <CardHeader>
          <div className="flex items-center justify-between gap-2">
            <div>
              <CardTitle>Reconciliation History</CardTitle>
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
        <CardContent>
          {runsLoading ? (
            <p className="text-muted-foreground">Loading runs…</p>
          ) : runs.length === 0 ? (
            <p className="text-muted-foreground">
              No reconciliation runs yet. Upload your first pair of files above.
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
                    <TableHead>Auto Matched</TableHead>
                    <TableHead>Partial</TableHead>
                    <TableHead>Review</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right w-[180px]">
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {runs.map((run) => (
                    <TableRow
                      key={run.id}
                      className={
                        selectedRunId === run.id
                          ? "bg-slate-50 hover:bg-slate-100"
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
                        <Badge variant="default">{run.autoMatched}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className="bg-yellow-500">
                          {run.partialMatched}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className="bg-orange-500">
                          {run.manualReview}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {new Date(run.createdAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right space-x-2">
                        <Button
                          size="sm"
                          variant={
                            selectedRunId === run.id ? "default" : "outline"
                          }
                          onClick={() => setSelectedRunId(run.id)}
                        >
                          View Details
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          className="gap-1"
                          onClick={() => handleDeleteRun(run.id)}
                          disabled={isDeleting}
                        >
                          {isDeleting &&
                          deleteMutation.variables === run.id ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <Trash2 className="w-3 h-3" />
                          )}
                          <span className="hidden sm:inline">Delete</span>
                        </Button>
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
        <Card className="border border-slate-200 shadow-sm">
          <CardHeader>
            <div className="flex items-center justify-between gap-2">
              <div>
                <CardTitle>Claims Details – Run #{selectedRunId}</CardTitle>
                <CardDescription>
                  Detailed view of reconciled claims for the selected run.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {claimsLoading ? (
              <p className="text-muted-foreground">Loading claims…</p>
            ) : claims.length === 0 ? (
              <p className="text-muted-foreground">No claims found.</p>
            ) : (
              <div className="w-full overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Member #</TableHead>
                      <TableHead>Patient Name</TableHead>
                      <TableHead>Service Date</TableHead>
                      <TableHead>Billed Amount</TableHead>
                      <TableHead>Amount Paid</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {claims.map((claim) => (
                      <TableRow key={claim.id}>
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
