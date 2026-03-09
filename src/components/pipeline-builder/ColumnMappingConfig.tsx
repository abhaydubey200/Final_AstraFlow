import { useMemo, useEffect } from "react";
import { BuilderNode, BuilderEdge } from "./types";
import { ArrowRight, Zap } from "lucide-react";

interface Props {
  node: BuilderNode;
  nodes: BuilderNode[];
  edges: BuilderEdge[];
  onUpdate: (id: string, updates: Partial<BuilderNode>) => void;
}

interface Column {
  name: string;
  data_type: string;
  is_primary_key?: boolean;
}

export default function ColumnMappingConfig({ node, nodes, edges, onUpdate }: Props) {
  // Find source node connected to this load node
  const sourceNode = useMemo(() => {
    // Walk back through edges to find a source node
    const visited = new Set<string>();
    const queue = [node.id];
    while (queue.length > 0) {
      const current = queue.shift()!;
      if (visited.has(current)) continue;
      visited.add(current);
      const incoming = edges.filter((e) => e.to === current);
      for (const edge of incoming) {
        const upstream = nodes.find((n) => n.id === edge.from);
        if (upstream?.type === "source") return upstream;
        queue.push(edge.from);
      }
    }
    return null;
  }, [node.id, nodes, edges]);

  const sourceColumns: Column[] = useMemo(() => {
    if (!sourceNode?.config.source_columns) return [];
    try {
      return JSON.parse(sourceNode.config.source_columns);
    } catch {
      return [];
    }
  }, [sourceNode?.config.source_columns]);

  const targetColumns: Column[] = useMemo(() => {
    if (!node.config.target_columns) return [];
    try {
      return JSON.parse(node.config.target_columns);
    } catch {
      return [];
    }
  }, [node.config.target_columns]);

  // Parse existing mappings
  const mappings: Record<string, string> = useMemo(() => {
    try {
      return node.config.column_mappings ? JSON.parse(node.config.column_mappings) : {};
    } catch {
      return {};
    }
  }, [node.config.column_mappings]);

  const updateMapping = (sourceCol: string, targetCol: string) => {
    const newMappings = { ...mappings, [sourceCol]: targetCol };
    if (!targetCol) delete newMappings[sourceCol];
    onUpdate(node.id, {
      config: { ...node.config, column_mappings: JSON.stringify(newMappings) },
    });
  };

  const autoMap = () => {
    const newMappings: Record<string, string> = {};
    for (const sc of sourceColumns) {
      const match = targetColumns.find(
        (tc) => tc.name.toLowerCase() === sc.name.toLowerCase()
      );
      if (match) newMappings[sc.name] = match.name;
    }
    onUpdate(node.id, {
      config: { ...node.config, column_mappings: JSON.stringify(newMappings) },
    });
  };

  if (!sourceNode) {
    return (
      <div className="p-2 rounded-md bg-muted/50 border border-border">
        <p className="text-[10px] text-muted-foreground">Connect a Source node upstream to configure column mapping.</p>
      </div>
    );
  }

  if (sourceColumns.length === 0) {
    return (
      <div className="p-2 rounded-md bg-muted/50 border border-border">
        <p className="text-[10px] text-muted-foreground">Select a source table first to map columns.</p>
      </div>
    );
  }

  if (targetColumns.length === 0 && node.config.load_mode !== "auto") {
    return (
      <div className="p-2 rounded-md bg-muted/50 border border-border">
        <p className="text-[10px] text-muted-foreground">Select a target table first to map columns.</p>
      </div>
    );
  }

  // For auto-create mode, target columns = source columns
  const effectiveTargetCols = node.config.load_mode === "auto" ? sourceColumns : targetColumns;

  const mappedCount = Object.keys(mappings).filter((k) => mappings[k]).length;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-[10px] text-muted-foreground uppercase tracking-wider">
          Column Mapping ({mappedCount}/{sourceColumns.length})
        </label>
        <button
          onClick={autoMap}
          className="flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
        >
          <Zap className="w-2.5 h-2.5" /> Auto-map
        </button>
      </div>

      <div className="max-h-48 overflow-y-auto space-y-1">
        {sourceColumns.map((sc) => (
          <div key={sc.name} className="flex items-center gap-1">
            <div className="flex-1 min-w-0">
              <div className="px-1.5 py-1 rounded bg-muted/50 text-[9px] text-foreground truncate" title={sc.name}>
                {sc.name}
                <span className="text-muted-foreground/60 ml-1">{sc.data_type}</span>
              </div>
            </div>
            <ArrowRight className="w-2.5 h-2.5 text-muted-foreground shrink-0" />
            <div className="flex-1 min-w-0">
              <select
                value={mappings[sc.name] || ""}
                onChange={(e) => updateMapping(sc.name, e.target.value)}
                className="w-full px-1.5 py-1 rounded border border-input bg-background text-[9px] text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="">— skip —</option>
                {effectiveTargetCols.map((tc) => (
                  <option key={tc.name} value={tc.name}>
                    {tc.name} ({tc.data_type})
                  </option>
                ))}
              </select>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
