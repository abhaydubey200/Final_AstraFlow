import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Connection, ConnectionFormData, ConnectionCapabilities } from "@/types/connection";
import { apiClient } from "@/lib/api-client";


const CONNECTIONS_KEY = ["connections"];

export function useConnections() {
  return useQuery<Connection[]>({
    queryKey: CONNECTIONS_KEY,
    queryFn: async () => {
      return apiClient.get<Connection[]>("/connections");
    },
  });
}

export function useConnection(id: string | undefined) {
  return useQuery<Connection>({
    queryKey: ["connections", id],
    enabled: !!id,
    queryFn: async () => {
      return apiClient.get<Connection>(`/connections/${id}`);
    },
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

// ... existing useConnections and useConnection (keep using Supabase for reading)

export function useCreateConnection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (form: ConnectionFormData) => {
      return apiClient.post<Connection>("/connections", form);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: CONNECTIONS_KEY }),
  });
}

export function useUpdateConnection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: { id: string } & Partial<ConnectionFormData>) => {
      const { id, ...payload } = data;
      return apiClient.put<Connection>(`/connections/${id}`, payload);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: CONNECTIONS_KEY }),
  });
}

export function useDeleteConnection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      return apiClient.delete(`/connections/${id}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: CONNECTIONS_KEY }),
  });
}

export function useTestConnection() {
  const qc = useQueryClient();
  return useMutation<TestConnectionResult, Error, TestConnectionParams>({
    mutationFn: async (params) => {
      return apiClient.post<TestConnectionResult>("/connections/test", params);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: CONNECTIONS_KEY }),
  });
}

export function useSchemaDiscovery() {
  const qc = useQueryClient();
  return useMutation<SchemaDiscoveryResult, Error, { connection_id: string; password?: string; force_refresh?: boolean }>({
    mutationFn: async (params) => {
      return apiClient.post<SchemaDiscoveryResult>("/connections/discover-schema", params);
    },
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: ["connections", variables.connection_id] });
    },
  });
}

export function useCapabilities() {
  return useMutation<ConnectionCapabilities, Error, { connection_id: string; type: string }>({
    mutationFn: async (params) => {
      return apiClient.post<ConnectionCapabilities>("/connections/capabilities", params);
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
      return apiClient.post<{ results: (string | Record<string, unknown>)[] }>("/connections/discover", params);
    },
  });
}

export function usePreviewData() {
  return useMutation<{ data: Record<string, unknown>[]; columns: string[] }, Error, { type: string; table_name: string; schema_name?: string; [key: string]: unknown }>({
    mutationFn: async (params) => {
      return apiClient.post<{ data: Record<string, unknown>[]; columns: string[] }>("/connections/preview-data", params as Record<string, unknown>);
    },
  });
}

export function useConnectorTypes() {
  return useQuery<Record<string, ConnectorTypeSchema>>({
    queryKey: ["connector_types"],
    queryFn: async () => {
      return apiClient.get<Record<string, ConnectorTypeSchema>>("/connections/types");
    },
  });
}

export function useValidatePipeline() {
  return useMutation<ValidationResult, Error, string>({
    mutationFn: async (pipelineId) => {
      return apiClient.post<ValidationResult>(`/pipelines/${pipelineId}/validate`);
    },
  });
}

