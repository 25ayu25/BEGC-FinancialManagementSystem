import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";

export interface User {
  id: string;
  username: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  role: string;
  location: string;
}

export function useAuth() {
  const queryClient = useQueryClient();
  const [authState, setAuthState] = useState<{
    user: User | null;
    isLoading: boolean;
    isAuthenticated: boolean;
  }>({
    user: null,
    isLoading: true,
    isAuthenticated: false,
  });

  // Initial auth check - only runs once
  useEffect(() => {
    const checkAuth = async () => {
      try {
        console.log('Checking authentication status...');
        const response = await fetch('/api/auth/user', {
          credentials: 'include'
        });
        
        console.log('Auth check response:', response.status);
        
        if (response.ok) {
          const user = await response.json();
          console.log('User authenticated:', user);
          setAuthState({
            user,
            isLoading: false,
            isAuthenticated: true,
          });
        } else {
          console.log('User not authenticated');
          setAuthState({
            user: null,
            isLoading: false,
            isAuthenticated: false,
          });
        }
      } catch (error) {
        console.error('Auth check error:', error);
        setAuthState({
          user: null,
          isLoading: false,
          isAuthenticated: false,
        });
      }
    };

    checkAuth();
  }, []);

  const loginMutation = useMutation({
    mutationFn: async ({ username, password }: { username: string; password: string }) => {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
        credentials: 'include'
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Login failed');
      }
      
      return await response.json();
    },
    onSuccess: (data) => {
      console.log('Login mutation success, updating auth state:', data);
      setAuthState({
        user: data.user,
        isLoading: false,
        isAuthenticated: true,
      });
      queryClient.invalidateQueries(); // Refresh all cached data
    },
    onError: (error) => {
      console.error('Login mutation error:', error);
    }
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/auth/logout', { 
        method: 'POST',
        credentials: 'include'
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Logout failed');
      }
      
      return await response.json();
    },
    onSuccess: () => {
      setAuthState({
        user: null,
        isLoading: false,
        isAuthenticated: false,
      });
      queryClient.clear(); // Clear all cached data
    }
  });

  return {
    user: authState.user,
    isLoading: authState.isLoading,
    isAuthenticated: authState.isAuthenticated,
    login: loginMutation.mutateAsync,
    logout: logoutMutation.mutateAsync,
    isLoggingIn: loginMutation.isPending,
    isLoggingOut: logoutMutation.isPending,
    loginError: loginMutation.error
  };
}