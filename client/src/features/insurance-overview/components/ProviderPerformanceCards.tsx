import { TrendingUp, TrendingDown, Trophy } from "lucide-react";

interface ProviderPerformance {
  rank: number;
  name: string;
  revenue: number;
  share: number; // percentage of total revenue
  vsLastMonth: number; // percentage change
}

interface ProviderPerformanceCardsProps {
  providers: ProviderPerformance[];
}

export function ProviderPerformanceCards({ providers }: ProviderPerformanceCardsProps) {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-6">Top Providers Performance</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {providers.map((provider) => {
          const isPositive = provider.vsLastMonth >= 0;
          const TrendIcon = isPositive ? TrendingUp : TrendingDown;
          
          // Medal colors for top 3
          const medalColors = {
            1: "text-yellow-500",
            2: "text-gray-400",
            3: "text-orange-600",
          };

          return (
            <div
              key={provider.rank}
              className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
            >
              {/* Header with Rank and Name */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  {provider.rank <= 3 ? (
                    <Trophy className={`w-5 h-5 ${medalColors[provider.rank as keyof typeof medalColors]}`} />
                  ) : (
                    <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center">
                      <span className="text-xs font-semibold text-gray-600">#{provider.rank}</span>
                    </div>
                  )}
                  <h3 className="font-semibold text-gray-900 text-sm">{provider.name}</h3>
                </div>
              </div>

              {/* Revenue */}
              <div className="mb-3">
                <p className="text-2xl font-bold text-gray-900">
                  ${provider.revenue.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                </p>
              </div>

              {/* Progress Bar - Revenue Share */}
              <div className="mb-3">
                <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
                  <span>Revenue Share</span>
                  <span className="font-medium">{provider.share.toFixed(1)}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${Math.min(provider.share, 100)}%` }}
                  />
                </div>
              </div>

              {/* vs Last Month */}
              <div className="flex items-center gap-1">
                <TrendIcon 
                  className={`w-4 h-4 ${isPositive ? 'text-green-600' : 'text-red-600'}`}
                />
                <span className={`text-xs font-medium ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
                  {isPositive ? '+' : ''}{provider.vsLastMonth.toFixed(1)}%
                </span>
                <span className="text-xs text-gray-500">vs last month</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
