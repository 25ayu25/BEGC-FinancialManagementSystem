import { TrendingUp, TrendingDown, Building2 } from "lucide-react";

interface RevenueOverviewCardProps {
  totalRevenue: number;
  activeProviders: number;
  vsLastMonth: number; // percentage change
}

export function RevenueOverviewCard({
  totalRevenue,
  activeProviders,
  vsLastMonth,
}: RevenueOverviewCardProps) {
  const isPositive = vsLastMonth >= 0;
  const TrendIcon = isPositive ? TrendingUp : TrendingDown;

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-6">Revenue Overview</h2>
      
      <div className="space-y-6">
        {/* Total Revenue */}
        <div>
          <p className="text-sm text-gray-600 mb-1">Total Revenue</p>
          <p className="text-3xl font-bold text-gray-900">
            ${totalRevenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
        </div>

        {/* Active Providers */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
            <Building2 className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <p className="text-sm text-gray-600">Active Providers</p>
            <p className="text-xl font-semibold text-gray-900">{activeProviders}</p>
          </div>
        </div>

        {/* vs Last Month */}
        <div className="pt-4 border-t border-gray-200">
          <div className="flex items-center gap-2">
            <TrendIcon 
              className={`w-5 h-5 ${isPositive ? 'text-green-600' : 'text-red-600'}`}
            />
            <span className={`text-sm font-medium ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
              {isPositive ? '+' : ''}{vsLastMonth.toFixed(1)}%
            </span>
            <span className="text-sm text-gray-600">vs Last Month</span>
          </div>
        </div>
      </div>
    </div>
  );
}
