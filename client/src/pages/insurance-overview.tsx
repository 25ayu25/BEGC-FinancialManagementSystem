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

  if (error) {
    return (
      <div className="max-w-7xl mx-auto">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-900">
          <h3 className="font-semibold mb-2">Error Loading Data</h3>
          <p>{error}</p>
          <button
            onClick={refetch}
            className="mt-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Retry
          </button>
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
