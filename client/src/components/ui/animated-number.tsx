'use client';

import { useEffect, useState, useRef } from 'react';

interface AnimatedNumberProps {
  value: number;
  duration?: number;
  formatFn?: (n: number) => string;
}

export function AnimatedNumber({ 
  value, 
  duration = 1500,
  formatFn = (n) => Math.round(n).toLocaleString()
}: AnimatedNumberProps) {
  const [displayValue, setDisplayValue] = useState(0);
  const startTimeRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const hasAnimatedRef = useRef(false);

  useEffect(() => {
    // Only animate on initial mount, not on value changes
    if (hasAnimatedRef.current) {
      setDisplayValue(value);
      return;
    }
    
    hasAnimatedRef.current = true;
    startTimeRef.current = null;
    
    const animate = (timestamp: number) => {
      if (!startTimeRef.current) startTimeRef.current = timestamp;
      
      const progress = Math.min((timestamp - startTimeRef.current) / duration, 1);
      // Ease-out cubic for smooth deceleration
      const easeOut = 1 - Math.pow(1 - progress, 3);
      
      setDisplayValue(easeOut * value);
      
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate);
      } else {
        setDisplayValue(value);
      }
    };
    
    rafRef.current = requestAnimationFrame(animate);
    
    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [value, duration]);

  return <span className="tabular-nums">{formatFn(displayValue)}</span>;
}
