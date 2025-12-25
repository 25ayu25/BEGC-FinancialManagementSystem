/**
 * Premium Department Growth with animated progress bars
 */

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { TrendingUp, TrendingDown, Star, Building, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { progressVariants, getStaggerDelay } from "@/lib/animations";
import { gradients } from "@/lib/designTokens";

interface DepartmentGrowthItem {
  id: string | number;
  name: string;
  currentValue: number;
  prevValue: number;
  growth: number;
  isNewDepartment: boolean;
  hasNoActivity: boolean;
  icon: LucideIcon;
  bgColor: string;
  iconColor: string;
}

interface PremiumDepartmentGrowthProps {
  departments: DepartmentGrowthItem[];
  maxDisplay?: number;
  compactSSP: (n: number) => string;
  onDepartmentClick?: (dept: DepartmentGrowthItem) => void;
}

export default function PremiumDepartmentGrowth({
  departments,
  maxDisplay = 6,
  compactSSP,
  onDepartmentClick,
}: PremiumDepartmentGrowthProps) {
  const [hoveredId, setHoveredId] = useState<string | number | null>(null);

  const displayedDepartments = departments.slice(0, maxDisplay);

  return (
    <motion.div
      className="space-y-3"
      initial="hidden"
      animate="visible"
      variants={{
        visible: {
          transition: {
            staggerChildren: 0.1,
          },
        },
      }}
    >
      {displayedDepartments.map((dept, index) => {
        const Icon = dept.icon;
        const isHovered = hoveredId === dept.id;
        const isClickable = !!onDepartmentClick;

        return (
          <motion.div
            key={dept.id}
            variants={{
              hidden: { opacity: 0, x: -20 },
              visible: {
                opacity: 1,
                x: 0,
                transition: {
                  duration: 0.5,
                  delay: getStaggerDelay(index, 0.1),
                  ease: "easeOut",
                },
              },
            }}
            onHoverStart={() => setHoveredId(dept.id)}
            onHoverEnd={() => setHoveredId(null)}
            onClick={() => onDepartmentClick?.(dept)}
            className={cn(
              "relative group",
              isClickable && "cursor-pointer"
            )}
          >
            <div className={cn(
              "flex items-center gap-3 p-3 rounded-xl transition-all duration-300",
              isHovered && "bg-slate-50/80 shadow-md"
            )}>
              {/* Icon */}
              <motion.div
                className={cn("w-10 h-10 rounded-lg flex items-center justify-center relative", dept.bgColor)}
                whileHover={{ scale: 1.1, rotate: 5 }}
                transition={{ duration: 0.3 }}
              >
                <Icon className={cn("h-5 w-5 z-10", dept.iconColor)} />
                
                {/* Glow effect on hover */}
                <motion.div
                  className="absolute inset-0 rounded-lg"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: isHovered ? 0.3 : 0 }}
                  style={{
                    background: dept.iconColor.includes("teal") 
                      ? gradients.teal 
                      : dept.iconColor.includes("blue")
                        ? gradients.blueGradient
                        : gradients.greenGradient,
                    filter: "blur(8px)",
                  }}
                />
              </motion.div>

              {/* Department info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-slate-700 truncate pr-2">
                    {dept.name}
                  </span>
                  
                  {/* Growth indicator or New badge */}
                  {dept.isNewDepartment ? (
                    <motion.div
                      className="flex items-center gap-1 px-2 py-1 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 shadow-lg"
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{
                        type: "spring",
                        stiffness: 260,
                        damping: 20,
                        delay: getStaggerDelay(index, 0.1) + 0.3,
                      }}
                      style={{
                        boxShadow: "0 0 20px rgba(139, 92, 246, 0.4)",
                      }}
                    >
                      <Star className="h-3 w-3 text-white fill-white" />
                      <span className="text-xs font-semibold text-white">New</span>
                    </motion.div>
                  ) : (
                    <motion.div
                      className={cn(
                        "flex items-center gap-1 text-sm font-semibold",
                        dept.growth >= 0 ? "text-green-600" : "text-red-600"
                      )}
                      initial={{ opacity: 0, x: 10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: getStaggerDelay(index, 0.1) + 0.2 }}
                    >
                      {dept.growth >= 0 ? "+" : ""}{dept.growth.toFixed(1)}%
                      {dept.growth >= 0 ? (
                        <TrendingUp className="h-3 w-3" />
                      ) : (
                        <TrendingDown className="h-3 w-3" />
                      )}
                    </motion.div>
                  )}
                </div>

                {/* Progress bar or new department indicator */}
                {dept.isNewDepartment ? (
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <span className="font-mono">
                      SSP 0 → {compactSSP(dept.currentValue)}
                    </span>
                  </div>
                ) : (
                  <div className="relative h-2 bg-slate-100 rounded-full overflow-hidden">
                    {/* Animated progress bar */}
                    <motion.div
                      className={cn(
                        "h-full rounded-full",
                        dept.growth >= 0 
                          ? "bg-gradient-to-r from-green-400 to-green-600" 
                          : "bg-gradient-to-r from-red-400 to-red-600"
                      )}
                      custom={Math.min(Math.abs(dept.growth) * 2, 100)}
                      variants={progressVariants}
                      initial="initial"
                      animate="animate"
                      transition={{
                        delay: getStaggerDelay(index, 0.1) + 0.4,
                      }}
                      style={{
                        boxShadow: dept.growth >= 0
                          ? "0 0 10px rgba(16, 185, 129, 0.5)"
                          : "0 0 10px rgba(239, 68, 68, 0.5)",
                      }}
                    />

                    {/* Shimmer effect */}
                    <motion.div
                      className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent opacity-30"
                      animate={{
                        x: ["-100%", "100%"],
                      }}
                      transition={{
                        duration: 2,
                        repeat: Infinity,
                        ease: "linear",
                        delay: getStaggerDelay(index, 0.1) + 0.5,
                      }}
                      style={{
                        width: "50%",
                      }}
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Tooltip on hover */}
            <AnimatePresence>
              {isHovered && (
                <motion.div
                  initial={{ opacity: 0, y: -10, scale: 0.9 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -10, scale: 0.9 }}
                  transition={{ duration: 0.2 }}
                  className="absolute z-50 left-0 right-0 -top-2 transform -translate-y-full pointer-events-none"
                >
                  <div className="bg-slate-900 text-white text-xs rounded-lg p-3 shadow-2xl mx-3">
                    <div className="font-semibold mb-1">{dept.name}</div>
                    {dept.isNewDepartment ? (
                      <>
                        <div className="text-slate-300">
                          Status: <span className="text-blue-300">Newly launched</span>
                        </div>
                        <div className="text-slate-300">
                          Current: <span className="text-white">{compactSSP(dept.currentValue)}</span>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="text-slate-300">
                          Current: <span className="text-white">{compactSSP(dept.currentValue)}</span>
                        </div>
                        <div className="text-slate-300">
                          Previous: <span className="text-white">{compactSSP(dept.prevValue)}</span>
                        </div>
                        <div className="text-slate-300">
                          Growth: <span className={cn(
                            "font-semibold",
                            dept.growth >= 0 ? "text-green-300" : "text-red-300"
                          )}>
                            {dept.growth >= 0 ? "+" : ""}{dept.growth.toFixed(1)}%
                          </span>
                        </div>
                      </>
                    )}
                  </div>
                  {/* Arrow */}
                  <div className="flex justify-center">
                    <div className="w-2 h-2 bg-slate-900 transform rotate-45 -mt-1" />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        );
      })}

      {departments.length === 0 && (
        <div className="h-40 flex flex-col items-center justify-center text-slate-500 text-sm">
          <Building className="h-10 w-10 text-slate-300 mb-2" />
          <p>No department data available</p>
        </div>
      )}
    </motion.div>
  );
}
