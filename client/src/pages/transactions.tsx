'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { api } from '@/lib/queryClient';

import {
  Card, CardHeader, CardTitle, CardContent,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from '@/components/ui/select';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

/* ─── Types ─────────────────────────────────────────────────────────────── */

type Currency = 'SSP' | 'USD';
type TxType = 'income' | 'expense';
type SyncStatus = 'synced' | 'pending' | 'failed';

type Txn = {
  id: string;
  date: string;          // ISO YYYY-MM-DD
  description: string;
  departmentId?: string;
  departmentName?: string;
  type: TxType;
  currency: Currency;
  amount: number;
  method?: string;
  status: SyncStatus;
  providerName?: string;
};

type Department = { id: string; name: string };
type Provider = { id: string; name: string };

type Paged<T> = { items: T[]; total: number };

type TxQuery = {
  q: string;
  type: TxType | '' | 'all';
  dept: string | 'all';
  provider: string | 'all';
  start: string;
  end: string;
  page: string;     // keep as string for URL stability
  pageSize: string; // keep as string for URL stability
  sort: 'date' | 'amount';
  order: 'asc' | 'desc';
};

/* ─── Helpers ───────────────────────────────────────────────────────────── */

const nf0 = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });

function fmtAmount(n: number, c: Currency, type: TxType) {
  const sign = type === 'expense' ? -1 : 1;
  const val = sign * n;
  return (
    <span className={cn(val < 0 ? 'text-rose-600' : 'text-emerald-600', 'tabular-nums')}>
      {c} {nf0.format(Math.abs(val))}
    </span>
  );
}

function useURLState<T extends Record<string, any>>(initial: T) {
  const [state, setState] = useState<T>(() => {
    const usp = new URLSearchParams(window.location.search);
    const merged: any = { ...initial };
    for (const k of Object.keys(initial)) {
      const v = usp.get(k);
      if (v !== null) merged[k] = v;
    }
    return merged as T;
  });
  useEffect(() => {
    const usp = new URLSearchParams();
    Object.entries(state).forEach(([k, v]) => {
      if (v !== '' && v !== 'all' && v !== undefined && v !== null) usp.set(k, String(v));
    });
    const url = `${location.pathname}?${usp.toString()}`;
    window.history.replaceState({}, '', url);
  }, [state]);
  return [state, setState] as const;
}

function monthSortKey(label: string) {
  // "September 2025" -> Date("2025-09-01")
  const [name, yearStr] = label.split(' ');
  const year = Number(yearStr) || 1970;
  const monthNames = ['january','february','march','april','may','june','july','august','september','october','november','december'];
  const idx = monthNames.indexOf(name.toLowerCase());
  return new Date(year, Math.max(0, idx), 1).getTime();
}

/* ─── API ───────────────────────────────────────────────────────────────── */

async function fetchDepartments(): Promise<Department[]> {
  const { data } = await api.get('/api/departments');
  return data ?? [];
}

async function fetchProviders(): Promise<Provider[]> {
  const { data } = await api.get('/api/insurance/providers');
  return data ?? [];
}

async function fetchTransactions(params: Partial<TxQuery>): Promise<Paged<Txn>> {
  const { data } = await api.get('/api/transactions', { params });
  return data ?? { items: [], total: 0 };
}

async function exportCsv(params: Partial<TxQuery>) {
  const { data } = await api.get('/api/transactions/export', {
    params,
    responseType: 'blob',
  });
  const url = URL.createObjectURL(new Blob([data], { type: 'text/csv' }));
  const a = document.createElement('a');
  a.href = url; a.download = 'transactions.csv'; a.click();
  URL.revokeObjectURL(url);
}

/* ─── Page ──────────────────────────────────────────────────────────────── */

export default function TransactionsPro() {
  // NOTE: default everything to strings so selects ALWAYS get a string
  const [filters, setFilters] = useURLState<TxQuery>({
    q: '',
    type: 'all',
    dept: 'all',
    provider: 'all',
    start: '',
    end: '',
    page: '1',
    pageSize: '50',
    sort: 'date',
    order: 'desc',
  });

  const [view, setView] = useState<'monthly'|'table'>('monthly');
  const [selection, setSelection] = useState<string[]>([]);
  const [drawer, setDrawer] = useState<{ open: boolean; tx?: Txn }>({ open: false });

  const { data: departments = [] } = useQuery({ queryKey: ['depts'], queryFn: fetchDepartments });
  const { data: providers = [] } = useQuery({ queryKey: ['provs'], queryFn: fetchProviders });

  const {
    data: txPage,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ['tx', filters],
    queryFn: () => fetchTransactions({
      ...filters,
      // convert 'all' to nothing for the API
      type: filters.type === 'all' ? '' : filters.type,
      dept: filters.dept === 'all' ? '' : filters.dept,
      provider: filters.provider === 'all' ? '' : filters.provider,
    }),
    keepPreviousData: true,
    staleTime: 30_000,
  });

  const items = txPage?.items ?? [];
  const total = txPage?.total ?? 0;

  // KPI strip (filtered set)
  const kpis = useMemo(() => {
    let sspInc = 0, sspExp = 0, usdInc = 0, usdExp = 0;
    for (const t of items) {
      if (t.currency === 'SSP') {
        if (t.type === 'income') sspInc += t.amount; else sspExp += t.amount;
      } else {
        if (t.type === 'income') usdInc += t.amount; else usdExp += t.amount;
      }
    }
    return { sspInc, sspExp, sspNet: sspInc - sspExp, usdInc, usdExp, usdNet: usdInc - usdExp };
  }, [items]);

  // group by month label
  const grouped = useMemo(() => {
    const map = new Map<string, Txn[]>();
    for (const t of items) {
      const m = format(new Date(t.date), 'MMMM yyyy');
      if (!map.has(m)) map.set(m, []);
      map.get(m)!.push(t);
    }
    return Array.from(map.entries())
      .map(([month, list]) => {
        let ssp = 0, usd = 0;
        list.forEach((t) => {
          const v = t.type === 'expense' ? -t.amount : t.amount;
          if (t.currency === 'SSP') ssp += v; else usd += v;
        });
        return { month, list, totalSSP: ssp, totalUSD: usd, key: monthSortKey(month) };
      })
      .sort((a, b) => b.key - a.key);
  }, [items]);

  const onExport = () => exportCsv({
    ...filters,
    type: filters.type === 'all' ? '' : filters.type,
    dept: filters.dept === 'all' ? '' : filters.dept,
    provider: filters.provider === 'all' ? '' : filters.provider,
  });

  const clearAll = () => setFilters({
    q: '', type: 'all', dept: 'all', provider: 'all',
    start: '', end: '', page: '1', pageSize: '50', sort: 'date', order: 'desc',
  });

  /* ─── UI ─────────────────────────────────────────────────────────────── */

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold">Transaction Management</h1>
          <p className="text-sm text-slate-500">Add and manage daily income and expense transactions</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={onExport}>Export CSV</Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button>+ Add Transaction</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              <DropdownMenuItem onClick={() => window.dispatchEvent(new CustomEvent('open-add-tx', { detail: { type: 'income' } }))}>+ Income</DropdownMenuItem>
              <DropdownMenuItem onClick={() => window.dispatchEvent(new CustomEvent('open-add-tx', { detail: { type: 'expense' } }))}>+ Expense</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Sticky Filters */}
      <Card className="sticky top-16 z-10">
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
              <Label>Transaction Type</Label>
              <Select
                value={filters.type} // ALWAYS a string
                onValueChange={(v) => setFilters((s) => ({ ...s, type: v as any, page: '1' }))}
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
              <Input type="date" value={filters.start} onChange={(e) => setFilters((s) => ({ ...s, start: e.target.value, page: '1' }))} />
            </div>
            <div>
              <Label>End Date</Label>
              <Input type="date" value={filters.end} onChange={(e) => setFilters((s) => ({ ...s, end: e.target.value, page: '1' }))} />
            </div>
            <div className="flex items-end gap-2">
              <Button variant="outline" onClick={clearAll}>Clear All</Button>
              <div className="inline-flex rounded-md border">
                <button
                  className={cn('px-3 py-2 text-sm', view==='monthly' ? 'bg-slate-900 text-white' : 'text-slate-700')}
                  onClick={()=>setView('monthly')}
                >
                  Monthly
                </button>
                <button
                  className={cn('px-3 py-2 text-sm border-l', view==='table' ? 'bg-slate-900 text-white' : 'text-slate-700')}
                  onClick={()=>setView('table')}
                >
                  Table
                </button>
              </div>
            </div>
          </div>

          {/* Chips */}
          <div className="flex flex-wrap gap-2">
            {filters.q !== '' && <Chip label={`Search: "${filters.q}"`} onClear={()=>setFilters((s)=>({ ...s, q:'', page:'1' }))} />}
            {filters.type !== 'all' && <Chip label={`Type: ${filters.type}`} onClear={()=>setFilters((s)=>({ ...s, type:'all', page:'1' }))} />}
            {filters.dept !== 'all' && (
              <Chip
                label={`Dept: ${departments.find(d=>d.id===filters.dept)?.name ?? filters.dept}`}
                onClear={()=>setFilters((s)=>({ ...s, dept:'all', page:'1' }))}
              />
            )}
            {filters.provider !== 'all' && (
              <Chip
                label={`Provider: ${providers.find(p=>p.id===filters.provider)?.name ?? filters.provider}`}
                onClear={()=>setFilters((s)=>({ ...s, provider:'all', page:'1' }))}
              />
            )}
            {filters.start && <Chip label={`From: ${filters.start}`} onClear={()=>setFilters((s)=>({ ...s, start:'', page:'1' }))} />}
            {filters.end && <Chip label={`To: ${filters.end}`} onClear={()=>setFilters((s)=>({ ...s, end:'', page:'1' }))} />}
          </div>
        </CardContent>
      </Card>

      {/* KPI strip */}
      <Card>
        <CardContent className="pt-6 grid grid-cols-2 md:grid-cols-6 gap-4">
          <KPI title="Income (SSP)" value={`SSP ${nf0.format(kpis.sspInc)}`} />
          <KPI title="Expense (SSP)" value={`SSP ${nf0.format(kpis.sspExp)}`} />
          <KPI title="Net (SSP)" value={`SSP ${nf0.format(kpis.sspNet)}`} positive={kpis.sspNet>=0} />
          <KPI title="Income (USD)" value={`USD ${nf0.format(kpis.usdInc)}`} />
          <KPI title="Expense (USD)" value={`USD ${nf0.format(kpis.usdExp)}`} />
          <KPI title="Net (USD)" value={`USD ${nf0.format(kpis.usdNet)}`} positive={kpis.usdNet>=0} />
        </CardContent>
      </Card>

      {/* Error/empty states */}
      {isError ? (
        <Card>
          <CardContent className="p-6">
            <div className="text-sm text-rose-600 font-medium">Couldn’t load transactions.</div>
            <div className="text-xs text-slate-500 mt-1">
              {String((error as any)?.message || 'Check authentication / permissions (401).')}
            </div>
          </CardContent>
        </Card>
      ) : view === 'monthly' ? (
        <MonthlyGroups
          grouped={grouped}
          isLoading={isLoading}
          onOpen={(tx) => setDrawer({ open: true, tx })}
        />
      ) : (
        <TransactionsTable
          items={items}
          total={total}
          filters={filters}
          setFilters={setFilters}
          selection={selection}
          setSelection={setSelection}
          onOpen={(tx) => setDrawer({ open: true, tx })}
          isLoading={isLoading}
        />
      )}

      {/* Drawer */}
      <Sheet open={drawer.open} onOpenChange={(v)=>setDrawer((s)=>({ ...s, open:v }))}>
        <SheetContent className="w-[420px] sm:w-[460px]">
          <SheetHeader><SheetTitle>Transaction details</SheetTitle></SheetHeader>
          {drawer.tx ? <Details tx={drawer.tx} /> : <div className="p-4 text-slate-500">No transaction.</div>}
        </SheetContent>
      </Sheet>
    </div>
  );
}

/* ─── Sub-components ────────────────────────────────────────────────────── */

function KPI({ title, value, positive }: { title: string; value: string; positive?: boolean }) {
  return (
    <div>
      <div className="text-xs text-slate-500">{title}</div>
      <div className={cn('text-base font-semibold', positive === undefined ? '' : (positive ? 'text-emerald-600' : 'text-rose-600'))}>
        {value}
      </div>
    </div>
  );
}

function Chip({ label, onClear }: { label: string; onClear: () => void }) {
  return (
    <Badge variant="secondary" className="gap-2">
      {label}
      <button className="text-slate-500 hover:text-slate-700" onClick={onClear} aria-label="Remove filter">×</button>
    </Badge>
  );
}

function MonthlyGroups({
  grouped,
  isLoading,
  onOpen,
}: {
  grouped: { month: string; list: Txn[]; totalSSP: number; totalUSD: number; key: number }[];
  isLoading: boolean;
  onOpen: (tx: Txn) => void;
}) {
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-base">Recent Transactions</CardTitle></CardHeader>
      <CardContent className="space-y-6">
        {isLoading ? (
          <Skeleton className="h-40 w-full" />
        ) : grouped.length === 0 ? (
          <div className="text-sm text-slate-500">No transactions for this period.</div>
        ) : (
          grouped.map((g) => (
            <div key={g.key}>
              <div className="flex items-center justify-between border-b pb-2">
                <div className="font-medium">{g.month}</div>
                <div className="text-xs text-slate-500 space-x-4">
                  <span className="text-emerald-600">SSP {nf0.format(g.totalSSP)}</span>
                  <span className="text-sky-600">USD {nf0.format(g.totalUSD)}</span>
                </div>
              </div>
              <div className="divide-y">
                {g.list.map((t) => (
                  <div key={t.id} className="grid grid-cols-12 items-center py-2 text-sm">
                    <div className="col-span-2 tabular-nums">{format(new Date(t.date), 'M/d/yyyy')}</div>
                    <div className="col-span-3 text-slate-700 truncate">{t.description}</div>
                    <div className="col-span-2 text-slate-600">{t.departmentName ?? '-'}</div>
                    <div className="col-span-2">{fmtAmount(t.amount, t.currency, t.type)}</div>
                    <div className="col-span-2">
                      <Badge variant={t.status === 'synced' ? 'secondary' : t.status === 'pending' ? 'outline' : 'destructive'}>{t.status}</Badge>
                    </div>
                    <div className="col-span-1 text-right">
                      <Button variant="ghost" size="sm" onClick={() => onOpen(t)}>View</Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

function TransactionsTable({
  items, total, filters, setFilters, selection, setSelection, onOpen, isLoading,
}: {
  items: Txn[];
  total: number;
  filters: TxQuery;
  setFilters: (fn: (s: TxQuery) => TxQuery) => void;
  selection: string[];
  setSelection: (v: string[]) => void;
  onOpen: (tx: Txn) => void;
  isLoading: boolean;
}) {
  const allChecked = selection.length > 0 && selection.length === items.length;
  const someChecked = selection.length > 0 && selection.length < items.length;

  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-base">Transactions</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        {selection.length > 0 && (
          <div className="flex items-center justify-between rounded-md border p-2 bg-slate-50">
            <div className="text-sm">{selection.length} selected</div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => exportCsv({ ...filters, ids: selection as any })}>Export selected</Button>
              <Button variant="destructive" size="sm" onClick={() => alert('Delete selected (wire your API)')}>Delete</Button>
            </div>
          </div>
        )}

        <div className="overflow-auto rounded-md border">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 sticky top-[calc(64px+96px)]">
              <tr className="text-left">
                <th className="w-10 px-3 py-2">
                  <Checkbox
                    checked={allChecked}
                    indeterminate={someChecked}
                    onCheckedChange={(v) => setSelection(v ? items.map(i=>i.id) : [])}
                  />
                </th>
                <th className="px-3 py-2 cursor-pointer"
                    onClick={()=>setFilters((s)=>({ ...s, sort:'date', order: s.order==='asc' ? 'desc' : 'asc' }))}>
                  Date
                </th>
                <th className="px-3 py-2">Description</th>
                <th className="px-3 py-2">Department</th>
                <th className="px-3 py-2">Type</th>
                <th className="px-3 py-2">Currency</th>
                <th className="px-3 py-2 text-right">Amount</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2 w-20 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={9}><Skeleton className="h-24 w-full" /></td></tr>
              ) : items.length === 0 ? (
                <tr><td colSpan={9} className="p-6 text-center text-slate-500">No transactions for this view.</td></tr>
              ) : (
                items.map((t) => {
                  const checked = selection.includes(t.id);
                  return (
                    <tr key={t.id} className="border-t">
                      <td className="px-3 py-2">
                        <Checkbox checked={checked} onCheckedChange={(v)=>setSelection(v ? [...selection, t.id] : selection.filter(id=>id!==t.id))} />
                      </td>
                      <td className="px-3 py-2 tabular-nums">{format(new Date(t.date), 'M/d/yyyy')}</td>
                      <td className="px-3 py-2 truncate max-w-[280px]">{t.description}</td>
                      <td className="px-3 py-2">{t.departmentName ?? '-'}</td>
                      <td className="px-3 py-2">{t.type === 'income' ? <Badge className="bg-emerald-600">Income</Badge> : <Badge className="bg-rose-600">Expense</Badge>}</td>
                      <td className="px-3 py-2"><Badge variant="outline">{t.currency}</Badge></td>
                      <td className="px-3 py-2 text-right">{fmtAmount(t.amount, t.currency, t.type)}</td>
                      <td className="px-3 py-2">
                        <Badge variant={t.status === 'synced' ? 'secondary' : t.status === 'pending' ? 'outline' : 'destructive'}>{t.status}</Badge>
                      </td>
                      <td className="px-3 py-2 text-right">
                        <Button size="sm" variant="ghost" onClick={()=>onOpen(t)}>View</Button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between text-sm">
          <div className="text-slate-500">
            Showing {(Number(filters.page)-1)*Number(filters.pageSize)+1}–{Math.min(Number(filters.page)*Number(filters.pageSize), total)} of {total}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline" size="sm"
              disabled={Number(filters.page) <= 1}
              onClick={()=>setFilters((s)=>({ ...s, page: String(Number(s.page)-1) }))}
            >Previous</Button>
            <Button
              variant="outline" size="sm"
              disabled={Number(filters.page)*Number(filters.pageSize) >= total}
              onClick={()=>setFilters((s)=>({ ...s, page: String(Number(s.page)+1) }))}
            >Next</Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function Details({ tx }: { tx: Txn }) {
  return (
    <div className="space-y-4 pt-4">
      <Field label="Date" value={format(new Date(tx.date), 'PPP')} />
      <Field label="Description" value={tx.description} />
      <div className="grid grid-cols-2 gap-3">
        <Field label="Department" value={tx.departmentName ?? '-'} />
        <Field label="Type" value={tx.type} />
        <Field label="Currency" value={tx.currency} />
        <Field label="Amount" value={`${tx.currency} ${nf0.format(tx.amount)}`} />
        <Field label="Method" value={tx.method ?? '-'} />
        <Field label="Status" value={tx.status} />
        {tx.providerName ? <Field label="Provider" value={tx.providerName} /> : null}
      </div>
      <div className="pt-2"><Button>Edit</Button></div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs text-slate-500">{label}</div>
      <div className="font-medium">{value}</div>
    </div>
  );
}
