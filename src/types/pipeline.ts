export type PipelineStatus = "active" | "inactive" | "draft" | "error";

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
