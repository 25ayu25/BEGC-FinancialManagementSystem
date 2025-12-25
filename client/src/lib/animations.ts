/**
 * Animation utilities and Framer Motion variants for premium UI
 */

import type { Variants } from "framer-motion";

// Easing functions
export const easings = {
  smooth: [0.4, 0, 0.2, 1],
  bounce: [0.68, -0.55, 0.265, 1.55],
  easeOut: [0, 0, 0.2, 1],
  easeIn: [0.4, 0, 1, 1],
  easeInOut: [0.4, 0, 0.6, 1],
} as const;

// Line drawing animation for charts
export const lineVariants: Variants = {
  hidden: { 
    pathLength: 0, 
    opacity: 0 
  },
  visible: {
    pathLength: 1,
    opacity: 1,
    transition: { 
      duration: 2, 
      ease: "easeInOut" 
    }
  }
};

// Staggered container for cards
export const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { 
      staggerChildren: 0.1,
      delayChildren: 0.2
    }
  }
};

// Card entrance animation
export const cardVariants: Variants = {
  hidden: { 
    opacity: 0, 
    y: 20,
    scale: 0.95
  },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { 
      duration: 0.5, 
      ease: easings.easeOut 
    }
  }
};

// Slide down entrance (for insight banner)
export const slideDownVariants: Variants = {
  hidden: {
    y: -100,
    opacity: 0
  },
  visible: {
    y: 0,
    opacity: 1,
    transition: {
      type: "spring",
      damping: 20,
      stiffness: 100
    }
  },
  exit: {
    y: -100,
    opacity: 0,
    transition: {
      duration: 0.3
    }
  }
};

// Fade and scale animation
export const fadeScaleVariants: Variants = {
  hidden: {
    opacity: 0,
    scale: 0.8
  },
  visible: {
    opacity: 1,
    scale: 1,
    transition: {
      duration: 0.4,
      ease: easings.smooth
    }
  },
  exit: {
    opacity: 0,
    scale: 0.8,
    transition: {
      duration: 0.2
    }
  }
};

// Progress bar fill animation
export const progressVariants = {
  initial: { width: "0%" },
  animate: (percentage: number) => ({
    width: `${percentage}%`,
    transition: { 
      duration: 1.5, 
      ease: easings.easeOut,
      delay: 0.2
    }
  })
};

// Pulse animation
export const pulseVariants: Variants = {
  pulse: {
    scale: [1, 1.05, 1],
    opacity: [1, 0.8, 1],
    transition: {
      duration: 2,
      repeat: Infinity,
      ease: "easeInOut"
    }
  }
};

// Shimmer animation
export const shimmerVariants: Variants = {
  shimmer: {
    x: ["-100%", "100%"],
    transition: {
      duration: 2,
      repeat: Infinity,
      ease: "linear"
    }
  }
};

// Hover lift animation
export const hoverLiftVariants: Variants = {
  rest: {
    scale: 1,
    y: 0,
    transition: {
      duration: 0.3,
      ease: easings.smooth
    }
  },
  hover: {
    scale: 1.03,
    y: -4,
    transition: {
      duration: 0.3,
      ease: easings.smooth
    }
  }
};

// Number counting animation utility
export const animateValue = (
  start: number,
  end: number,
  duration: number,
  callback: (value: number) => void,
  decimals: number = 1
) => {
  const startTime = performance.now();
  const difference = end - start;

  const step = (currentTime: number) => {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    
    // Easing function (ease-out)
    const eased = 1 - Math.pow(1 - progress, 3);
    const current = start + difference * eased;
    
    callback(parseFloat(current.toFixed(decimals)));

    if (progress < 1) {
      requestAnimationFrame(step);
    } else {
      callback(end); // Ensure we end at exact value
    }
  };

  requestAnimationFrame(step);
};

// Stagger delay calculator
export const getStaggerDelay = (index: number, baseDelay: number = 0.1): number => {
  return index * baseDelay;
};

// Rotate cycle animation for insights
export const rotateCycleVariants: Variants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 50 : -50,
    opacity: 0
  }),
  center: {
    x: 0,
    opacity: 1,
    transition: {
      duration: 0.5,
      ease: easings.smooth
    }
  },
  exit: (direction: number) => ({
    x: direction > 0 ? -50 : 50,
    opacity: 0,
    transition: {
      duration: 0.5,
      ease: easings.smooth
    }
  })
};

// Skeleton loading shimmer
export const skeletonShimmer = {
  shimmer: {
    backgroundPosition: ["200% 0", "-200% 0"],
    transition: {
      duration: 2,
      repeat: Infinity,
      ease: "linear"
    }
  }
};
