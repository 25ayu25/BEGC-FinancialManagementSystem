import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, eachDayOfInterval, addDays, subDays } from "date-fns";
import { useDateFilter } from "@/context/date-filter-context";
import StickyPageHeader from "@/components/layout/StickyPageHeader";
import { Button } from "@/components/ui/button";

const DEPARTMENTS = ["Ultrasound", "Laboratory", "X-Ray", "Consultation", "Pharmacy"];

export default function MissingPostingsPage() {
  const { startDate, endDate, periodLabel } = useDateFilter();

  const s = startDate ? format(startDate, "yyyy-MM-dd") : format(new Date(), "yyyy-MM-01");
  const e = endDate ? format(endDate, "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd");

  const { data } = useQuery({
    queryKey: ["missing-postings", s, e],
    queryFn: async () => {
      const res = await fetch(`/api/quality/missing-postings?start=${s}&end=${e}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch missing postings");
      return (await res.json()) as { data: { day: string; department: string }[] };
    },
  });

  const gaps = new Set((data?.data ?? []).map((g) => `${g.day}|${g.department}`));

  const days = useMemo(() => {
    const sd = startDate ?? new Date();
    const ed = endDate ?? new Date();
    return eachDayOfInterval({ start: sd, end: ed });
  }, [startDate, endDate]);

  const openAdd = (day: string, dept: string) => {
    // Reuse your existing "Add Transaction" route/drawer; prefill date & department via query params:
    const url = `/add-transaction?date=${day}&department=${encodeURIComponent(dept)}&source=quality`;
    window.location.href = url;
  };

  return (
    <div>
      <StickyPageHeader showDateFilter>
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900">Missing Postings</h1>
          <p className="text-slate-600">Ensure every department is posted · {periodLabel}</p>
        </div>
      </StickyPageHeader>

      <main className="mx-auto max-w-7xl px-4 md:px-6 py-6 space-y-4">
        <div className="rounded-lg border bg-white shadow-sm overflow-x-auto">
          <table className="min-w-[720px] w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-3 py-2 text-left text-slate-600">Date</th>
                {DEPARTMENTS.map((d) => (
                  <th key={d} className="px-3 py-2 text-left text-slate-600">
                    {d}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {days.map((d) => {
                const dayStr = format(d, "yyyy-MM-dd");
                return (
                  <tr key={dayStr} className="border-t">
                    <td className="px-3 py-2 font-medium text-slate-800">{format(d, "eee, MMM d")}</td>
                    {DEPARTMENTS.map((dep) => {
                      const missing = gaps.has(`${dayStr}|${dep}`);
                      return (
                        <td key={dep} className="px-3 py-2">
                          {missing ? (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs"
                              onClick={() => openAdd(dayStr, dep)}
                            >
                              Add
                            </Button>
                          ) : (
                            <span className="text-xs text-emerald-600">✓ posted</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Mobile helper: quick day nav */}
        <div className="flex items-center gap-2 md:hidden">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => (window.location.href = `?start=${format(subDays(new Date(s), 1), "yyyy-MM-dd")}&end=${e}`)}
          >
            Prev
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => (window.location.href = `?start=${format(addDays(new Date(s), 1), "yyyy-MM-dd")}&end=${e}`)}
          >
            Next
          </Button>
        </div>
      </main>
    </div>
  );
}
