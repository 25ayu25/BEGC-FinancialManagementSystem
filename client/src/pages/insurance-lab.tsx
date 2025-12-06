import React, { useState, useMemo } from "react";
import {
  useQuery,
  useQueries,
  useQueryClient,
} from "@tanstack/react-query";
import {
  getLabSummary,
  deleteLabPayment,
  setLabPortion,
} from "@/lib/api-insurance-lab";
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
  MoreVertical,
  Pencil,
  Trash2,
} from "lucide-react";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

// Modals
import SetLabPortionModal from "@/components/insurance/modals/SetLabPortionModal";
import AddLabPaymentModal from "@/components/insurance/modals/AddLabPaymentModal";

type ViewMode = "monthly" | "year";

export default function InsuranceLabPage() {
  /* ---------------------------------------------------------------------- */
  /* Filters & state                                                        */
  /* ---------------------------------------------------------------------- */

  const today = new Date();
  const [month, setMonth] = useState<number>(today.getMonth() + 1);
  const [year, setYear] = useState<number>(today.getFullYear());
  const [viewMode, setViewMode] = useState<ViewMode>("monthly");

  // Modal state
  const [openSetPortion, setOpenSetPortion] = useState(false);
  const [openAddPayment, setOpenAddPayment] = useState(false);
  const [editingPayment, setEditingPayment] = useState<any | null>(null);

  // For editing submitted totals (portion)
  const [portionYear, setPortionYear] = useState<number>(year);
  const [portionMonth, setPortionMonth] = useState<number>(month);
  const [portionAmount, setPortionAmount] = useState<number>(0);
  const [portionCurrency, setPortionCurrency] = useState<string | undefined>(
    undefined
  );
  const [clearingMonth, setClearingMonth] = useState<number | null>(null);

  // Delete payment loading indicator
  const [isDeleteLoadingId, setIsDeleteLoadingId] = useState<
    string | number | null
  >(null);

  const queryClient = useQueryClient();
  const { toast } = useToast();

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
    (monthlySummary as any)?.portion?.currency ?? (yearCurrency ?? "USD");

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

  const paymentsTotal = payments.reduce(
    (sum: number, p: any) => sum + Number(p.amount || 0),
    0
  );

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

  const showingLabel =
    viewMode === "monthly"
      ? `Showing ${periodLabel} (Monthly)`
      : `Showing ${year} (Year to date)`;

  const isOverpaid = balance < 0;

  /* ---------------------------------------------------------------------- */
  /* Helpers: open / edit / clear submitted totals                          */
  /* ---------------------------------------------------------------------- */

  const openSetPortionForMonth = (
    targetMonth: number,
    amount: number,
    currency?: string
  ) => {
    setPortionYear(year);
    setPortionMonth(targetMonth);
    setPortionAmount(amount);
    setPortionCurrency(currency || displayCurrency || "USD");
    setOpenSetPortion(true);
  };

  const handleToolbarOpenSetPortion = () => {
    let amount = 0;
    let currency = displayCurrency || "USD";

    if (usingYear) {
      const row = perMonthRows.find((r) => r.month === month);
      if (row) {
        amount = row.submitted;
        currency = row.currency;
      }
    } else {
      amount = allocated;
    }

    openSetPortionForMonth(month, amount, currency);
  };

  const handleEditSubmittedRow = (row: {
    month: number;
    submitted: number;
    currency: string;
  }) => {
    openSetPortionForMonth(row.month, row.submitted, row.currency);
  };

  const handleClearSubmittedRow = async (row: {
    month: number;
    currency: string;
  }) => {
    const confirmed = window.confirm(
      "Clear this month's submitted total? This will set the amount to 0 and recalculate balances."
    );
    if (!confirmed) return;

    setClearingMonth(row.month);
    try {
      await setLabPortion({
        periodYear: year,
        periodMonth: row.month,
        currency: row.currency || (displayCurrency || "USD"),
        amount: 0,
      });
      toast({ title: "Monthly total cleared" });
      queryClient.invalidateQueries({ queryKey: ["lab-summary"] });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error?.message || "Failed to clear monthly total",
        variant: "destructive",
      });
    } finally {
      setClearingMonth(null);
    }
  };

  /* ---------------------------------------------------------------------- */
  /* Handlers: edit / delete payments                                       */
  /* ---------------------------------------------------------------------- */

  const handlePaymentSaved = () => {
    queryClient.invalidateQueries({ queryKey: ["lab-summary"] });
  };

  const handleEditPayment = (p: any) => {
    setEditingPayment({
      id: p.id,
      payDate: p.payDate,
      amount: Number(p.amount),
      note: p.note,
      currency: p.currency,
      periodYear: year,
      periodMonth: p.periodMonth ?? month,
    });
    setOpenAddPayment(true);
  };

  const handleDeletePayment = async (p: any) => {
    if (!p.id) {
      toast({
        title: "Cannot delete payment",
        description: "This payment has no ID.",
        variant: "destructive",
      });
      return;
    }

    const confirmed = window.confirm(
      "Delete this payment record? This will reduce the total paid amount."
    );
    if (!confirmed) return;

    setIsDeleteLoadingId(p.id);
    try {
      await deleteLabPayment(p.id);
      toast({ title: "Payment deleted" });
      queryClient.invalidateQueries({ queryKey: ["lab-summary"] });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error?.message || "Failed to delete payment",
        variant: "destructive",
      });
    } finally {
      setIsDeleteLoadingId(null);
    }
  };

  const paymentTotalLabel =
    viewMode === "monthly" ? `Total for ${periodLabel}` : `Total for ${year}`;

  const paymentLabelColSpan = viewMode === "year" ? 4 : 3;

  /* ---------------------------------------------------------------------- */
  /* Render                                                                 */
  /* ---------------------------------------------------------------------- */

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-10 px-4 sm:px-6">
      {/* Header & Filters */}
      <div className="flex flex-col gap-4 pt-2">
        <div className="space-y-1">
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">
            Lab Finance
          </h1>
          <p className="text-sm text-muted-foreground">
            Track lab insurance and technician payments.
          </p>
          <p className="text-xs text-muted-foreground mt-1">{showingLabel}</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white/80 shadow-sm px-4 py-3 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <p className="text-[11px] text-muted-foreground max-w-xs">
            Month controls the cards; Year controls the table below.
          </p>

          <div className="flex flex-col gap-3 w-full md:w-auto sm:flex-row sm:items-end sm:justify-end">
            {/* Month selector */}
            <div className="flex-1 sm:flex-none flex flex-col">
              <span className="text-[11px] text-muted-foreground mb-1">
                Month
              </span>
              <Select
                value={month.toString()}
                onValueChange={(v) => setMonth(parseInt(v))}
                disabled={viewMode === "year"}
              >
                <SelectTrigger className="w-full sm:w-[140px] bg-white">
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

            {/* Year selector */}
            <div className="flex-1 sm:flex-none flex flex-col">
              <span className="text-[11px] text-muted-foreground mb-1">
                Year
              </span>
              <Select
                value={year.toString()}
                onValueChange={(v) => setYear(parseInt(v))}
              >
                <SelectTrigger className="w-full sm:w-[100px] bg-white">
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
            </div>

            {/* View mode toggle */}
            <div className="inline-flex rounded-full bg-slate-100 p-1 text-xs self-start sm:self-auto">
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
        <div className="flex flex-col gap-2 border-b border-gray-200 pb-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-[11px] text-muted-foreground">
              Actions apply to{" "}
              {new Date(year, month - 1).toLocaleString("default", {
                month: "long",
              })}{" "}
              {year}.
            </p>
            <div className="flex flex-col gap-2 sm:flex-row sm:justify-end w-full sm:w-auto">
              <Button
                variant="outline"
                className="w-full sm:w-auto"
                onClick={handleToolbarOpenSetPortion}
                title="Set how much insurance paid for lab this month."
              >
                <Settings2 className="w-4 h-4 mr-2" />
                Enter Monthly Total
              </Button>
              <Button
                variant="outline"
                className="w-full sm:w-auto"
                onClick={() => {
                  setEditingPayment(null);
                  setOpenAddPayment(true);
                }}
                title="Save a cash payment you gave to the Lab Technician."
              >
                <Plus className="w-4 h-4 mr-2" />
                Record Payment to Technician
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid gap-4 md:grid-cols-4">
        {/* 1. Total sent to insurance */}
        <Card className="border-l-4 border-l-blue-500 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total sent to insurance
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
              {usingYear ? "All claims this year (100%)" : "All claims this period (100%)"}
            </p>
          </CardContent>
        </Card>

        {/* 2. Lab Technician share (35%) */}
        <Card className="border-l-4 border-l-purple-500 shadow-sm bg-purple-50/30">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-purple-900">
              Lab Technician share (35%)
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
              {usingYear
                ? "Total owed to the Lab Technician this year"
                : "What we should pay the Lab Technician"}
            </p>
          </CardContent>
        </Card>

        {/* 3. Total Paid */}
        <Card className="border-l-4 border-l-emerald-500 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Already paid to technician
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
              {usingYear ? "Paid this year" : "Paid this period"}
            </p>
          </CardContent>
        </Card>

        {/* 4. Balance / Overpaid */}
        <Card
          className={cn(
            "border-l-4 shadow-sm",
            isOverpaid ? "border-l-red-500 bg-red-50/40" : "border-l-gray-500"
          )}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {isOverpaid ? "Overpaid technician" : "Still owed to technician"}
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
                  isOverpaid ? "text-red-600" : "text-gray-900"
                )}
              >
                {displayCurrency} {balance.toLocaleString()}
              </div>
            )}
            <p className="text-xs text-muted-foreground mt-1">
              {isOverpaid
                ? `We paid more than required this ${
                    usingYear ? "year" : "period"
                  }`
                : usingYear
                ? "Still to pay this year"
                : "Still to pay this period"}
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
                Year overview for {year}.
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="submitted" className="w-full">
            <TabsList className="mb-4 inline-flex rounded-full bg-slate-100 p-1">
              <TabsTrigger
                value="submitted"
                className="rounded-full px-4 py-1 text-sm data-[state=active]:bg-white data-[state=active]:shadow-sm"
              >
                Submitted totals
              </TabsTrigger>
              <TabsTrigger
                value="payments"
                className="rounded-full px-4 py-1 text-sm data-[state=active]:bg-white data-[state=active]:shadow-sm"
              >
                Payment history
              </TabsTrigger>
            </TabsList>

            {/* Submitted totals (per month for the selected year) */}
            <TabsContent value="submitted">
              <p className="text-xs text-muted-foreground mb-3">
                Monthly totals: sent to insurance, technician share, paid, and
                balance.
              </p>
              <div className="w-full overflow-x-auto">
                <Table className="min-w-[720px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Period</TableHead>
                      <TableHead className="text-right">
                        Submitted (USD)
                      </TableHead>
                      <TableHead className="text-right">
                        Lab share (35%) (USD)
                      </TableHead>
                      <TableHead className="text-right">Paid (USD)</TableHead>
                      <TableHead className="text-right">
                        Balance (USD)
                      </TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isYearLoading && submittedRowsForYear.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={6}
                          className="text-center py-8 text-muted-foreground"
                        >
                          Loading...
                        </TableCell>
                      </TableRow>
                    ) : submittedRowsForYear.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={6}
                          className="text-center py-8 text-muted-foreground"
                        >
                          No lab submissions recorded for {year}.
                        </TableCell>
                      </TableRow>
                    ) : (
                      <>
                        {submittedRowsForYear.map((row) => {
                          const isCurrentMonth = row.month === month;
                          const monthLabelShort = new Date(
                            year,
                            row.month - 1
                          ).toLocaleString("default", {
                            month: "short",
                          });

                          return (
                            <TableRow
                              key={row.month}
                              className={cn(isCurrentMonth && "bg-slate-50")}
                            >
                              <TableCell className="whitespace-nowrap">
                                {monthLabelShort} {year}
                                {isCurrentMonth && (
                                  <span className="ml-2 inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
                                    Current month
                                  </span>
                                )}
                              </TableCell>
                              <TableCell className="text-right">
                                {row.currency}{" "}
                                {row.submitted.toLocaleString()}
                              </TableCell>
                              <TableCell className="text-right">
                                {row.currency} {row.due.toLocaleString()}
                              </TableCell>
                              <TableCell className="text-right">
                                {row.currency} {row.paid.toLocaleString()}
                              </TableCell>
                              <TableCell
                                className={cn(
                                  "text-right",
                                  row.balance > 0
                                    ? "text-amber-600"
                                    : row.balance < 0
                                    ? "text-red-600"
                                    : "text-slate-700"
                                )}
                              >
                                {row.currency} {row.balance.toLocaleString()}
                              </TableCell>
                              <TableCell className="text-right">
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8"
                                    >
                                      <MoreVertical className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent
                                    align="end"
                                    sideOffset={4}
                                    className="bg-white shadow-lg border border-slate-200 rounded-md min-w-[190px]"
                                  >
                                    <DropdownMenuLabel className="text-xs text-slate-500">
                                      Submitted total
                                    </DropdownMenuLabel>
                                    <DropdownMenuItem
                                      onClick={() =>
                                        handleEditSubmittedRow(row)
                                      }
                                    >
                                      <Pencil className="mr-2 h-3 w-3" />
                                      Edit monthly total
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                      onClick={() =>
                                        handleClearSubmittedRow(row)
                                      }
                                      disabled={clearingMonth === row.month}
                                      className="text-red-600 focus:text-red-600"
                                    >
                                      <Trash2 className="mr-2 h-3 w-3" />
                                      {clearingMonth === row.month
                                        ? "Clearing..."
                                        : "Clear monthly total"}
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </TableCell>
                            </TableRow>
                          );
                        })}

                        {/* Total row for the year */}
                        <TableRow className="font-semibold border-t">
                          <TableCell>Total for {year}</TableCell>
                          <TableCell className="text-right">
                            {displayCurrency}{" "}
                            {yearTotals.submitted.toLocaleString()}
                          </TableCell>
                          <TableCell className="text-right">
                            {displayCurrency}{" "}
                            {yearTotals.due.toLocaleString()}
                          </TableCell>
                          <TableCell className="text-right">
                            {displayCurrency}{" "}
                            {yearTotals.paid.toLocaleString()}
                          </TableCell>
                          <TableCell
                            className={cn(
                              "text-right",
                              yearTotals.balance > 0
                                ? "text-amber-600"
                                : yearTotals.balance < 0
                                ? "text-red-600"
                                : "text-slate-700"
                            )}
                          >
                            {displayCurrency}{" "}
                            {yearTotals.balance.toLocaleString()}
                          </TableCell>
                          <TableCell />
                        </TableRow>
                      </>
                    )}
                  </TableBody>
                </Table>
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                <span className="font-medium text-amber-600">Orange</span> =
                still owed to the Lab Technician.{" "}
                <span className="font-medium text-red-600">Red</span> =
                overpaid.
              </p>
            </TabsContent>

            {/* Payment history */}
            <TabsContent value="payments">
              <p className="text-xs text-muted-foreground mb-3">
                All cash payments to the Lab Technician in{" "}
                {viewMode === "monthly" ? periodLabel : year}.
              </p>
              <div className="w-full overflow-x-auto">
                <Table className="min-w-[640px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Payment date</TableHead>
                      {viewMode === "year" && <TableHead>Period</TableHead>}
                      <TableHead>Note</TableHead>
                      <TableHead>Created By</TableHead>
                      <TableHead className="text-right">
                        Amount (USD)
                      </TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {anyLoading && payments.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={viewMode === "year" ? 6 : 5}
                          className="text-center py-8 text-muted-foreground"
                        >
                          Loading...
                        </TableCell>
                      </TableRow>
                    ) : payments.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={viewMode === "year" ? 6 : 5}
                          className="text-center py-8 text-muted-foreground"
                        >
                          No payments recorded for{" "}
                          {viewMode === "monthly" ? periodLabel : year}.
                        </TableCell>
                      </TableRow>
                    ) : (
                      <>
                        {payments.map((p: any) => (
                          <TableRow
                            key={p.id ?? `${p.payDate}-${p.periodMonth}`}
                          >
                            <TableCell>
                              {new Date(p.payDate).toLocaleDateString()}
                            </TableCell>
                            {viewMode === "year" && (
                              <TableCell>
                                {new Date(
                                  year,
                                  (p.periodMonth ?? month) - 1
                                ).toLocaleString("default", {
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
                              {p.currency}{" "}
                              {Number(p.amount).toLocaleString()}
                            </TableCell>
                            <TableCell className="text-right">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8"
                                  >
                                    <MoreVertical className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent
                                  align="end"
                                  sideOffset={4}
                                  className="bg-white shadow-lg border border-slate-200 rounded-md min-w-[170px]"
                                >
                                  <DropdownMenuLabel className="text-xs text-slate-500">
                                    Actions
                                  </DropdownMenuLabel>
                                  <DropdownMenuItem
                                    onClick={() => handleEditPayment(p)}
                                  >
                                    <Pencil className="mr-2 h-3 w-3" />
                                    Edit payment
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    onClick={() => handleDeletePayment(p)}
                                    disabled={isDeleteLoadingId === p.id}
                                    className="text-red-600 focus:text-red-600"
                                  >
                                    <Trash2 className="mr-2 h-3 w-3" />
                                    {isDeleteLoadingId === p.id
                                      ? "Deleting..."
                                      : "Delete payment"}
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </TableCell>
                          </TableRow>
                        ))}

                        {/* Total row */}
                        <TableRow className="font-semibold border-t">
                          <TableCell colSpan={paymentLabelColSpan}>
                            {paymentTotalLabel}
                          </TableCell>
                          <TableCell className="text-right">
                            {displayCurrency}{" "}
                            {paymentsTotal.toLocaleString()}
                          </TableCell>
                          <TableCell />
                        </TableRow>
                      </>
                    )}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Modals */}
      <SetLabPortionModal
        open={openSetPortion}
        onOpenChange={setOpenSetPortion}
        year={portionYear}
        month={portionMonth}
        currentAmount={portionAmount}
        currentCurrency={portionCurrency}
      />

      <AddLabPaymentModal
        open={openAddPayment}
        onOpenChange={(open) => {
          if (!open) setEditingPayment(null);
          setOpenAddPayment(open);
        }}
        year={year}
        month={month}
        defaultCurrency={displayCurrency}
        paymentToEdit={editingPayment}
        onSaved={handlePaymentSaved}
      />
    </div>
  );
}
