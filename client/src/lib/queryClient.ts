import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { buildApiUrl } from "./env";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  urlOrMethod: string,
  urlOrOptions?: string | RequestInit,
  data?: unknown | undefined,
): Promise<any> {
  let url: string;
  let options: RequestInit;

  // Handle both old and new calling patterns
  if (typeof urlOrOptions === 'string') {
    // Old pattern: apiRequest(method, url, data)
    const method = urlOrMethod;
    url = urlOrOptions;
    options = {
      method,
      headers: data ? { "Content-Type": "application/json" } : {},
      body: data ? JSON.stringify(data) : undefined,
      credentials: "include",
    };
  } else {
    // New pattern: apiRequest(url, options)
    url = urlOrMethod;
    options = {
      credentials: "include",
      ...urlOrOptions,
    };
  }

  // Build the full API URL using environment configuration
  const apiUrl = url.startsWith('http') ? url : buildApiUrl(url);
  
  const res = await fetch(apiUrl, options);

  await throwIfResNotOk(res);
  
  // Return parsed JSON for successful responses
  const contentType = res.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    return await res.json();
  }
  
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const url = queryKey.join("/") as string;
    // Build the full API URL using environment configuration
    const apiUrl = url.startsWith('http') ? url : buildApiUrl(url);
    
    const res = await fetch(apiUrl, {
      credentials: "include",
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
