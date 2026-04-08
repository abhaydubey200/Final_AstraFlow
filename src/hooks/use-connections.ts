import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Connection, ConnectionFormData, ConnectionCapabilities } from "@/types/connection";
import { apiClient } from "@/lib/api-client";


const CONNECTIONS_KEY = ["connections"];

export function useConnections() {
  return useQuery<Connection[]>({
    queryKey: CONNECTIONS_KEY,
    queryFn: async () => {
      const response = await apiClient.get<{success: boolean; data: Connection[]; total: number}>("/connections");
      // PHASE 3D: Handle new standard API response format
      return response.success ? response.data : [];
    },
    staleTime: 30_000,   // 30s fresh
    gcTime: 60_000,      // PHASE 3D: 60s cache lifetime
    refetchOnWindowFocus: false, // PHASE 3D: Avoid redundant API calls
    retry: 2,
  });
}

export function useConnection(id: string | undefined) {
  return useQuery<Connection>({
    queryKey: ["connections", id],
    enabled: !!id,
    queryFn: async () => {
      const response = await apiClient.get<{success: boolean; data: Connection}>(`/connections/${id}`);
      // PHASE 3D: Handle new standard API response format
      if (!response.success) throw new Error("Failed to fetch connection");
      return response.data;
    },
    staleTime: 30_000,
    gcTime: 60_000, // PHASE 3D: 60s cache lifetime
    retry: 2,
  });
}




export interface TestConnectionParams {

  connection_id?: string;
  type?: string;
  host?: string;
  port?: number;
  database_name?: string;
  username?: string;
  password?: string;
  ssl_enabled?: boolean;
  timeout_seconds?: number;
}

export interface TestConnectionResult {
  success: boolean;
  latency_ms: number;
  server_version?: string;
  error?: string;
  tables_count?: number;
  diagnostics?: Record<string, string | number>;
}

export interface SchemaTable {
  table_name: string;
  schema_name: string;
  row_count_estimate: number;
  columns: {
    name: string;
    data_type: string;
    is_nullable: boolean;
    is_primary_key: boolean;
    default_value: string | null;
  }[];
}

export interface SchemaDiscoveryResult {
  tables: SchemaTable[];
  supported: boolean;
  count?: number;
  message?: string;
}

export interface ResourceDiscoveryParams {
  type: string;
  host: string;
  port: number;
  username: string;
  password?: string;
  database_name?: string;
  schema_name?: string;
  warehouse_name?: string;
  target: "warehouses" | "databases" | "schemas" | "tables";
  ssl_enabled: boolean;
}

export interface ValidationResult {
  valid: boolean;
  errors: { node_id?: string; field: string; message: string; severity: "error" | "warning" }[];
  warnings: { node_id?: string; field: string; message: string; severity: "error" | "warning" }[];
  dag: { stages: string[]; node_count: number; edge_count: number } | null;
}



export function useCreateConnection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (form: ConnectionFormData) => {
      const response = await apiClient.post<{success: boolean; data: Connection; message?: string}>("/connections", form);
      // PHASE 3D: Handle new standard API response format
      if (!response.success) throw new Error("Failed to create connection");
      return response.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: CONNECTIONS_KEY }),
  });
}

export function useUpdateConnection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: { id: string } & Partial<ConnectionFormData>) => {
      const { id, ...payload } = data;
      const response = await apiClient.put<{success: boolean; data: Connection}>(`/connections/${id}`, payload);
      // PHASE 3D: Handle new standard API response format
      if (!response.success) throw new Error("Failed to update connection");
      return response.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: CONNECTIONS_KEY }),
  });
}

export function useDeleteConnection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const response = await apiClient.delete<{success: boolean; message?: string}>(`/connections/${id}`);
      // PHASE 3D: Handle new standard API response format
      if (!response.success) throw new Error("Failed to delete connection");
      return response;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: CONNECTIONS_KEY }),
  });
}

export function useTestConnection() {
  const qc = useQueryClient();
  return useMutation<TestConnectionResult, Error, TestConnectionParams>({
    mutationFn: async (params) => {
      // PHASE 3D: Add 8s client-side timeout with AbortController
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 8000);
      
      try {
        const response = await apiClient.post<TestConnectionResult>("/connections/test", params);
        clearTimeout(timer);
        return response;
      } catch (error) {
        clearTimeout(timer);
        throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: CONNECTIONS_KEY }),
  });
}

export function useSchemaDiscovery() {
  const qc = useQueryClient();
  return useMutation<SchemaDiscoveryResult, Error, { connection_id: string; password?: string; force_refresh?: boolean }>({
    mutationFn: async (params) => {
      const response = await apiClient.post<{ success: boolean; data: SchemaDiscoveryResult } | SchemaDiscoveryResult>("/connections/discover", params);
      // Handle both wrapped {success, data} and legacy direct response
      if (response && typeof response === 'object' && 'success' in response && 'data' in response) {
        return (response as { success: boolean; data: SchemaDiscoveryResult }).data;
      }
      return response as SchemaDiscoveryResult;
    },
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: ["connections", variables.connection_id] });
    },
  });
}

export interface ConnectorTypeSchema {
  schema: Record<string, unknown>;
  capabilities: ConnectionCapabilities;
}

export function useResourceDiscovery() {
  return useMutation<{ results: (string | Record<string, unknown>)[] }, Error, ResourceDiscoveryParams>({
    mutationFn: async (params) => {
      const response = await apiClient.post<{ success: boolean; data: { results: (string | Record<string, unknown>)[] } } | { results: (string | Record<string, unknown>)[] }>("/connections/discover", params);
      // Handle both wrapped {success, data} and legacy direct response
      if (response && typeof response === 'object' && 'success' in response && 'data' in response) {
        return (response as { success: boolean; data: { results: (string | Record<string, unknown>)[] } }).data;
      }
      return response as { results: (string | Record<string, unknown>)[] };
    },
  });
}

export function usePreviewData() {
  return useMutation<{ data: Record<string, unknown>[]; columns: string[] }, Error, { type: string; table_name: string; schema_name?: string; [key: string]: unknown }>({
    mutationFn: async (params) => {
      const response = await apiClient.post<{ success: boolean; data: { data: Record<string, unknown>[]; columns: string[] } } | { data: Record<string, unknown>[]; columns: string[] }>("/connections/preview-data", params as Record<string, unknown>);
      // Handle both wrapped {success, data} and legacy direct response
      if (response && typeof response === 'object' && 'success' in response && 'data' in response) {
        return (response as { success: boolean; data: { data: Record<string, unknown>[]; columns: string[] } }).data;
      }
      return response as { data: Record<string, unknown>[]; columns: string[] };
    },
  });
}

export function useConnectorTypes() {
  return useQuery<Record<string, ConnectorTypeSchema>>({
    queryKey: ["connector_types"],
    queryFn: async () => {
      const response = await apiClient.get<{ success: boolean; data: Record<string, ConnectorTypeSchema> } | Record<string, ConnectorTypeSchema>>("/connections/types");
      // Handle both wrapped {success, data} and legacy direct response
      if (response && typeof response === 'object' && 'success' in response && 'data' in response) {
        return (response as { success: boolean; data: Record<string, ConnectorTypeSchema> }).data;
      }
      return response as Record<string, ConnectorTypeSchema>;
    },
    staleTime: 5 * 60_000, // 5 minutes — connector types rarely change
    gcTime: 10 * 60_000,
  });
}

export function useValidatePipeline() {
  return useMutation<ValidationResult, Error, string>({
    mutationFn: async (pipelineId) => {
      return apiClient.post<ValidationResult>(`/pipelines/${pipelineId}/validate`);
    },
  });
}

