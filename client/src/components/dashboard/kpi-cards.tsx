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
      value: `SSP ${data?.totalIncome || '0.00'}`,
      icon: DollarSign,
      change: "+12.5%",
      changeType: "positive" as const,
      bgColor: "bg-success/10",
      iconColor: "text-success",
      testId: "card-monthly-income"
    },
    {
      title: "Monthly Expenses", 
      value: `SSP ${data?.totalExpenses || '0.00'}`,
      icon: CreditCard,
      change: "+8.2%",
      changeType: "negative" as const,
      bgColor: "bg-destructive/10",
      iconColor: "text-destructive",
      testId: "card-monthly-expenses"
    },
    {
      title: "Net Income",
      value: `SSP ${data?.netIncome || '0.00'}`,
      icon: TrendingUp,
      change: parseFloat(data?.netIncome || '0') >= 0 ? "Profit" : "Loss",
      changeType: parseFloat(data?.netIncome || '0') >= 0 ? "positive" : "negative" as const,
      bgColor: "bg-primary/10",
      iconColor: "text-primary",
      testId: "card-net-income"
    },
    {
      title: "Insurance Income",
      value: `SSP ${totalInsurance.toFixed(2)}`,
      icon: Shield,
      change: `${Object.keys(data?.insuranceBreakdown || {}).length} providers`,
      changeType: "neutral" as const,
      bgColor: "bg-accent/10",
      iconColor: "text-accent",
      testId: "card-insurance-income"
    }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      {cards.map((card) => (
        <Card key={card.title} className="border border-gray-100" data-testid={card.testId}>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${card.bgColor}`}>
                <card.icon className={`text-xl ${card.iconColor}`} />
              </div>
              <Badge 
                variant={card.changeType === 'positive' ? 'default' : card.changeType === 'negative' ? 'destructive' : 'secondary'}
                className="text-xs"
              >
                {card.change}
              </Badge>
            </div>
            <h3 className="text-2xl font-bold text-gray-900 mb-1" data-testid={`text-${card.testId}-value`}>
              {card.value}
            </h3>
            <p className="text-gray-500 text-sm">{card.title}</p>
            <div className="mt-3 text-xs text-gray-400">
              {card.title === "Net Income" ? "Current month" : "vs last month"}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
