import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import StatusBadge from "@/components/StatusBadge";
import { cn } from "@/lib/utils";
import {
  ArrowLeft,
  Play,
  Settings,
  Calendar,
  Clock,
  CheckCircle,
  XCircle,
  ChevronDown,
  ChevronRight,
  Database,
  Upload,
  Activity,
  FileCheck,
  Trash2,
  RotateCcw,
  Bell,
  BellOff,
  Terminal,
  Edit,
} from "lucide-react";

const pipelineData: Record<string, {
  id: string; name: string; source: string; sourceTable: string;
  destination: string; destTable: string; mode: string; timestampCol: string;
  schedule: string; scheduleType: string; cronExpr: string;
  status: "success" | "running" | "failed" | "pending";
  successRate: string; avgDuration: string; totalRows: string;
  retryMax: number; retryInterval: number; timeout: number;
  notifyOnFail: boolean; notifyOnSuccess: boolean;
}> = {
  "PL-001": {
    id: "PL-001", name: "Sales MSSQL → Snowflake", source: "Sales DB Primary (MSSQL)",
    sourceTable: "dbo.orders", destination: "Analytics Warehouse (Snowflake)",
    destTable: "analytics.orders", mode: "Incremental", timestampCol: "updated_at",
    schedule: "Every 15 min", scheduleType: "cron", cronExpr: "*/15 * * * *",
    status: "success", successRate: "99.8%", avgDuration: "4m 32s", totalRows: "142.3M",
    retryMax: 3, retryInterval: 5, timeout: 30, notifyOnFail: true, notifyOnSuccess: false,
  },
  "PL-002": {
    id: "PL-002", name: "Inventory CDC Pipeline", source: "Inventory DB (MSSQL)",
    sourceTable: "dbo.inventory", destination: "Analytics Warehouse (Snowflake)",
    destTable: "analytics.inventory", mode: "CDC", timestampCol: "—",
    schedule: "Real-time", scheduleType: "cron", cronExpr: "* * * * *",
    status: "running", successRate: "98.2%", avgDuration: "2m 10s", totalRows: "58.1M",
    retryMax: 5, retryInterval: 2, timeout: 15, notifyOnFail: true, notifyOnSuccess: false,
  },
};

const runHistory = [
  { id: "RUN-2847", status: "success" as const, started: "2026-03-07 14:32:00", duration: "4m 32s", rowsExtracted: "1,234,567", rowsLoaded: "1,230,102",
    tasks: [
      { name: "Extract", status: "success" as const, duration: "1m 12s", rows: "1,234,567", logs: ["Connected to sql-prod-01", "Extracted 1,234,567 rows"] },
      { name: "Transform", status: "success" as const, duration: "1m 45s", rows: "1,230,102", logs: ["dropDuplicates applied", "Schema mapping complete"] },
      { name: "Validate", status: "success" as const, duration: "0m 22s", rows: "1,230,102", logs: ["Row count: PASS", "Null check: PASS"] },
      { name: "Load", status: "success" as const, duration: "1m 13s", rows: "1,230,102", logs: ["COPY INTO analytics.orders", "1,230,102 rows loaded"] },
    ],
  },
  { id: "RUN-2840", status: "success" as const, started: "2026-03-07 14:17:00", duration: "4m 18s", rowsExtracted: "1,180,320", rowsLoaded: "1,176,500",
    tasks: [
      { name: "Extract", status: "success" as const, duration: "1m 05s", rows: "1,180,320", logs: ["Extracted 1,180,320 rows"] },
      { name: "Transform", status: "success" as const, duration: "1m 40s", rows: "1,176,500", logs: ["Processing complete"] },
      { name: "Validate", status: "success" as const, duration: "0m 20s", rows: "1,176,500", logs: ["All checks passed"] },
      { name: "Load", status: "success" as const, duration: "1m 13s", rows: "1,176,500", logs: ["Loaded successfully"] },
    ],
  },
  { id: "RUN-2833", status: "failed" as const, started: "2026-03-07 14:02:00", duration: "1m 45s", rowsExtracted: "890,000", rowsLoaded: "0",
    tasks: [
      { name: "Extract", status: "success" as const, duration: "1m 05s", rows: "890,000", logs: ["Extracted 890,000 rows"] },
      { name: "Transform", status: "failed" as const, duration: "0m 40s", rows: "0", logs: ["ERROR: OutOfMemory on Spark worker", "Transformation aborted"] },
    ],
  },
  { id: "RUN-2826", status: "success" as const, started: "2026-03-07 13:47:00", duration: "4m 50s", rowsExtracted: "1,320,000", rowsLoaded: "1,315,200",
    tasks: [
      { name: "Extract", status: "success" as const, duration: "1m 15s", rows: "1,320,000", logs: ["Extracted 1,320,000 rows"] },
      { name: "Transform", status: "success" as const, duration: "1m 50s", rows: "1,315,200", logs: ["Processing complete"] },
      { name: "Validate", status: "success" as const, duration: "0m 25s", rows: "1,315,200", logs: ["All checks passed"] },
      { name: "Load", status: "success" as const, duration: "1m 20s", rows: "1,315,200", logs: ["Loaded successfully"] },
    ],
  },
];

const taskIcons: Record<string, typeof Database> = {
  Extract: Database,
  Transform: Activity,
  Validate: FileCheck,
  Load: Upload,
};

const PipelineDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<"overview" | "history" | "schedule" | "settings">("overview");
  const [expandedRun, setExpandedRun] = useState<string | null>(null);
  const [expandedTask, setExpandedTask] = useState<string | null>(null);

  const pipeline = pipelineData[id || "PL-001"] || pipelineData["PL-001"];
  const [scheduleType, setScheduleType] = useState(pipeline.scheduleType);
  const [cronExpr, setCronExpr] = useState(pipeline.cronExpr);
  const [retryMax, setRetryMax] = useState(pipeline.retryMax);
  const [retryInterval, setRetryInterval] = useState(pipeline.retryInterval);
  const [timeout, setTimeout_] = useState(pipeline.timeout);
  const [notifyFail, setNotifyFail] = useState(pipeline.notifyOnFail);
  const [notifySuccess, setNotifySuccess] = useState(pipeline.notifyOnSuccess);

  const tabs = [
    { key: "overview" as const, label: "Overview" },
    { key: "history" as const, label: "Run History" },
    { key: "schedule" as const, label: "Schedule" },
    { key: "settings" as const, label: "Settings" },
  ];

  return (
    <div className="p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/pipelines")} className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-display font-bold text-foreground">{pipeline.name}</h1>
              <StatusBadge status={pipeline.status} />
            </div>
            <p className="text-xs text-muted-foreground mt-0.5 font-display">{pipeline.id}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => navigate(`/pipelines/${id}/edit`)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border text-xs text-muted-foreground hover:text-foreground transition-colors">
            <Edit className="w-3.5 h-3.5" /> Edit Pipeline
          </button>
          <button className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors">
            <Play className="w-3.5 h-3.5" /> Run Now
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              "px-4 py-2 text-xs font-medium transition-colors border-b-2 -mb-px",
              activeTab === tab.key
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab: Overview */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          {/* Metric cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { label: "Success Rate", value: pipeline.successRate, icon: CheckCircle, color: "text-success" },
              { label: "Avg Duration", value: pipeline.avgDuration, icon: Clock, color: "text-primary" },
              { label: "Total Rows Moved", value: pipeline.totalRows, icon: Activity, color: "text-primary" },
            ].map((m) => (
              <div key={m.label} className="rounded-lg border border-border bg-card p-4">
                <div className="flex items-center gap-2 mb-2">
                  <m.icon className={cn("w-4 h-4", m.color)} />
                  <span className="text-xs text-muted-foreground">{m.label}</span>
                </div>
                <span className="text-lg font-display font-bold text-foreground">{m.value}</span>
              </div>
            ))}
          </div>

          {/* Config summary */}
          <div className="rounded-lg border border-border bg-card p-5 space-y-3">
            <h3 className="text-sm font-display font-semibold text-foreground">Configuration</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                { label: "Source", value: `${pipeline.source} → ${pipeline.sourceTable}` },
                { label: "Destination", value: `${pipeline.destination} → ${pipeline.destTable}` },
                { label: "Mode", value: `${pipeline.mode}${pipeline.timestampCol !== "—" ? ` (column: ${pipeline.timestampCol})` : ""}` },
                { label: "Schedule", value: pipeline.schedule },
              ].map((item) => (
                <div key={item.label}>
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">{item.label}</span>
                  <p className="text-xs text-foreground mt-0.5">{item.value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Mini DAG */}
          <div className="rounded-lg border border-border bg-card p-5">
            <h3 className="text-sm font-display font-semibold text-foreground mb-4">Pipeline Flow</h3>
            <div className="flex items-center justify-center gap-4 py-4">
              {["Extract", "Transform", "Validate", "Load"].map((step, i, arr) => {
                const Icon = taskIcons[step];
                return (
                  <div key={step} className="flex items-center gap-4">
                    <div className="flex flex-col items-center gap-1.5">
                      <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                        <Icon className="w-5 h-5 text-primary" />
                      </div>
                      <span className="text-[10px] text-muted-foreground font-display">{step}</span>
                    </div>
                    {i < arr.length - 1 && (
                      <div className="w-8 h-px bg-border" />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Tab: Run History */}
      {activeTab === "history" && (
        <div className="space-y-2">
          {runHistory.length === 0 ? (
            <div className="rounded-lg border border-border bg-card p-12 flex flex-col items-center text-center">
              <Clock className="w-10 h-10 text-muted-foreground mb-3" />
              <h3 className="text-sm font-display font-semibold text-foreground">No runs yet</h3>
              <p className="text-xs text-muted-foreground mt-1">This pipeline hasn't been executed yet.</p>
              <button className="mt-4 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-medium">
                <Play className="w-3.5 h-3.5" /> Run Now
              </button>
            </div>
          ) : (
            <div className="rounded-lg border border-border bg-card overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="text-left text-xs font-medium text-muted-foreground px-5 py-3 w-8" />
                    <th className="text-left text-xs font-medium text-muted-foreground px-5 py-3">Run ID</th>
                    <th className="text-left text-xs font-medium text-muted-foreground px-5 py-3">Status</th>
                    <th className="text-left text-xs font-medium text-muted-foreground px-5 py-3">Started</th>
                    <th className="text-left text-xs font-medium text-muted-foreground px-5 py-3">Duration</th>
                    <th className="text-left text-xs font-medium text-muted-foreground px-5 py-3">Extracted</th>
                    <th className="text-left text-xs font-medium text-muted-foreground px-5 py-3">Loaded</th>
                  </tr>
                </thead>
                <tbody>
                  {runHistory.map((run) => (
                    <>
                      <tr
                        key={run.id}
                        onClick={() => setExpandedRun(expandedRun === run.id ? null : run.id)}
                        className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors cursor-pointer"
                      >
                        <td className="px-5 py-3">
                          {expandedRun === run.id ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />}
                        </td>
                        <td className="px-5 py-3 text-xs font-display text-foreground">{run.id}</td>
                        <td className="px-5 py-3"><StatusBadge status={run.status} /></td>
                        <td className="px-5 py-3 text-xs text-muted-foreground">{run.started}</td>
                        <td className="px-5 py-3 text-xs font-display text-muted-foreground">{run.duration}</td>
                        <td className="px-5 py-3 text-xs font-display text-muted-foreground">{run.rowsExtracted}</td>
                        <td className="px-5 py-3 text-xs font-display text-muted-foreground">{run.rowsLoaded}</td>
                      </tr>
                      {expandedRun === run.id && (
                        <tr key={`${run.id}-detail`}>
                          <td colSpan={7} className="bg-muted/5 px-5 py-3">
                            <div className="space-y-2">
                              {run.tasks.map((task, ti) => {
                                const TaskIcon = taskIcons[task.name] || Activity;
                                const taskKey = `${run.id}-${ti}`;
                                return (
                                  <div key={ti} className="rounded-md border border-border bg-card overflow-hidden">
                                    <button
                                      onClick={(e) => { e.stopPropagation(); setExpandedTask(expandedTask === taskKey ? null : taskKey); }}
                                      className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-muted/20 transition-colors text-left"
                                    >
                                      {task.status === "success" ? <CheckCircle className="w-3.5 h-3.5 text-success" /> : task.status === "failed" ? <XCircle className="w-3.5 h-3.5 text-destructive" /> : <Clock className="w-3.5 h-3.5 text-warning" />}
                                      <TaskIcon className="w-3.5 h-3.5 text-muted-foreground" />
                                      <span className="text-xs font-medium text-foreground flex-1">{task.name}</span>
                                      <span className="text-[10px] text-muted-foreground font-display">{task.duration}</span>
                                      <span className="text-[10px] text-muted-foreground">{task.rows} rows</span>
                                      <Terminal className="w-3 h-3 text-muted-foreground" />
                                    </button>
                                    {expandedTask === taskKey && task.logs.length > 0 && (
                                      <div className="border-t border-border bg-background px-4 py-2 space-y-0.5">
                                        {task.logs.map((log, li) => (
                                          <p key={li} className={cn("text-[11px] font-display leading-relaxed", log.startsWith("ERROR") ? "text-destructive" : "text-muted-foreground")}>
                                            {log}
                                          </p>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab: Schedule */}
      {activeTab === "schedule" && (
        <div className="max-w-lg space-y-5">
          <div className="rounded-lg border border-border bg-card p-5 space-y-4">
            <h3 className="text-sm font-display font-semibold text-foreground">Schedule Configuration</h3>
            <div>
              <label className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Schedule Type</label>
              <div className="flex gap-2 mt-2">
                {["hourly", "daily", "cron"].map((t) => (
                  <button
                    key={t}
                    onClick={() => setScheduleType(t)}
                    className={cn(
                      "px-3 py-1.5 rounded-md border text-xs font-medium transition-colors capitalize",
                      scheduleType === t ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
            {scheduleType === "cron" && (
              <div>
                <label className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Cron Expression</label>
                <input
                  type="text"
                  value={cronExpr}
                  onChange={(e) => setCronExpr(e.target.value)}
                  className="w-full mt-1 px-3 py-2 rounded-md border border-border bg-background text-sm font-display text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
            )}
            <div className="flex items-center gap-2 p-3 rounded-md bg-muted/30 border border-border">
              <Calendar className="w-4 h-4 text-primary" />
              <span className="text-xs text-foreground">Next run: <span className="font-display">March 8, 2026 02:00 UTC</span></span>
            </div>
            <button className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors">
              Update Schedule
            </button>
          </div>
        </div>
      )}

      {/* Tab: Settings */}
      {activeTab === "settings" && (
        <div className="max-w-lg space-y-5">
          <div className="rounded-lg border border-border bg-card p-5 space-y-4">
            <h3 className="text-sm font-display font-semibold text-foreground">Retry Policy</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Max Retries</label>
                <input type="number" value={retryMax} onChange={(e) => setRetryMax(Number(e.target.value))} className="w-full mt-1 px-3 py-2 rounded-md border border-border bg-background text-sm font-display text-foreground focus:outline-none focus:ring-1 focus:ring-ring" />
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Retry Interval (min)</label>
                <input type="number" value={retryInterval} onChange={(e) => setRetryInterval(Number(e.target.value))} className="w-full mt-1 px-3 py-2 rounded-md border border-border bg-background text-sm font-display text-foreground focus:outline-none focus:ring-1 focus:ring-ring" />
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-card p-5 space-y-4">
            <h3 className="text-sm font-display font-semibold text-foreground">Timeout</h3>
            <div>
              <label className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Timeout (minutes)</label>
              <input type="number" value={timeout} onChange={(e) => setTimeout_(Number(e.target.value))} className="w-full mt-1 px-3 py-2 rounded-md border border-border bg-background text-sm font-display text-foreground focus:outline-none focus:ring-1 focus:ring-ring" />
            </div>
          </div>

          <div className="rounded-lg border border-border bg-card p-5 space-y-4">
            <h3 className="text-sm font-display font-semibold text-foreground">Notifications</h3>
            <div className="space-y-3">
              <label className="flex items-center justify-between cursor-pointer">
                <div className="flex items-center gap-2">
                  <Bell className="w-4 h-4 text-destructive" />
                  <span className="text-xs text-foreground">Notify on failure</span>
                </div>
                <button
                  onClick={() => setNotifyFail(!notifyFail)}
                  className={cn("w-9 h-5 rounded-full transition-colors relative", notifyFail ? "bg-primary" : "bg-muted")}
                >
                  <span className={cn("absolute top-0.5 w-4 h-4 rounded-full bg-foreground transition-transform", notifyFail ? "left-4" : "left-0.5")} />
                </button>
              </label>
              <label className="flex items-center justify-between cursor-pointer">
                <div className="flex items-center gap-2">
                  <BellOff className="w-4 h-4 text-success" />
                  <span className="text-xs text-foreground">Notify on success</span>
                </div>
                <button
                  onClick={() => setNotifySuccess(!notifySuccess)}
                  className={cn("w-9 h-5 rounded-full transition-colors relative", notifySuccess ? "bg-primary" : "bg-muted")}
                >
                  <span className={cn("absolute top-0.5 w-4 h-4 rounded-full bg-foreground transition-transform", notifySuccess ? "left-4" : "left-0.5")} />
                </button>
              </label>
            </div>
          </div>

          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-5 space-y-3">
            <h3 className="text-sm font-display font-semibold text-destructive">Danger Zone</h3>
            <p className="text-xs text-muted-foreground">Permanently delete this pipeline and all its run history.</p>
            <button className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-destructive text-destructive-foreground text-xs font-medium hover:bg-destructive/90 transition-colors">
              <Trash2 className="w-3.5 h-3.5" /> Delete Pipeline
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default PipelineDetail;
