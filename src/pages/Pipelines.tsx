import { useState } from "react";
import { useNavigate } from "react-router-dom";
import StatusBadge from "@/components/StatusBadge";
import PipelineBuilder from "@/components/PipelineBuilder";
import { cn } from "@/lib/utils";
import { Plus, Search, GitBranch, MoreHorizontal, Play, Copy, Trash2, Eye, Edit } from "lucide-react";

const pipelines = [
  { id: "PL-001", name: "Sales MSSQL → Snowflake", source: "MSSQL", destination: "Snowflake", schedule: "Every 15 min", status: "success" as const, lastRun: "2 min ago", type: "Incremental" },
  { id: "PL-002", name: "Inventory CDC Pipeline", source: "MSSQL", destination: "Snowflake", schedule: "Real-time", status: "running" as const, lastRun: "Running", type: "CDC" },
  { id: "PL-003", name: "Customer Analytics Load", source: "PostgreSQL", destination: "Snowflake", schedule: "Hourly", status: "success" as const, lastRun: "15 min ago", type: "Full Load" },
  { id: "PL-004", name: "Product Catalog Sync", source: "MySQL", destination: "Snowflake", schedule: "Daily", status: "failed" as const, lastRun: "22 min ago", type: "Full Load" },
  { id: "PL-005", name: "Financial Reports ETL", source: "MSSQL", destination: "Snowflake", schedule: "Daily 2 AM", status: "success" as const, lastRun: "1 hr ago", type: "Incremental" },
  { id: "PL-006", name: "User Events Ingestion", source: "API", destination: "Snowflake", schedule: "Every 5 min", status: "pending" as const, lastRun: "Scheduled", type: "Micro-batch" },
  { id: "PL-007", name: "Marketing Data Merge", source: "CSV", destination: "Snowflake", schedule: "Weekly", status: "success" as const, lastRun: "2 days ago", type: "Full Load" },
  { id: "PL-008", name: "IoT Sensor Feed", source: "API", destination: "Snowflake", schedule: "Every 1 min", status: "running" as const, lastRun: "Running", type: "Micro-batch" },
];

type StatusFilter = "all" | "success" | "running" | "failed" | "pending";
type SortKey = "lastRun" | "name" | "created";

const Pipelines = () => {
  const navigate = useNavigate();
  const [showBuilder, setShowBuilder] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sortBy, setSortBy] = useState<SortKey>("lastRun");
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [showDelete, setShowDelete] = useState<string | null>(null);

  if (showBuilder) {
    return <PipelineBuilder onBack={() => setShowBuilder(false)} />;
  }

  const filtered = pipelines
    .filter((p) => statusFilter === "all" || p.status === statusFilter)
    .filter((p) => p.name.toLowerCase().includes(search.toLowerCase()) || p.id.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      if (sortBy === "name") return a.name.localeCompare(b.name);
      return 0;
    });

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">Pipelines</h1>
          <p className="text-sm text-muted-foreground mt-1">{pipelines.length} pipelines configured</p>
        </div>
        <button onClick={() => setShowBuilder(true)} className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors">
          <Plus className="w-4 h-4" /> New Pipeline
        </button>
      </div>

      <div className="flex gap-3 flex-wrap">
        <div className="flex-1 min-w-[200px] relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search pipelines..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-md border border-border bg-card text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
        <div className="flex gap-1 rounded-md border border-border bg-card p-0.5">
          {(["all", "running", "success", "failed", "pending"] as StatusFilter[]).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={cn("px-3 py-1.5 rounded text-xs font-medium transition-colors capitalize", statusFilter === s ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground")}
            >
              {s}
            </button>
          ))}
        </div>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as SortKey)}
          className="px-3 py-2 rounded-md border border-border bg-card text-xs text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        >
          <option value="lastRun">Sort: Last Run</option>
          <option value="name">Sort: Name</option>
          <option value="created">Sort: Created</option>
        </select>
      </div>

      {filtered.length === 0 ? (
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
            <button onClick={() => setShowBuilder(true)} className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-primary text-primary-foreground text-xs font-medium">
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
                  <th className="text-left text-xs font-medium text-muted-foreground px-5 py-3">Type</th>
                  <th className="text-left text-xs font-medium text-muted-foreground px-5 py-3">Source → Dest</th>
                  <th className="text-left text-xs font-medium text-muted-foreground px-5 py-3">Schedule</th>
                  <th className="text-left text-xs font-medium text-muted-foreground px-5 py-3">Status</th>
                  <th className="text-left text-xs font-medium text-muted-foreground px-5 py-3">Last Run</th>
                  <th className="text-left text-xs font-medium text-muted-foreground px-5 py-3 w-10" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => (
                  <tr key={p.id} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors cursor-pointer group">
                    <td className="px-5 py-3" onClick={() => navigate(`/pipelines/${p.id}`)}>
                      <span className="text-sm font-medium text-foreground">{p.name}</span>
                      <span className="text-xs text-muted-foreground ml-2">{p.id}</span>
                    </td>
                    <td className="px-5 py-3" onClick={() => navigate(`/pipelines/${p.id}`)}>
                      <span className="text-xs px-2 py-0.5 rounded bg-muted text-muted-foreground font-display">{p.type}</span>
                    </td>
                    <td className="px-5 py-3 text-xs text-muted-foreground" onClick={() => navigate(`/pipelines/${p.id}`)}>
                      {p.source} → {p.destination}
                    </td>
                    <td className="px-5 py-3 text-xs font-display text-muted-foreground" onClick={() => navigate(`/pipelines/${p.id}`)}>{p.schedule}</td>
                    <td className="px-5 py-3" onClick={() => navigate(`/pipelines/${p.id}`)}><StatusBadge status={p.status} /></td>
                    <td className="px-5 py-3 text-xs text-muted-foreground" onClick={() => navigate(`/pipelines/${p.id}`)}>{p.lastRun}</td>
                    <td className="px-5 py-3 relative">
                      <button
                        onClick={(e) => { e.stopPropagation(); setOpenMenu(openMenu === p.id ? null : p.id); }}
                        className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors opacity-0 group-hover:opacity-100"
                      >
                        <MoreHorizontal className="w-4 h-4" />
                      </button>
                      {openMenu === p.id && (
                        <div className="absolute right-5 top-10 z-20 w-40 rounded-md border border-border bg-popover shadow-lg py-1">
                          <button onClick={() => { navigate(`/pipelines/${p.id}`); setOpenMenu(null); }} className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-foreground hover:bg-muted transition-colors">
                            <Eye className="w-3.5 h-3.5" /> View Details
                          </button>
                          <button className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-foreground hover:bg-muted transition-colors">
                            <Play className="w-3.5 h-3.5" /> Run Now
                          </button>
                          <button className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-foreground hover:bg-muted transition-colors">
                            <Edit className="w-3.5 h-3.5" /> Edit
                          </button>
                          <button className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-foreground hover:bg-muted transition-colors">
                            <Copy className="w-3.5 h-3.5" /> Duplicate
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
          {/* Pagination */}
          <div className="flex items-center justify-between px-5 py-3 border-t border-border">
            <span className="text-xs text-muted-foreground">Showing {filtered.length} of {pipelines.length} pipelines</span>
            <div className="flex gap-1">
              <button className="px-3 py-1 rounded text-xs text-muted-foreground border border-border hover:text-foreground transition-colors" disabled>Previous</button>
              <button className="px-3 py-1 rounded text-xs bg-primary/10 text-primary border border-primary/30">1</button>
              <button className="px-3 py-1 rounded text-xs text-muted-foreground border border-border hover:text-foreground transition-colors" disabled>Next</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {showDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-lg border border-border bg-card shadow-xl p-6 space-y-4">
            <h3 className="text-sm font-display font-semibold text-foreground">Delete Pipeline</h3>
            <p className="text-xs text-muted-foreground">
              This will permanently delete <span className="text-foreground font-medium">{pipelines.find((p) => p.id === showDelete)?.name}</span> and all its run history.
            </p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowDelete(null)} className="px-3 py-1.5 rounded-md border border-border text-xs text-muted-foreground hover:text-foreground transition-colors">Cancel</button>
              <button onClick={() => setShowDelete(null)} className="px-3 py-1.5 rounded-md bg-destructive text-destructive-foreground text-xs font-medium hover:bg-destructive/90 transition-colors">
                <Trash2 className="w-3 h-3 inline mr-1" /> Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Pipelines;
