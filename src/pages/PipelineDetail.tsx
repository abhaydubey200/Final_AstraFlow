import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/components/AuthProvider";
import { usePipeline, useUpdatePipeline, useDeletePipeline, useAuditLogs } from "@/hooks/use-pipelines";
import type { ScheduleType, PipelineRun, PipelineTaskRun, AuditLog } from "@/types/pipeline";
import { usePipelineRuns, useExecutionLogs, useTriggerRun, useWorkerJobs } from "@/hooks/use-executions";
import StatusBadge from "@/components/StatusBadge";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft, Play, Clock, CheckCircle, XCircle,
  ChevronDown, ChevronRight, Database, Upload, Activity,
  FileCheck, Trash2, Bell, BellOff, Terminal, Edit, Loader2,
} from "lucide-react";
import { format, formatDistanceStrict } from "date-fns";
import VersionHistory from "@/components/VersionHistory";
import { Badge } from "@/components/ui/badge";
import { ExecutionTimeline, type TaskState } from "@/components/ExecutionTimeline";
import { WorkerStatusCard } from "@/components/WorkerStatusCard";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Sparkles, ShieldCheck, ShieldAlert } from "lucide-react";

const taskIcons: Record<string, typeof Database> = {
  Extract: Database, extract: Database,
  Transform: Activity, transform: Activity,
  Validate: FileCheck, validate: FileCheck,
  Load: Upload, load: Upload,
};

function formatDuration(start: string, end: string | null): string {
  if (!end) return "—";
  return formatDistanceStrict(new Date(start), new Date(end));
}

interface ValidationResult {
  valid: boolean;
  message?: string;
}

const PipelineDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();

  const { data: pipelineData, isLoading: loadingPipeline } = usePipeline(id);
  const pipeline = pipelineData;
  const nodes = pipelineData?.pipeline_nodes ?? [];

  const { data: runs = [], isLoading: loadingRuns } = usePipelineRuns({ pipelineId: id });
  const updatePipeline = useUpdatePipeline();
  const deletePipeline = useDeletePipeline();
  const triggerRun = useTriggerRun();

  const [activeTab, setActiveTab] = useState<"overview" | "history" | "schedule" | "settings" | "versions" | "audit">("overview");
  const [expandedRun, setExpandedRun] = useState<string | null>(null);
  const [expandedTask, setExpandedTask] = useState<string | null>(null);

  // Schedule state
  const [scheduleType, setScheduleType] = useState<ScheduleType>("manual");
  const [cronExpr, setCronExpr] = useState<string>("");
  const [scheduleInit, setScheduleInit] = useState(false);

  // Settings state
  const [retryMax, setRetryMax] = useState(3);
  const [retryInterval, setRetryInterval] = useState(5);
  const [timeout_, setTimeout_] = useState(30);
  const [notifyFail, setNotifyFail] = useState(true);
  const [notifySuccess, setNotifySuccess] = useState(false);
  const [settingsInit, setSettingsInit] = useState(false);

  const [validationResult] = useState<ValidationResult | null>(null);

  // Initialize schedule/settings from pipeline once loaded
  useEffect(() => {
    if (pipeline && !scheduleInit) {
      setScheduleType(pipeline.schedule_type || "manual");
      const cfg = pipeline.schedule_config as Record<string, unknown> | null;
      setCronExpr((cfg?.cron_expression as string) ?? "");
      setScheduleInit(true);
    }
  }, [pipeline, scheduleInit]);

  useEffect(() => {
    if (pipeline && !settingsInit) {
      const cfg = pipeline.schedule_config as Record<string, unknown> | null;
      setRetryMax((cfg?.retry_max as number) ?? 3);
      setRetryInterval((cfg?.retry_interval as number) ?? 5);
      setTimeout_((cfg?.timeout as number) ?? 30);
      setNotifyFail((cfg?.notify_on_fail as boolean) ?? true);
      setNotifySuccess((cfg?.notify_on_success as boolean) ?? false);
      setSettingsInit(true);
    }
  }, [pipeline, settingsInit]);

  if (loadingPipeline) {
    return (
      <div className="p-6 lg:p-8 flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!pipeline) {
    return (
      <div className="p-6 lg:p-8 space-y-4">
        <button onClick={() => navigate("/pipelines")} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <p className="text-sm text-muted-foreground">Pipeline not found.</p>
      </div>
    );
  }

  const statusMap: Record<string, "success" | "running" | "failed" | "pending"> = {
    active: "success", draft: "pending", paused: "pending", error: "failed", completed: "success",
  };

  const successCount = runs.filter((r) => r.status === "success").length;
  const successRate = runs.length > 0 ? `${((successCount / runs.length) * 100).toFixed(1)}%` : "—";
  const totalRows = runs.reduce((s, r) => s + (r.rows_processed ?? 0), 0);
  const avgDuration = (() => {
    const completed = runs.filter((r) => r.end_time);
    if (!completed.length) return "—";
    const avg = completed.reduce((s, r) => s + (new Date(r.end_time!).getTime() - new Date(r.start_time).getTime()), 0) / completed.length;
    const mins = Math.floor(avg / 60000);
    const secs = Math.floor((avg % 60000) / 1000);
    return `${mins}m ${secs}s`;
  })();

  const handleRunNow = () => {
    if (!user) return;
    triggerRun.mutate({ pipelineId: pipeline.id, userId: user.id }, {
      onSuccess: () => toast({ title: "Pipeline execution started", description: "Watch the logs update in real time." }),
      onError: (e) => toast({ title: "Error", description: e.message, variant: "destructive" }),
    });
  };

  const handleUpdateSchedule = () => {
    // Compute next_run_at based on schedule type
    let nextRun: string | null = null;
    const now = new Date();
    if (scheduleType === "hourly") {
      nextRun = new Date(now.getTime() + 60 * 60 * 1000).toISOString();
    } else if (scheduleType === "daily") {
      nextRun = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();
    } else if (scheduleType === "cron") {
      nextRun = new Date(now.getTime() + 60 * 60 * 1000).toISOString();
    }

        updatePipeline.mutate({ 
          id: pipeline.id, 
          name: pipeline.name!,
          schedule_type: scheduleType,
          schedule_config: { ...((pipeline.schedule_config as Record<string, unknown>) ?? {}), cron_expression: cronExpr },
          ...(nextRun ? { next_run_at: nextRun } : {}),
        },
        {
          onSuccess: () => toast({ title: "Schedule updated" }),
          onError: (e) => toast({ title: "Error", description: e.message, variant: "destructive" }),
        });
  };

  const handleUpdateSettings = () => {
    const existing = (pipeline.schedule_config as Record<string, unknown>) ?? {};
    updatePipeline.mutate(
      {
        id: pipeline.id,
        schedule_config: { ...existing, retry_max: retryMax, retry_interval: retryInterval, timeout: timeout_, notify_on_fail: notifyFail, notify_on_success: notifySuccess },
      },
      {
        onSuccess: () => toast({ title: "Settings saved" }),
        onError: (e) => toast({ title: "Error", description: e.message, variant: "destructive" }),
      }
    );
  };

  const handleDelete = () => {
    if (!confirm("Delete this pipeline permanently?")) return;
    deletePipeline.mutate(pipeline.id, {
      onSuccess: () => { toast({ title: "Pipeline deleted" }); navigate("/pipelines"); },
      onError: (e) => toast({ title: "Error", description: e.message, variant: "destructive" }),
    });
  };

  const tabs = [
    { key: "overview" as const, label: "Overview" },
    { key: "history" as const, label: "Run History" },
    { key: "versions" as const, label: "Versions" },
    { key: "audit" as const, label: "Audit Logs" },
    { key: "schedule" as const, label: "Schedule" },
    { key: "settings" as const, label: "Settings" },
  ];

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/pipelines")} className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-display font-bold text-foreground">{pipeline.name}</h1>
              <StatusBadge status={statusMap[pipeline.status] ?? "pending"} />
              {validationResult && (
                <Badge variant="outline" className={cn(
                  "text-[9px] h-5 gap-1 px-1.5",
                  validationResult.valid ? "text-success border-success/30 bg-success/5" : "text-destructive border-destructive/30 bg-destructive/5"
                )}>
                  {validationResult.valid ? <ShieldCheck className="w-3 h-3" /> : <ShieldAlert className="w-3 h-3" />}
                  {validationResult.valid ? "Verified" : "Invalid"}
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5 font-display">{pipeline.id.slice(0, 8)}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => navigate(`/pipelines/${id}/edit`)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border text-xs text-muted-foreground hover:text-foreground transition-colors">
            <Edit className="w-3.5 h-3.5" /> Edit Pipeline
          </button>
          <button onClick={handleRunNow} disabled={triggerRun.isPending} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors disabled:opacity-50">
            {triggerRun.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />} Run Now
          </button>
        </div>
      </div>

      <div className="flex gap-1 border-b border-border">
        {tabs.map((tab) => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)} className={cn("px-4 py-2 text-xs font-medium transition-colors border-b-2 -mb-px", activeTab === tab.key ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground")}>
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "overview" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {[
              { label: "Success Rate", value: successRate, icon: CheckCircle, color: "text-success" },
              { label: "Avg Duration", value: avgDuration, icon: Clock, color: "text-primary" },
              { label: "Rows Scaled", value: totalRows.toLocaleString(), icon: Activity, color: "text-primary" },
              { label: "Staging Files", value: runs.reduce((s, r) => s + (Number(r.metadata?.files_created) || 0), 0), icon: FileCheck, color: "text-primary" },
              { label: "Data Scale", value: `${(runs.reduce((s, r) => s + (Number(r.metadata?.bytes_extracted) || 0), 0) / (1024 * 1024)).toFixed(2)} MB`, icon: Database, color: "text-emerald-500" },
            ].map((m) => (
              <div key={m.label} className="rounded-lg border border-border bg-card p-4">
                <div className="flex items-center gap-2 mb-2">
                  <m.icon className={cn("w-4 h-4", m.color)} />
                  <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-tight">{m.label}</span>
                </div>
                <span className="text-lg font-display font-bold text-foreground">{m.value}</span>
              </div>
            ))}
          </div>

          <div className="rounded-lg border border-border bg-card p-5 space-y-3">
            <h3 className="text-sm font-display font-semibold text-foreground">Configuration</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                { label: "Description", value: pipeline.description || "No description" },
                { label: "Schedule", value: pipeline.schedule_type },
                { label: "Status", value: pipeline.status },
                { label: "Created", value: format(new Date(pipeline.created_at), "PPP") },
              ].map((item) => (
                <div key={item.label}>
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">{item.label}</span>
                  <p className="text-xs text-foreground mt-0.5">{item.value}</p>
                </div>
              ))}
            </div>
          </div>

          {nodes.length > 0 && (
            <div className="rounded-lg border border-border bg-card p-5">
              <h3 className="text-sm font-display font-semibold text-foreground mb-4">Pipeline Flow</h3>
              <div className="flex items-center justify-center gap-4 py-4 flex-wrap">
                {nodes.sort((a, b) => a.order_index - b.order_index).map((node, i) => {
                  const Icon = taskIcons[node.node_type] || Activity;
                  return (
                    <div key={node.id} className="flex items-center gap-4">
                      <div className="flex flex-col items-center gap-1.5">
                        <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                          <Icon className="w-5 h-5 text-primary" />
                        </div>
                        <span className="text-[10px] text-muted-foreground font-display">{node.label || node.node_type}</span>
                      </div>
                      {i < nodes.length - 1 && <div className="w-8 h-px bg-border" />}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          
          <WorkerStatusCard 
            className="mt-6"
            stats={{
              active_workers: 8,
              total_workers: 10,
              cpu_usage: 42,
              memory_usage: 68,
              queue_depth: 3
            }} 
          />
        </div>
      )}

      {activeTab === "history" && (
        <div className="space-y-2">
          {loadingRuns ? (
            <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
          ) : runs.length === 0 ? (
            <div className="rounded-lg border border-border bg-card p-12 flex flex-col items-center text-center">
              <Clock className="w-10 h-10 text-muted-foreground mb-3" />
              <h3 className="text-sm font-display font-semibold text-foreground">No runs yet</h3>
              <p className="text-xs text-muted-foreground mt-1">This pipeline hasn't been executed yet.</p>
              <button onClick={handleRunNow} className="mt-4 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-medium">
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
                    <th className="text-left text-xs font-medium text-muted-foreground px-5 py-3">Rows</th>
                  </tr>
                </thead>
                <tbody>
                  {runs.map((run) => (
                    <RunRow key={run.id} run={run} expanded={expandedRun === run.id} onToggle={() => setExpandedRun(expandedRun === run.id ? null : run.id)} expandedTask={expandedTask} setExpandedTask={setExpandedTask} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTab === "schedule" && (
        <div className="max-w-lg space-y-5">
          <div className="rounded-lg border border-border bg-card p-5 space-y-4">
            <h3 className="text-sm font-display font-semibold text-foreground">Schedule Configuration</h3>
            <div>
              <label className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Schedule Type</label>
              <div className="flex gap-2 mt-2">
                {["manual", "hourly", "daily", "cron"].map((t) => (
                  <button key={t} onClick={() => setScheduleType(t as ScheduleType)} className={cn("px-3 py-1.5 rounded-md border text-xs font-medium transition-colors capitalize", scheduleType === t ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:text-foreground")}>
                    {t}
                  </button>
                ))}
              </div>
            </div>
            {scheduleType === "cron" && (
              <div>
                <label className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Cron Expression</label>
                <input type="text" value={cronExpr} onChange={(e) => setCronExpr(e.target.value)} className="w-full mt-1 px-3 py-2 rounded-md border border-border bg-background text-sm font-display text-foreground focus:outline-none focus:ring-1 focus:ring-ring" />
              </div>
            )}
            {pipeline.next_run_at && scheduleType !== "manual" && (
              <div className="flex items-center gap-2 p-3 rounded-md bg-muted/30 border border-border">
                <Clock className="w-4 h-4 text-primary" />
                <div>
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Next Run</span>
                  <p className="text-xs text-foreground font-display">{format(new Date(pipeline.next_run_at), "PPpp")}</p>
                </div>
              </div>
            )}
            {pipeline.last_run_at && (
              <div className="flex items-center gap-2 p-3 rounded-md bg-muted/30 border border-border">
                <CheckCircle className="w-4 h-4 text-success" />
                <div>
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Last Run</span>
                  <p className="text-xs text-foreground font-display">{format(new Date(pipeline.last_run_at), "PPpp")}</p>
                </div>
              </div>
            )}
            <button onClick={handleUpdateSchedule} disabled={updatePipeline.isPending} className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors disabled:opacity-50">
              {updatePipeline.isPending ? "Saving..." : "Update Schedule"}
            </button>
          </div>
        </div>
      )}

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
              <input type="number" value={timeout_} onChange={(e) => setTimeout_(Number(e.target.value))} className="w-full mt-1 px-3 py-2 rounded-md border border-border bg-background text-sm font-display text-foreground focus:outline-none focus:ring-1 focus:ring-ring" />
            </div>
          </div>

          <div className="rounded-lg border border-border bg-card p-5 space-y-4">
            <h3 className="text-sm font-display font-semibold text-foreground">Notifications</h3>
            <div className="space-y-3">
              <label className="flex items-center justify-between cursor-pointer">
                <div className="flex items-center gap-2"><Bell className="w-4 h-4 text-destructive" /><span className="text-xs text-foreground">Notify on failure</span></div>
                <button onClick={() => setNotifyFail(!notifyFail)} className={cn("w-9 h-5 rounded-full transition-colors relative", notifyFail ? "bg-primary" : "bg-muted")}>
                  <span className={cn("absolute top-0.5 w-4 h-4 rounded-full bg-foreground transition-transform", notifyFail ? "left-4" : "left-0.5")} />
                </button>
              </label>
              <label className="flex items-center justify-between cursor-pointer">
                <div className="flex items-center gap-2"><BellOff className="w-4 h-4 text-success" /><span className="text-xs text-foreground">Notify on success</span></div>
                <button onClick={() => setNotifySuccess(!notifySuccess)} className={cn("w-9 h-5 rounded-full transition-colors relative", notifySuccess ? "bg-primary" : "bg-muted")}>
                  <span className={cn("absolute top-0.5 w-4 h-4 rounded-full bg-foreground transition-transform", notifySuccess ? "left-4" : "left-0.5")} />
                </button>
              </label>
            </div>
          </div>

          <button onClick={handleUpdateSettings} disabled={updatePipeline.isPending} className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors disabled:opacity-50">
            {updatePipeline.isPending ? "Saving..." : "Save Settings"}
          </button>

          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-5 space-y-3">
            <h3 className="text-sm font-display font-semibold text-destructive">Danger Zone</h3>
            <p className="text-xs text-muted-foreground">Permanently delete this pipeline and all its run history.</p>
            <button onClick={handleDelete} disabled={deletePipeline.isPending} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-destructive text-destructive-foreground text-xs font-medium hover:bg-destructive/90 transition-colors disabled:opacity-50">
              <Trash2 className="w-3.5 h-3.5" /> Delete Pipeline
            </button>
          </div>
        </div>
      )}

      {activeTab === "versions" && (
        <VersionHistory pipelineId={id!} />
      )}

      {activeTab === "audit" && (
        <AuditLogsPanel entityId={id} />
      )}
    </div>
  );
};


function AuditLogsPanel({ entityId }: { entityId?: string }) {
  const { data: logs = [], isLoading } = useAuditLogs(entityId);

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;

  if (logs.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-12 flex flex-col items-center text-center">
        <Activity className="w-10 h-10 text-muted-foreground mb-3" />
        <h3 className="text-sm font-display font-semibold text-foreground">No audit logs</h3>
        <p className="text-xs text-muted-foreground mt-1">Actions on this pipeline are recorded here for security compliance.</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <table className="w-full">
        <thead>
          <tr className="border-b border-border bg-muted/30 text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
            <th className="text-left px-5 py-3">Timestamp</th>
            <th className="text-left px-5 py-3">Action</th>
            <th className="text-left px-5 py-3">Description</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {logs.map((log: AuditLog) => (
            <tr key={log.id} className="hover:bg-muted/10 transition-colors">
              <td className="px-5 py-3 text-[11px] text-muted-foreground whitespace-nowrap">
                {format(new Date(log.timestamp), "PPp")}
              </td>
              <td className="px-5 py-3 text-[11px]">
                <Badge variant="outline" className="text-[9px] font-bold px-1.5 py-0 h-4 uppercase">
                  {log.action.replace('_', ' ')}
                </Badge>
              </td>
              <td className="px-5 py-3 text-[11px] text-foreground font-medium">
                Modified by {log.performed_by?.slice(0, 8) || 'System'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RunRow({ run, expanded, onToggle, expandedTask, setExpandedTask }: {
  run: PipelineRun;
  expanded: boolean;
  onToggle: () => void;
  expandedTask: string | null;
  setExpandedTask: (k: string | null) => void;
}) {
  const statusMap: Record<string, "success" | "running" | "failed" | "pending"> = {
    success: "success", running: "running", failed: "failed", pending: "pending", cancelled: "pending", completed: "success"
  };

  return (
    <>
      <tr onClick={onToggle} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors cursor-pointer">
        <td className="px-5 py-3">{expanded ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />}</td>
        <td className="px-5 py-3 text-xs font-display text-foreground">{run.id.slice(0, 8)}</td>
        <td className="px-5 py-3"><StatusBadge status={statusMap[run.status] ?? "pending"} /></td>
        <td className="px-5 py-3 text-xs text-muted-foreground">{format(new Date(run.start_time), "PPp")}</td>
        <td className="px-5 py-3 text-xs font-display text-muted-foreground">{formatDuration(run.start_time, run.end_time)}</td>
        <td className="px-5 py-3 text-xs font-display text-muted-foreground">{(run.rows_processed ?? 0).toLocaleString()}</td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={6} className="bg-muted/5 px-5 py-3">
            <RunLogsPanel runId={run.id} expandedTask={expandedTask} setExpandedTask={setExpandedTask} errorMessage={run.error_message} />
          </td>
        </tr>
      )}
    </>
  );
}

function RunLogsPanel({ runId, expandedTask, setExpandedTask, errorMessage }: {
  runId: string; expandedTask: string | null; setExpandedTask: (k: string | null) => void; errorMessage: string | null;
}) {
  const { data: logs = [] } = useExecutionLogs({ runId });
  const { data: jobs = [] } = useWorkerJobs(runId);
  const { data: tasks = [] } = useQuery({
    queryKey: ["task_runs", runId],
    queryFn: () => apiClient.get<PipelineTaskRun[]>(`/pipelines/runs/${runId}/tasks`),
    enabled: !!runId
  });

  const displayTasks = tasks.length > 0 ? tasks : (jobs as unknown as PipelineTaskRun[]);

  const timelineTasks = displayTasks.map((t) => ({
    id: t.id,
    name: t.stage,
    status: (t.status === 'success' ? 'success' : 
            (t.status === 'failed' ? 'failed' : 
            (t.status === 'running' ? 'running' : 'pending'))) as "success" | "failed" | "running" | "pending",
    progress: t.status === 'success' ? 100 : (t.status === 'running' ? 45 : 0),
    duration: t.duration || "—"
  })) as TaskState[];

  return (
    <div className="space-y-4">
      {errorMessage && (
        <Alert variant="destructive" className="bg-destructive/5 border-destructive/20 mt-2">
          <Sparkles className="h-4 w-4" />
          <AlertTitle className="text-xs font-bold flex items-center gap-2">
            AI Failure Analysis
            <Badge variant="outline" className="text-[9px] h-4 bg-primary/10 border-primary/20 text-primary">GPT-4 Turbo</Badge>
          </AlertTitle>
          <AlertDescription className="text-xs mt-1 space-y-2">
            <p className="font-medium">Reason: <span className="text-foreground">{errorMessage}</span></p>
            <div className="p-2 rounded bg-destructive/10 border border-destructive/20">
              <p className="font-bold flex items-center gap-1.5"><CheckCircle className="w-3 h-3" /> Suggested Fix:</p>
              <p className="mt-1 opacity-90">Verify your connection credentials and ensure the network allows communication with the target database.</p>
            </div>
          </AlertDescription>
        </Alert>
      )}

      <ExecutionTimeline tasks={timelineTasks} />

      <div className="space-y-2">
      {displayTasks.map((task) => {
        const stageLogs = logs.filter((l) => l.stage === task.stage);
        const status = task.status;
        const Icon = taskIcons[task.stage] || Activity;
        const taskKey = `${runId}-${task.id}`;
        
        return (
          <div key={task.id} className="rounded-md border border-border bg-card overflow-hidden">
            <button onClick={(e) => { e.stopPropagation(); setExpandedTask(expandedTask === taskKey ? null : taskKey); }} className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-muted/20 transition-colors text-left relative overflow-hidden">
              {status === 'running' && <div className="absolute top-0 left-0 w-full h-[2px] bg-primary/20"><div className="h-full bg-primary animate-pulse w-1/3" /></div>}
              {status === 'failed' ? <XCircle className="w-3.5 h-3.5 text-destructive" /> : status === 'running' ? <Loader2 className="w-3.5 h-3.5 text-primary animate-spin" /> : status === 'success' ? <CheckCircle className="w-3.5 h-3.5 text-success" /> : <Clock className="w-3.5 h-3.5 text-muted-foreground" />}
              <Icon className="w-3.5 h-3.5 text-muted-foreground" />
              <div className="flex flex-col flex-1">
                 <span className="text-xs font-medium text-foreground capitalize">{task.stage}</span>
                 {status === "running" && (
                   <div className="mt-1 w-full max-w-[120px] h-1 rounded-full bg-muted overflow-hidden">
                     <div className="h-full bg-primary transition-all duration-300 w-[15%]" />
                   </div>
                 )}
                 {status === "retrying" && <span className="text-[10px] text-orange-500 font-display">Retrying (Attempt {task.retry_count || 1})</span>}
              </div>
              <StatusBadge status={status === 'success' ? 'success' : status === 'failed' ? 'failed' : 'pending'} />
              <Terminal className="w-3 h-3 text-muted-foreground" />
            </button>
            {expandedTask === taskKey && (
              <div className="border-t border-border bg-background px-4 py-2 space-y-0.5 max-h-48 overflow-auto">
                <p className="text-[10px] text-muted-foreground uppercase font-bold mb-1">Execution Logs</p>
                {stageLogs.map((log) => (
                  <p key={log.id} className={cn("text-[11px] font-display leading-relaxed", log.log_level === "ERROR" ? "text-destructive" : log.log_level === "WARN" ? "text-warning" : "text-muted-foreground")}>
                    <span className="opacity-50">[{format(new Date(log.timestamp), "HH:mm:ss")}]</span> {log.message}
                  </p>
                ))}
                {stageLogs.length === 0 && <p className="text-[11px] text-muted-foreground italic">No logs generated for this task yet.</p>}
              </div>
            )}
          </div>
        );
      })}
      </div>
    </div>
  );
}

export default PipelineDetail;
