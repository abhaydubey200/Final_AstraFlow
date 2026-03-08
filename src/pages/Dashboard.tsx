import { useState } from "react";
import { useNavigate } from "react-router-dom";
import MetricCard from "@/components/MetricCard";
import StatusBadge from "@/components/StatusBadge";
import { Activity, CheckCircle, XCircle, Clock, ArrowRight, Database, Snowflake, Plus, GitBranch } from "lucide-react";
import { cn } from "@/lib/utils";

const recentRuns = [
  { id: "PL-001", name: "Sales MSSQL → Snowflake", status: "success" as const, duration: "4m 32s", rows: "1.2M", lastRun: "2 min ago" },
  { id: "PL-002", name: "Inventory CDC Pipeline", status: "running" as const, duration: "—", rows: "340K", lastRun: "Running" },
  { id: "PL-003", name: "Customer Analytics Load", status: "success" as const, duration: "12m 08s", rows: "8.4M", lastRun: "15 min ago" },
  { id: "PL-004", name: "Product Catalog Sync", status: "failed" as const, duration: "1m 12s", rows: "0", lastRun: "22 min ago" },
  { id: "PL-005", name: "Financial Reports ETL", status: "success" as const, duration: "7m 45s", rows: "2.1M", lastRun: "1 hr ago" },
  { id: "PL-006", name: "User Events Ingestion", status: "pending" as const, duration: "—", rows: "—", lastRun: "Scheduled" },
];

const Dashboard = () => {
  const navigate = useNavigate();
  const [timeRange, setTimeRange] = useState<"24h" | "7d" | "30d">("24h");
  const hasPipelines = recentRuns.length > 0;

  return (
    <div className="p-6 lg:p-8 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">Pipeline overview and system health</p>
        </div>
        <div className="flex gap-1 rounded-md border border-border bg-card p-0.5">
          {(["24h", "7d", "30d"] as const).map((r) => (
            <button
              key={r}
              onClick={() => setTimeRange(r)}
              className={cn("px-3 py-1 rounded text-xs font-medium transition-colors", timeRange === r ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground")}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {!hasPipelines ? (
        <div className="rounded-lg border border-border bg-card p-16 flex flex-col items-center text-center">
          <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mb-4">
            <GitBranch className="w-6 h-6 text-primary" />
          </div>
          <h3 className="text-sm font-display font-semibold text-foreground">No pipelines yet</h3>
          <p className="text-xs text-muted-foreground mt-1 max-w-sm">Create your first pipeline to see metrics here.</p>
          <button
            onClick={() => navigate("/pipelines")}
            className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> Create Pipeline
          </button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard title="Active Pipelines" value={24} subtitle="3 running now" icon={Activity} variant="primary" trend={{ value: "12% vs last week", positive: true }} />
            <MetricCard title="Success Rate" value="99.2%" subtitle="Last 24 hours" icon={CheckCircle} variant="success" trend={{ value: "0.3% improvement", positive: true }} />
            <MetricCard title="Failed Runs" value={2} subtitle="Last 24 hours" icon={XCircle} variant="destructive" trend={{ value: "1 less than yesterday", positive: true }} />
            <MetricCard title="Avg Latency" value="6.2m" subtitle="Batch pipelines" icon={Clock} variant="default" trend={{ value: "8% faster", positive: true }} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-1 rounded-lg border border-border bg-card p-5 space-y-4">
              <h3 className="text-sm font-display font-semibold text-foreground">Today's Throughput</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Rows Processed</span>
                  <span className="font-display font-bold text-foreground">48.3M</span>
                </div>
                <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-primary rounded-full" style={{ width: "72%" }} />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Data Volume</span>
                  <span className="font-display font-bold text-foreground">1.2 TB</span>
                </div>
                <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-success rounded-full" style={{ width: "58%" }} />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Active Sources</span>
                  <span className="font-display font-bold text-foreground">12</span>
                </div>
              </div>
            </div>

            <div className="lg:col-span-2 rounded-lg border border-border bg-card p-5">
              <h3 className="text-sm font-display font-semibold text-foreground mb-4">Pipeline Flow</h3>
              <div className="flex items-center justify-center gap-3 py-6">
                {[
                  { icon: Database, label: "MSSQL", count: "8 sources" },
                  { icon: ArrowRight, label: "", count: "" },
                  { icon: Activity, label: "Transform", count: "Spark Engine" },
                  { icon: ArrowRight, label: "", count: "" },
                  { icon: Snowflake, label: "Snowflake", count: "3 warehouses" },
                ].map((step, i) =>
                  step.label === "" ? (
                    <ArrowRight key={i} className="w-5 h-5 text-primary/50" />
                  ) : (
                    <div key={i} className="flex flex-col items-center gap-2">
                      <div className="w-14 h-14 rounded-xl border border-border bg-muted/50 flex items-center justify-center">
                        <step.icon className="w-6 h-6 text-primary" />
                      </div>
                      <span className="text-xs font-display font-medium text-foreground">{step.label}</span>
                      <span className="text-[10px] text-muted-foreground">{step.count}</span>
                    </div>
                  )
                )}
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-card">
            <div className="px-5 py-4 border-b border-border">
              <h3 className="text-sm font-display font-semibold text-foreground">Recent Pipeline Runs</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left text-xs font-medium text-muted-foreground px-5 py-3">Pipeline</th>
                    <th className="text-left text-xs font-medium text-muted-foreground px-5 py-3">Status</th>
                    <th className="text-left text-xs font-medium text-muted-foreground px-5 py-3">Duration</th>
                    <th className="text-left text-xs font-medium text-muted-foreground px-5 py-3">Rows</th>
                    <th className="text-left text-xs font-medium text-muted-foreground px-5 py-3">Last Run</th>
                  </tr>
                </thead>
                <tbody>
                  {recentRuns.map((run) => (
                    <tr
                      key={run.id}
                      onClick={() => navigate(`/pipelines/${run.id}`)}
                      className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors cursor-pointer"
                    >
                      <td className="px-5 py-3">
                        <div>
                          <span className="text-sm font-medium text-foreground">{run.name}</span>
                          <span className="text-xs text-muted-foreground ml-2">{run.id}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3"><StatusBadge status={run.status} /></td>
                      <td className="px-5 py-3 text-sm font-display text-muted-foreground">{run.duration}</td>
                      <td className="px-5 py-3 text-sm font-display text-muted-foreground">{run.rows}</td>
                      <td className="px-5 py-3 text-sm text-muted-foreground">{run.lastRun}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default Dashboard;
