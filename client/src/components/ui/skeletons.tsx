import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

const shimmer = {
  hidden: { x: '-100%' },
  visible: {
    x: '100%',
    transition: {
      repeat: Infinity,
      duration: 1.5,
      ease: 'linear'
    }
  }
};

export const SkeletonCard = ({ className }: { className?: string }) => (
  <div className={cn(
    "skeleton-card relative overflow-hidden rounded-xl p-5",
    "bg-gradient-to-br from-slate-800/50 to-slate-900/50 border border-white/10",
    "dark:bg-gradient-to-br dark:from-slate-800/50 dark:to-slate-900/50 dark:border-white/10",
    className
  )}>
    <div className="skeleton-shimmer-wrapper relative w-full h-24 overflow-hidden rounded-lg">
      <div className="absolute inset-0 bg-gradient-to-r from-white/5 via-white/10 to-white/5 rounded-lg" />
      <motion.div
        className="skeleton-shimmer absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
        variants={shimmer}
        initial="hidden"
        animate="visible"
      />
    </div>
  </div>
);

export const SkeletonChart = ({ className }: { className?: string }) => (
  <div className={cn(
    "skeleton-chart relative overflow-hidden rounded-xl p-6 h-[400px]",
    "bg-gradient-to-br from-slate-800/50 to-slate-900/50 border border-white/10",
    "dark:bg-gradient-to-br dark:from-slate-800/50 dark:to-slate-900/50 dark:border-white/10",
    "flex items-end",
    className
  )}>
    <div className="skeleton-chart-bars flex gap-2 w-full h-full items-end">
      {[...Array(12)].map((_, i) => (
        <div 
          key={i} 
          className="skeleton-bar flex-1 bg-white/10 rounded-t animate-pulse"
          style={{ 
            height: `${Math.random() * 60 + 40}%`,
            animationDelay: `${i * 0.1}s`
          }}
        />
      ))}
    </div>
  </div>
);

export const SkeletonList = ({ count = 6, className }: { count?: number; className?: string }) => (
  <div className={cn("space-y-3", className)}>
    {[...Array(count)].map((_, i) => (
      <div
        key={i}
        className={cn(
          "h-16 rounded-lg relative overflow-hidden",
          "bg-gradient-to-br from-slate-800/50 to-slate-900/50 border border-white/10",
          "dark:bg-gradient-to-br dark:from-slate-800/50 dark:to-slate-900/50 dark:border-white/10"
        )}
      >
        <motion.div
          className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent"
          variants={shimmer}
          initial="hidden"
          animate="visible"
          style={{ animationDelay: `${i * 0.1}s` }}
        />
      </div>
    ))}
  </div>
);
