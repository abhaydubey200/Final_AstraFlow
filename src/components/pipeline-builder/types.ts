import { Database, Cog, Upload, Filter, Merge, Table, FileCheck } from "lucide-react";

export type NodeType = "source" | "transform" | "validate" | "load" | "filter" | "join" | "aggregate";

export interface BuilderNode {
  id: string;
  type: NodeType;
  label: string;
  x: number;
  y: number;
  config: Record<string, unknown>;
  status?: "pending" | "running" | "success" | "failed";
}

export interface BuilderEdge {
  from: string;
  to: string;
}

export const NODE_CONFIG: Record<NodeType, { icon: typeof Database; color: string; bg: string; label: string }> = {
  source:    { icon: Database,  color: "text-primary",  bg: "bg-primary/15",  label: "Source" },
  transform: { icon: Cog,       color: "text-warning",  bg: "bg-warning/15",  label: "Transform" },
  filter:    { icon: Filter,    color: "text-accent",   bg: "bg-accent/15",   label: "Filter" },
  join:      { icon: Merge,     color: "text-warning",  bg: "bg-warning/15",  label: "Join" },
  aggregate: { icon: Table,     color: "text-warning",  bg: "bg-warning/15",  label: "Aggregate" },
  validate:  { icon: FileCheck, color: "text-success",  bg: "bg-success/15",  label: "Validate" },
  load:      { icon: Upload,    color: "text-primary",  bg: "bg-primary/15",  label: "Load" },
};

export const NODE_WIDTH = 140;
export const NODE_HEIGHT = 52;
export const PORT_RADIUS = 6;
export const GRID_SIZE = 20;

export function snapToGrid(val: number): number {
  return Math.round(val / GRID_SIZE) * GRID_SIZE;
}
