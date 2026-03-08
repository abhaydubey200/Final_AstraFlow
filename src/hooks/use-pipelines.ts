import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabaseUntyped as supabase } from "@/integrations/supabase/untyped-client";
import type { Pipeline, PipelineNode, PipelineEdge, PipelineWithNodes } from "@/types/pipeline";

const PIPELINES_KEY = ["pipelines"];

export function usePipelines() {
  return useQuery<Pipeline[]>({
    queryKey: PIPELINES_KEY,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pipelines")
        .select("*")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return (data as Pipeline[]) ?? [];
    },
  });
}

export function usePipeline(id: string | undefined) {
  return useQuery<PipelineWithNodes>({
    queryKey: ["pipelines", id],
    enabled: !!id,
    queryFn: async () => {
      const { data: pipeline, error: pErr } = await supabase
        .from("pipelines")
        .select("*")
        .eq("id", id!)
        .single();
      if (pErr) throw pErr;

      const { data: nodes, error: nErr } = await supabase
        .from("pipeline_nodes")
        .select("*")
        .eq("pipeline_id", id!)
        .order("order_index");
      if (nErr) throw nErr;

      const { data: edges, error: eErr } = await supabase
        .from("pipeline_edges")
        .select("*")
        .eq("pipeline_id", id!);
      if (eErr) throw eErr;

      return {
        ...(pipeline as Pipeline),
        pipeline_nodes: (nodes as PipelineNode[]) ?? [],
        pipeline_edges: (edges as PipelineEdge[]) ?? [],
      };
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
      const { data: pipeline, error: pErr } = await supabase
        .from("pipelines")
        .insert(payload.pipeline)
        .select()
        .single();
      if (pErr) throw pErr;

      const pipelineId = (pipeline as Pipeline).id;

      if (payload.nodes.length > 0) {
        const nodesWithPipeline = payload.nodes.map((n) => ({
          ...n,
          pipeline_id: pipelineId,
        }));
        const { error: nErr } = await supabase
          .from("pipeline_nodes")
          .insert(nodesWithPipeline);
        if (nErr) throw nErr;
      }

      if (payload.edges.length > 0) {
        const edgesWithPipeline = payload.edges.map((e) => ({
          ...e,
          pipeline_id: pipelineId,
        }));
        const { error: eErr } = await supabase
          .from("pipeline_edges")
          .insert(edgesWithPipeline);
        if (eErr) throw eErr;
      }

      return pipeline as Pipeline;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: PIPELINES_KEY }),
  });
}

export function useUpdatePipeline() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      ...updates
    }: Partial<Pipeline> & { id: string }) => {
      const { data, error } = await supabase
        .from("pipelines")
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data as Pipeline;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: PIPELINES_KEY }),
  });
}

export function useDeletePipeline() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("pipelines").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: PIPELINES_KEY }),
  });
}
