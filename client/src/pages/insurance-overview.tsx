/**
 * Insurance Overview Page - Main Dashboard
 */

import React from "react";
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

export default function InsuranceOverview() {
  const {
    filters,
    updateFilter,
    clearFilters,
    applyFilters,
    setDatePreset,
  } = useAdvancedFilters();

  const { data, loading, error, refetch } = useInsuranceOverview(filters);

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

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Page Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Insurance Overview</h1>
          <p className="text-gray-600 mt-1">
            Comprehensive analytics and insights for insurance claims and payments
          </p>
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
    </div>
  );
}
