import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";


import type { 
  Pipeline, 
  PipelineNode, 
  PipelineEdge, 
  PipelineWithNodes,
  AuditLog
} from "@/types/pipeline";
import type { CatalogDataset } from "@/pages/Catalog";


const PIPELINES_KEY = ["pipelines"];



export function usePipelines() {
  return useQuery<Pipeline[]>({
    queryKey: PIPELINES_KEY,
    queryFn: async () => {
      return apiClient.get<Pipeline[]>("/pipelines");
    },
  });
}

export function usePipeline(id: string | undefined) {
  return useQuery<PipelineWithNodes>({
    queryKey: ["pipelines", id],
    enabled: !!id,
    queryFn: async () => {
      return apiClient.get<PipelineWithNodes>(`/pipelines/${id}`);
    },
  });
}



export function useCreatePipeline() {

  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      pipeline: Omit<Pipeline, "id" | "created_at" | "updated_at">;
      nodes: Omit<PipelineNode, "id" | "pipeline_id">[];
      edges: Omit<PipelineEdge, "id" | "pipeline_id">[];
    }) => {
      // Create via backend to handle multi-table insert and audit logs
      return apiClient.post<Pipeline>("/pipelines", payload);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: PIPELINES_KEY }),
  });
}

export function useRunPipeline() {
  return useMutation({
    mutationFn: async ({ pipelineId, source, destination }: { pipelineId: string; source: Record<string, unknown>; destination: Record<string, unknown> }) => {
      return apiClient.post(`/pipelines/${pipelineId}/run`, { source, destination });
    },
  });
}

export function useUpdatePipeline() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      ...payload
    }: Partial<PipelineWithNodes> & { id: string }) => {
      return apiClient.put<Pipeline>(`/pipelines/${id}`, payload);
    },
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: PIPELINES_KEY });
      qc.invalidateQueries({ queryKey: ["pipelines", variables.id] });
      qc.invalidateQueries({ queryKey: ["pipeline_versions", variables.id] });
    },
  });
}

export function usePipelineVersions(pipelineId: string) {
  return useQuery({
    queryKey: ["pipeline_versions", pipelineId],
    enabled: !!pipelineId,
    queryFn: async () => {
      return apiClient.get<Array<{ id: string; version: number; created_at: string; config_json: Record<string, unknown> }>>(`/pipelines/${pipelineId}/versions`);
    },
  });
}

export function useAuditLogs(entityId?: string) {
  return useQuery({
    queryKey: ["audit_logs", entityId],
    queryFn: async () => {
      return apiClient.get<AuditLog[]>("/monitoring/audit-logs", { entityId });
    },
  });
}

export function useDeletePipeline() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      return apiClient.delete(`/pipelines/${id}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: PIPELINES_KEY }),
  });
}

export function useDuplicatePipeline() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      return apiClient.post<Pipeline>(`/pipelines/${id}/duplicate`, {});
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: PIPELINES_KEY }),
  });
}

export function useAllPipelineData() {
  return useQuery({
    queryKey: ["all_pipeline_data"],
    queryFn: async () => {
      return apiClient.get<Record<string, unknown>>("/pipelines/export");
    },
  });
}

export function useDatasets() {
  return useQuery({
    queryKey: ["datasets"],
    queryFn: async () => {
      return apiClient.get<CatalogDataset[]>("/metadata/datasets");
    },
  });
}

export function useEnterpriseLineage() {
  return useQuery({
    queryKey: ["enterprise_lineage"],
    queryFn: async () => {
      return apiClient.get<{
        pipelines: Array<{ id: string; name: string; status: string }>;
        datasets: Array<{ id: string; name: string; connection_id: string }>;
        dependencies: Array<{ upstream_dataset?: string; downstream_dataset?: string; pipeline_id: string }>;
      }>("/metadata/lineage");
    },
  });
}


