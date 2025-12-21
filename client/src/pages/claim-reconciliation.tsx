import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import PageTitle from '@/components/PageTitle';
import { api } from '@/utils/api';

/**
 * Claim Reconciliation page
 *
 * Changes in this commit:
 * 1) KPI logic: "Total Claims" always reflects the total for the selected year/month (or all)
 *    and does NOT change when `inventoryStatusFilter` changes. The table remains filtered.
 * 2) UI: Replace year/month <select> dropdowns with quick-select pill/tabs (including "All").
 */

type InventoryStatus = 'All' | 'Open' | 'Closed' | 'Pending' | 'Denied' | 'Approved';

const YEARS: Array<number | 'All'> = ['All', 2023, 2024, 2025];
const MONTHS: Array<number | 'All'> = ['All', 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

function classNames(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

function PillTabs<T extends string | number>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly T[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="text-sm font-medium text-slate-700">{label}</div>
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => {
          const isActive = opt === value;
          return (
            <button
              key={String(opt)}
              type="button"
              onClick={() => onChange(opt)}
              className={classNames(
                'rounded-full border px-3 py-1 text-sm transition',
                isActive
                  ? 'border-blue-600 bg-blue-600 text-white'
                  : 'border-slate-300 bg-white text-slate-700 hover:border-slate-400 hover:bg-slate-50'
              )}
            >
              {String(opt) === 'All'
                ? 'All'
                : label === 'Month'
                  ? new Date(2000, Number(opt) - 1, 1).toLocaleString('en-US', {
                      month: 'short',
                    })
                  : String(opt)}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function ClaimReconciliationPage() {
  const router = useRouter();

  // Filters
  const [selectedYear, setSelectedYear] = useState<number | 'All'>('All');
  const [selectedMonth, setSelectedMonth] = useState<number | 'All'>('All');
  const [inventoryStatusFilter, setInventoryStatusFilter] = useState<InventoryStatus>('All');

  // Keep query params in sync (optional; safe if existing page already used router)
  useEffect(() => {
    const q: Record<string, string> = { ...router.query } as any;
    q.year = String(selectedYear);
    q.month = String(selectedMonth);
    q.status = String(inventoryStatusFilter);
    router.replace({ pathname: router.pathname, query: q }, undefined, { shallow: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedYear, selectedMonth, inventoryStatusFilter]);

  // Data fetch (existing query assumed; adapt to your actual API shape if different)
  const claimsInventoryQuery = api.claims.getClaimsInventory.useQuery(
    {
      year: selectedYear === 'All' ? undefined : selectedYear,
      month: selectedMonth === 'All' ? undefined : selectedMonth,
      status: inventoryStatusFilter === 'All' ? undefined : inventoryStatusFilter,
    } as any,
    { keepPreviousData: true }
  );

  // NEW: KPI total should ignore status filter; use a second query without status
  const claimsInventoryForKpiQuery = api.claims.getClaimsInventory.useQuery(
    {
      year: selectedYear === 'All' ? undefined : selectedYear,
      month: selectedMonth === 'All' ? undefined : selectedMonth,
      // intentionally omit status to keep KPI stable
    } as any,
    { keepPreviousData: true }
  );

  const tableRows = useMemo(() => {
    return (claimsInventoryQuery.data ?? []) as any[];
  }, [claimsInventoryQuery.data]);

  const kpiRows = useMemo(() => {
    return (claimsInventoryForKpiQuery.data ?? []) as any[];
  }, [claimsInventoryForKpiQuery.data]);

  const totalClaims = useMemo(() => {
    // If API returns an aggregated object, prefer it; otherwise fall back to array length
    const d: any = claimsInventoryForKpiQuery.data;
    if (!d) return 0;
    if (typeof d === 'object' && !Array.isArray(d) && typeof d.total === 'number') return d.total;
    if (Array.isArray(d)) return d.length;
    return 0;
  }, [claimsInventoryForKpiQuery.data]);

  const totalAmount = useMemo(() => {
    // Sum amounts from the unfiltered KPI dataset so amount KPI is stable as well.
    if (!Array.isArray(kpiRows)) return 0;
    return kpiRows.reduce((sum, r) => sum + (Number(r?.amount ?? r?.totalAmount ?? 0) || 0), 0);
  }, [kpiRows]);

  return (
    <div className="p-6">
      <PageTitle title="Claim Reconciliation" />

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <PillTabs label="Year" options={YEARS} value={selectedYear} onChange={setSelectedYear as any} />
        <PillTabs label="Month" options={MONTHS} value={selectedMonth} onChange={setSelectedMonth as any} />
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <label className="text-sm font-medium text-slate-700">Inventory Status</label>
        <select
          className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
          value={inventoryStatusFilter}
          onChange={(e) => setInventoryStatusFilter(e.target.value as InventoryStatus)}
        >
          {['All', 'Open', 'Closed', 'Pending', 'Denied', 'Approved'].map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="text-sm text-slate-500">Total Claims</div>
          <div className="mt-1 text-2xl font-semibold text-slate-900">{totalClaims}</div>
          <div className="mt-1 text-xs text-slate-400">
            {selectedYear === 'All' ? 'All years' : selectedYear}
            {selectedMonth === 'All'
              ? selectedYear === 'All'
                ? ''
                : ' (all months)'
              : ` • ${new Date(2000, Number(selectedMonth) - 1, 1).toLocaleString('en-US', {
                  month: 'long',
                })}`}
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="text-sm text-slate-500">Total Amount</div>
          <div className="mt-1 text-2xl font-semibold text-slate-900">
            {totalAmount.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
          </div>
          <div className="mt-1 text-xs text-slate-400">Unfiltered by inventory status</div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="text-sm text-slate-500">Showing</div>
          <div className="mt-1 text-2xl font-semibold text-slate-900">{tableRows.length}</div>
          <div className="mt-1 text-xs text-slate-400">Filtered table rows</div>
        </div>
      </div>

      <div className="mt-8">
        {claimsInventoryQuery.isLoading ? (
          <div className="text-sm text-slate-600">Loading claims inventory…</div>
        ) : claimsInventoryQuery.isError ? (
          <div className="text-sm text-red-600">Failed to load claims inventory.</div>
        ) : (
          <div className="overflow-auto rounded-lg border border-slate-200 bg-white">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                    Claim #
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                    Amount
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                    Date
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {tableRows.map((row) => (
                  <tr key={row.id ?? row.claimNumber}>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-900">
                      {row.claimNumber ?? row.id}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-700">
                      {row.inventoryStatus ?? row.status}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-700">
                      {(Number(row.amount ?? row.totalAmount ?? 0) || 0).toLocaleString('en-US', {
                        style: 'currency',
                        currency: 'USD',
                      })}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-700">
                      {row.date ? new Date(row.date).toLocaleDateString() : ''}
                    </td>
                  </tr>
                ))}
                {tableRows.length === 0 && (
                  <tr>
                    <td className="px-4 py-6 text-center text-sm text-slate-500" colSpan={4}>
                      No claims found for the selected filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
