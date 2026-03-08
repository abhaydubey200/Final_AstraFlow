import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabaseUntyped as supabase } from "@/integrations/supabase/untyped-client";
import type { PipelineRun, ExecutionLog, RunStatus, LogLevel } from "@/types/execution";

const RUNS_KEY = ["pipeline_runs"];

export interface RunFilters {
  pipelineId?: string;
  status?: RunStatus;
  from?: string;
  to?: string;
}

export function usePipelineRuns(filters?: RunFilters) {
  return useQuery<PipelineRun[]>({
    queryKey: [...RUNS_KEY, filters],
    queryFn: async () => {
      let query = supabase
        .from("pipeline_runs")
        .select("*")
        .order("start_time", { ascending: false });

      if (filters?.pipelineId) {
        query = query.eq("pipeline_id", filters.pipelineId);
      }
      if (filters?.status) {
        query = query.eq("status", filters.status);
      }
      if (filters?.from) {
        query = query.gte("start_time", filters.from);
      }
      if (filters?.to) {
        query = query.lte("start_time", filters.to);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data as PipelineRun[]) ?? [];
    },
  });
}

export function usePipelineRun(runId: string | undefined) {
  return useQuery<PipelineRun>({
    queryKey: ["pipeline_runs", runId],
    enabled: !!runId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pipeline_runs")
        .select("*")
        .eq("id", runId!)
        .single();
      if (error) throw error;
      return data as PipelineRun;
    },
  });
}

export interface LogFilters {
  runId: string;
  stage?: string;
  logLevel?: LogLevel;
  search?: string;
}

export function useExecutionLogs(filters: LogFilters) {
  return useQuery<ExecutionLog[]>({
    queryKey: ["execution_logs", filters],
    enabled: !!filters.runId,
    queryFn: async () => {
      let query = supabase
        .from("execution_logs")
        .select("*")
        .eq("run_id", filters.runId)
        .order("timestamp", { ascending: true });

      if (filters.stage) {
        query = query.eq("stage", filters.stage);
      }
      if (filters.logLevel) {
        query = query.eq("log_level", filters.logLevel);
      }

      const { data, error } = await query;
      if (error) throw error;

      let logs = (data as ExecutionLog[]) ?? [];

      if (filters.search) {
        const term = filters.search.toLowerCase();
        logs = logs.filter((l) => l.message.toLowerCase().includes(term));
      }

      return logs;
    },
  });
}

export function useTriggerRun() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (pipelineId: string) => {
      const { data, error } = await supabase
        .from("pipeline_runs")
        .insert({
          pipeline_id: pipelineId,
          status: "running",
          start_time: new Date().toISOString(),
          rows_processed: 0,
          triggered_by: "manual",
        })
        .select()
        .single();
      if (error) throw error;
      return data as PipelineRun;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: RUNS_KEY }),
  });
}
