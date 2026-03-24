import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";

import type { PipelineRun, ExecutionLog, LogLevel, RunStatus } from "@/types/pipeline";

const RUNS_KEY = ["pipeline_runs"];


export interface RunFilters {
  pipelineId?: string;
  status?: RunStatus;
  from?: string;
  to?: string;
}

export function usePipelineRuns(filters?: RunFilters) {
  return useQuery<PipelineRun[]>({
    queryKey: [RUNS_KEY, filters],
    queryFn: async () => {
      const queryFilters: Record<string, string> = {};
      if (filters?.pipelineId) queryFilters.pipeline_id = filters.pipelineId;
      if (filters?.status) queryFilters.status = filters.status;
      if (filters?.from) queryFilters.from = filters.from;
      if (filters?.to) queryFilters.to = filters.to;

      return apiClient.get<PipelineRun[]>("/pipelines/runs", queryFilters);
    },
    refetchInterval: (query) => {
      const data = query.state.data;
      if (data && data.some((r) => r.status === "running")) return 3000;
      return false;
    },
  });
}

export function usePipelineRun(runId: string | undefined) {
  return useQuery<PipelineRun>({
    queryKey: ["pipeline_runs", runId],
    enabled: !!runId,
    queryFn: async () => {
      return apiClient.get<PipelineRun>(`/pipelines/runs/${runId}`);
    },
  });
}


export interface WorkerJob {
  id: string;
  pipeline_id: string;
  run_id: string;
  stage: string;
  status: "pending" | "processing" | "completed" | "failed";
  progress?: number;
  error?: string;
  started_at?: string;
  finished_at?: string;
}

export function useWorkerJobs(runId?: string) {
  return useQuery<WorkerJob[]>({
    queryKey: ["worker_jobs", runId],
    enabled: !!runId,
    queryFn: async () => {
      return apiClient.get<WorkerJob[]>(`/pipelines/runs/${runId}/worker-jobs`);
    },
    refetchInterval: (query) => {
      const data = query.state.data;
      if (data && data.some((r) => r.status === "pending" || r.status === "processing")) return 2000;
      return false;
    },
  });
}

export interface RunTask {
  id: string;
  run_id: string;
  node_id: string;
  name: string;
  status: RunStatus | "pending";
  duration_ms?: number;
  rows_processed?: number;
  error?: string;
}

export function useRunTasks(runId?: string) {
  return useQuery<RunTask[]>({
    queryKey: ["run_tasks", runId],
    enabled: !!runId,
    queryFn: async () => {
      return apiClient.get<RunTask[]>(`/pipelines/runs/${runId}/tasks`);
    },
    refetchInterval: (query) => {
      const data = query.state.data;
      if (!data) return 2000;
      if (data.some((t) => t.status === "pending" || t.status === "running")) return 2000;
      return false;
    },
  });
}

export interface LogFilters {
  runId?: string;
  stage?: string;
  logLevel?: LogLevel;
  search?: string;
}

export function useExecutionLogs(filters: LogFilters) {
  return useQuery<ExecutionLog[]>({
    queryKey: ["execution_logs", filters],
    enabled: !!filters.runId,
    queryFn: async () => {
      const queryFilters: Record<string, any> = {};
      if (filters.stage) queryFilters.stage = filters.stage;
      if (filters.logLevel) queryFilters.log_level = filters.logLevel;
      if (filters.search) queryFilters.search = filters.search;

      return apiClient.get<ExecutionLog[]>(`/pipelines/runs/${filters.runId}/logs`, queryFilters);
    },
    refetchInterval: 3000
  });
}



export function useTriggerRun() {

  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ pipelineId }: { pipelineId: string; userId?: string }) => {
      // In the new backend, we trigger via the pipeline run endpoint
      // We might need to pass source/destination if they are not stored, but for now 
      // let's assume the backend retrieves them by DB lookup.
      return apiClient.post<{ run_id: string; status: string; rows_processed: number }>(`/pipelines/${pipelineId}/run`, {});
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: RUNS_KEY });
      qc.invalidateQueries({ queryKey: ["notifications"] });
      qc.invalidateQueries({ queryKey: ["pipelines"] });
    },
  });
}


export interface SystemMetric {
  totalRows: number;
  rowsPerSec: number;
  queuePending: number;
  alertDelivered: number;
  successRate: number;
}

export function useSystemMetrics(metricName?: string) {
  return useQuery<SystemMetric>({
    queryKey: ["system_metrics", metricName],
    queryFn: async () => {
      const queryFilters: Record<string, string> = {};
      if (metricName) queryFilters.metric_name = metricName;
      return apiClient.get<SystemMetric>("/monitoring/metrics", queryFilters);
    },
    refetchInterval: 5000
  });
}

export interface WorkerHeartbeat {
  id: string;
  status: string;
  last_heartbeat: string;
  tasks: number;
  cpu: number;
  ram: number;
}

export function useWorkerStatus() {
  return useQuery<WorkerHeartbeat[]>({
    queryKey: ["worker_status"],
    queryFn: async () => {
      return apiClient.get<WorkerHeartbeat[]>("/monitoring/worker-status");
    },
    refetchInterval: 5000,
  });
}

export function useQueueMetrics() {
  return useQuery<{ pending: number, processing: number, failed: number, completed: number }>({
    queryKey: ["queue_metrics"],
    queryFn: async () => {
      return apiClient.get<{ pending: number, processing: number, failed: number, completed: number }>("/monitoring/queue-metrics");
    },
    refetchInterval: 5000,
  });
}

