/**
 * Premium design tokens and CSS-in-JS utilities
 */

// Premium gradients
export const gradients = {
  // AI Insight banner gradients
  insight: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
  insightAlt: "linear-gradient(135deg, #14b8a6 0%, #3b82f6 50%, #8b5cf6 100%)",
  
  // Chart area gradients
  teal: "linear-gradient(to right, #11998e 0%, #38ef7d 100%)",
  tealArea: "linear-gradient(to bottom, rgba(20, 184, 166, 0.4) 0%, rgba(20, 184, 166, 0) 100%)",
  blueArea: "linear-gradient(to bottom, rgba(59, 130, 246, 0.4) 0%, rgba(59, 130, 246, 0) 100%)",
  purpleArea: "linear-gradient(to bottom, rgba(139, 92, 246, 0.4) 0%, rgba(139, 92, 246, 0) 100%)",
  
  // Card gradients
  greenGradient: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
  redGradient: "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)",
  blueGradient: "linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)",
  purpleGradient: "linear-gradient(135deg, #a855f7 0%, #9333ea 100%)",
  
  // Glassmorphism backgrounds
  glass: "rgba(255, 255, 255, 0.1)",
  glassDark: "rgba(0, 0, 0, 0.1)",
} as const;

// Shadows and glows
export const shadows = {
  // Premium shadows
  premium: "0 8px 32px rgba(31, 38, 135, 0.15), 0 2px 8px rgba(31, 38, 135, 0.1)",
  premiumHover: "0 16px 48px rgba(31, 38, 135, 0.25), 0 4px 16px rgba(31, 38, 135, 0.15)",
  
  // Colored glows
  glowTeal: "0 0 20px rgba(20, 184, 166, 0.5), 0 0 40px rgba(20, 184, 166, 0.2)",
  glowBlue: "0 0 20px rgba(59, 130, 246, 0.5), 0 0 40px rgba(59, 130, 246, 0.2)",
  glowPurple: "0 0 20px rgba(139, 92, 246, 0.5), 0 0 40px rgba(139, 92, 246, 0.2)",
  glowGreen: "0 0 20px rgba(16, 185, 129, 0.5), 0 0 40px rgba(16, 185, 129, 0.2)",
  glowRed: "0 0 20px rgba(239, 68, 68, 0.5), 0 0 40px rgba(239, 68, 68, 0.2)",
  
  // Card shadows
  cardElevation: "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)",
  cardHover: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
} as const;

// Glassmorphism styles
export const glassmorphism = {
  light: {
    background: "rgba(255, 255, 255, 0.7)",
    backdropFilter: "blur(10px)",
    border: "1px solid rgba(255, 255, 255, 0.3)",
    boxShadow: shadows.premium,
  },
  dark: {
    background: "rgba(0, 0, 0, 0.4)",
    backdropFilter: "blur(10px)",
    border: "1px solid rgba(255, 255, 255, 0.1)",
    boxShadow: shadows.premium,
  },
  card: {
    background: "rgba(255, 255, 255, 0.85)",
    backdropFilter: "blur(12px)",
    border: "1px solid rgba(255, 255, 255, 0.5)",
    boxShadow: shadows.cardElevation,
  }
} as const;

// Transition timings
export const transitions = {
  smooth: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
  bounce: "all 0.5s cubic-bezier(0.68, -0.55, 0.265, 1.55)",
  fast: "all 0.15s ease-out",
  slow: "all 0.6s ease-out",
} as const;

// CSS custom properties helper
export const getCSSVariables = () => ({
  "--gradient-insight": gradients.insight,
  "--gradient-teal": gradients.teal,
  "--gradient-area": gradients.tealArea,
  "--shadow-premium": shadows.premium,
  "--glow-teal": shadows.glowTeal,
  "--glow-purple": shadows.glowPurple,
  "--transition-smooth": transitions.smooth,
  "--transition-bounce": transitions.bounce,
} as const);

// Utility function to apply glassmorphism style
export const applyGlassmorphism = (variant: keyof typeof glassmorphism = 'light') => {
  return glassmorphism[variant];
};

// Color palette for charts
export const chartColors = {
  primary: "#14b8a6", // Teal
  secondary: "#3b82f6", // Blue
  tertiary: "#8b5cf6", // Purple
  success: "#10b981", // Green
  danger: "#ef4444", // Red
  warning: "#f59e0b", // Amber
  info: "#06b6d4", // Cyan
  
  // Area fills (with opacity)
  primaryArea: "rgba(20, 184, 166, 0.2)",
  secondaryArea: "rgba(59, 130, 246, 0.2)",
  tertiaryArea: "rgba(139, 92, 246, 0.2)",
} as const;

// Animation durations
export const durations = {
  instant: 100,
  fast: 200,
  normal: 300,
  slow: 500,
  slower: 700,
  verySlow: 1000,
  lineDrawing: 2000,
  counting: 1500,
  carousel: 8000, // Auto-rotate interval for insights
} as const;

// Z-index layers
export const zIndex = {
  base: 0,
  dropdown: 1000,
  sticky: 1020,
  fixed: 1030,
  modalBackdrop: 1040,
  modal: 1050,
  popover: 1060,
  tooltip: 1070,
} as const;
