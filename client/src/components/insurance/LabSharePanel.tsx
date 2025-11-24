import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getLabSummary, getLabPayments } from "@/lib/api-insurance-lab";
import { ChevronDown, ChevronRight, Download, Plus, Settings2 } from "lucide-react";

type Props = { year: number; month: number; };

export default function LabSharePanel({ year, month }: Props) {
  const [open, setOpen] = useState(false);
  const { data: summary } = useQuery({
    queryKey: ["lab-summary", year, month],
    queryFn: () => getLabSummary(year, month),
    enabled: open,
  });
  const { data: payments } = useQuery({
    queryKey: ["lab-payments", year, month],
    queryFn: () => getLabPayments(year, month),
    enabled: open,
  });

  const pct = useMemo(() => {
    if (!summary) return 0;
    return summary.due.amount === 0 ? 0 : Math.max(0, Math.min(100, (summary.paid.amount / summary.due.amount) * 100));
  }, [summary]);

  const exportCsv = () => {
    if (!summary) return;
    const lines: string[] = [];
    lines.push(`Period,${year}-${String(month).padStart(2,"0")}`);
    lines.push(`Currency,${summary.due.currency}`);
    lines.push(`Lab portion,${summary.portion?.amount ?? 0}`);
    lines.push(`35% due,${summary.due.amount}`);
    lines.push(`Paid,${summary.paid.amount}`);
    lines.push(`Balance,${summary.balance.amount}`);
    lines.push("");
    lines.push("Payments");
    lines.push("Date,Amount,Currency,Note");
    (payments ?? []).forEach((p:any) => {
      lines.push(`${p.payDate},${p.amount},${p.currency},"${(p.note ?? "").replace(/"/g,'""')}"`);
    });
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `lab-insurance-share_${year}-${String(month).padStart(2,"0")}.csv`;
    a.click();
  };

  return (
    <Card className="border-slate-200/80 shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={()=>setOpen(v=>!v)} aria-label="Toggle">
            {open ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
          </Button>
          <CardTitle>Lab Insurance Share</CardTitle>
          {summary?.portion
            ? <Badge variant="secondary" className="ml-2">{summary.portion.currency} {summary.portion.amount.toLocaleString()} set</Badge>
            : <Badge className="ml-2">Not set</Badge>}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={exportCsv}><Download className="w-4 h-4 mr-1" />Export CSV</Button>
        </div>
      </CardHeader>

      {!open ? null : (
        <CardContent className="space-y-6">
          {/* KPIs */}
          <div className="grid md:grid-cols-4 gap-3">
            <Kpi title="Lab portion (submitted)" value={summary?.portion?.amount ?? 0} currency={summary?.due.currency ?? "SSP"} />
            <Kpi title="35% due to Lab" value={summary?.due.amount ?? 0} currency={summary?.due.currency ?? "SSP"} />
            <Kpi title="Paid to Lab" value={summary?.paid.amount ?? 0} currency={summary?.due.currency ?? "SSP"} />
            <Kpi title="Balance" value={summary?.balance.amount ?? 0} currency={summary?.due.currency ?? "SSP"} highlight />
          </div>

          {/* Donut + progress */}
          <div className="grid md:grid-cols-2 gap-6 items-center">
            <Donut paid={summary?.paid.amount ?? 0} due={summary?.due.amount ?? 0} currency={summary?.due.currency ?? "SSP"} />
            <div>
              <div className="text-sm text-slate-600 mb-2">Progress toward 35% due</div>
              <div className="w-full h-3 bg-slate-200 rounded-full overflow-hidden">
                <div className="h-3 bg-emerald-500" style={{ width: `${pct}%` }} />
              </div>
              <div className="mt-1 text-xs text-muted-foreground">{pct.toFixed(0)}% paid</div>
            </div>
          </div>

          {/* Payments table */}
          <div className="flex items-center justify-between">
            <div className="font-medium">Payments</div>
            <span className="text-xs text-muted-foreground">{(payments ?? []).length} items</span>
          </div>
          <div className="w-full overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Currency</TableHead>
                  <TableHead>Note</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(payments ?? []).length === 0 ? (
                  <TableRow><TableCell colSpan={4} className="text-muted-foreground">No payments yet.</TableCell></TableRow>
                ) : (
                  payments!.map((p:any) => (
                    <TableRow key={p.id} className="odd:bg-slate-50/40">
                      <TableCell>{new Date(p.payDate).toLocaleDateString()}</TableCell>
                      <TableCell>{p.amount}</TableCell>
                      <TableCell>{p.currency}</TableCell>
                      <TableCell>{p.note ?? "-"}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          <div className="text-xs text-muted-foreground">
            Tip: You can record payments even months later — just choose the correct month to apply them to.
          </div>
        </CardContent>
      )}
    </Card>
  );
}

function Kpi({ title, value, currency, highlight=false }: {title:string; value:number; currency:string; highlight?:boolean}) {
  return (
    <div className={`rounded-xl border bg-white px-4 py-3 ${highlight ? "border-amber-300" : ""}`}>
      <div className="text-xs font-medium text-slate-500">{title}</div>
      <div className="mt-1 text-lg font-semibold">{currency} {Number(value ?? 0).toLocaleString()}</div>
    </div>
  );
}

function Donut({ paid, due, currency }: { paid:number; due:number; currency:string }) {
  const pct = due === 0 ? 0 : Math.max(0, Math.min(100, (paid/due)*100));
  // simple SVG donut
  const r = 48, c = 2*Math.PI*r;
  const filled = (pct/100)*c;
  return (
    <div className="flex items-center gap-5">
      <svg width="120" height="120" viewBox="0 0 120 120">
        <circle cx="60" cy="60" r={r} stroke="#e5e7eb" strokeWidth="12" fill="none" />
        <circle cx="60" cy="60" r={r} stroke="#10b981" strokeWidth="12" fill="none"
          strokeDasharray={`${filled} ${c}`} strokeLinecap="round" transform="rotate(-90 60 60)" />
        <text x="50%" y="50%" dominantBaseline="middle" textAnchor="middle" fontSize="16" fill="#0f172a">{pct.toFixed(0)}%</text>
      </svg>
      <div className="text-sm">
        <div><span className="inline-block w-3 h-3 bg-emerald-500 rounded-sm mr-2" />Paid: {currency} {paid.toLocaleString()}</div>
        <div><span className="inline-block w-3 h-3 bg-slate-300 rounded-sm mr-2" />Due: {currency} {due.toLocaleString()}</div>
      </div>
    </div>
  );
}
