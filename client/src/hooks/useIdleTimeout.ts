import { useEffect, useRef, useState } from 'react';
import { api } from '@/lib/queryClient';

interface UseIdleTimeoutProps {
  timeoutMinutes?: number;
  warningMinutes?: number;
  onTimeout: () => void;
  onWarning?: (remainingSeconds: number) => void;
  enabled?: boolean;
}

export function useIdleTimeout({
  timeoutMinutes = 30, // 30 minutes default timeout
  warningMinutes = 5,  // 5 minutes warning before timeout
  onTimeout,
  onWarning,
  enabled = true
}: UseIdleTimeoutProps) {
  const [isWarning, setIsWarning] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  
  const timeoutRef = useRef<NodeJS.Timeout>();
  const warningTimeoutRef = useRef<NodeJS.Timeout>();
  const countdownIntervalRef = useRef<NodeJS.Timeout>();
  
  const timeoutMs = timeoutMinutes * 60 * 1000;
  const warningMs = warningMinutes * 60 * 1000;
  const warningStartMs = timeoutMs - warningMs;

  const resetTimer = () => {
    if (!enabled) return;
    
    // Clear existing timers
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (warningTimeoutRef.current) clearTimeout(warningTimeoutRef.current);
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    
    // Reset warning state
    setIsWarning(false);
    setRemainingSeconds(0);
    
    // Set warning timer
    warningTimeoutRef.current = setTimeout(() => {
      setIsWarning(true);
      setRemainingSeconds(warningMinutes * 60);
      
      if (onWarning) {
        onWarning(warningMinutes * 60);
      }
      
      // Start countdown
      countdownIntervalRef.current = setInterval(() => {
        setRemainingSeconds(prev => {
          if (prev <= 1) {
            clearInterval(countdownIntervalRef.current!);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      
    }, warningStartMs);
    
    // Set timeout timer
    timeoutRef.current = setTimeout(() => {
      handleTimeout();
    }, timeoutMs);
  };

  const handleTimeout = async () => {
    try {
      // Call logout API
      await api.post('/api/auth/logout');
    } catch (error) {
      console.error('Auto-logout error:', error);
    } finally {
      // Clear session and redirect
      localStorage.removeItem('user_session_backup');
      // Force a full page redirect to ensure proper navigation
      window.location.href = '/login?timeout=true';
    }
  };

  const extendSession = () => {
    resetTimer();
  };

  const logoutNow = () => {
    handleTimeout();
  };

  useEffect(() => {
    if (!enabled) return;

    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
    
    const handleActivity = () => {
      resetTimer();
    };

    // Add event listeners for user activity
    events.forEach(event => {
      document.addEventListener(event, handleActivity, true);
    });

    // Initial timer setup
    resetTimer();

    // Cleanup
    return () => {
      events.forEach(event => {
        document.removeEventListener(event, handleActivity, true);
      });
      
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (warningTimeoutRef.current) clearTimeout(warningTimeoutRef.current);
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    };
  }, [enabled, timeoutMs, warningMs]);

  return {
    isWarning,
    remainingSeconds,
    extendSession,
    logoutNow,
    formatTime: (seconds: number) => {
      const minutes = Math.floor(seconds / 60);
      const remainderSeconds = seconds % 60;
      return `${minutes}:${remainderSeconds.toString().padStart(2, '0')}`;
    }
  };
}