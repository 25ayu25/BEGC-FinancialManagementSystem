import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  DollarSign, 
  CreditCard, 
  TrendingUp, 
  Shield 
} from "lucide-react";

interface KPICardsProps {
  data?: {
    totalIncome: string;
    totalExpenses: string;
    netIncome: string;
    insuranceBreakdown: Record<string, string>;
  };
}

export default function KPICards({ data }: KPICardsProps) {
  const totalInsurance = Object.values(data?.insuranceBreakdown || {})
    .reduce((sum, amount) => sum + parseFloat(amount), 0);

  const cards = [
    {
      title: "Monthly Income",
      value: `SSP ${Math.round(parseFloat(data?.totalIncome || '0')).toLocaleString()}`,
      icon: DollarSign,
      change: "+12.5%",
      changeType: "positive" as const,
      bgColor: "bg-emerald-50",
      iconColor: "text-emerald-600",
      borderColor: "border-emerald-100",
      valueColor: "text-emerald-700",
      testId: "card-monthly-income"
    },
    {
      title: "Monthly Expenses", 
      value: `SSP ${Math.round(parseFloat(data?.totalExpenses || '0')).toLocaleString()}`,
      icon: CreditCard,
      change: "+8.2%",
      changeType: "negative" as const,
      bgColor: "bg-red-50",
      iconColor: "text-red-600",
      borderColor: "border-red-100",
      valueColor: "text-red-700",
      testId: "card-monthly-expenses"
    },
    {
      title: "Net Income",
      value: `SSP ${Math.round(parseFloat(data?.netIncome || '0')).toLocaleString()}`,
      icon: TrendingUp,
      change: parseFloat(data?.netIncome || '0') >= 0 ? "Profit" : "Loss",
      changeType: parseFloat(data?.netIncome || '0') >= 0 ? "positive" : "negative" as const,
      bgColor: "bg-blue-50",
      iconColor: "text-blue-600",
      borderColor: "border-blue-100",
      valueColor: parseFloat(data?.netIncome || '0') >= 0 ? "text-blue-700" : "text-red-700",
      testId: "card-net-income"
    },
    {
      title: "Insurance Income",
      value: `USD ${Math.round(totalInsurance).toLocaleString()}`,
      icon: Shield,
      change: `${Object.keys(data?.insuranceBreakdown || {}).length} providers`,
      changeType: "neutral" as const,
      bgColor: "bg-purple-50",
      iconColor: "text-purple-600",
      borderColor: "border-purple-100",
      valueColor: "text-purple-700",
      testId: "card-insurance-income"
    }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      {cards.map((card) => (
        <Card 
          key={card.title} 
          className={`border-0 shadow-md hover:shadow-lg transition-all duration-200 ${card.borderColor} bg-white`} 
          data-testid={card.testId}
        >
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-5">
              <div className={`w-14 h-14 rounded-xl flex items-center justify-center ${card.bgColor} shadow-sm`}>
                <card.icon className={`h-6 w-6 ${card.iconColor}`} />
              </div>
              <Badge 
                variant={card.changeType === 'positive' ? 'default' : card.changeType === 'negative' ? 'destructive' : 'secondary'}
                className="text-xs font-medium px-2 py-1"
              >
                {card.change}
              </Badge>
            </div>
            <div className="space-y-2">
              <h3 className={`text-2xl font-bold mb-1 ${card.valueColor}`} data-testid={`text-${card.testId}-value`}>
                {card.value}
              </h3>
              <p className="text-slate-600 text-sm font-medium">{card.title}</p>
              <div className="text-xs text-slate-500 font-medium">
                {card.title === "Net Income" ? "Current month" : "vs last month"}
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
