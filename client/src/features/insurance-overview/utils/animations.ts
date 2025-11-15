/**
 * Animation Utilities
 * 
 * Common animation configurations and transition utilities
 * for smooth, consistent animations throughout the Insurance Overview page.
 */

export const transitions = {
  // Fast transitions for micro-interactions
  fast: 'transition-all duration-150 ease-in-out',
  
  // Standard transitions for most UI elements
  base: 'transition-all duration-300 ease-in-out',
  
  // Slower transitions for complex animations
  slow: 'transition-all duration-500 ease-in-out',
};

export const shadows = {
  // Subtle shadow for cards at rest
  sm: 'shadow-sm hover:shadow-md',
  
  // Medium shadow with hover effect
  md: 'shadow-md hover:shadow-lg',
  
  // Large shadow for prominent elements
  lg: 'shadow-lg hover:shadow-xl',
  
  // Layered shadow for depth
  layered: 'shadow-[0_1px_3px_rgba(0,0,0,0.05),0_10px_15px_rgba(0,0,0,0.03)]',
};

export const hover = {
  // Scale up on hover
  scale: 'hover:scale-[1.02] active:scale-[0.98]',
  
  // Lift effect
  lift: 'hover:-translate-y-1',
  
  // Glow effect
  glow: 'hover:shadow-[0_0_20px_rgba(59,130,246,0.3)]',
};

// Shimmer animation for loading states
export const shimmer = `
  @keyframes shimmer {
    0% {
      background-position: -200% 0;
    }
    100% {
      background-position: 200% 0;
    }
  }
  
  .animate-shimmer {
    animation: shimmer 2s infinite;
    background: linear-gradient(
      90deg,
      rgba(255, 255, 255, 0) 0%,
      rgba(255, 255, 255, 0.3) 50%,
      rgba(255, 255, 255, 0) 100%
    );
    background-size: 200% 100%;
  }
`;

// Fade in animation
export const fadeIn = 'animate-in fade-in duration-500';

// Slide up animation
export const slideUp = 'animate-in slide-in-from-bottom-4 duration-500';
