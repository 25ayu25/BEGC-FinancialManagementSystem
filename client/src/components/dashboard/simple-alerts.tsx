import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Clock, CreditCard } from "lucide-react";

export default function SimpleAlerts() {
  const alerts = [
    {
      id: 1,
      type: "warning",
      icon: Clock,
      title: "Unsynced entries",
      count: 3,
      description: "3 transactions pending sync",
      urgency: "medium"
    },

    {
      id: 3,
      type: "error",
      icon: CreditCard,
      title: "Unpaid claims",
      count: 1,
      description: "1 insurance claim 30+ days",
      urgency: "high"
    }
  ];

  const getUrgencyColor = (urgency: string) => {
    switch (urgency) {
      case 'high': return 'bg-red-100 text-red-700 border-red-200';
      case 'medium': return 'bg-orange-100 text-orange-700 border-orange-200';
      case 'low': return 'bg-blue-100 text-blue-700 border-blue-200';
      default: return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  return (
    <Card className="border border-slate-200 shadow-sm">
      <CardHeader className="pb-4">
        <CardTitle className="text-lg font-semibold text-slate-900 flex items-center gap-2">
          <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
          Alerts
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {alerts.map((alert) => (
            <div 
              key={alert.id}
              className={`p-3 rounded-lg border transition-colors hover:shadow-sm cursor-pointer ${getUrgencyColor(alert.urgency)}`}
            >
              <div className="flex items-center gap-3">
                <alert.icon className="w-4 h-4" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-medium truncate">
                      {alert.title}
                    </h4>
                    <Badge variant="secondary" className="ml-2 text-xs">
                      {alert.count}
                    </Badge>
                  </div>
                  <p className="text-xs opacity-80 mt-1">
                    {alert.description}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}