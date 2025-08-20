// client/src/pages/simple-dashboard.tsx
import { useEffect, useState } from "react";
import Header from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabaseDashboard } from "@/lib/supabaseQueries";

export default function SimpleDashboard() {
  const [loading, setLoading] = useState(true);
  const [totals, setTotals] = useState<any>(null);

  useEffect(() => {
    (async () => {
      try {
        const now = new Date();
        const data = await supabaseDashboard.getMonthlyData(
          now.getFullYear(),
          now.getMonth() + 1,
        );
        setTotals(data.totals);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="flex-1 overflow-auto p-6">
      <Header title="Dashboard" />
      {loading ? (
        <div className="text-center mt-24">Loading...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Total Revenue (SSP)</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold">
              {totals?.totalIncome ?? "0.00"}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Total Expenses (SSP)</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold">
              {totals?.totalExpense ?? "0.00"}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Net Income (SSP)</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold">
              {totals?.netIncome ?? "0.00"}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Insurance Revenue (USD)</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold">
              {totals?.insuranceRevenue ?? "0.00"}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
