import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000';

async function request<T>(endpoint: string, options: RequestInit = {}) {
  const isDebug = import.meta.env.VITE_ASTRA_DEBUG_MODE === "true";
  let token = "";

  if (isDebug) {
    token = "mock-token";
  } else {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      token = session.access_token;
    }
  }
  
  const url = `${BACKEND_URL}${endpoint}`;
  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': token ? `Bearer ${token}` : '',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      
      if (errorData.healing) {
        toast.info("AstraFlow Resilience", {
          description: "A minor issue was detected. Self-healing is in progress...",
        });
      } else {
        toast.error("System Error", {
          description: errorData.message || `API error: ${response.statusText}`,
        });
      }
      
      throw new Error(errorData.message || `API error: ${response.statusText}`);
    }

    return response.json() as Promise<T>;
  } catch (error) {
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


