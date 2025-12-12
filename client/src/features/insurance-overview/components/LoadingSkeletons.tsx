/**
 * Loading Skeletons for Insurance Overview
 */

import { Card } from "@/components/ui/card";

export function KPICardsLoadingSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <Card key={i} className="p-4 animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-24 mb-3" />
          <div className="h-8 bg-gray-300 rounded w-32 mb-2" />
          <div className="h-3 bg-gray-200 rounded w-20" />
        </Card>
      ))}
    </div>
  );
}

export function RankingCardsLoadingSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <Card key={i} className="p-6 animate-pulse">
          <div className="flex items-center justify-between mb-4">
            <div className="h-6 bg-gray-300 rounded w-8" />
            <div className="h-8 bg-gray-200 rounded-full w-20" />
          </div>
          <div className="h-6 bg-gray-300 rounded w-3/4 mb-3" />
          <div className="h-10 bg-gray-400 rounded w-full mb-3" />
          <div className="h-4 bg-gray-200 rounded w-1/2 mb-2" />
          <div className="h-12 bg-gray-200 rounded w-full" />
        </Card>
      ))}
    </div>
  );
}

export function TableLoadingSkeleton() {
  return (
    <Card className="p-6">
      <div className="animate-pulse">
        <div className="h-6 bg-gray-300 rounded w-48 mb-6" />
        <div className="space-y-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4">
              <div className="h-12 bg-gray-200 rounded flex-1" />
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}

export function ChartLoadingSkeleton() {
  return (
    <Card className="p-6">
      <div className="animate-pulse">
        <div className="h-6 bg-gray-300 rounded w-56 mb-6" />
        <div className="h-[400px] bg-gray-200 rounded" />
      </div>
    </Card>
  );
}

export function InsightsLoadingSkeleton() {
  return (
    <Card className="p-6">
      <div className="animate-pulse">
        <div className="h-6 bg-gray-300 rounded w-48 mb-4" />
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-start gap-3">
              <div className="h-10 w-10 bg-gray-300 rounded-full flex-shrink-0" />
              <div className="flex-1">
                <div className="h-4 bg-gray-200 rounded w-full mb-2" />
                <div className="h-4 bg-gray-200 rounded w-3/4" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}
