import { useState } from "react";
import { BuilderNode } from "./types";
import { Code, Database, Braces, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  node: BuilderNode;
  onUpdate: (id: string, updates: Partial<BuilderNode>) => void;
}

export default function TransformNodeConfig({ node, onUpdate }: Props) {
  const [mode, setMode] = useState<"sql" | "js">((node.config.transform_mode as "sql" | "js") || "sql");

  const updateConfig = (updates: Record<string, unknown>) => {
    onUpdate(node.id, { config: { ...node.config, ...updates } });
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      <div>
        <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block mb-2">Engine Mode</label>
        <div className="flex gap-1 bg-muted/30 p-1 rounded-xl border border-border/50">
          <button
            onClick={() => { setMode("sql"); updateConfig({ transform_mode: "sql" }); }}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-[10px] font-bold transition-all",
              mode === "sql" ? "bg-background text-primary shadow-sm ring-1 ring-border/50" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Database className="w-3.5 h-3.5" /> SQL (ELT)
          </button>
          <button
            onClick={() => { setMode("js"); updateConfig({ transform_mode: "js" }); }}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-[10px] font-bold transition-all",
              mode === "js" ? "bg-background text-warning shadow-sm ring-1 ring-border/50" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Braces className="w-3.5 h-3.5" /> JS (ETL)
          </button>
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex items-center justify-between">
          Logic Implementation
          <Sparkles className="w-3 h-3 text-primary animate-pulse" />
        </label>
        <div className="relative group">
          <div className="absolute top-3 left-3 flex items-center gap-2 pointer-events-none opacity-40">
             <Code className="w-3.5 h-3.5" />
             <span className="text-[9px] font-mono font-black uppercase text-muted-foreground">{mode}</span>
          </div>
          <textarea
            value={(node.config.logic as string) || ""}
            onChange={(e) => updateConfig({ logic: e.target.value })}
            placeholder={mode === "sql" 
              ? "-- Use {{source}} to reference input\nSELECT * FROM {{source}} WHERE processed = false" 
              : "// item is the input record\nreturn { ...item, timestamp: Date.now() };"
            }
            rows={8}
            className="w-full pl-3 pr-3 pt-9 pb-3 rounded-xl border border-border/50 bg-muted/10 text-[11px] font-mono text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all resize-none shadow-inner"
          />
        </div>
        <p className="text-[9px] text-muted-foreground leading-relaxed italic">
          {mode === "sql" 
            ? "Executed directly on the destination database for maximum throughput." 
            : "Executed in a secure sandbox for complex mapping and custom formatting."
          }
        </p>
      </div>

      {/* Persistence Note */}
      <div className="p-3 rounded-xl bg-primary/5 border border-primary/10">
        <p className="text-[9px] font-medium text-primary flex items-center gap-2">
          <div className="w-1 h-1 rounded-full bg-primary animate-ping" />
          Auto-compiling transformation...
        </p>
      </div>
    </div>
  );
}
