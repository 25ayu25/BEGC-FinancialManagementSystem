import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp, TrendingDown, DollarSign, CreditCard, PiggyBank, Shield, Users } from "lucide-react";

interface PatientVolume {
  id: string;
  date: string;
  departmentId?: string;
  patientCount: number;
  notes?: string;
}

interface SimpleDashboardKPIsProps {
  data?: {
    totalIncome: string;
    totalIncomeSSP: string;
    totalIncomeUSD: string;
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
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${index * 8} ${80 - point}`)
    .join(' ');

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

export default function SimpleDashboardKPIs({ data }: SimpleDashboardKPIsProps) {
  // Use the backend-separated currency amounts
  const sspIncome = parseFloat(data?.totalIncomeSSP || '0');
  const usdIncome = parseFloat(data?.totalIncomeUSD || '0');
  const expenses = parseFloat(data?.totalExpenses || '0');
  
  // SSP calculations (no currency mixing)
  const sspNet = sspIncome - expenses;
  const margin = sspIncome > 0 ? (sspNet / sspIncome) * 100 : 0;

  // Calculate additional context
  const currentDay = new Date().getDate();
  const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
  const monthProgress = (currentDay / daysInMonth) * 100;
  const estimatedMonthlyIncome = sspIncome > 0 ? (sspIncome / currentDay) * daysInMonth : 0;



  const kpis = [
    {
      title: "Income",
      value: `SSP ${Math.round(sspIncome).toLocaleString()}`,
      subtitle: `Day ${currentDay} of ${daysInMonth} • ${monthProgress.toFixed(0)}% complete`,
      context: estimatedMonthlyIncome > 0 ? `Projected: SSP ${Math.round(estimatedMonthlyIncome).toLocaleString()}` : undefined,
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
      subtitle: expenses > 0 ? `${((expenses / sspIncome) * 100).toFixed(1)}% of income` : "No expenses yet",
      context: `Avg per day: SSP ${currentDay > 0 ? Math.round(expenses / currentDay).toLocaleString() : 0}`,
      icon: CreditCard,
      trend: -8.2,
      delta: "-8.2%",
      bgColor: "bg-red-500",
      textColor: "text-red-600",
      lightBg: "bg-red-50",
    },
    {
      title: "Net",
      value: `SSP ${Math.round(sspNet).toLocaleString()}`,
      subtitle: `${margin.toFixed(1)}% margin`,
      context: sspNet > 0 ? "Positive cash flow" : "Monitor expenses",
      icon: PiggyBank,
      trend: sspNet >= 0 ? 15.3 : -5.2,
      delta: sspNet >= 0 ? "+15.3%" : "-5.2%",
      bgColor: sspNet >= 0 ? "bg-blue-500" : "bg-orange-500",
      textColor: sspNet >= 0 ? "text-blue-600" : "text-orange-600",
      lightBg: sspNet >= 0 ? "bg-blue-50" : "bg-orange-50",
    },
    {
      title: "Insurance",
      value: `USD ${Math.round(usdIncome).toLocaleString()}`,
      subtitle: usdIncome > 0 ? "Claims processed" : "No claims yet",
      context: `Separate from SSP operations`,
      icon: Shield,
      trend: 5.7,
      delta: "+5.7%",
      bgColor: "bg-purple-500",
      textColor: "text-purple-600",
      lightBg: "bg-purple-50",
    },

  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {kpis.map((kpi) => (
        <Card key={kpi.title} className="border-0 shadow-md hover:shadow-lg transition-all duration-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${kpi.lightBg}`}>
                <kpi.icon className={`h-5 w-5 ${kpi.textColor}`} />
              </div>
              <div className="text-right">
                <div className={`text-xs font-medium ${kpi.textColor} flex items-center gap-1`}>
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
              <h3 className={`text-2xl font-bold ${kpi.textColor}`} data-testid={`value-${kpi.title.toLowerCase()}`}>
                {kpi.value}
              </h3>
              <p className="text-slate-600 text-sm font-medium">{kpi.title}</p>
              {kpi.subtitle && (
                <p className="text-slate-500 text-xs">{kpi.subtitle}</p>
              )}
              {kpi.context && (
                <p className="text-slate-400 text-xs mt-1">{kpi.context}</p>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}