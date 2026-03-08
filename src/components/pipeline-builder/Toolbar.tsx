import { cn } from "@/lib/utils";
import { NODE_CONFIG, NodeType } from "./types";
import { ZoomIn, ZoomOut, Maximize2 } from "lucide-react";

interface Props {
  onAddNode: (type: NodeType) => void;
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetZoom: () => void;
}

const ITEMS: NodeType[] = ["source", "transform", "filter", "join", "aggregate", "validate", "load"];

export default function Toolbar({ onAddNode, zoom, onZoomIn, onZoomOut, onResetZoom }: Props) {
  return (
    <div className="flex items-center gap-1 px-2 py-1.5 border-b border-border bg-card overflow-x-auto">
      {/* Node buttons */}
      <div className="flex items-center gap-0.5 flex-1 min-w-0">
        {ITEMS.map((type) => {
          const cfg = NODE_CONFIG[type];
          const Icon = cfg.icon;
          return (
            <button
              key={type}
              onClick={() => onAddNode(type)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors whitespace-nowrap shrink-0"
              title={`Add ${cfg.label}`}
            >
              <Icon className={cn("w-3.5 h-3.5", cfg.color)} />
              <span className="hidden sm:inline">{cfg.label}</span>
            </button>
          );
        })}
      </div>

      {/* Zoom controls */}
      <div className="flex items-center gap-0.5 border-l border-border pl-2 ml-1 shrink-0">
        <button onClick={onZoomOut} className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
          <ZoomOut className="w-3.5 h-3.5" />
        </button>
        <span className="text-[10px] text-muted-foreground w-9 text-center font-mono tabular-nums">
          {Math.round(zoom * 100)}%
        </span>
        <button onClick={onZoomIn} className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
          <ZoomIn className="w-3.5 h-3.5" />
        </button>
        <button onClick={onResetZoom} className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
          <Maximize2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
