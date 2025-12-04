import { useState, useEffect, useRef } from 'react';

interface UseCountUpOptions {
  end: number;
  duration?: number; // in milliseconds
  startOnMount?: boolean;
}

/**
 * Alternative hook for animated counting.
 * Returns the current animated count value directly.
 * 
 * Use AnimatedNumber component for most cases - this hook is provided for cases
 * where you need more control over the animated value (e.g., custom rendering).
 */
export function useCountUp({ end, duration = 1500, startOnMount = true }: UseCountUpOptions) {
  const [count, setCount] = useState(0);
  const startTimeRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const hasStartedRef = useRef(false);

  useEffect(() => {
    if (!startOnMount || hasStartedRef.current) return;
    
    hasStartedRef.current = true;
    
    const animate = (timestamp: number) => {
      if (!startTimeRef.current) {
        startTimeRef.current = timestamp;
      }
      
      const progress = Math.min((timestamp - startTimeRef.current) / duration, 1);
      
      // Ease-out cubic for smooth deceleration
      const easeOut = 1 - Math.pow(1 - progress, 3);
      
      setCount(Math.floor(easeOut * end));
      
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate);
      } else {
        setCount(end); // Ensure we end on exact value
      }
    };
    
    rafRef.current = requestAnimationFrame(animate);
    
    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [end, duration, startOnMount]);

  return count;
}
