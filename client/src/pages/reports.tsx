'use client';

import { useMemo, useState } from "react";
import { useReports } from "@/hooks/use-reports";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Download, FileText, Loader2, Trash2, Calendar as CalendarIcon } from "lucide-react";

const months = [
  { label: "January", value: 1 }, { label: "February", value: 2 }, { label: "March", value: 3 },
  { label: "April", value: 4 }, { label: "May", value: 5 }, { label: "June", value: 6 },
  { label: "July", value: 7 }, { label: "August", value: 8 }, { label: "September", value: 9 },
  { label: "October", value: 10 }, { label: "November", value: 11 }, { label: "December", value: 12 },
];

export default function ReportsPage() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1); // 1-12

  const { listQuery, generate, isGenerating, remove, isRemoving, downloadPdf } = useReports(year, month);

  const years = useMemo(() => {
    const y = now.getFullYear();
    return [y, y - 1, y - 2];
  }, [now]);

  const onGenerate = async () => {
    await generate({ year, month });
  };

  const onDownload = async (id: string) => {
    const url = await downloadPdf(id);
    // open new tab (or create a link to download)
    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="p-6">
      <div className="mb-4 flex items-center gap-2">
        <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
          <SelectTrigger className="w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {months.map(m => (
              <SelectItem key={m.value} value={String(m.value)}>{m.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
          <SelectTrigger className="w-[120px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {years.map(y => (
              <SelectItem key={y} value={String(y)}>{y}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button onClick={onGenerate} disabled={isGenerating}>
          {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CalendarIcon className="mr-2 h-4 w-4" />}
          Generate Report
        </Button>
      </div>

      <Card className="border border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle>Available Reports</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {listQuery.isLoading ? (
            <div className="text-sm text-slate-500">Loading…</div>
          ) : (listQuery.data?.length ?? 0) === 0 ? (
            <div className="text-sm text-slate-500">
              No reports for the selected month yet. Click <span className="font-medium">Generate Report</span>.
            </div>
          ) : (
            listQuery.data!.map((r) => (
              <div key={r.id} className="flex items-center justify-between rounded-md border border-slate-200 p-3">
                <div className="flex items-center gap-3">
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-slate-100 border border-slate-200">
                    <FileText className="h-4 w-4 text-slate-700" />
                  </span>
                  <div>
                    <div className="text-sm font-medium text-slate-900">
                      {months[r.month - 1]?.label} {r.year} Report
                    </div>
                    <div className="text-xs text-slate-500">
                      Net Income: {r.netIncomeSSP ? `SSP ${r.netIncomeSSP.toLocaleString()}` : "—"}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="capitalize">{r.status}</Badge>
                  <Button variant="outline" size="sm" onClick={() => onDownload(r.id)}>
                    <Download className="mr-1.5 h-4 w-4" /> PDF
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={isRemoving}
                    onClick={() => remove(r.id)}
                  >
                    <Trash2 className="mr-1.5 h-4 w-4" /> Delete
                  </Button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
