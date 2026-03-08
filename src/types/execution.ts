export type RunStatus = "running" | "success" | "failed" | "pending" | "cancelled";

export type LogLevel = "INFO" | "WARN" | "ERROR" | "DEBUG";

export type ExecutionStage = "extract" | "transform" | "load";

export interface PipelineRun {
  id: string;
  pipeline_id: string;
  status: RunStatus;
  start_time: string;
  end_time: string | null;
  rows_processed: number;
  error_message: string | null;
  triggered_by: string | null;
  created_at: string;
}

export interface ExecutionLog {
  id: string;
  run_id: string;
  stage: ExecutionStage;
  log_level: LogLevel;
  message: string;
  timestamp: string;
}

export interface PipelineCheckpoint {
  id: string;
  pipeline_id: string;
  source_table: string;
  last_processed_value: string;
  updated_at: string;
}

export interface RunWithLogs extends PipelineRun {
  execution_logs: ExecutionLog[];
}
