import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000';

// Cache session token to avoid repeated Supabase auth calls
let cachedToken: string | null = null;
let tokenExpiry: number = 0;

async function getAuthToken(): Promise<string> {
  const isDebug = import.meta.env.VITE_ASTRA_DEBUG_MODE === "true";
  
  if (isDebug) {
    return "mock-token";
  }

  // Return cached token if still valid (cache for 5 minutes)
  const now = Date.now();
  if (cachedToken && now < tokenExpiry) {
    return cachedToken;
  }

  try {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token || "mock-token";
    
    // Cache the token for 5 minutes
    cachedToken = token;
    tokenExpiry = now + (5 * 60 * 1000);
    
    return token;
  } catch (e) {
    // Fallback for single-admin dev mode
    return "mock-token";
  }
}

// Clear cache on auth state changes (with proper cleanup)
let authStateSubscription: { unsubscribe: () => void } | null = null;

if (typeof window !== 'undefined') {
  const { data } = supabase.auth.onAuthStateChange(() => {
    cachedToken = null;
    tokenExpiry = 0;
  });
  authStateSubscription = data.subscription;
  
  // Cleanup on page unload
  window.addEventListener('beforeunload', () => {
    if (authStateSubscription) {
      authStateSubscription.unsubscribe();
      authStateSubscription = null;
    }
  });
}

async function request<T>(endpoint: string, options: RequestInit = {}) {
  const token = await getAuthToken();
  
  const url = `${BACKEND_URL}${endpoint}`;
  
  // PHASE 3E: Global 30s timeout for all requests
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30_000);
  
  try {
    const response = await fetch(url, {
      ...options,
      signal: options.signal ?? controller.signal, // allow override per-call
      headers: {
        'Content-Type': 'application/json',
        'Authorization': token ? `Bearer ${token}` : '',
        ...options.headers,
      },
    });
    
    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      
      if (errorData.healing) {
        toast.info("AstraFlow Resilience", {
          description: "A minor issue was detected. Self-healing is in progress...",
        });
      } else {
        const errorMsg = errorData.detail || errorData.message || `API error: ${response.statusText}`;
        toast.error("System Error", {
          description: errorMsg,
        });
      }
      
      // Throw error with the detail or message field for better error handling
      throw new Error(errorData.detail || errorData.message || `API error: ${response.statusText}`);
    }

    return response.json() as Promise<T>;
  } catch (error) {
    clearTimeout(timeoutId);
    
    // PHASE 3E: Handle timeout errors
    if (error instanceof DOMException && error.name === 'AbortError') {
      toast.error("Request Timeout", {
        description: "The server did not respond in time. Please try again.",
      });
      throw new Error("Request timed out");
    }
    
    if (error instanceof TypeError && error.message === "Failed to fetch") {
      toast.error("Connectivity Issue", {
        description: "Backend server is unreachable. Please check your connection.",
      });
    }
    throw error;
  }
}

export const apiClient = {
  get: <T>(endpoint: string, params?: Record<string, unknown>) => {
    let url = endpoint;
    if (params) {
      const searchParams = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          searchParams.append(key, String(value));
        }
      });
      const queryString = searchParams.toString();
      if (queryString) {
        url += (url.includes('?') ? '&' : '?') + queryString;
      }
    }
    return request<T>(url, { method: 'GET' });
  },
  post: <T>(endpoint: string, body?: unknown) => request<T>(endpoint, { method: 'POST', body: body ? JSON.stringify(body) : undefined }),
  put: <T>(endpoint: string, body: unknown) => request<T>(endpoint, { method: 'PUT', body: JSON.stringify(body) }),
  delete: <T>(endpoint: string) => request<T>(endpoint, { method: 'DELETE' }),
};


