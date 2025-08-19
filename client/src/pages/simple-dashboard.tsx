import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import {
  getTotalsCurrentMonth,
  getDeptTotalsCurrentMonth,
  getInsuranceTotalsCurrentMonth,
} from "@/lib/supabaseQueries";
import Loading from "@/components/Loading";

type Totals = {
  total_income: number;
  total_expense: number;
  net_income: number;
  transactions_count: number;
  month_start: string;
};

type DeptRow = {
  department: string;
  income: number;
  expense: number;
};

type InsuranceRow = {
  insurance: string;
  income: number;
};

export default function SimpleDashboard() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [totals, setTotals] = useState<Totals | null>(null);
  const [depts, setDepts] = useState<DeptRow[]>([]);
  const [insurance, setInsurance] = useState<InsuranceRow[]>([]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);
      try {
        const [t, d, i] = await Promise.all([
          getTotalsCurrentMonth(),
          getDeptTotalsCurrentMonth(),
          getInsuranceTotalsCurrentMonth(),
        ]);

        if (cancelled) return;
        setTotals(t ?? null);
        setDepts(Array.isArray(d) ? d : []);
        setInsurance(Array.isArray(i) ? i : []);
      } catch (err: any) {
        console.error(err);
        toast({
          title: "Error loading data",
          description:
            typeof err?.message === "string"
              ? err.message
              : "Could not load current month data from Supabase.",
          variant: "destructive",
        });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [toast]);

  if (loading) return <Loading />;

  if (!totals) {
    return (
      <div className="p-6">
        <Card>
          <CardHeader>
            <CardTitle>Dashboard</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">No data yet.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Total Revenue</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            SSP {totals.total_income?.toLocaleString() ?? "0"}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Total Expenses</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            SSP {totals.total_expense?.toLocaleString() ?? "0"}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Net Income</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            SSP {totals.net_income?.toLocaleString() ?? "0"}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Transactions</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            {totals.transactions_count ?? 0}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Top Departments</CardTitle>
          </CardHeader>
          <CardContent>
            {depts.length === 0 ? (
              <p className="text-muted-foreground">No department data yet.</p>
            ) : (
              <ul className="space-y-2">
                {depts.map((row) => (
                  <li key={row.department} className="flex items-center justify-between">
                    <span>{row.department}</span>
                    <span className="tabular-nums">
                      SSP {row.income?.toLocaleString() ?? "0"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Insurance Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            {insurance.length === 0 ? (
              <p className="text-muted-foreground">No insurance data yet.</p>
            ) : (
              <ul className="space-y-2">
                {insurance.map((row) => (
                  <li key={row.insurance} className="flex items-center justify-between">
                    <span>{row.insurance}</span>
                    <span className="tabular-nums">
                      USD {row.income?.toLocaleString() ?? "0"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
