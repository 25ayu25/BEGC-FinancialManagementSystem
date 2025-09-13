import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Link } from "wouter";
import { Users } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

import ExecutiveStyleKPIs from "@/components/dashboard/executive-style-kpis";
import SimpleTopDepartments from "@/components/dashboard/simple-top-departments";
import SimpleExpenseBreakdown from "@/components/dashboard/simple-expense-breakdown";

import { api } from "@/lib/queryClient";
import { useDateFilter } from "@/context/date-filter-context";

export default function Dashboard() {
  // ---- Pull the active period from the shared context (includes month-select) ----
  const {
    timeRange,
    selectedYear,
    selectedMonth,
    startDate,
    endDate,
  } = useDateFilter();

  // Normalize range for API compatibility:
  // - When user picked an arbitrary month (month-select), tell the API "current-month"
  //   but send the explicit year/month chosen by the user.
  const normalizedRange =
    timeRange === "month-select" ? "current-month" : timeRange;

  // Build the patient-volume navigation target based on the active range
  const getPatientVolumeNavigation = () => {
    const now = new Date();

    switch (timeRange) {
      case "current-month":
        return { year: now.getFullYear(), month: now.getMonth() + 1 };

      case "last-month": {
        const last = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        return { year: last.getFullYear(), month: last.getMonth() + 1 };
      }

      case "last-3-months": {
        // Show the start of the 3-month window
        const start3 = new Date(now.getFullYear(), now.getMonth() - 2, 1);
        return { year: start3.getFullYear(), month: start3.getMonth() + 1 };
      }

      case "year":
        return { year: now.getFullYear(), month: 1 };

      case "month-select":
        return { year: selectedYear, month: selectedMonth };

      case "custom":
        if (startDate) {
          return { year: startDate.getFullYear(), month: startDate.getMonth() + 1 };
        }
        return { year: now.getFullYear(), month: now.getMonth() + 1 };

      default:
        return { year: selectedYear, month: selectedMonth };
    }
  };

  // ---- Dashboard data ----
  const { data: dashboardData, isLoading, error } = useQuery({
    queryKey: [
      "/api/dashboard",
      selectedYear,
      selectedMonth,
      normalizedRange,
      startDate?.toISOString(),
      endDate?.toISOString(),
    ],
    queryFn: async () => {
      // Base: always send year/month (backend already expects these)
      let url = `/api/dashboard?year=${selectedYear}&month=${selectedMonth}&range=${normalizedRange}`;

      // Only include custom dates for custom mode
      if (timeRange === "custom" && startDate && endDate) {
        url += `&startDate=${format(startDate, "yyyy-MM-dd")}&endDate=${format(
          endDate,
          "yyyy-MM-dd"
        )}`;
      }

      const response = await api.get(url);
      return response.data;
    },
  });

  // ---- Departments master data ----
  const { data: departments } = useQuery({
    queryKey: ["/api/departments"],
  });

  // ---- Patient volume for the active period ----
  const { data: periodPatientVolume = [] } = useQuery({
    queryKey: [
      "/api/patient-volume/period",
      selectedYear,
      selectedMonth,
      normalizedRange,
      startDate?.toISOString(),
      endDate?.toISOString(),
    ],
    queryFn: async () => {
      let url = `/api/patient-volume/period/${selectedYear}/${selectedMonth}?range=${normalizedRange}`;

      if (timeRange === "custom" && startDate && endDate) {
        url += `&startDate=${format(startDate, "yyyy-MM-dd")}&endDate=${format(
          endDate,
          "yyyy-MM-dd"
        )}`;
      }

      try {
        const response = await api.get(url);
        return Array.isArray(response.data) ? response.data : [];
      } catch {
        console.warn("Patient volume unavailable for this period");
        return [];
      }
    },
  });

  if (error) {
    return (
      <div className="flex-1 flex flex-col h-full">
        <div className="bg-white border-b border-slate-200 px-6 py-4">
          <h1 className="text-2xl font-bold text-slate-900">Overview</h1>
          <p className="text-slate-600">Daily operations at a glance</p>
        </div>
        <main className="flex-1 overflow-y-auto p-6">
          <Card>
            <CardContent className="pt-6">
              <div className="text-center text-red-600">
                <p className="text-lg font-semibold">Error Loading Dashboard</p>
                <p className="text-sm mt-2">
                  Unable to fetch dashboard data. Please check your connection and try again.
                </p>
              </div>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col h-full bg-slate-50">
        <div className="bg-white border-b border-slate-200 px-6 py-6">
          <div className="flex items-center justify-between">
            <div>
              <Skeleton className="h-8 w-32 mb-2" />
              <Skeleton className="h-4 w-32" />
            </div>
            <div className="flex items-center space-x-4">
              <Skeleton className="h-10 w-32" />
              <Skeleton className="h-10 w-24" />
            </div>
          </div>
        </div>

        <main className="flex-1 overflow-y-auto p-6 space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[...Array(4)].map((_, i) => (
              <Card key={i} className="p-6">
                <Skeleton className="h-20 w-full" />
              </Card>
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="p-6">
              <Skeleton className="h-64 w-full" />
            </Card>
            <Card className="p-6">
              <Skeleton className="h-64 w-full" />
            </Card>
          </div>
        </main>
      </div>
    );
  }

  const pvNav = getPatientVolumeNavigation();

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-50">
      {/* NOTE: the sticky header + date picker now live in StickyPageHeader.
         This page renders content only. */}

      <div className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] md:items-start md:gap-x-8">
          <div>
            <h1 className="text-3xl font-semibold leading-tight text-slate-900">Overview</h1>

            <div className="mt-1 flex items-center gap-4">
              {/* Patient Volume Chip - Clickable */}
              <Link
                href={`/patient-volume?view=monthly&year=${pvNav.year}&month=${pvNav.month}&range=${normalizedRange}`}
                className="inline-block"
              >
                <div className="flex items-center gap-2 px-3 py-1.5 bg-teal-50 hover:bg-teal-100 rounded-md transition-colors cursor-pointer min-h-[44px]">
                  <Users className="w-4 h-4 text-teal-600" />
                  <span className="text-teal-600 text-sm font-medium font-variant-numeric-tabular">
                    {periodPatientVolume.reduce(
                      (sum: number, v: any) => sum + (v.patientCount || 0),
                      0
                    )}{" "}
                    patients in selected period
                  </span>
                </div>
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto px-6 py-6 space-y-6 max-w-7xl mx-auto w-full">
        {/* KPI Band - Executive Style */}
        <ExecutiveStyleKPIs data={dashboardData || {}} />

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Departments Chart */}
          <SimpleTopDepartments
            data={dashboardData?.departmentBreakdown || {}}
            departments={(departments as any) || []}
          />

          {/* Expenses Breakdown */}
          <SimpleExpenseBreakdown
            breakdown={(dashboardData as any)?.expenseBreakdown}
            total={parseFloat((dashboardData as any)?.totalExpenses || "0")}
            title="Expenses Breakdown"
            // The card itself is self-contained; no period label needed here
          />
        </div>
      </main>
    </div>
  );
}
