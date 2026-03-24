export type PipelineStatus = "active" | "inactive" | "draft" | "error";

export type RunStatus = "success" | "failed" | "running" | "pending" | "cancelled";

export type NodeType = "source" | "transform" | "filter" | "join" | "aggregate" | "validate" | "load";

export type ExtractionMode = "full_load" | "incremental";

export type ScheduleType = "manual" | "hourly" | "daily" | "cron";

export interface Pipeline {
  id: string;
  name: string;
  description: string | null;
  status: PipelineStatus;
  schedule_type: ScheduleType;
  schedule_config: Record<string, unknown> | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  last_run_at: string | null;
  next_run_at: string | null;
  execution_mode?: string;
}

export interface PipelineNode {
  id: string;
  pipeline_id: string;
  node_type: NodeType;
  label: string;
  config_json: Record<string, unknown>;
  position_x: number;
  position_y: number;
  order_index: number;
}

export interface PipelineEdge {
  id: string;
  pipeline_id: string;
  source_node_id: string;
  target_node_id: string;
}

export interface PipelineWithNodes extends Pipeline {
  pipeline_nodes: PipelineNode[];
  pipeline_edges: PipelineEdge[];
}

export type LogLevel = "INFO" | "WARN" | "ERROR" | "DEBUG";

export interface PipelineRun {
  id: string;
  pipeline_id: string;
  status: "success" | "failed" | "running" | "pending" | "cancelled";
  environment: string;
  start_time: string;
  finished_at: string | null;
  end_time: string | null; // Frontend alias
  rows_processed: number;
  last_successful_stage: string | null;
  error_message: string | null;
  metadata?: Record<string, unknown>;
}

export interface ExecutionLog {
  id: string;
  run_id: string;
  stage: string;
  log_level: LogLevel;
  message: string;
  timestamp: string;
}

export interface PipelineTaskRun {
  id: string;
  pipeline_run_id: string;
  node_id: string;
  stage: string;
  status: "success" | "failed" | "running" | "pending" | "retrying";
  start_time: string | null;
  end_time: string | null;
  retry_count: number;
  error_message: string | null;
  duration?: string;
}

export interface RunWithLogs extends PipelineRun {
  execution_logs: ExecutionLog[];
}

export interface AuditLog {
  id: string;
  entity_type: string;
  entity_id: string;
  action: string;
  performed_by: string;
  timestamp: string;
  metadata_json: Record<string, unknown>;
}
