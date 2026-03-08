import { useState } from "react";
import { useNavigate } from "react-router-dom";
import StatusBadge from "@/components/StatusBadge";
import { cn } from "@/lib/utils";
import { Plus, Search, GitBranch, MoreHorizontal, Play, Copy, Trash2, Eye, Edit, Loader2 } from "lucide-react";
import PipelinesSkeleton from "@/components/PipelinesSkeleton";
import { usePipelines, useDeletePipeline } from "@/hooks/use-pipelines";
import { useTriggerRun } from "@/hooks/use-executions";
import { toast } from "@/hooks/use-toast";
import type { Pipeline } from "@/types/pipeline";

type StatusFilter = "all" | "active" | "inactive" | "draft" | "error";
type SortKey = "updated_at" | "name" | "created_at";

const statusToRunStatus = (status: string) => {
  switch (status) {
    case "active": return "success" as const;
    case "error": return "failed" as const;
    case "draft": return "pending" as const;
    default: return "pending" as const;
  }
};

const Pipelines = () => {
  const navigate = useNavigate();
  const { data: pipelines = [], isLoading } = usePipelines();
  const deleteMutation = useDeletePipeline();
  const triggerRun = useTriggerRun();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sortBy, setSortBy] = useState<SortKey>("updated_at");
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [showDelete, setShowDelete] = useState<string | null>(null);

  const filtered = pipelines
    .filter((p) => statusFilter === "all" || p.status === statusFilter)
    .filter((p) => p.name.toLowerCase().includes(search.toLowerCase()) || p.id.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      if (sortBy === "name") return a.name.localeCompare(b.name);
      if (sortBy === "created_at") return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
    });

  const handleDelete = async (id: string) => {
    try {
      await deleteMutation.mutateAsync(id);
      toast({ title: "Pipeline deleted" });
      setShowDelete(null);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const handleRunNow = async (id: string) => {
    try {
      await triggerRun.mutateAsync(id);
      toast({ title: "Pipeline run triggered" });
      setOpenMenu(null);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const formatDate = (d: string) => {
    const diff = Date.now() - new Date(d).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "Just now";
    if (mins < 60) return `${mins} min ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs} hr ago`;
    return `${Math.floor(hrs / 24)} days ago`;
  };

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">Pipelines</h1>
          <p className="text-sm text-muted-foreground mt-1">{pipelines.length} pipelines configured</p>
        </div>
        <button onClick={() => navigate("/pipelines/new")} className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors">
          <Plus className="w-4 h-4" /> New Pipeline
        </button>
      </div>

      <div className="flex gap-3 flex-wrap">
        <div className="flex-1 min-w-[200px] relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input type="text" placeholder="Search pipelines..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full pl-9 pr-4 py-2 rounded-md border border-border bg-card text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring" />
        </div>
        <div className="flex gap-1 rounded-md border border-border bg-card p-0.5">
          {(["all", "active", "draft", "error", "inactive"] as StatusFilter[]).map((s) => (
            <button key={s} onClick={() => setStatusFilter(s)} className={cn("px-3 py-1.5 rounded text-xs font-medium transition-colors capitalize", statusFilter === s ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground")}>
              {s}
            </button>
          ))}
        </div>
        <select value={sortBy} onChange={(e) => setSortBy(e.target.value as SortKey)} className="px-3 py-2 rounded-md border border-border bg-card text-xs text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring">
          <option value="updated_at">Sort: Last Updated</option>
          <option value="name">Sort: Name</option>
          <option value="created_at">Sort: Created</option>
        </select>
      </div>

      {isLoading ? (
        <PipelinesSkeleton />
      ) : filtered.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-16 flex flex-col items-center text-center">
          <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mb-4">
            <GitBranch className="w-6 h-6 text-primary" />
          </div>
          <h3 className="text-sm font-display font-semibold text-foreground">
            {search || statusFilter !== "all" ? "No matching pipelines" : "No pipelines created yet"}
          </h3>
          <p className="text-xs text-muted-foreground mt-1">
            {search || statusFilter !== "all" ? "Try adjusting your filters." : "Create your first pipeline to get started."}
          </p>
          {!search && statusFilter === "all" && (
            <button onClick={() => navigate("/pipelines/new")} className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-primary text-primary-foreground text-xs font-medium">
              <Plus className="w-3.5 h-3.5" /> Create Pipeline
            </button>
          )}
        </div>
      ) : (
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left text-xs font-medium text-muted-foreground px-5 py-3">Pipeline</th>
                  <th className="text-left text-xs font-medium text-muted-foreground px-5 py-3">Schedule</th>
                  <th className="text-left text-xs font-medium text-muted-foreground px-5 py-3">Status</th>
                  <th className="text-left text-xs font-medium text-muted-foreground px-5 py-3">Last Updated</th>
                  <th className="text-left text-xs font-medium text-muted-foreground px-5 py-3 w-10" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => (
                  <tr key={p.id} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors cursor-pointer group">
                    <td className="px-5 py-3" onClick={() => navigate(`/pipelines/${p.id}`)}>
                      <span className="text-sm font-medium text-foreground">{p.name}</span>
                      {p.description && <span className="text-xs text-muted-foreground ml-2">{p.description}</span>}
                    </td>
                    <td className="px-5 py-3 text-xs font-display text-muted-foreground capitalize" onClick={() => navigate(`/pipelines/${p.id}`)}>{p.schedule_type}</td>
                    <td className="px-5 py-3" onClick={() => navigate(`/pipelines/${p.id}`)}>
                      <StatusBadge status={statusToRunStatus(p.status)} />
                    </td>
                    <td className="px-5 py-3 text-xs text-muted-foreground" onClick={() => navigate(`/pipelines/${p.id}`)}>{formatDate(p.updated_at)}</td>
                    <td className="px-5 py-3 relative">
                      <button onClick={(e) => { e.stopPropagation(); setOpenMenu(openMenu === p.id ? null : p.id); }} className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors opacity-0 group-hover:opacity-100">
                        <MoreHorizontal className="w-4 h-4" />
                      </button>
                      {openMenu === p.id && (
                        <div className="absolute right-5 top-10 z-20 w-40 rounded-md border border-border bg-popover shadow-lg py-1">
                          <button onClick={() => { navigate(`/pipelines/${p.id}`); setOpenMenu(null); }} className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-foreground hover:bg-muted transition-colors">
                            <Eye className="w-3.5 h-3.5" /> View Details
                          </button>
                          <button onClick={() => handleRunNow(p.id)} className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-foreground hover:bg-muted transition-colors">
                            <Play className="w-3.5 h-3.5" /> Run Now
                          </button>
                          <button onClick={() => { navigate(`/pipelines/${p.id}/edit`); setOpenMenu(null); }} className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-foreground hover:bg-muted transition-colors">
                            <Edit className="w-3.5 h-3.5" /> Edit
                          </button>
                          <div className="border-t border-border my-1" />
                          <button onClick={() => { setShowDelete(p.id); setOpenMenu(null); }} className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-destructive hover:bg-destructive/10 transition-colors">
                            <Trash2 className="w-3.5 h-3.5" /> Delete
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between px-5 py-3 border-t border-border">
            <span className="text-xs text-muted-foreground">Showing {filtered.length} of {pipelines.length} pipelines</span>
          </div>
        </div>
      )}

      {showDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-lg border border-border bg-card shadow-xl p-6 space-y-4">
            <h3 className="text-sm font-display font-semibold text-foreground">Delete Pipeline</h3>
            <p className="text-xs text-muted-foreground">
              This will permanently delete <span className="text-foreground font-medium">{pipelines.find((p) => p.id === showDelete)?.name}</span> and all its nodes and edges.
            </p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowDelete(null)} className="px-3 py-1.5 rounded-md border border-border text-xs text-muted-foreground hover:text-foreground transition-colors">Cancel</button>
              <button onClick={() => handleDelete(showDelete)} disabled={deleteMutation.isPending} className="px-3 py-1.5 rounded-md bg-destructive text-destructive-foreground text-xs font-medium hover:bg-destructive/90 transition-colors">
                {deleteMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <><Trash2 className="w-3 h-3 inline mr-1" /> Delete</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Pipelines;
