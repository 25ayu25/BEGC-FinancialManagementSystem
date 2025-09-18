'use client';

import React, { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { api } from '@/lib/queryClient';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

/* ───────────────────────── Types ───────────────────────── */

type Currency = 'SSP' | 'USD';
type TxType = 'income' | 'expense';
type SyncStatus = 'synced' | 'pending' | 'failed';

type Txn = {
  id: string;
  date: string; // ISO
  description: string;
  departmentId?: string;
  departmentName?: string;
  type: TxType;
  currency: Currency;
  amount: number;
  status: SyncStatus;
  providerName?: string;
};

type Department = { id: string; name: string };
type Provider = { id: string; name: string };
type Paged<T> = { items: T[]; total: number };

type TxQuery = {
  q: string;
  type: 'all' | TxType;
  dept: 'all' | string;
  provider: 'all' | string;
  start: string;     // yyyy-MM-dd
  end: string;       // yyyy-MM-dd
  page: string;      // keep string for URL stability
  pageSize: string;  // keep string for URL stability
  sort: 'date' | 'amount';
  order: 'asc' | 'desc';
};

/* ────────────────── Helpers & UI Utils ─────────────────── */

const nf0 = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });

function amountCell(value: number, currency: Currency, type: TxType) {
  const isExpense = type === 'expense';
  const classes = isExpense ? 'text-rose-600' : 'text-emerald-600';
  return (
    <span className={cn('tabular-nums', classes)}>
      {currency} {nf0.format(value)}
    </span>
  );
}

function useURLState<T extends Record<string, any>>(initial: T) {
  const [state, setState] = useState<T>(() => {
    const usp = new URLSearchParams(window.location.search);
    const merged: any = { ...initial };
    Object.keys(initial).forEach((k) => {
      const v = usp.get(k);
      if (v !== null) merged[k] = v;
    });
    return merged as T;
  });
  useEffect(() => {
    const usp = new URLSearchParams();
    Object.entries(state).forEach(([k, v]) => {
      if (v !== '' && v !== 'all' && v !== undefined && v !== null) {
        usp.set(k, String(v));
      }
    });
    const url = `${location.pathname}?${usp.toString()}`;
    window.history.replaceState({}, '', url);
  }, [state]);
  return [state, setState] as const;
}

/* ─────────────────────── API Calls ─────────────────────── */

async function fetchDepartments(): Promise<Department[]> {
  const { data } = await api.get('/api/departments');
  return data ?? [];
}

async function fetchProviders(): Promise<Provider[]> {
  const { data } = await api.get('/api/insurance/providers');
  return data ?? [];
}

/** Send tolerant params and normalize responses so rows always render */
async function fetchTransactions(params: Partial<TxQuery>): Promise<Paged<Txn>> {
  // Map UI state -> *all likely* backend param names
  const p: Record<string, any> = {
    // search
    q: params.q || '',

    // type (omit if "all")
    type: params.type && params.type !== 'all' ? params.type : undefined,

    // date range (send both variants)
    startDate: params.start || undefined,
    endDate: params.end || undefined,
    start: params.start || undefined,
    end: params.end || undefined,

    // department
    departmentId: params.dept && params.dept !== 'all' ? params.dept : undefined,
    dept: params.dept && params.dept !== 'all' ? params.dept : undefined,

    // provider / insurance provider
    providerId: params.provider && params.provider !== 'all' ? params.provider : undefined,
    insuranceProviderId: params.provider && params.provider !== 'all' ? params.provider : undefined,
    provider: params.provider && params.provider !== 'all' ? params.provider : undefined,

    // paging / sort (send a few common variants)
    page: params.page || '1',
    pageIndex: params.page || '1',
    pageNumber: params.page || '1',
    pageSize: params.pageSize || '50',
    sort: params.sort || 'date',
    order: params.order || 'desc',
  };

  // strip undefined values
  Object.keys(p).forEach((k) => p[k] === undefined && delete p[k]);

  const { data } = await api.get('/api/transactions', { params: p });

  // Normalize response: array | {items,total} | {data,total} | {records,totalCount} | {result,count}
  let items: any[] = [];
  let total = 0;

  if (Array.isArray(data)) {
    items = data;
    total = data.length;
  } else if (data?.items && Array.isArray(data.items)) {
    items = data.items;
    total = data.total ?? data.items.length ?? 0;
  } else if (data?.data && Array.isArray(data.data)) {
    items = data.data;
    total = data.total ?? data.data.length ?? 0;
  } else if (data?.records && Array.isArray(data.records)) {
    items = data.records;
    total = data.totalCount ?? data.records.length ?? 0;
  } else if (data?.result && Array.isArray(data.result)) {
    items = data.result;
    total = data.count ?? data.result.length ?? 0;
  }

  return { items, total };
}

/** CSV export uses same tolerant mapping */
async function exportCsv(params: Partial<TxQuery>) {
  const p: Record<string, any> = {
    q: params.q || '',
    type: params.type && params.type !== 'all' ? params.type : undefined,

    startDate: params.start || undefined,
    endDate: params.end || undefined,
    start: params.start || undefined,
    end: params.end || undefined,

    departmentId: params.dept && params.dept !== 'all' ? params.dept : undefined,
    providerId: params.provider && params.provider !== 'all' ? params.provider : undefined,
    insuranceProviderId: params.provider && params.provider !== 'all' ? params.provider : undefined,

    page: params.page || '1',
    pageSize: params.pageSize || '50',
    sort: params.sort || 'date',
    order: params.order || 'desc',
  };
  Object.keys(p).forEach((k) => p[k] === undefined && delete p[k]);

  const { data } = await api.get('/api/transactions/export', {
    params: p,
    responseType: 'blob',
  });
  const url = URL.createObjectURL(new Blob([data], { type: 'text/csv' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = 'transactions.csv';
  a.click();
  URL.revokeObjectURL(url);
}

/* ───────────────────────── Page ───────────────────────── */

export default function TransactionsPage() {
  const thisMonthStart = format(startOfMonth(new Date()), 'yyyy-MM-dd');
  const thisMonthEnd = format(endOfMonth(new Date()), 'yyyy-MM-dd');

  const [filters, setFilters] = useURLState<TxQuery>({
    q: '',
    type: 'all',
    dept: 'all',
    provider: 'all',
    start: thisMonthStart,
    end: thisMonthEnd,
    page: '1',
    pageSize: '50',
    sort: 'date',
    order: 'desc',
  });

  const { data: departments = [] } = useQuery({
    queryKey: ['depts'],
    queryFn: fetchDepartments,
    staleTime: 5 * 60_000,
  });

  const { data: providers = [] } = useQuery({
    queryKey: ['provs'],
    queryFn: fetchProviders,
    staleTime: 5 * 60_000,
  });

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['tx', filters],
    queryFn: () => fetchTransactions(filters),
    keepPreviousData: true,
    staleTime: 30_000,
  });

  const items = data?.items ?? [];
  const total = data?.total ?? 0;

  /* Quick presets */
  const setThisMonth = () =>
    setFilters((s) => ({
      ...s,
      start: format(startOfMonth(new Date()), 'yyyy-MM-dd'),
      end: format(endOfMonth(new Date()), 'yyyy-MM-dd'),
      page: '1',
    }));

  const setLastMonth = () => {
    const d = subMonths(new Date(), 1);
    setFilters((s) => ({
      ...s,
      start: format(startOfMonth(d), 'yyyy-MM-dd'),
      end: format(endOfMonth(d), 'yyyy-MM-dd'),
      page: '1',
    }));
  };

  const clearDates = () =>
    setFilters((s) => ({
      ...s,
      start: '',
      end: '',
      page: '1',
    }));

  const handleExport = () => exportCsv(filters);

  const from = (Number(filters.page) - 1) * Number(filters.pageSize) + 1;
  const to = Number(filters.page) * Number(filters.pageSize);
  const safeTotal = total || items.length;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold">Transaction Management</h1>
          <p className="text-sm text-slate-500">
            Add and manage daily income and expense transactions
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleExport}>Export CSV</Button>
          <Button onClick={() => window.dispatchEvent(new CustomEvent('open-add-tx'))}>
            + Add Transaction
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            <div className="md:col-span-2">
              <Label>Search</Label>
              <Input
                placeholder="Search descriptions, refs, notes…"
                value={filters.q}
                onChange={(e) => setFilters((s) => ({ ...s, q: e.target.value, page: '1' }))}
              />
            </div>

            <div>
              <Label>Type</Label>
              <Select
                value={filters.type}
                onValueChange={(v) =>
                  setFilters((s) => ({ ...s, type: v as 'all' | TxType, page: '1' }))
                }
              >
                <SelectTrigger><SelectValue placeholder="All types" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All types</SelectItem>
                  <SelectItem value="income">Income</SelectItem>
                  <SelectItem value="expense">Expense</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Department</Label>
              <Select
                value={filters.dept}
                onValueChange={(v) => setFilters((s) => ({ ...s, dept: v, page: '1' }))}
              >
                <SelectTrigger><SelectValue placeholder="All departments" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All departments</SelectItem>
                  {departments.map((d) => (
                    <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Insurance Provider</Label>
              <Select
                value={filters.provider}
                onValueChange={(v) => setFilters((s) => ({ ...s, provider: v, page: '1' }))}
              >
                <SelectTrigger><SelectValue placeholder="All providers" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All providers</SelectItem>
                  {providers.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div>
              <Label>Start Date</Label>
              <Input
                type="date"
                value={filters.start}
                onChange={(e) => setFilters((s) => ({ ...s, start: e.target.value, page: '1' }))}
              />
            </div>
            <div>
              <Label>End Date</Label>
              <Input
                type="date"
                value={filters.end}
                onChange={(e) => setFilters((s) => ({ ...s, end: e.target.value, page: '1' }))}
              />
            </div>
            <div className="flex items-end gap-2">
              <Button variant="outline" onClick={setThisMonth}>This month</Button>
              <Button variant="outline" onClick={setLastMonth}>Last month</Button>
              <Button variant="ghost" onClick={clearDates}>Clear</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="pt-6">
          <div className="overflow-auto rounded-md border">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 sticky top-[64px]">
                <tr className="text-left">
                  <th className="px-3 py-2">Date</th>
                  <th className="px-3 py-2">Description</th>
                  <th className="px-3 py-2">Department</th>
                  <th className="px-3 py-2">Type</th>
                  <th className="px-3 py-2">Currency</th>
                  <th className="px-3 py-2 text-right">Amount</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2 w-24 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr><td colSpan={8}><Skeleton className="h-24 w-full" /></td></tr>
                ) : isError ? (
                  <tr>
                    <td colSpan={8} className="p-6 text-center text-rose-600">
                      Couldn’t load transactions. {String((error as any)?.message ?? '')}
                    </td>
                  </tr>
                ) : items.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-6 text-center text-slate-500">
                      No transactions for this period.
                    </td>
                  </tr>
                ) : (
                  items.map((t) => (
                    <tr key={t.id} className="border-t">
                      <td className="px-3 py-2 tabular-nums">
                        {format(new Date(t.date), 'M/d/yyyy')}
                      </td>
                      <td className="px-3 py-2 truncate max-w-[360px]">{t.description}</td>
                      <td className="px-3 py-2">
                        {t.departmentName ?? <span className="text-slate-400">—</span>}
                      </td>
                      <td className="px-3 py-2">
                        {t.type === 'income'
                          ? <Badge className="bg-emerald-600">Income</Badge>
                          : <Badge className="bg-rose-600">Expense</Badge>}
                      </td>
                      <td className="px-3 py-2"><Badge variant="outline">{t.currency}</Badge></td>
                      <td className="px-3 py-2 text-right">
                        {amountCell(t.amount, t.currency, t.type)}
                      </td>
                      <td className="px-3 py-2">
                        <Badge
                          variant={
                            t.status === 'synced'
                              ? 'secondary'
                              : t.status === 'pending'
                                ? 'outline'
                                : 'destructive'
                          }
                        >
                          {t.status}
                        </Badge>
                      </td>
                      <td className="px-3 py-2 text-right">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            window.dispatchEvent(new CustomEvent('open-edit-tx', { detail: { id: t.id } }))
                          }
                        >
                          Edit
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="mt-3 flex items-center justify-between text-sm">
            <div className="text-slate-500">
              Showing {items.length ? from : 0}–{Math.min(to, safeTotal)} of {safeTotal}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline" size="sm"
                disabled={Number(filters.page) <= 1}
                onClick={() => setFilters((s) => ({ ...s, page: String(Number(s.page) - 1) }))}
              >
                Previous
              </Button>
              <Button
                variant="outline" size="sm"
                disabled={Number(filters.page) * Number(filters.pageSize) >= safeTotal}
                onClick={() => setFilters((s) => ({ ...s, page: String(Number(s.page) + 1) }))}
              >
                Next
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
