import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface SuccessCelebrationProps {
  show: boolean;
  onComplete?: () => void;
  message?: string;
}

/**
 * Success celebration component with animated checkmark
 * Displays for 2 seconds with satisfying animations
 * Respects prefers-reduced-motion
 */
export function SuccessCelebration({
  show,
  onComplete,
  message = "Success!",
}: SuccessCelebrationProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (show) {
      setIsVisible(true);
      const timer = setTimeout(() => {
        setIsVisible(false);
        onComplete?.();
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [show, onComplete]);

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none"
        >
          {/* Backdrop with blur */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/10 backdrop-blur-sm"
          />

          {/* Success card */}
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            transition={{
              type: "spring",
              stiffness: 300,
              damping: 25,
            }}
            className="relative z-10 bg-white rounded-2xl shadow-2xl p-8 max-w-sm mx-4"
          >
            {/* Animated checkmark circle */}
            <div className="flex flex-col items-center gap-4">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{
                  type: "spring",
                  stiffness: 400,
                  damping: 20,
                  delay: 0.1,
                }}
                className="relative"
              >
                {/* Pulsing background circle */}
                <motion.div
                  initial={{ scale: 1, opacity: 0.8 }}
                  animate={{ scale: [1, 1.2, 1], opacity: [0.8, 0.4, 0.8] }}
                  transition={{
                    duration: 1.5,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }}
                  className="absolute inset-0 bg-emerald-400 rounded-full blur-xl"
                />
                
                {/* Checkmark icon */}
                <div className="relative bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-full p-4">
                  <motion.div
                    initial={{ scale: 0, rotate: -180 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{
                      type: "spring",
                      stiffness: 300,
                      damping: 15,
                      delay: 0.2,
                    }}
                  >
                    <CheckCircle className="w-12 h-12 text-white" strokeWidth={3} />
                  </motion.div>
                </div>
              </motion.div>

              {/* Success message */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="text-center"
              >
                <h3 className="text-xl font-bold text-slate-800 mb-1">
                  {message}
                </h3>
                <p className="text-sm text-slate-600">
                  Reconciliation completed successfully
                </p>
              </motion.div>

              {/* Confetti particles (lightweight) */}
              <div className="absolute inset-0 pointer-events-none">
                {Array.from({ length: 20 }).map((_, i) => (
                  <motion.div
                    key={i}
                    initial={{
                      x: 0,
                      y: 0,
                      opacity: 0,
                      scale: 0,
                    }}
                    animate={{
                      x: (Math.random() - 0.5) * 300,
                      y: Math.random() * -200 - 100,
                      opacity: [0, 1, 0],
                      scale: [0, 1, 0.5],
                      rotate: Math.random() * 360,
                    }}
                    transition={{
                      duration: 1.5,
                      delay: i * 0.02,
                      ease: "easeOut",
                    }}
                    className={cn(
                      "absolute w-2 h-2 rounded-full",
                      i % 3 === 0 ? "bg-emerald-400" :
                      i % 3 === 1 ? "bg-amber-400" :
                      "bg-orange-400"
                    )}
                    style={{
                      left: "50%",
                      top: "50%",
                    }}
                  />
                ))}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/**
 * Toast-style success notification with animated icon
 * Alternative lightweight celebration
 */
export function SuccessToast({
  show,
  onComplete,
  message = "Success!",
}: SuccessCelebrationProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (show) {
      setIsVisible(true);
      const timer = setTimeout(() => {
        setIsVisible(false);
        onComplete?.();
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [show, onComplete]);

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: -50, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -20, scale: 0.95 }}
          transition={{
            type: "spring",
            stiffness: 400,
            damping: 25,
          }}
          className="fixed top-4 right-4 z-50 bg-white rounded-xl shadow-2xl p-4 flex items-center gap-3 max-w-sm"
        >
          {/* Animated checkmark */}
          <motion.div
            initial={{ scale: 0, rotate: -90 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{
              type: "spring",
              stiffness: 300,
              damping: 20,
              delay: 0.1,
            }}
            className="flex-shrink-0 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-full p-2"
          >
            <CheckCircle className="w-6 h-6 text-white" strokeWidth={3} />
          </motion.div>

          {/* Message */}
          <div className="flex-1">
            <p className="font-semibold text-slate-800">{message}</p>
            <p className="text-sm text-slate-600">Reconciliation completed</p>
          </div>

          {/* Progress bar */}
          <motion.div
            initial={{ scaleX: 1 }}
            animate={{ scaleX: 0 }}
            transition={{ duration: 2, ease: "linear" }}
            className="absolute bottom-0 left-0 right-0 h-1 bg-emerald-400 origin-left rounded-b-xl"
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
