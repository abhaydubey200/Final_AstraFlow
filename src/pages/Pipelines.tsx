import { useState } from "react";
import StatusBadge from "@/components/StatusBadge";
import PipelineBuilder from "@/components/PipelineBuilder";
import { Plus, Search, Filter } from "lucide-react";

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

const Pipelines = () => {
  const [showBuilder, setShowBuilder] = useState(false);

  if (showBuilder) {
    return <PipelineBuilder onBack={() => setShowBuilder(false)} />;
  }

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

      <div className="flex gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input type="text" placeholder="Search pipelines..." className="w-full pl-9 pr-4 py-2 rounded-md border border-border bg-card text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring" />
        </div>
        <button className="inline-flex items-center gap-2 px-4 py-2 rounded-md border border-border bg-card text-sm text-muted-foreground hover:text-foreground transition-colors">
          <Filter className="w-4 h-4" /> Filter
        </button>
      </div>

      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left text-xs font-medium text-muted-foreground px-5 py-3">Pipeline</th>
                <th className="text-left text-xs font-medium text-muted-foreground px-5 py-3">Type</th>
                <th className="text-left text-xs font-medium text-muted-foreground px-5 py-3">Source</th>
                <th className="text-left text-xs font-medium text-muted-foreground px-5 py-3">Destination</th>
                <th className="text-left text-xs font-medium text-muted-foreground px-5 py-3">Schedule</th>
                <th className="text-left text-xs font-medium text-muted-foreground px-5 py-3">Status</th>
                <th className="text-left text-xs font-medium text-muted-foreground px-5 py-3">Last Run</th>
              </tr>
            </thead>
            <tbody>
              {pipelines.map((p) => (
                <tr key={p.id} onClick={() => setShowBuilder(true)} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors cursor-pointer">
                  <td className="px-5 py-3">
                    <span className="text-sm font-medium text-foreground">{p.name}</span>
                    <span className="text-xs text-muted-foreground ml-2">{p.id}</span>
                  </td>
                  <td className="px-5 py-3"><span className="text-xs px-2 py-0.5 rounded bg-muted text-muted-foreground font-display">{p.type}</span></td>
                  <td className="px-5 py-3 text-sm text-muted-foreground">{p.source}</td>
                  <td className="px-5 py-3 text-sm text-muted-foreground">{p.destination}</td>
                  <td className="px-5 py-3 text-sm font-display text-muted-foreground">{p.schedule}</td>
                  <td className="px-5 py-3"><StatusBadge status={p.status} /></td>
                  <td className="px-5 py-3 text-sm text-muted-foreground">{p.lastRun}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Pipelines;
