/**
 * Premium AI Insight Banner with rotating insights and animations
 */

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, X, ChevronLeft, ChevronRight, TrendingUp, AlertTriangle, Lightbulb, Target } from "lucide-react";
import { cn } from "@/lib/utils";
import { slideDownVariants, rotateCycleVariants } from "@/lib/animations";
import { gradients, shadows, durations } from "@/lib/designTokens";

export interface InsightData {
  id: string;
  type: "trend" | "anomaly" | "new" | "recommendation" | "prediction";
  message: string;
  icon?: "sparkles" | "trending" | "alert" | "lightbulb" | "target";
}

interface PremiumInsightBannerProps {
  insights: InsightData[];
  autoRotate?: boolean;
  rotateInterval?: number;
  onDismiss?: () => void;
  className?: string;
}

const iconMap = {
  sparkles: Sparkles,
  trending: TrendingUp,
  alert: AlertTriangle,
  lightbulb: Lightbulb,
  target: Target,
};

export default function PremiumInsightBanner({
  insights,
  autoRotate = true,
  rotateInterval = durations.carousel,
  onDismiss,
  className,
}: PremiumInsightBannerProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [direction, setDirection] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [isVisible, setIsVisible] = useState(true);

  const currentInsight = insights[currentIndex] || insights[0];

  // Auto-rotate through insights
  useEffect(() => {
    if (!autoRotate || isPaused || insights.length <= 1) return;

    const timer = setInterval(() => {
      goToNext();
    }, rotateInterval);

    return () => clearInterval(timer);
  }, [currentIndex, autoRotate, isPaused, rotateInterval, insights.length]);

  const goToNext = useCallback(() => {
    setDirection(1);
    setCurrentIndex((prev) => (prev + 1) % insights.length);
  }, [insights.length]);

  const goToPrevious = useCallback(() => {
    setDirection(-1);
    setCurrentIndex((prev) => (prev - 1 + insights.length) % insights.length);
  }, [insights.length]);

  const goToIndex = useCallback((index: number) => {
    setDirection(index > currentIndex ? 1 : -1);
    setCurrentIndex(index);
  }, [currentIndex]);

  const handleDismiss = () => {
    setIsVisible(false);
    setTimeout(() => {
      onDismiss?.();
    }, 300);
  };

  if (!currentInsight || insights.length === 0) return null;

  const Icon = iconMap[currentInsight.icon || "sparkles"];

  return (
    <AnimatePresence mode="wait">
      {isVisible && (
        <motion.div
          variants={slideDownVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          onHoverStart={() => setIsPaused(true)}
          onHoverEnd={() => setIsPaused(false)}
          className={cn(
            "relative overflow-hidden rounded-2xl shadow-2xl",
            "border border-white/20",
            className
          )}
          style={{
            background: gradients.insightAlt,
            boxShadow: `${shadows.premium}, ${shadows.glowPurple}`,
          }}
        >
          {/* Animated background pattern */}
          <div className="absolute inset-0 opacity-10">
            <motion.div
              className="absolute inset-0"
              style={{
                backgroundImage: "radial-gradient(circle at 20% 50%, white 1px, transparent 1px)",
                backgroundSize: "30px 30px",
              }}
              animate={{
                backgroundPosition: ["0px 0px", "30px 30px"],
              }}
              transition={{
                duration: 20,
                repeat: Infinity,
                ease: "linear",
              }}
            />
          </div>

          {/* Glassmorphism overlay */}
          <div 
            className="absolute inset-0 backdrop-blur-sm"
            style={{
              background: "rgba(255, 255, 255, 0.1)",
            }}
          />

          {/* Content */}
          <div className="relative px-6 py-4">
            <div className="flex items-center gap-4">
              {/* Animated Icon */}
              <motion.div
                animate={{
                  rotate: [0, 5, -5, 0],
                  scale: [1, 1.1, 1],
                }}
                transition={{
                  duration: 3,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
                className="flex-shrink-0"
              >
                <div className="relative">
                  <Icon className="h-6 w-6 text-white drop-shadow-lg" />
                  {/* Glow effect */}
                  <motion.div
                    className="absolute inset-0 blur-md"
                    animate={{
                      opacity: [0.5, 1, 0.5],
                    }}
                    transition={{
                      duration: 2,
                      repeat: Infinity,
                      ease: "easeInOut",
                    }}
                  >
                    <Icon className="h-6 w-6 text-white" />
                  </motion.div>
                </div>
              </motion.div>

              {/* Message with rotation animation */}
              <div className="flex-1 min-w-0 relative h-6 overflow-hidden">
                <AnimatePresence mode="wait" custom={direction}>
                  <motion.p
                    key={currentIndex}
                    custom={direction}
                    variants={rotateCycleVariants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    className="absolute inset-x-0 font-medium text-white text-sm sm:text-base drop-shadow-md"
                  >
                    {currentInsight.message}
                  </motion.p>
                </AnimatePresence>
              </div>

              {/* Controls */}
              <div className="flex items-center gap-2 flex-shrink-0">
                {/* Navigation arrows (only show if multiple insights) */}
                {insights.length > 1 && (
                  <>
                    <button
                      onClick={goToPrevious}
                      className="p-1.5 rounded-lg bg-white/20 hover:bg-white/30 backdrop-blur-sm transition-colors"
                      aria-label="Previous insight"
                    >
                      <ChevronLeft className="h-4 w-4 text-white" />
                    </button>

                    {/* Dots indicator */}
                    <div className="flex gap-1.5 px-2">
                      {insights.map((_, index) => (
                        <button
                          key={index}
                          onClick={() => goToIndex(index)}
                          className={cn(
                            "h-2 rounded-full transition-all duration-300",
                            index === currentIndex
                              ? "w-6 bg-white"
                              : "w-2 bg-white/40 hover:bg-white/60"
                          )}
                          aria-label={`Go to insight ${index + 1}`}
                        />
                      ))}
                    </div>

                    <button
                      onClick={goToNext}
                      className="p-1.5 rounded-lg bg-white/20 hover:bg-white/30 backdrop-blur-sm transition-colors"
                      aria-label="Next insight"
                    >
                      <ChevronRight className="h-4 w-4 text-white" />
                    </button>
                  </>
                )}

                {/* Dismiss button */}
                {onDismiss && (
                  <button
                    onClick={handleDismiss}
                    className="p-1.5 rounded-lg bg-white/20 hover:bg-white/30 backdrop-blur-sm transition-colors ml-2"
                    aria-label="Dismiss"
                  >
                    <X className="h-4 w-4 text-white" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Bottom shine effect */}
          <motion.div
            className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white to-transparent"
            animate={{
              opacity: [0.3, 0.6, 0.3],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
