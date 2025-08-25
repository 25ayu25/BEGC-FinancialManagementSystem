import { QueryClient, QueryFunction } from "@tanstack/react-query";
import axios from 'axios';

// Get API base URL from environment
const getApiBaseUrl = () => {
  return import.meta.env.VITE_API_URL || 'https://bgc-financialmanagementsystem.onrender.com';
};

// Create axios instance with credentials
export const api = axios.create({
  baseURL: getApiBaseUrl(),
  withCredentials: true,  // REQUIRED for cross-site cookies
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add Safari fallback token to all requests
api.interceptors.request.use((config) => {
  const sessionBackup = localStorage.getItem('user_session_backup');
  if (sessionBackup) {
    config.headers['x-session-token'] = sessionBackup;
  }
  return config;
});

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  try {
    const response = await api.request({
      method,
      url,
      data,
    });
    
    // Convert axios response to fetch Response format for compatibility
    return {
      ok: response.status >= 200 && response.status < 300,
      status: response.status,
      statusText: response.statusText,
      json: async () => response.data,
      text: async () => JSON.stringify(response.data),
    } as Response;
  } catch (error: any) {
    throw new Error(`${error.response?.status || 500}: ${error.response?.data?.error || error.message}`);
  }
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    try {
      const response = await api.get(queryKey.join("/"));
      return response.data;
    } catch (error: any) {
      if (unauthorizedBehavior === "returnNull" && error.response?.status === 401) {
        return null;
      }
      throw new Error(`${error.response?.status || 500}: ${error.response?.data?.error || error.message}`);
    }
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
