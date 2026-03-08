import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabaseUntyped as supabase } from "@/integrations/supabase/untyped-client";
import type { Connection, ConnectionFormData } from "@/types/connection";

const CONNECTIONS_KEY = ["connections"];

export function useConnections() {
  return useQuery<Connection[]>({
    queryKey: CONNECTIONS_KEY,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("connections")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data as Connection[]) ?? [];
    },
  });
}

export function useConnection(id: string | undefined) {
  return useQuery<Connection>({
    queryKey: ["connections", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("connections")
        .select("*")
        .eq("id", id!)
        .single();
      if (error) throw error;
      return data as Connection;
    },
  });
}

export function useCreateConnection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (form: ConnectionFormData) => {
      const { data, error } = await supabase
        .from("connections")
        .insert({
          name: form.name,
          type: form.type,
          host: form.host,
          port: form.port,
          database_name: form.database_name,
          username: form.username,
          ssl_enabled: form.ssl_enabled,
          status: "disconnected",
        })
        .select()
        .single();
      if (error) throw error;
      return data as Connection;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: CONNECTIONS_KEY }),
  });
}

export function useUpdateConnection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...form }: Partial<ConnectionFormData> & { id: string }) => {
      const { data, error } = await supabase
        .from("connections")
        .update({ ...form, updated_at: new Date().toISOString() })
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data as Connection;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: CONNECTIONS_KEY }),
  });
}

export function useDeleteConnection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("connections").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: CONNECTIONS_KEY }),
  });
}

// --- New backend-powered hooks ---

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
}

export function useTestConnection() {
  const qc = useQueryClient();
  return useMutation<TestConnectionResult, Error, TestConnectionParams>({
    mutationFn: async (params) => {
      const { data, error } = await supabase.functions.invoke("connection-test", {
        body: params,
      });
      if (error) throw error;
      return data as TestConnectionResult;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: CONNECTIONS_KEY }),
  });
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

export function useSchemaDiscovery() {
  return useMutation<SchemaDiscoveryResult, Error, { connection_id: string; password: string }>({
    mutationFn: async (params) => {
      const { data, error } = await supabase.functions.invoke("schema-discovery", {
        body: params,
      });
      if (error) throw error;
      return data as SchemaDiscoveryResult;
    },
  });
}

export interface ValidationResult {
  valid: boolean;
  errors: { node_id?: string; field: string; message: string; severity: "error" | "warning" }[];
  warnings: { node_id?: string; field: string; message: string; severity: "error" | "warning" }[];
  dag: { stages: string[]; node_count: number; edge_count: number } | null;
}

export function useValidatePipeline() {
  return useMutation<ValidationResult, Error, string>({
    mutationFn: async (pipelineId) => {
      const { data, error } = await supabase.functions.invoke("pipeline-validate", {
        body: { pipeline_id: pipelineId },
      });
      if (error) throw error;
      return data as ValidationResult;
    },
  });
}
