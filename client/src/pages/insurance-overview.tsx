/**
 * Insurance Overview Page - 100% Standalone Implementation
 * 
 * This page is completely independent from insurance.tsx
 * - Uses its own data fetching hooks
 * - Manages its own filter state
 * - Has its own API endpoints
 * - USD-only (no multi-currency support)
 * 
 * @module InsuranceOverview
 */

import React, { useState } from "react";
import { Plus, DollarSign, RefreshCw, Download } from "lucide-react";
import { useAdvancedFilters } from "@/features/insurance-overview/hooks/useAdvancedFilters";
import { useInsuranceOverview } from "@/features/insurance-overview/hooks/useInsuranceOverview";
import { AdvancedFilters } from "@/features/insurance-overview/components/AdvancedFilters";
import { ExecutiveDashboard } from "@/features/insurance-overview/components/ExecutiveDashboard";
import { ProviderComparison } from "@/features/insurance-overview/components/ProviderComparison";
import { PaymentTimeline } from "@/features/insurance-overview/components/PaymentTimeline";
import { AgingAnalysis } from "@/features/insurance-overview/components/AgingAnalysis";
import { SmartTable } from "@/features/insurance-overview/components/SmartTable";
import { formatCurrency } from "@/features/insurance-overview/utils/calculations";
import { format } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";

export default function InsuranceOverview() {
  // ALL HOOKS MUST BE AT THE TOP - React Rules of Hooks
  const {
    filters,
    updateFilter,
    clearFilters,
    applyFilters,
    setDatePreset,
  } = useAdvancedFilters();

  const { data, loading, error, refetch } = useInsuranceOverview(filters);

  // Modal states - MUST be before any conditional returns
  const [showAddClaimModal, setShowAddClaimModal] = useState(false);
  const [showRecordPaymentModal, setShowRecordPaymentModal] = useState(false);

  // Form states for Add Claim modal - MUST be before any conditional returns
  const [claimForm, setClaimForm] = useState({
    providerId: "",
    periodStart: "",
    periodEnd: "",
    amount: "",
    notes: "",
  });

  // Form states for Record Payment modal - MUST be before any conditional returns
  const [paymentForm, setPaymentForm] = useState({
    providerId: "",
    paymentDate: "",
    amount: "",
    reference: "",
    notes: "",
  });

  // Format data for tables
  const claimsTableData = data.claims.map(claim => {
    const provider = data.providers.find(p => p.id === claim.providerId);
    return {
      provider: provider?.name || "Unknown",
      period: `${claim.periodYear}-${String(claim.periodMonth).padStart(2, "0")}`,
      periodStart: claim.periodStart,
      amount: Number(claim.claimedAmount),
      status: claim.status,
      notes: claim.notes || "",
    };
  });

  const paymentsTableData = data.payments.map(payment => {
    const provider = data.providers.find(p => p.id === payment.providerId);
    const paymentDate = payment.paymentDate || payment.createdAt;
    return {
      provider: provider?.name || "Unknown",
      date: paymentDate ? format(new Date(paymentDate), "yyyy-MM-dd") : "",
      amount: Number(payment.amount),
      reference: payment.reference || "",
      notes: payment.notes || "",
    };
  });

  const claimsColumns = [
    { key: "provider", label: "Provider", sortable: true },
    { key: "period", label: "Period", sortable: true },
    {
      key: "amount",
      label: "Amount",
      sortable: true,
      formatter: (v: number) => formatCurrency(v),
    },
    { key: "status", label: "Status", sortable: true },
    { key: "notes", label: "Notes", sortable: false },
  ];

  const paymentsColumns = [
    { key: "provider", label: "Provider", sortable: true },
    { key: "date", label: "Date", sortable: true },
    {
      key: "amount",
      label: "Amount",
      sortable: true,
      formatter: (v: number) => formatCurrency(v),
    },
    { key: "reference", label: "Reference", sortable: true },
    { key: "notes", label: "Notes", sortable: false },
  ];

  // Enhanced error handling
  if (error) {
    // Check if it's an authentication error (401)
    const isAuthError = error.includes("401") || error.toLowerCase().includes("authentication");
    
    if (isAuthError) {
      return (
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col items-center justify-center py-12 px-4">
            <div className="text-center">
              <svg
                className="mx-auto h-16 w-16 text-red-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                />
              </svg>
              <h3 className="mt-4 text-xl font-semibold text-gray-900">
                Authentication Required
              </h3>
              <p className="mt-2 text-gray-600">
                Please log in to view insurance overview data
              </p>
              <button
                onClick={() => (window.location.href = "/login")}
                className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Go to Login
              </button>
            </div>
          </div>
        </div>
      );
    }

    // General error state
    return (
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col items-center justify-center py-12 px-4">
          <div className="text-center">
            <svg
              className="mx-auto h-16 w-16 text-yellow-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            <h3 className="mt-4 text-xl font-semibold text-gray-900">
              Unable to Load Data
            </h3>
            <p className="mt-2 text-gray-600">{error}</p>
            <button
              onClick={refetch}
              className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Empty state when no data is available
  const hasData = data.claims.length > 0 || data.payments.length > 0;
  if (!loading && !hasData) {
    return (
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col items-center justify-center py-12 px-4">
          <div className="text-center">
            <svg
              className="mx-auto h-16 w-16 text-gray-300"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            <h3 className="mt-4 text-xl font-semibold text-gray-900">
              No Insurance Data Yet
            </h3>
            <p className="mt-2 text-gray-600">
              Get started by adding your first insurance claim or payment
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Handle Add Claim
  const handleAddClaim = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await fetch("/api/insurance-claims", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          providerId: claimForm.providerId,
          periodStart: claimForm.periodStart,
          periodEnd: claimForm.periodEnd,
          currency: "USD",
          claimedAmount: Number(claimForm.amount),
          notes: claimForm.notes,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to add claim");
      }

      // Reset form and close modal
      setClaimForm({ providerId: "", periodStart: "", periodEnd: "", amount: "", notes: "" });
      setShowAddClaimModal(false);
      // Refresh data
      refetch();
    } catch (error) {
      console.error("Error adding claim:", error);
      alert("Failed to add claim. Please try again.");
    }
  };

  // Handle Record Payment
  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await fetch("/api/insurance-payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          providerId: paymentForm.providerId,
          paymentDate: paymentForm.paymentDate,
          currency: "USD",
          amount: Number(paymentForm.amount),
          reference: paymentForm.reference,
          notes: paymentForm.notes,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to record payment");
      }

      // Reset form and close modal
      setPaymentForm({ providerId: "", paymentDate: "", amount: "", reference: "", notes: "" });
      setShowRecordPaymentModal(false);
      // Refresh data
      refetch();
    } catch (error) {
      console.error("Error recording payment:", error);
      alert("Failed to record payment. Please try again.");
    }
  };

  // Handle Export (simple CSV export for now)
  const handleExport = () => {
    const csv = [
      ["Provider", "Period", "Claimed Amount", "Status", "Notes"],
      ...claimsTableData.map(c => [
        c.provider,
        c.period,
        c.amount.toString(),
        c.status,
        c.notes || "",
      ]),
    ]
      .map(row => row.map(cell => `"${cell}"`).join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `insurance-overview-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Page Header with Action Buttons */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Insurance Overview</h1>
          <p className="text-gray-600 mt-1">
            Comprehensive analytics and insights for insurance claims and payments (USD only)
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setShowAddClaimModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Claim
          </button>
          <button
            onClick={() => setShowRecordPaymentModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            <DollarSign className="w-4 h-4" />
            Record Payment
          </button>
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
          >
            <Download className="w-4 h-4" />
            Export
          </button>
          <button
            onClick={refetch}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>
      </div>

      {/* Advanced Filters */}
      <AdvancedFilters
        filters={filters}
        providers={data.providers}
        onFilterChange={updateFilter}
        onClear={clearFilters}
        onApply={applyFilters}
        onDatePreset={setDatePreset}
      />

      {/* Executive Dashboard KPIs */}
      <ExecutiveDashboard
        claims={data.claims}
        payments={data.payments}
        loading={loading}
      />

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ProviderComparison
          claims={data.claims}
          payments={data.payments}
          providers={data.providers}
        />
        <AgingAnalysis claims={data.claims} payments={data.payments} />
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 gap-4">
        <PaymentTimeline claims={data.claims} payments={data.payments} />
      </div>

      {/* Data Tables */}
      <div className="space-y-4">
        <SmartTable
          data={claimsTableData}
          columns={claimsColumns}
          title="Claims"
          defaultPageSize={25}
        />

        <SmartTable
          data={paymentsTableData}
          columns={paymentsColumns}
          title="Payments"
          defaultPageSize={25}
        />
      </div>

      {/* Add Claim Modal */}
      <Dialog open={showAddClaimModal} onOpenChange={setShowAddClaimModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add New Insurance Claim (USD Only)</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAddClaim} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Provider *
              </label>
              <select
                required
                value={claimForm.providerId}
                onChange={(e) => setClaimForm({ ...claimForm, providerId: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Select Provider</option>
                {data.providers
                  .filter(p => p.isActive)
                  .map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Period Start *
              </label>
              <input
                required
                type="date"
                value={claimForm.periodStart}
                onChange={(e) => setClaimForm({ ...claimForm, periodStart: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Period End *
              </label>
              <input
                required
                type="date"
                value={claimForm.periodEnd}
                onChange={(e) => setClaimForm({ ...claimForm, periodEnd: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Amount (USD) *
              </label>
              <input
                required
                type="number"
                step="0.01"
                min="0"
                value={claimForm.amount}
                onChange={(e) => setClaimForm({ ...claimForm, amount: e.target.value })}
                placeholder="0.00"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Notes
              </label>
              <textarea
                value={claimForm.notes}
                onChange={(e) => setClaimForm({ ...claimForm, notes: e.target.value })}
                rows={3}
                placeholder="Optional notes..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <DialogFooter>
              <button
                type="button"
                onClick={() => setShowAddClaimModal(false)}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Add Claim
              </button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Record Payment Modal */}
      <Dialog open={showRecordPaymentModal} onOpenChange={setShowRecordPaymentModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Record Insurance Payment (USD Only)</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleRecordPayment} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Provider *
              </label>
              <select
                required
                value={paymentForm.providerId}
                onChange={(e) => setPaymentForm({ ...paymentForm, providerId: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              >
                <option value="">Select Provider</option>
                {data.providers
                  .filter(p => p.isActive)
                  .map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Payment Date *
              </label>
              <input
                required
                type="date"
                value={paymentForm.paymentDate}
                onChange={(e) => setPaymentForm({ ...paymentForm, paymentDate: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Amount (USD) *
              </label>
              <input
                required
                type="number"
                step="0.01"
                min="0"
                value={paymentForm.amount}
                onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                placeholder="0.00"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Reference Number
              </label>
              <input
                type="text"
                value={paymentForm.reference}
                onChange={(e) => setPaymentForm({ ...paymentForm, reference: e.target.value })}
                placeholder="Optional reference number..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Notes
              </label>
              <textarea
                value={paymentForm.notes}
                onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })}
                rows={3}
                placeholder="Optional notes..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>

            <DialogFooter>
              <button
                type="button"
                onClick={() => setShowRecordPaymentModal(false)}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                Record Payment
              </button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
