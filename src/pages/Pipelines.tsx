import { useState } from "react";
import { useNavigate } from "react-router-dom";
import StatusBadge from "@/components/StatusBadge";
import { cn } from "@/lib/utils";
import {
  Plus, Search, GitBranch, MoreHorizontal, Play, Copy, Trash2,
  Eye, Edit, Loader2, CheckSquare, Square, LayoutGrid, List,
} from "lucide-react";
import PipelinesSkeleton from "@/components/PipelinesSkeleton";
import { usePipelines, useDeletePipeline, useDuplicatePipeline } from "@/hooks/use-pipelines";
import { useTriggerRun } from "@/hooks/use-executions";
import { toast } from "@/hooks/use-toast";
import type { Pipeline } from "@/types/pipeline";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

type StatusFilter = "all" | "active" | "inactive" | "draft" | "error";
type SortKey = "updated_at" | "name" | "created_at";
type ViewMode = "table" | "grid";

const statusToRunStatus = (status: string) => {
  switch (status) {
    case "active": return "success" as const;
    case "error": return "failed" as const;
    case "draft": return "pending" as const;
    default: return "pending" as const;
  }
};

const formatDate = (d: string) => {
  const diff = Date.now() - new Date(d).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
};

const Pipelines = () => {
  const navigate = useNavigate();
  const { data: pipelines = [], isLoading } = usePipelines();
  const deleteMutation = useDeletePipeline();
  const duplicateMutation = useDuplicatePipeline();
  const triggerRun = useTriggerRun();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sortBy, setSortBy] = useState<SortKey>("updated_at");
  const [viewMode, setViewMode] = useState<ViewMode>("table");
  const [showDelete, setShowDelete] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const filtered = pipelines
    .filter((p) => statusFilter === "all" || p.status === statusFilter)
    .filter((p) => p.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      if (sortBy === "name") return a.name.localeCompare(b.name);
      if (sortBy === "created_at") return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
    });

  const allSelected = filtered.length > 0 && filtered.every((p) => selected.has(p.id));

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map((p) => p.id)));
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteMutation.mutateAsync(id);
      toast({ title: "Pipeline deleted" });
      setShowDelete(null);
      setSelected((prev) => { const n = new Set(prev); n.delete(id); return n; });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const handleBulkDelete = async () => {
    try {
      for (const id of selected) {
        await deleteMutation.mutateAsync(id);
      }
      toast({ title: `${selected.size} pipeline(s) deleted` });
      setSelected(new Set());
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const handleDuplicate = async (id: string) => {
    try {
      await duplicateMutation.mutateAsync(id);
      toast({ title: "Pipeline duplicated" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const handleRunNow = async (id: string) => {
    try {
      await triggerRun.mutateAsync({ pipelineId: id });
      toast({ title: "Pipeline execution started" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">Pipelines</h1>
          <p className="text-sm text-muted-foreground mt-1">{pipelines.length} pipelines configured</p>
        </div>
        <Button onClick={() => navigate("/pipelines/new")} className="gap-2 w-full sm:w-auto">
          <Plus className="w-4 h-4" /> New Pipeline
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1 min-w-0 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search pipelines..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-md border border-input bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring transition-colors"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          <div className="flex gap-0.5 rounded-md border border-input bg-background p-0.5">
            {(["all", "active", "draft", "error", "inactive"] as StatusFilter[]).map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={cn(
                  "px-3 py-1.5 rounded text-xs font-medium transition-colors capitalize",
                  statusFilter === s ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {s}
              </button>
            ))}
          </div>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortKey)}
            className="px-3 py-2 rounded-md border border-input bg-background text-xs text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          >
            <option value="updated_at">Last Updated</option>
            <option value="name">Name</option>
            <option value="created_at">Created</option>
          </select>
          <div className="flex gap-0.5 rounded-md border border-input bg-background p-0.5">
            <button onClick={() => setViewMode("table")} className={cn("p-1.5 rounded transition-colors", viewMode === "table" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}>
              <List className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => setViewMode("grid")} className={cn("p-1.5 rounded transition-colors", viewMode === "grid" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}>
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Bulk actions bar */}
      {selected.size > 0 && (
        <div className="flex items-center gap-3 px-4 py-2.5 rounded-lg border border-primary/20 bg-primary/5 animate-fade-in">
          <span className="text-xs font-medium text-foreground">{selected.size} selected</span>
          <Button variant="ghost" size="sm" onClick={handleBulkDelete} className="text-destructive hover:text-destructive gap-1.5 h-7 text-xs">
            <Trash2 className="w-3.5 h-3.5" /> Delete
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())} className="h-7 text-xs">
            Clear
          </Button>
        </div>
      )}

      {/* Content */}
      {isLoading ? (
        <PipelinesSkeleton />
      ) : filtered.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-16 flex flex-col items-center text-center animate-fade-in">
          <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mb-4">
            <GitBranch className="w-6 h-6 text-primary" />
          </div>
          <h3 className="text-sm font-display font-semibold text-foreground">
            {search || statusFilter !== "all" ? "No matching pipelines" : "No pipelines yet"}
          </h3>
          <p className="text-xs text-muted-foreground mt-1">
            {search || statusFilter !== "all" ? "Try adjusting your filters." : "Create your first pipeline to get started."}
          </p>
          {!search && statusFilter === "all" && (
            <Button onClick={() => navigate("/pipelines/new")} size="sm" className="mt-4 gap-1.5">
              <Plus className="w-3.5 h-3.5" /> Create Pipeline
            </Button>
          )}
        </div>
      ) : viewMode === "grid" ? (
        /* Grid View */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 animate-fade-in">
          {filtered.map((p) => (
            <div
              key={p.id}
              className={cn(
                "group rounded-lg border bg-card p-5 space-y-3 cursor-pointer transition-all hover:shadow-md hover:border-primary/30",
                selected.has(p.id) && "ring-2 ring-primary border-primary/40"
              )}
              onClick={() => navigate(`/pipelines/${p.id}`)}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <button
                    onClick={(e) => { e.stopPropagation(); toggleSelect(p.id); }}
                    className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
                  >
                    {selected.has(p.id) ? <CheckSquare className="w-4 h-4 text-primary" /> : <Square className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />}
                  </button>
                  <span className="text-sm font-medium text-foreground truncate">{p.name}</span>
                </div>
                <PipelineActions pipeline={p} onRun={handleRunNow} onDuplicate={handleDuplicate} onDelete={setShowDelete} onNavigate={navigate} />
              </div>
              {p.description && <p className="text-xs text-muted-foreground line-clamp-2">{p.description}</p>}
              <div className="flex items-center justify-between pt-1">
                <StatusBadge status={statusToRunStatus(p.status)} />
                <span className="text-[11px] text-muted-foreground">{formatDate(p.updated_at)}</span>
              </div>
              <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                <span className="capitalize">{p.schedule_type}</span>
                {p.last_run_at && <><span>·</span><span>Last run {formatDate(p.last_run_at)}</span></>}
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* Table View */
        <div className="rounded-lg border border-border bg-card overflow-hidden animate-fade-in">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="w-10 px-4 py-3">
                    <button onClick={toggleAll} className="text-muted-foreground hover:text-foreground transition-colors">
                      {allSelected ? <CheckSquare className="w-4 h-4 text-primary" /> : <Square className="w-4 h-4" />}
                    </button>
                  </th>
                  <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">Pipeline</th>
                  <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3 hidden md:table-cell">Schedule</th>
                  <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">Status</th>
                  <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3 hidden sm:table-cell">Updated</th>
                  <th className="w-10 px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => (
                  <tr
                    key={p.id}
                    className={cn(
                      "border-b border-border last:border-0 hover:bg-muted/20 transition-colors group",
                      selected.has(p.id) && "bg-primary/5"
                    )}
                  >
                    <td className="px-4 py-3">
                      <button onClick={() => toggleSelect(p.id)} className="text-muted-foreground hover:text-foreground transition-colors">
                        {selected.has(p.id) ? <CheckSquare className="w-4 h-4 text-primary" /> : <Square className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />}
                      </button>
                    </td>
                    <td className="px-4 py-3 cursor-pointer" onClick={() => navigate(`/pipelines/${p.id}`)}>
                      <span className="text-sm font-medium text-foreground">{p.name}</span>
                      {p.description && <span className="text-xs text-muted-foreground ml-2 hidden lg:inline">{p.description}</span>}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground capitalize hidden md:table-cell cursor-pointer" onClick={() => navigate(`/pipelines/${p.id}`)}>{p.schedule_type}</td>
                    <td className="px-4 py-3 cursor-pointer" onClick={() => navigate(`/pipelines/${p.id}`)}>
                      <StatusBadge status={statusToRunStatus(p.status)} />
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground hidden sm:table-cell cursor-pointer" onClick={() => navigate(`/pipelines/${p.id}`)}>{formatDate(p.updated_at)}</td>
                    <td className="px-4 py-3">
                      <PipelineActions pipeline={p} onRun={handleRunNow} onDuplicate={handleDuplicate} onDelete={setShowDelete} onNavigate={navigate} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between px-4 py-3 border-t border-border">
            <span className="text-xs text-muted-foreground">Showing {filtered.length} of {pipelines.length}</span>
          </div>
        </div>
      )}

      {/* Delete dialog */}
      <Dialog open={!!showDelete} onOpenChange={(open) => !open && setShowDelete(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Pipeline</DialogTitle>
            <DialogDescription>
              This will permanently delete <span className="text-foreground font-medium">{pipelines.find((p) => p.id === showDelete)?.name}</span> and all its nodes and edges.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowDelete(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => showDelete && handleDelete(showDelete)} disabled={deleteMutation.isPending}>
              {deleteMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

/* Extracted dropdown actions menu */
function PipelineActions({
  pipeline: p, onRun, onDuplicate, onDelete, onNavigate,
}: {
  pipeline: Pipeline;
  onRun: (id: string) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string | null) => void;
  onNavigate: (path: string) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          onClick={(e) => e.stopPropagation()}
          className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
        >
          <MoreHorizontal className="w-4 h-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuItem onClick={() => onNavigate(`/pipelines/${p.id}`)}>
          <Eye className="w-3.5 h-3.5 mr-2" /> View Details
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onRun(p.id)}>
          <Play className="w-3.5 h-3.5 mr-2" /> Run Now
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onNavigate(`/pipelines/${p.id}/edit`)}>
          <Edit className="w-3.5 h-3.5 mr-2" /> Edit
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onDuplicate(p.id)}>
          <Copy className="w-3.5 h-3.5 mr-2" /> Duplicate
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => onDelete(p.id)} className="text-destructive focus:text-destructive">
          <Trash2 className="w-3.5 h-3.5 mr-2" /> Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default Pipelines;
