import { useState } from "react";
import { usePipelines } from "@/hooks/use-pipelines";
import { useConnections } from "@/hooks/use-connections";
import { cn } from "@/lib/utils";
import { Database, GitBranch, Layers, Search, ChevronRight, Activity, Upload, FileCheck, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { supabaseUntyped as supabase } from "@/integrations/supabase/untyped-client";
import { useQuery } from "@tanstack/react-query";

const nodeIcons: Record<string, typeof Database> = {
  source: Database, extract: Database,
  transform: Activity,
  load: Upload,
  validate: FileCheck,
};

function usePipelineNodes() {
  return useQuery({
    queryKey: ["all_pipeline_nodes"],
    queryFn: async () => {
      const { data, error } = await supabase.from("pipeline_nodes").select("*").order("order_index", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Array<{ id: string; pipeline_id: string; node_type: string; label: string; config_json: Record<string, unknown>; order_index: number }>;
    },
  });
}

const Catalog = () => {
  const { data: pipelines = [], isLoading: loadingPipelines } = usePipelines();
  const { data: connections = [], isLoading: loadingConns } = useConnections();
  const { data: nodes = [], isLoading: loadingNodes } = usePipelineNodes();
  const [activeTab, setActiveTab] = useState<"pipelines" | "connections">("pipelines");
  const [search, setSearch] = useState("");
  const [expandedPipeline, setExpandedPipeline] = useState<string | null>(null);

  const isLoading = loadingPipelines || loadingConns || loadingNodes;

  const filteredPipelines = pipelines.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()));
  const filteredConns = connections.filter((c) => c.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold text-foreground">Data Catalog</h1>
        <p className="text-sm text-muted-foreground mt-1">Browse pipelines, nodes, and connection metadata</p>
      </div>

      {/* Tabs + search */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex gap-1 border-b border-border">
          {(["pipelines", "connections"] as const).map((tab) => (
            <button key={tab} onClick={() => setActiveTab(tab)} className={cn("px-4 py-2 text-xs font-medium transition-colors border-b-2 -mb-px capitalize", activeTab === tab ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground")}>
              {tab}
            </button>
          ))}
        </div>
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search..." className="pl-9 pr-3 py-1.5 rounded-md border border-border bg-background text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring w-56" />
        </div>
      </div>

      {isLoading && <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>}

      {/* Pipelines catalog */}
      {!isLoading && activeTab === "pipelines" && (
        <div className="space-y-2">
          {filteredPipelines.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No pipelines found.</p>
          ) : filteredPipelines.map((p) => {
            const pipelineNodes = nodes.filter((n) => n.pipeline_id === p.id).sort((a, b) => a.order_index - b.order_index);
            const expanded = expandedPipeline === p.id;
            return (
              <div key={p.id} className="rounded-lg border border-border bg-card overflow-hidden">
                <button onClick={() => setExpandedPipeline(expanded ? null : p.id)} className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-muted/20 transition-colors text-left">
                  {expanded ? <ChevronRight className="w-3.5 h-3.5 text-muted-foreground rotate-90 transition-transform" /> : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground transition-transform" />}
                  <GitBranch className="w-4 h-4 text-primary" />
                  <span className="text-sm font-medium text-foreground flex-1">{p.name}</span>
                  <span className="text-[10px] text-muted-foreground">{pipelineNodes.length} nodes</span>
                  <span className="text-[10px] text-muted-foreground capitalize px-2 py-0.5 rounded bg-muted">{p.status}</span>
                </button>
                {expanded && (
                  <div className="border-t border-border px-5 py-4 space-y-3 bg-muted/5">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                      <div><span className="text-muted-foreground text-[10px] uppercase font-semibold">Schedule</span><p className="text-foreground mt-0.5">{p.schedule_type}</p></div>
                      <div><span className="text-muted-foreground text-[10px] uppercase font-semibold">Created</span><p className="text-foreground mt-0.5">{format(new Date(p.created_at), "PP")}</p></div>
                      <div><span className="text-muted-foreground text-[10px] uppercase font-semibold">Updated</span><p className="text-foreground mt-0.5">{format(new Date(p.updated_at), "PP")}</p></div>
                      <div><span className="text-muted-foreground text-[10px] uppercase font-semibold">Description</span><p className="text-foreground mt-0.5">{p.description || "—"}</p></div>
                    </div>
                    {pipelineNodes.length > 0 && (
                      <div>
                        <span className="text-muted-foreground text-[10px] uppercase font-semibold">Pipeline Nodes</span>
                        <div className="flex items-center gap-3 mt-2 flex-wrap">
                          {pipelineNodes.map((n, i) => {
                            const Icon = nodeIcons[n.node_type] || Layers;
                            return (
                              <div key={n.id} className="flex items-center gap-3">
                                <div className="flex items-center gap-2 px-3 py-1.5 rounded-md border border-border bg-card">
                                  <Icon className="w-3.5 h-3.5 text-primary" />
                                  <span className="text-xs text-foreground">{n.label || n.node_type}</span>
                                </div>
                                {i < pipelineNodes.length - 1 && <div className="w-4 h-px bg-border" />}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Connections catalog */}
      {!isLoading && activeTab === "connections" && (
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          {filteredConns.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No connections found.</p>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left text-xs font-medium text-muted-foreground px-5 py-3">Name</th>
                  <th className="text-left text-xs font-medium text-muted-foreground px-5 py-3">Type</th>
                  <th className="text-left text-xs font-medium text-muted-foreground px-5 py-3">Host</th>
                  <th className="text-left text-xs font-medium text-muted-foreground px-5 py-3">Database</th>
                  <th className="text-left text-xs font-medium text-muted-foreground px-5 py-3">Status</th>
                  <th className="text-left text-xs font-medium text-muted-foreground px-5 py-3">SSL</th>
                </tr>
              </thead>
              <tbody>
                {filteredConns.map((c) => (
                  <tr key={c.id} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors">
                    <td className="px-5 py-3 text-xs font-medium text-foreground">{c.name}</td>
                    <td className="px-5 py-3 text-xs text-muted-foreground uppercase">{c.type}</td>
                    <td className="px-5 py-3 text-xs text-muted-foreground font-display">{c.host}:{c.port}</td>
                    <td className="px-5 py-3 text-xs text-muted-foreground">{c.database_name}</td>
                    <td className="px-5 py-3"><span className={cn("text-[10px] px-2 py-0.5 rounded font-medium", c.status === "connected" ? "bg-success/10 text-success" : "bg-muted text-muted-foreground")}>{c.status}</span></td>
                    <td className="px-5 py-3 text-xs text-muted-foreground">{c.ssl_enabled ? "Yes" : "No"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
};

export default Catalog;
