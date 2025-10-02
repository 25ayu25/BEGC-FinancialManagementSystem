// client/src/pages/reports.tsx
'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';

import { api } from '@/lib/queryClient';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';

import {
  Calendar,
  FileText,
  Loader2,
  Download,
  Trash2,
} from 'lucide-react';

/* ------------------------- helpers & constants -------------------------- */

const months = [
  { value: 1, label: 'January' },
  { value: 2, label: 'February' },
  { value: 3, label: 'March' },
  { value: 4, label: 'April' },
  { value: 5, label: 'May' },
  { value: 6, label: 'June' },
  { value: 7, label: 'July' },
  { value: 8, label: 'August' },
  { value: 9, label: 'September' },
  { value: 10, label: 'October' },
  { value: 11, label: 'November' },
  { value: 12, label: 'December' },
];

const nf0 = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
const fmtSSP = (n: number) => `SSP ${nf0.format(Math.round(Number(n || 0)))}`;

/** robust PDF download that avoids blank file issues */
async function fetchAndDownloadPdf(url: string, filename: string) {
  const bust = url.includes('?') ? '&_=' : '?_=';
  const res = await api.get(`${url}${bust}${Date.now()}`, {
    responseType: 'blob',
  });

  const blob = new Blob([res.data], {
    type: res.headers['content-type'] || 'application/pdf',
  });

  if (!blob || blob.size === 0) throw new Error('Empty PDF');

  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename.endsWith('.pdf') ? filename : `${filename}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1500);
}

/* ------------------------------- page ---------------------------------- */

type ReportRow = {
  id: string;
  month: number; // 1..12
  year: number;
  status?: 'draft' | 'approved' | 'locked';
  pdfPath?: string | null;
  netIncomeSSP?: number | string | null;
  title?: string | null;
};

export default function ReportsPage() {
  const now = new Date();
  const [year, setYear] = useState<number>(now.getFullYear());
  const [month, setMonth] = useState<number>(now.getMonth() + 1);

  const yearOptions = useMemo(
    () => [year, year - 1, year - 2, year - 3, year - 4],
    [year],
  );

  const {
    data: reportData,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ['/api/reports/list', year, month],
    queryFn: async () => {
      // Returns either { reports: ReportRow[] } or ReportRow[]
      const { data } = await api.get(
        `/api/reports?year=${year}&month=${month}`,
      );
      return Array.isArray(data) ? data : data?.reports ?? [];
    },
  });

  const generateMutation = useMutation({
    mutationFn: async () => {
      await api.post('/api/reports/generate', { year, month });
    },
    onSuccess: () => refetch(),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/api/reports/${id}`);
    },
    onSuccess: () => refetch(),
  });

  const rows: ReportRow[] = Array.isArray(reportData) ? (reportData as any) : [];

  async function onDownload(report: ReportRow) {
    const m = months.find((x) => x.value === (report.month || month))?.label ?? 'Report';
    const filename = `${m} ${report.year || year} Report`;

    try {
      if (report.pdfPath) {
        await fetchAndDownloadPdf(report.pdfPath, filename);
        return;
      }
      const url = report.id
        ? `/api/reports/${report.id}/pdf`
        : `/api/reports/${report.year || year}/${report.month || month}/pdf`;
      await fetchAndDownloadPdf(url, filename);
    } catch (err) {
      console.error(err);
      alert("Couldn't download the PDF. Try Generate Report first.");
    }
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header / Filters */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Monthly Reports</h1>
          <p className="text-sm text-muted-foreground">
            Generate and manage monthly financial reports
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Month */}
          <Select
            value={String(month)}
            onValueChange={(v) => setMonth(Number(v))}
          >
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Select Month..." />
            </SelectTrigger>
            <SelectContent>
              {months.map((m) => (
                <SelectItem key={m.value} value={String(m.value)}>
                  {m.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Year */}
          <Select
            value={String(year)}
            onValueChange={(v) => setYear(Number(v))}
          >
            <SelectTrigger className="w-[120px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {yearOptions.map((y) => (
                <SelectItem key={y} value={String(y)}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Generate */}
          <Button
            onClick={() => generateMutation.mutate()}
            disabled={generateMutation.isPending}
            className="inline-flex items-center gap-2"
          >
            {generateMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Generating…
              </>
            ) : (
              <>
                <Calendar className="h-4 w-4" />
                Generate Report
              </>
            )}
          </Button>
        </div>
      </div>

      {/* List */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Available Reports</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {isLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading reports…
            </div>
          ) : rows.length === 0 ? (
            <div className="text-sm text-muted-foreground">
              No reports for the selected month yet. Click <span className="font-medium">Generate Report</span>.
            </div>
          ) : (
            rows.map((r) => {
              const mLabel =
                months.find((m) => m.value === r.month)?.label ?? 'Month';
              const title = r.title || `${mLabel} ${r.year} Report`;
              const net = r.netIncomeSSP != null ? Number(r.netIncomeSSP) : null;

              return (
                <div
                  key={r.id}
                  className="flex items-center justify-between border rounded-lg px-4 py-3"
                >
                  <div className="flex items-center gap-3">
                    <span className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-slate-50 border border-slate-200">
                      <FileText className="h-4 w-4 text-slate-600" />
                    </span>
                    <div>
                      <div className="text-sm font-medium text-slate-900">
                        {title}
                      </div>
                      <div className="text-xs text-slate-500">
                        {net !== null ? (
                          <>
                            Net Income:&nbsp;
                            <span className="font-medium">{fmtSSP(net)}</span>
                          </>
                        ) : (
                          '—'
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {r.status && (
                      <Badge variant="outline" className="capitalize">
                        {r.status}
                      </Badge>
                    )}

                    <Button
                      variant="outline"
                      size="sm"
                      className="inline-flex items-center gap-2"
                      onClick={() => onDownload(r)}
                    >
                      <Download className="h-4 w-4" />
                      Download PDF
                    </Button>

                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        if (confirm('Delete this report?')) {
                          deleteMutation.mutate(r.id);
                        }
                      }}
                      title="Delete report"
                    >
                      <Trash2 className="h-4 w-4 text-red-600" />
                    </Button>
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>
    </div>
  );
}
