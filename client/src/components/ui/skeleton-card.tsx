import { cn } from "@/lib/utils";

/**
 * Reusable shimmer effect component
 */
function ShimmerEffect() {
  return (
    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/60 to-transparent skeleton-shimmer" />
  );
}

interface SkeletonCardProps {
  className?: string;
}

/**
 * Skeleton card component with shimmer animation for loading states
 */
export function SkeletonCard({ className }: SkeletonCardProps) {
  return (
    <div
      className={cn(
        "premium-card border border-slate-200/30 shadow-2xl backdrop-blur-sm bg-white/90 p-6 space-y-4",
        className
      )}
    >
      {/* Card header skeleton */}
      <div className="space-y-2">
        <div className="h-6 bg-slate-200 rounded-md w-2/3 relative overflow-hidden">
          <ShimmerEffect />
        </div>
        <div className="h-4 bg-slate-200 rounded-md w-1/2 relative overflow-hidden">
          <ShimmerEffect />
        </div>
      </div>

      {/* Card content skeleton */}
      <div className="space-y-3 pt-2">
        <div className="h-8 bg-slate-200 rounded-md w-1/3 relative overflow-hidden">
          <ShimmerEffect />
        </div>
        <div className="h-4 bg-slate-200 rounded-md w-full relative overflow-hidden">
          <ShimmerEffect />
        </div>
        <div className="h-4 bg-slate-200 rounded-md w-5/6 relative overflow-hidden">
          <ShimmerEffect />
        </div>
      </div>
    </div>
  );
}

/**
 * Skeleton component for Key Metrics Overview cards
 */
export function MetricCardSkeleton() {
  return (
    <div className="premium-card border border-slate-200/30 shadow-xl backdrop-blur-sm bg-white/90 p-6 space-y-3">
      {/* Icon placeholder */}
      <div className="h-12 w-12 bg-slate-200 rounded-xl relative overflow-hidden">
        <ShimmerEffect />
      </div>
      
      {/* Label skeleton */}
      <div className="h-4 bg-slate-200 rounded-md w-2/3 relative overflow-hidden">
        <ShimmerEffect />
      </div>
      
      {/* Value skeleton */}
      <div className="h-10 bg-slate-200 rounded-md w-1/2 relative overflow-hidden">
        <ShimmerEffect />
      </div>
      
      {/* Trend skeleton */}
      <div className="h-3 bg-slate-200 rounded-md w-1/3 relative overflow-hidden">
        <ShimmerEffect />
      </div>
    </div>
  );
}

/**
 * Skeleton component for Period cards
 */
export function PeriodCardSkeleton() {
  return (
    <div className="premium-card border border-slate-200/30 shadow-xl backdrop-blur-sm bg-white/90 p-6 space-y-4">
      {/* Period label skeleton */}
      <div className="h-6 bg-slate-200 rounded-md w-2/5 relative overflow-hidden">
        <ShimmerEffect />
      </div>
      
      {/* Stats skeleton */}
      <div className="space-y-2">
        <div className="h-4 bg-slate-200 rounded-md w-full relative overflow-hidden">
          <ShimmerEffect />
        </div>
        <div className="h-4 bg-slate-200 rounded-md w-4/5 relative overflow-hidden">
          <ShimmerEffect />
        </div>
        <div className="h-4 bg-slate-200 rounded-md w-3/5 relative overflow-hidden">
          <ShimmerEffect />
        </div>
      </div>
      
      {/* Progress bar skeleton */}
      <div className="h-2 bg-slate-200 rounded-full w-full relative overflow-hidden">
        <ShimmerEffect />
      </div>
      
      {/* Badge skeleton */}
      <div className="h-6 bg-slate-200 rounded-full w-1/3 relative overflow-hidden">
        <ShimmerEffect />
      </div>
    </div>
  );
}

/**
 * Skeleton component for table rows
 */
export function TableRowSkeleton({ columns = 6 }: { columns?: number }) {
  return (
    <tr className="border-b border-slate-200">
      {Array.from({ length: columns }).map((_, i) => (
        <td key={i} className="p-4">
          <div className="h-4 bg-slate-200 rounded-md w-full relative overflow-hidden">
            <ShimmerEffect />
          </div>
        </td>
      ))}
    </tr>
  );
}

/**
 * Skeleton for entire table
 */
export function TableSkeleton({ rows = 5, columns = 6 }: { rows?: number; columns?: number }) {
  return (
    <div className="w-full overflow-x-auto rounded-xl border border-slate-200/50">
      <table className="w-full">
        <thead className="bg-slate-50">
          <tr className="border-b border-slate-200">
            {Array.from({ length: columns }).map((_, i) => (
              <th key={i} className="p-4">
                <div className="h-4 bg-slate-300 rounded-md w-full relative overflow-hidden">
                  <ShimmerEffect />
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, i) => (
            <TableRowSkeleton key={i} columns={columns} />
          ))}
        </tbody>
      </table>
    </div>
  );
}
