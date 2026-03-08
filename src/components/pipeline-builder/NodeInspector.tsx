import { cn } from "@/lib/utils";
import { BuilderNode, BuilderEdge, NODE_CONFIG } from "./types";
import { Trash2, X } from "lucide-react";

interface Props {
  node: BuilderNode;
  edges: BuilderEdge[];
  nodes: BuilderNode[];
  onUpdate: (id: string, updates: Partial<BuilderNode>) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

export default function NodeInspector({ node, edges, nodes, onUpdate, onDelete, onClose }: Props) {
  const cfg = NODE_CONFIG[node.type];
  const Icon = cfg.icon;
  const inCount = edges.filter((e) => e.to === node.id).length;
  const outCount = edges.filter((e) => e.from === node.id).length;
  const inEdges = edges.filter((e) => e.to === node.id);

  return (
    <div className="w-64 border-l border-border bg-card p-3 space-y-3 overflow-y-auto animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={cn("w-6 h-6 rounded flex items-center justify-center", cfg.bg)}>
            <Icon className={cn("w-3 h-3", cfg.color)} />
          </div>
          <span className="text-xs font-semibold text-foreground capitalize">{node.type}</span>
        </div>
        <div className="flex gap-0.5">
          <button onClick={() => onDelete(node.id)} className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
            <Trash2 className="w-3 h-3" />
          </button>
          <button onClick={onClose} className="p-1 rounded hover:bg-muted text-muted-foreground transition-colors">
            <X className="w-3 h-3" />
          </button>
        </div>
      </div>

      <div>
        <label className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">Label</label>
        <input
          type="text"
          value={node.label}
          onChange={(e) => onUpdate(node.id, { label: e.target.value })}
          className="w-full px-2.5 py-1.5 rounded-md border border-input bg-background text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        />
      </div>

      <div className="pt-2 border-t border-border">
        <div className="flex gap-3 text-[11px] text-muted-foreground">
          <span>{inCount} in</span>
          <span>{outCount} out</span>
        </div>
        {inEdges.length > 0 && (
          <div className="mt-1.5 space-y-0.5">
            {inEdges.map((e) => {
              const from = nodes.find((n) => n.id === e.from);
              return from ? (
                <div key={e.from} className="text-[10px] text-muted-foreground">
                  ← {from.label}
                </div>
              ) : null;
            })}
          </div>
        )}
      </div>
    </div>
  );
}
