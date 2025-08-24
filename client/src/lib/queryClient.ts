import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

// Get API base URL from environment
const getApiBaseUrl = () => {
  return import.meta.env.VITE_API_URL || '';
};

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  // Safari fallback: include session token in headers
  const sessionBackup = localStorage.getItem('user_session_backup');
  const headers: Record<string, string> = data ? { "Content-Type": "application/json" } : {};
  
  if (sessionBackup) {
    headers['x-session-token'] = sessionBackup;
  }
  
  // Use production API URL if available
  const apiUrl = url.startsWith('http') ? url : `${getApiBaseUrl()}${url}`;
  
  const res = await fetch(apiUrl, {
    method,
    headers,
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    // Safari fallback: include session token in headers
    const sessionBackup = localStorage.getItem('user_session_backup');
    const headers: Record<string, string> = {};
    
    if (sessionBackup) {
      headers['x-session-token'] = sessionBackup;
    }
    
    const apiUrl = `${getApiBaseUrl()}${queryKey.join("/")}`;
    const res = await fetch(apiUrl, {
      credentials: "include",
      headers,
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
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
