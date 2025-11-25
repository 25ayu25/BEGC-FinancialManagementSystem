import React, { useState, useMemo } from "react";
import { useQuery, useQueries } from "@tanstack/react-query";
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
  Settings2,
} from "lucide-react";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

// Modals
import SetLabPortionModal from "@/components/insurance/modals/SetLabPortionModal";
import AddLabPaymentModal from "@/components/insurance/modals/AddLabPaymentModal";

type ViewMode = "monthly" | "year";

export default function InsuranceLabPage() {
  // State for filters
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [month, setMonth] = useState<number>(new Date().getMonth() + 1);
  const [viewMode, setViewMode] = useState<ViewMode>("monthly");

  // Modal state
  const [openSetPortion, setOpenSetPortion] = useState(false);
  const [openAddPayment, setOpenAddPayment] = useState(false);

  /* ---------------------------------------------------------------------- */
  /* Data loading                                                           */
  /* ---------------------------------------------------------------------- */

  // Single month summary (used for Monthly view, and also as cache)
  const {
    data: monthlySummary,
    isLoading: isMonthlyLoading,
  } = useQuery({
    queryKey: ["lab-summary", year, month],
    queryFn: () => getLabSummary(year, month),
  });

  // All months in the year – used for Year view + Submitted history
  const monthSummaries = useQueries({
    queries: Array.from({ length: 12 }, (_, index) => {
      const m = index + 1;
      return {
        queryKey: ["lab-summary", year, m],
        queryFn: () => getLabSummary(year, m),
      };
    }),
  });

  const isYearLoading = monthSummaries.some((q) => q.isLoading);

  /* ---------------------------------------------------------------------- */
  /* Year aggregations (built from 12 month summaries)                      */
  /* ---------------------------------------------------------------------- */

  const {
    yearCurrency,
    yearTotals,
    perMonthRows,
    yearPayments,
  } = useMemo(() => {
    let currency: string | null = null;
    let totalSubmitted = 0;
    let totalDue = 0;
    let totalPaid = 0;
    let totalBalance = 0;

    const perMonth: Array<{
      month: number;
      submitted: number;
      due: number;
      paid: number;
      balance: number;
      currency: string;
    }> = [];

    const payments: Array<any & { periodMonth: number }> = [];

    monthSummaries.forEach((q, index) => {
      const m = index + 1;
      const s: any = q.data;
      if (!s) return;

      const portionAmt = s.portion?.amount ? Number(s.portion.amount) : 0;
      const dueAmt = s.due?.amount ? Number(s.due.amount) : 0;
      const paidAmt = s.paid?.amount ? Number(s.paid.amount) : 0;
      const balanceAmt =
        s.balance?.amount !== undefined
          ? Number(s.balance.amount)
          : dueAmt - paidAmt;

      const thisCurrency =
        s.portion?.currency ||
        s.due?.currency ||
        s.paid?.currency ||
        "USD";

      if (!currency) currency = thisCurrency;

      totalSubmitted += portionAmt;
      totalDue += dueAmt;
      totalPaid += paidAmt;
      totalBalance += balanceAmt;

      perMonth.push({
        month: m,
        submitted: portionAmt,
        due: dueAmt,
        paid: paidAmt,
        balance: balanceAmt,
        currency: thisCurrency,
      });

      (s.payments || []).forEach((p: any) => {
        payments.push({
          ...p,
          periodMonth: m,
        });
      });
    });

    return {
      yearCurrency: currency,
      yearTotals: {
        submitted: totalSubmitted,
        due: totalDue,
        paid: totalPaid,
        balance: totalBalance,
      },
      perMonthRows: perMonth,
      yearPayments: payments,
    };
  }, [monthSummaries]);

  /* ---------------------------------------------------------------------- */
  /* Derived values for the UI                                              */
  /* ---------------------------------------------------------------------- */

  const usingYear = viewMode === "year";

  const baseCurrency =
    (monthlySummary as any)?.portion?.currency ??
    (yearCurrency ?? "USD");

  const displayCurrency = usingYear ? yearCurrency || baseCurrency : baseCurrency;

  const allocated = usingYear
    ? yearTotals.submitted
    : (monthlySummary as any)?.portion?.amount
    ? Number((monthlySummary as any).portion.amount)
    : 0;

  const dueAmount = usingYear
    ? yearTotals.due
    : (monthlySummary as any)?.due?.amount
    ? Number((monthlySummary as any).due.amount)
    : 0;

  const paid = usingYear
    ? yearTotals.paid
    : (monthlySummary as any)?.paid?.amount
    ? Number((monthlySummary as any).paid.amount)
    : 0;

  const balance = usingYear
    ? yearTotals.balance
    : (monthlySummary as any)?.balance?.amount !== undefined
    ? Number((monthlySummary as any).balance.amount)
    : dueAmount - paid;

  const payments = usingYear
    ? yearPayments
    : ((monthlySummary as any)?.payments || []);

  const submittedRowsForYear = perMonthRows.filter(
    (row) =>
      row.submitted !== 0 || row.due !== 0 || row.paid !== 0 || row.balance !== 0
  );

  const periodLabel =
    viewMode === "monthly"
      ? `${new Date(year, month - 1).toLocaleString("default", {
          month: "long",
        })} ${year}`
      : `${year}`;

  const anyLoading = usingYear ? isYearLoading : isMonthlyLoading;

  /* ---------------------------------------------------------------------- */
  /* Render                                                                 */
  /* ---------------------------------------------------------------------- */

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

          <div className="flex flex-col items-end gap-2">
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
                disabled={viewMode === "year"}
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

            {/* View mode toggle */}
            <div className="inline-flex rounded-full bg-slate-100 p-1 text-xs">
              <button
                type="button"
                className={cn(
                  "px-3 py-1 rounded-full",
                  viewMode === "monthly"
                    ? "bg-white shadow-sm"
                    : "text-slate-600"
                )}
                onClick={() => setViewMode("monthly")}
              >
                Monthly
              </button>
              <button
                type="button"
                className={cn(
                  "px-3 py-1 rounded-full",
                  viewMode === "year" ? "bg-white shadow-sm" : "text-slate-600"
                )}
                onClick={() => setViewMode("year")}
              >
                Year to date
              </button>
            </div>
          </div>
        </div>

        {/* Primary Actions Toolbar */}
        <div className="flex flex-col items-end gap-1 border-b border-gray-200 pb-4">
          <div className="flex items-center justify-end gap-2">
            <Button variant="outline" onClick={() => setOpenSetPortion(true)}>
              <Settings2 className="w-4 h-4 mr-2" />
              Enter Monthly Total
            </Button>
            <Button onClick={() => setOpenAddPayment(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Record Payment
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Actions apply to{" "}
            {new Date(year, month - 1).toLocaleString("default", {
              month: "long",
            })}{" "}
            {year}.
          </p>
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
            {anyLoading ? (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            ) : (
              <div className="text-2xl font-bold">
                {displayCurrency} {allocated.toLocaleString()}
              </div>
            )}
            <p className="text-xs text-muted-foreground mt-1">
              {usingYear ? "Across all months this year" : "100% of Lab Claims"}
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
            {anyLoading ? (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            ) : (
              <div className="text-2xl font-bold text-purple-900">
                {displayCurrency} {dueAmount.toLocaleString()}
              </div>
            )}
            <p className="text-xs text-purple-600 mt-1">
              {usingYear ? "Total owed for the year" : "Total owed to Tech"}
            </p>
          </CardContent>
        </Card>

        {/* 3. Total Paid */}
        <Card className="border-l-4 border-l-emerald-500 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Paid
            </CardTitle>
            <ArrowRightLeft className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            {anyLoading ? (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            ) : (
              <div className="text-2xl font-bold">
                {displayCurrency} {paid.toLocaleString()}
              </div>
            )}
            <p className="text-xs text-muted-foreground mt-1">
              {usingYear
                ? "Disbursed during this year"
                : "Already disbursed"}
            </p>
          </CardContent>
        </Card>

        {/* 4. Balance Due */}
        <Card
          className={cn(
            "border-l-4 shadow-sm",
            balance < 0 ? "border-l-red-500 bg-red-50/30" : "border-l-gray-500"
          )}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Remaining Balance
            </CardTitle>
            <Banknote className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {anyLoading ? (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            ) : (
              <div
                className={cn(
                  "text-2xl font-bold",
                  balance < 0 ? "text-red-600" : "text-gray-900"
                )}
              >
                {displayCurrency} {balance.toLocaleString()}
              </div>
            )}
            <p className="text-xs text-muted-foreground mt-1">
              {usingYear
                ? "Still owed for this year"
                : "Available to pay"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Submitted + Payments */}
      <Card className="shadow-sm border border-slate-200">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">Lab Insurance Activity</CardTitle>
              <p className="text-sm text-muted-foreground">
                Submitted totals and payments for{" "}
                {viewMode === "monthly" ? periodLabel : `the year ${year}`}.
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="submitted" className="w-full">
            <TabsList className="mb-4">
              <TabsTrigger value="submitted">Submitted totals</TabsTrigger>
              <TabsTrigger value="payments">Payment history</TabsTrigger>
            </TabsList>

            {/* Submitted totals (per month for the selected year) */}
            <TabsContent value="submitted">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Period</TableHead>
                    <TableHead>Submitted</TableHead>
                    <TableHead>Tech share (35%)</TableHead>
                    <TableHead>Paid</TableHead>
                    <TableHead className="text-right">Balance</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isYearLoading && submittedRowsForYear.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={5}
                        className="text-center py-8 text-muted-foreground"
                      >
                        Loading...
                      </TableCell>
                    </TableRow>
                  ) : submittedRowsForYear.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={5}
                        className="text-center py-8 text-muted-foreground"
                      >
                        No lab submissions recorded for {year}.
                      </TableCell>
                    </TableRow>
                  ) : (
                    submittedRowsForYear.map((row) => (
                      <TableRow key={row.month}>
                        <TableCell>
                          {new Date(year, row.month - 1).toLocaleString(
                            "default",
                            { month: "short" }
                          )}{" "}
                          {year}
                        </TableCell>
                        <TableCell>
                          {row.currency} {row.submitted.toLocaleString()}
                        </TableCell>
                        <TableCell>
                          {row.currency} {row.due.toLocaleString()}
                        </TableCell>
                        <TableCell>
                          {row.currency} {row.paid.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right">
                          {row.currency} {row.balance.toLocaleString()}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TabsContent>

            {/* Payment history */}
            <TabsContent value="payments">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Payment date</TableHead>
                    {viewMode === "year" && <TableHead>Period</TableHead>}
                    <TableHead>Note</TableHead>
                    <TableHead>Created By</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {anyLoading && payments.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={viewMode === "year" ? 5 : 4}
                        className="text-center py-8 text-muted-foreground"
                      >
                        Loading...
                      </TableCell>
                    </TableRow>
                  ) : payments.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={viewMode === "year" ? 5 : 4}
                        className="text-center py-8 text-muted-foreground"
                      >
                        No payments recorded for{" "}
                        {viewMode === "monthly" ? periodLabel : year}.
                      </TableCell>
                    </TableRow>
                  ) : (
                    payments.map((p: any) => (
                      <TableRow key={p.id ?? `${p.payDate}-${p.periodMonth}`}>
                        <TableCell>
                          {new Date(p.payDate).toLocaleDateString()}
                        </TableCell>
                        {viewMode === "year" && (
                          <TableCell>
                            {new Date(year, (p.periodMonth ?? month) - 1)
                              .toLocaleString("default", {
                                month: "short",
                              })}{" "}
                            {year}
                          </TableCell>
                        )}
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
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Modals */}
      <SetLabPortionModal
        open={openSetPortion}
        onOpenChange={setOpenSetPortion}
        year={year}
        month={month}
        currentAmount={allocated}
        currentCurrency={displayCurrency}
      />

      <AddLabPaymentModal
        open={openAddPayment}
        onOpenChange={setOpenAddPayment}
        year={year}
        month={month}
        defaultCurrency={displayCurrency as "SSP" | "USD"}
      />
    </div>
  );
}
