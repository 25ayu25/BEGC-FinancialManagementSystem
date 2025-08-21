import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, DollarSign } from "lucide-react";

export default function SimpleQuickActions() {
  return (
    <Card className="border border-slate-200 shadow-sm">
      <CardHeader className="pb-4">
        <CardTitle className="text-lg font-semibold text-slate-900 flex items-center gap-2">
          <div className="w-2 h-2 bg-green-500 rounded-full"></div>
          Quick Actions
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <Button 
            className="w-full justify-start bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200"
            variant="outline"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Income
          </Button>
          
          <Button 
            className="w-full justify-start bg-red-50 hover:bg-red-100 text-red-700 border border-red-200"
            variant="outline"
          >
            <DollarSign className="w-4 h-4 mr-2" />
            Add Expense
          </Button>
          

        </div>
      </CardContent>
    </Card>
  );
}