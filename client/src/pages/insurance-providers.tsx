import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Shield, DollarSign, TrendingUp, TrendingDown, ArrowLeft } from "lucide-react";
import { Link } from "wouter";

export default function InsuranceProvidersPage() {
  const [selectedPeriod, setSelectedPeriod] = useState("current");
  
  const currentDate = new Date();
  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth() + 1;

  // Calculate date ranges
  const prevMonth = currentMonth === 1 ? 12 : currentMonth - 1;
  const prevYear = currentMonth === 1 ? currentYear - 1 : currentYear;

  // Get current month data
  const { data: currentDashboardData } = useQuery({
    queryKey: ["/api/dashboard", currentYear, currentMonth],
    enabled: true
  });

  // Get last month's data
  const { data: prevDashboardData } = useQuery({
    queryKey: ["/api/dashboard", prevYear, prevMonth],
    enabled: true
  });

  // Select data based on period
  const selectedData = selectedPeriod === "current" ? currentDashboardData : prevDashboardData;
  const comparisonData = selectedPeriod === "current" ? prevDashboardData : currentDashboardData;

  const insuranceBreakdown = (selectedData as any)?.insuranceBreakdown || {};
  const prevInsuranceBreakdown = (comparisonData as any)?.insuranceBreakdown || {};
  
  // Calculate totals
  const totalSelectedUSD = Object.values(insuranceBreakdown).reduce((sum: number, value) => sum + parseFloat(value as string), 0);
  const totalComparisonUSD = Object.values(prevInsuranceBreakdown).reduce((sum: number, value) => sum + parseFloat(value as string), 0);
  
  // Calculate overall change
  const overallChange = totalComparisonUSD > 0 ? ((totalSelectedUSD - totalComparisonUSD) / totalComparisonUSD) * 100 : 0;

  return (
    <div className="p-6 space-y-6 bg-gray-50 min-h-screen">
      {/* Header */}
      <header className="bg-white rounded-lg shadow-sm border p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="inline-flex">
              <Button variant="ghost" size="sm" className="gap-2">
                <ArrowLeft className="h-4 w-4" />
                Back to Dashboard
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Insurance Providers</h1>
              <p className="text-slate-600 mt-1">Detailed breakdown by insurance provider</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Select period" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="current">Current Month</SelectItem>
                <SelectItem value="last">Last Month</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </header>

      {/* Overview Card */}
      <Card className="border-0 shadow-md bg-white">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-semibold text-slate-900">Insurance Revenue Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="flex items-center gap-3">
              <div className="bg-purple-50 p-2 rounded-lg">
                <Shield className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-slate-600">Total Revenue</p>
                <p className="text-xl font-bold text-slate-900">USD {Math.round(totalSelectedUSD as number).toLocaleString()}</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <div className="bg-blue-50 p-2 rounded-lg">
                <DollarSign className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-slate-600">Active Providers</p>
                <p className="text-xl font-bold text-slate-900">{Object.keys(insuranceBreakdown).length}</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <div className="bg-emerald-50 p-2 rounded-lg">
                {overallChange >= 0 ? (
                  <TrendingUp className="h-5 w-5 text-emerald-600" />
                ) : (
                  <TrendingDown className="h-5 w-5 text-red-600" />
                )}
              </div>
              <div>
                <p className="text-sm text-slate-600">
                  vs {selectedPeriod === "current" ? "Last Month" : "Current Month"}
                </p>
                <p className={`text-xl font-bold ${overallChange >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                  {overallChange >= 0 ? '+' : ''}{overallChange.toFixed(1)}%
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Providers Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {Object.entries(insuranceBreakdown).map(([provider, amount]) => {
          const currentAmount = parseFloat(amount as string);
          const prevAmount = parseFloat(prevInsuranceBreakdown[provider] as string || '0');
          const change = prevAmount > 0 ? ((currentAmount - prevAmount) / prevAmount) * 100 : 0;
          const percentage = (totalSelectedUSD as number) > 0 ? (currentAmount / (totalSelectedUSD as number)) * 100 : 0;
          
          return (
            <Card key={provider} className="border-0 shadow-md bg-white hover:shadow-lg transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="bg-purple-50 p-1.5 rounded-lg">
                      <Shield className="h-4 w-4 text-purple-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-900">{provider}</h3>
                      <Badge variant="secondary" className="text-xs">
                        {percentage.toFixed(1)}% of total
                      </Badge>
                    </div>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-slate-600">Revenue</span>
                    <span className="font-mono font-semibold text-slate-900">
                      USD {Math.round(currentAmount).toLocaleString()}
                    </span>
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-slate-600">
                      vs {selectedPeriod === "current" ? "Last Month" : "Current Month"}
                    </span>
                    <span className={`text-sm font-medium ${
                      change > 0 ? 'text-emerald-600' :
                      change < 0 ? 'text-red-600' : 
                      'text-slate-500'
                    }`}>
                      {change > 0 ? '+' : ''}{change.toFixed(1)}%
                    </span>
                  </div>
                  
                  {prevAmount > 0 && (
                    <div className="flex justify-between items-center pt-1 border-t border-slate-100">
                      <span className="text-xs text-slate-500">
                        {selectedPeriod === "current" ? "Previous" : "Current"}
                      </span>
                      <span className="text-xs font-mono text-slate-500">
                        USD {Math.round(prevAmount).toLocaleString()}
                      </span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
      
      {Object.keys(insuranceBreakdown).length === 0 && (
        <Card className="border-0 shadow-md bg-white">
          <CardContent className="p-8 text-center">
            <Shield className="h-12 w-12 text-slate-400 mx-auto mb-3" />
            <h3 className="text-lg font-semibold text-slate-900 mb-2">No Insurance Data</h3>
            <p className="text-slate-600">No insurance transactions found for the selected period.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}