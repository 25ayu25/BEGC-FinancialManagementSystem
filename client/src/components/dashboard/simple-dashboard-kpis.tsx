import { Card, CardContent } from "@/components/ui/card";
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  CreditCard,
  PiggyBank,
  Shield,
} from "lucide-react";

interface SimpleDashboardKPIsProps {
  data?: {
    totalIncome: string;
    totalExpenses: string;
    netIncome: string;
    insuranceBreakdown: Record<string, string>;
  };
}

const Sparkline = ({ trend = 0 }: { trend?: number }) => {
  const points = Array.from({ length: 7 }, (_, i) => {
    const variance = (Math.random() - 0.5) * 20;
    const trendValue = (i / 6) * trend;
    return 40 + variance + trendValue;
  });

  const pathData = points
    .map(
      (point, index) => `${index === 0 ? "M" : "L"} ${index * 8} ${80 - point}`,
    )
    .join(" ");

  return (
    <svg width="56" height="32" className="opacity-70">
      <path
        d={pathData}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        className="stroke-current"
      />
    </svg>
  );
};

export default function SimpleDashboardKPIs({
  data,
}: SimpleDashboardKPIsProps) {
  const totalInsurance = Object.values(data?.insuranceBreakdown || {}).reduce(
    (sum, amount) => sum + parseFloat(amount),
    0,
  );

  const income = parseFloat(data?.totalIncome || "0");
  const expenses = parseFloat(data?.totalExpenses || "0");
  const net = parseFloat(data?.netIncome || "0");
  const margin = income > 0 ? (net / income) * 100 : 0;

  const kpis = [
    {
      title: "Income",
      value: `SSP ${Math.round(income).toLocaleString()}`,
      icon: DollarSign,
      trend: 12.5,
      delta: "+12.5%",
      bgColor: "bg-emerald-500",
      textColor: "text-emerald-600",
      lightBg: "bg-emerald-50",
    },
    {
      title: "Expenses",
      value: `SSP ${Math.round(expenses).toLocaleString()}`,
      icon: CreditCard,
      trend: -8.2,
      delta: "-8.2%",
      bgColor: "bg-red-500",
      textColor: "text-red-600",
      lightBg: "bg-red-50",
    },
    {
      title: "Net",
      value: `SSP ${Math.round(net).toLocaleString()}`,
      subtitle: `${margin.toFixed(1)}% margin`,
      icon: PiggyBank,
      trend: net >= 0 ? 15.3 : -5.2,
      delta: net >= 0 ? "+15.3%" : "-5.2%",
      bgColor: net >= 0 ? "bg-blue-500" : "bg-orange-500",
      textColor: net >= 0 ? "text-blue-600" : "text-orange-600",
      lightBg: net >= 0 ? "bg-blue-50" : "bg-orange-50",
    },
    {
      title: "Insurance",
      value: `USD ${Math.round(totalInsurance).toLocaleString()}`,
      icon: Shield,
      trend: 5.7,
      delta: "+5.7%",
      bgColor: "bg-purple-500",
      textColor: "text-purple-600",
      lightBg: "bg-purple-50",
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {kpis.map((kpi) => (
        <Card
          key={kpi.title}
          className="border-0 shadow-md hover:shadow-lg transition-all duration-200"
        >
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div
                className={`w-12 h-12 rounded-xl flex items-center justify-center ${kpi.lightBg}`}
              >
                <kpi.icon className={`h-6 w-6 ${kpi.textColor}`} />
              </div>
              <div className="text-right">
                <div
                  className={`text-xs font-medium ${kpi.textColor} flex items-center gap-1`}
                >
                  {kpi.trend >= 0 ? (
                    <TrendingUp className="w-3 h-3" />
                  ) : (
                    <TrendingDown className="w-3 h-3" />
                  )}
                  {kpi.delta}
                </div>
                <div className={`${kpi.textColor} mt-1`}>
                  <Sparkline trend={kpi.trend} />
                </div>
              </div>
            </div>

            <div className="space-y-1">
              <h3
                className={`text-3xl font-bold ${kpi.textColor}`}
                data-testid={`value-${kpi.title.toLowerCase()}`}
              >
                {kpi.value}
              </h3>
              <p className="text-slate-600 text-sm font-medium">{kpi.title}</p>
              {kpi.subtitle && (
                <p className="text-slate-500 text-xs">{kpi.subtitle}</p>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
