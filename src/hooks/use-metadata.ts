import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";

export interface MetadataTable {
  schema: string;
  table: string;
  columns: Array<{ name: string; type: string }>;
}

export function useConnectionMetadata(connectionId: string | undefined) {
  return useQuery<MetadataTable[]>({
    queryKey: ["metadata", connectionId],
    enabled: !!connectionId,
    queryFn: async () => {
      return apiClient.get<MetadataTable[]>(`/metadata/${connectionId}`);
    },
  });
}

export interface SearchMetadataResult {
  id: string;
  name: string;
  type: "table" | "view" | "column";
  connection_id: string;
}

export interface PipelineNode {
  id: string;
  pipeline_id: string;
  node_type: string;
  name: string;
  config_json: Record<string, unknown>;
}

export interface SchemaDriftEvent {
  id: string;
  pipeline_id: string;
  dataset_id: string;
  detected_at: string;
  change_type: string;
  details: Record<string, unknown>;
  resolution?: string;
  resolved_at?: string;
}

export interface SchemaVersion {
  id: string;
  dataset_id: string;
  version_number: number;
  schema_json: Record<string, unknown>;
  checksum: string;
  created_at: string;
}

export function useSearchMetadata(query: string) {
  return useQuery<SearchMetadataResult[]>({
    queryKey: ["metadata-search", query],
    enabled: query.length > 2,
    queryFn: async () => {
      return apiClient.get<SearchMetadataResult[]>(`/metadata/search?q=${encodeURIComponent(query)}`);
    },
  });
}

export function usePipelineNodes() {
  return useQuery<PipelineNode[]>({
    queryKey: ["all_pipeline_nodes"],
    queryFn: async () => {
      return apiClient.get<PipelineNode[]>("/pipelines/nodes");
    },
  });
}

export function useSchemaDrift(pipelineId?: string, datasetId?: string) {
  return useQuery<SchemaDriftEvent[]>({
    queryKey: ["schema_drift", pipelineId, datasetId],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (pipelineId) params.pipeline_id = pipelineId;
      if (datasetId) params.dataset_id = datasetId;
      return apiClient.get<SchemaDriftEvent[]>("/monitoring/schema-drift", params);
    },
  });
}

export function useSchemaVersions(datasetId: string | undefined) {
  return useQuery<SchemaVersion[]>({
    queryKey: ["schema_versions", datasetId],
    enabled: !!datasetId,
    queryFn: async () => {
      return apiClient.get<SchemaVersion[]>(`/monitoring/datasets/${datasetId}/versions`);
    },
  });
}

export function useResolveDrift() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ driftId, resolution }: { driftId: string; resolution: string }) => {
      return apiClient.post(`/monitoring/schema-drift/${driftId}/resolve?resolution=${encodeURIComponent(resolution)}`, {});
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["schema_drift"] });
    },
  });
}
