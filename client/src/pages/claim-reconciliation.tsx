// client/src/pages/claim-reconciliation.tsx

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Upload, FileSpreadsheet, CheckCircle2, AlertCircle, Clock } from "lucide-react";
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

export default function ClaimReconciliation() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Form state
  const [providerName, setProviderName] = useState("CIC");
  const [periodYear, setPeriodYear] = useState(new Date().getFullYear().toString());
  const [periodMonth, setPeriodMonth] = useState((new Date().getMonth() + 1).toString());
  const [claimsFile, setClaimsFile] = useState<File | null>(null);
  const [remittanceFile, setRemittanceFile] = useState<File | null>(null);
  const [selectedRunId, setSelectedRunId] = useState<number | null>(null);

  // Fetch all reconciliation runs
  const { data: runs = [], isLoading: runsLoading } = useQuery<ReconRun[]>({
    queryKey: ["/api/claim-reconciliation/runs"],
  });

  // Fetch claims for selected run
  const { data: claims = [] } = useQuery<ClaimDetail[]>({
    queryKey: [`/api/claim-reconciliation/runs/${selectedRunId}/claims`],
    enabled: !!selectedRunId,
  });

  // Upload mutation
  const uploadMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const uploadUrl = new URL("/api/claim-reconciliation/upload", API_BASE_URL).toString();
      const response = await fetch(uploadUrl, {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      if (!response.ok) {
        // Check if response is JSON before parsing
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          const error = await response.json();
          throw new Error(error.error || "Upload failed");
        } else {
          // Non-JSON error (likely HTML error page)
          const text = await response.text();
          throw new Error(`Upload failed (${response.status}): ${text.substring(0, 100)}`);
        }
      }

      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Success",
        description: `Reconciliation completed. Matched ${data.summary.autoMatched} claims automatically.`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/claim-reconciliation/runs"] });
      setSelectedRunId(data.runId);
      // Reset form
      setClaimsFile(null);
      setRemittanceFile(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!claimsFile || !remittanceFile) {
      toast({
        title: "Error",
        description: "Please select both files",
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
    // Note: userId is now obtained server-side from the authenticated session

    uploadMutation.mutate(formData);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "paid":
        return <Badge className="bg-green-500"><CheckCircle2 className="w-3 h-3 mr-1" />Paid</Badge>;
      case "partially_paid":
        return <Badge className="bg-yellow-500"><Clock className="w-3 h-3 mr-1" />Partial</Badge>;
      case "manual_review":
        return <Badge className="bg-orange-500"><AlertCircle className="w-3 h-3 mr-1" />Review</Badge>;
      case "submitted":
      default:
        return <Badge variant="secondary">Submitted</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Claim Reconciliation</h1>
        <p className="text-muted-foreground">
          Upload and reconcile insurance claims with remittance advice
        </p>
      </div>

      {/* Upload Form */}
      <Card>
        <CardHeader>
          <CardTitle>Upload Reconciliation Files</CardTitle>
          <CardDescription>
            Select the Claims Submitted and Remittance Advice Excel files
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="provider">Insurance Provider</Label>
                <Select value={providerName} onValueChange={setProviderName}>
                  <SelectTrigger id="provider">
                    <SelectValue />
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
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="month">Period Month</Label>
                <Select value={periodMonth} onValueChange={setPeriodMonth}>
                  <SelectTrigger id="month">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                      <SelectItem key={m} value={m.toString()}>
                        {new Date(2000, m - 1).toLocaleString("default", { month: "long" })}
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
                    onChange={(e) => setClaimsFile(e.target.files?.[0] || null)}
                  />
                  {claimsFile && <FileSpreadsheet className="w-5 h-5 text-green-500" />}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="remittance-file">Remittance Advice File</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="remittance-file"
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={(e) => setRemittanceFile(e.target.files?.[0] || null)}
                  />
                  {remittanceFile && <FileSpreadsheet className="w-5 h-5 text-green-500" />}
                </div>
              </div>
            </div>

            <Button
              type="submit"
              disabled={!claimsFile || !remittanceFile || uploadMutation.isPending}
              className="w-full md:w-auto"
            >
              <Upload className="w-4 h-4 mr-2" />
              {uploadMutation.isPending ? "Processing..." : "Upload & Reconcile"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Reconciliation Runs List */}
      <Card>
        <CardHeader>
          <CardTitle>Reconciliation History</CardTitle>
          <CardDescription>Previous reconciliation runs</CardDescription>
        </CardHeader>
        <CardContent>
          {runsLoading ? (
            <p className="text-muted-foreground">Loading...</p>
          ) : runs.length === 0 ? (
            <p className="text-muted-foreground">No reconciliation runs yet</p>
          ) : (
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
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {runs.map((run) => (
                  <TableRow key={run.id}>
                    <TableCell className="font-medium">{run.providerName}</TableCell>
                    <TableCell>
                      {new Date(run.periodYear, run.periodMonth - 1).toLocaleString("default", {
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
                      <Badge className="bg-yellow-500">{run.partialMatched}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className="bg-orange-500">{run.manualReview}</Badge>
                    </TableCell>
                    <TableCell>
                      {new Date(run.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setSelectedRunId(run.id)}
                      >
                        View Details
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Claims Details */}
      {selectedRunId && (
        <Card>
          <CardHeader>
            <CardTitle>Claims Details - Run #{selectedRunId}</CardTitle>
            <CardDescription>Detailed view of reconciled claims</CardDescription>
          </CardHeader>
          <CardContent>
            {claims.length === 0 ? (
              <p className="text-muted-foreground">No claims found</p>
            ) : (
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
                      <TableCell className="font-mono">{claim.memberNumber}</TableCell>
                      <TableCell>{claim.patientName || "N/A"}</TableCell>
                      <TableCell>
                        {new Date(claim.serviceDate).toLocaleDateString()}
                      </TableCell>
                      <TableCell>SSP {parseFloat(claim.billedAmount).toFixed(2)}</TableCell>
                      <TableCell>SSP {parseFloat(claim.amountPaid).toFixed(2)}</TableCell>
                      <TableCell>{getStatusBadge(claim.status)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
