import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getLabSummary } from "@/lib/api-insurance-lab";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { 
  Loader2, 
  Plus, 
  Wallet, 
  ArrowRightLeft, 
  Banknote, 
  Percent, 
  Settings2 
} from "lucide-react";

// Modals
import SetLabPortionModal from "@/components/insurance/modals/SetLabPortionModal";
import AddLabPaymentModal from "@/components/insurance/modals/AddLabPaymentModal";

export default function InsuranceLabPage() {
  // State for filters
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [month, setMonth] = useState<number>(new Date().getMonth() + 1);

  // Modal state
  const [openSetPortion, setOpenSetPortion] = useState(false);
  const [openAddPayment, setOpenAddPayment] = useState(false);

  // Fetch Data
  const { data, isLoading } = useQuery({
    queryKey: ["lab-summary", year, month],
    queryFn: () => getLabSummary(year, month),
  });

  const summary = data || {};
  
  // 1. The Portion (Total Lab Submitted)
  const portion = summary.portion;
  const currency = portion?.currency || "SSP"; // Default to SSP if nothing set
  const allocated = portion?.amount ? Number(portion.amount) : 0; // This is the 100%

  // 2. The Due (35% Share)
  const dueAmount = summary.due?.amount ? Number(summary.due.amount) : 0;

  // 3. Paid & Balance
  const paid = summary.paid?.amount ? Number(summary.paid.amount) : 0;
  const balance = summary.balance?.amount ? Number(summary.balance.amount) : 0;
  const payments = summary.payments || [];

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-10">
      {/* Header & Filters */}
      <div className="flex flex-col space-y-4 pt-2">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">
              Lab Finance
            </h1>
            <p className="text-muted-foreground">
              Manage allocations and staff payments for the Laboratory.
            </p>
          </div>

          <div className="flex gap-3">
            <Select
              value={year.toString()}
              onValueChange={(v) => setYear(parseInt(v))}
            >
              <SelectTrigger className="w-[100px] bg-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[2023, 2024, 2025, 2026].map((y) => (
                  <SelectItem key={y} value={y.toString()}>
                    {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={month.toString()}
              onValueChange={(v) => setMonth(parseInt(v))}
            >
              <SelectTrigger className="w-[140px] bg-white">
                <SelectValue />
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

        {/* Primary Actions Toolbar */}
        <div className="flex items-center justify-end gap-2 border-b border-gray-200 pb-4">
          <Button variant="outline" onClick={() => setOpenSetPortion(true)}>
            <Settings2 className="w-4 h-4 mr-2" />
            Set Monthly Total
          </Button>
          <Button onClick={() => setOpenAddPayment(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Record Payment
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid gap-4 md:grid-cols-4">
        {/* 1. Total Submitted */}
        <Card className="border-l-4 border-l-blue-500 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Lab Submitted
            </CardTitle>
            <Wallet className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            ) : (
              <div className="text-2xl font-bold">
                {currency} {allocated.toLocaleString()}
              </div>
            )}
            <p className="text-xs text-muted-foreground mt-1">
              100% of Lab Claims
            </p>
          </CardContent>
        </Card>

        {/* 2. Tech Share (35%) */}
        <Card className="border-l-4 border-l-purple-500 shadow-sm bg-purple-50/30">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-purple-900">
              Tech Share (35%)
            </CardTitle>
            <Percent className="h-4 w-4 text-purple-700" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            ) : (
              <div className="text-2xl font-bold text-purple-900">
                {currency} {dueAmount.toLocaleString()}
              </div>
            )}
            <p className="text-xs text-purple-600 mt-1">
              Total owed to Tech
            </p>
          </CardContent>
        </Card>

        {/* 3. Total Paid */}
        <Card className="border-l-4 border-l-emerald-500 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Paid</CardTitle>
            <ArrowRightLeft className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            ) : (
              <div className="text-2xl font-bold">
                {currency} {paid.toLocaleString()}
              </div>
            )}
            <p className="text-xs text-muted-foreground mt-1">
              Already disbursed
            </p>
          </CardContent>
        </Card>

        {/* 4. Balance Due */}
        <Card
          className={`border-l-4 shadow-sm ${
            balance < 0 ? "border-l-red-500 bg-red-50/30" : "border-l-gray-500"
          }`}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Remaining Balance</CardTitle>
            <Banknote className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            ) : (
              <div
                className={`text-2xl font-bold ${
                  balance < 0 ? "text-red-600" : "text-gray-900"
                }`}
              >
                {currency} {balance.toLocaleString()}
              </div>
            )}
            <p className="text-xs text-muted-foreground mt-1">
              Available to pay
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Payments List */}
      <Card className="shadow-sm border border-slate-200">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">Payment History</CardTitle>
              <p className="text-sm text-muted-foreground">
                Staff payments recorded for {new Date(year, month-1).toLocaleString('default', { month: 'long' })} {year}.
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Note</TableHead>
                <TableHead>Created By</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                    Loading...
                  </TableCell>
                </TableRow>
              ) : payments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                    No payments recorded for this period.
                  </TableCell>
                </TableRow>
              ) : (
                payments.map((p: any) => (
                  <TableRow key={p.id}>
                    <TableCell>
                      {new Date(p.payDate).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {p.note || "—"}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {p.createdBy}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {p.currency} {Number(p.amount).toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Modals */}
      <SetLabPortionModal
        open={openSetPortion}
        onOpenChange={setOpenSetPortion}
        year={year}
        month={month}
        currentAmount={allocated}
        currentCurrency={currency}
      />

      <AddLabPaymentModal
        open={openAddPayment}
        onOpenChange={setOpenAddPayment}
        year={year}
        month={month}
        defaultCurrency={currency as "SSP" | "USD"}
      />
    </div>
  );
}
