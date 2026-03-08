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
