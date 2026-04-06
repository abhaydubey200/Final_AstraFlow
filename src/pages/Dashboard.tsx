import { useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import MetricCard from "@/components/MetricCard";
import StatusBadge from "@/components/StatusBadge";
import { Activity, CheckCircle, XCircle, Clock, Plus, GitBranch, Shield, TrendingUp, Database } from "lucide-react";
import DashboardSkeleton from "@/components/DashboardSkeleton";
import { OnboardingWizard } from "@/components/OnboardingWizard";
import { EmptyState } from "@/components/EmptyState";
import { cn } from "@/lib/utils";
import { usePipelines } from "@/hooks/use-pipelines";
import { usePipelineRuns } from "@/hooks/use-executions";
import { useConnections } from "@/hooks/use-connections";

const Dashboard = () => {
  const navigate = useNavigate();
  const [timeRange, setTimeRange] = useState<"24h" | "7d" | "30d">("24h");
  const [isWizardOpen, setIsWizardOpen] = useState(false);

  const { data: pipelines = [], isLoading: pipelinesLoading } = usePipelines();
  const { data: connections = [] } = useConnections();
  const { data: allRuns = [], isLoading: runsLoading } = usePipelineRuns();

  const isLoading = pipelinesLoading || runsLoading;

  const filteredRuns = useMemo(() => {
    const cutoff = timeRange === "24h" ? 24 : timeRange === "7d" ? 168 : 720;
    const since = Date.now() - cutoff * 60 * 60 * 1000;
    return allRuns.filter((r) => new Date(r.start_time).getTime() > since);
  }, [allRuns, timeRange]);

  const successRuns = filteredRuns.filter((r) => r.status === "success").length;
  const failedRuns = filteredRuns.filter((r) => r.status === "failed").length;
  const totalRows = filteredRuns.reduce((sum, r) => sum + r.rows_processed, 0);
  const successRate = filteredRuns.length > 0 ? ((successRuns / filteredRuns.length) * 100).toFixed(1) + "%" : "—";

  const avgLatency = useMemo(() => {
    const completed = filteredRuns.filter((r) => r.end_time);
    if (completed.length === 0) return "—";
    const avgMs = completed.reduce((sum, r) => sum + (new Date(r.end_time!).getTime() - new Date(r.start_time).getTime()), 0) / completed.length;
    return `${(avgMs / 60000).toFixed(1)}m`;
  }, [filteredRuns]);

  const recentRuns = allRuns.slice(0, 8);

  // Memoize pipeline name lookup for performance
  const pipelineMap = useMemo(
    () => new Map(pipelines.map((p) => [p.id, p.name])),
    [pipelines]
  );
  const getPipelineName = useCallback((id: string) => pipelineMap.get(id) || "Unknown", [pipelineMap]);

  // Memoize format functions
  const formatDuration = useCallback((start: string, end: string | null) => {
    if (!end) return "—";
    const ms = new Date(end).getTime() - new Date(start).getTime();
    return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
  }, []);

  const formatRows = useCallback((n: number) => {
    if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
    if (n >= 1000) return `${(n / 1000).toFixed(0)}K`;
    return String(n);
  }, []);

  const formatTimeAgo = useCallback((d: string) => {
    const diff = Date.now() - new Date(d).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "Just now";
    if (mins < 60) return `${mins} min ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs} hr ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  }, []);

  const statusMap = (s: string) => {
    if (s === "success") return "success" as const;
    if (s === "failed") return "failed" as const;
    if (s === "running") return "running" as const;
    return "pending" as const;
  };

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  const hasPipelines = pipelines.length > 0;

  return (
    <div className="p-6 lg:p-8 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">Pipeline overview and system health</p>
        </div>
        <div className="flex gap-1 rounded-md border border-border bg-card p-0.5">
          {(["24h", "7d", "30d"] as const).map((r) => (
            <button key={r} onClick={() => setTimeRange(r)} className={cn("px-3 py-1 rounded text-xs font-medium transition-colors", timeRange === r ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground")}>
              {r}
            </button>
          ))}
        </div>
      </div>

      {!hasPipelines ? (
        <EmptyState
          icon={GitBranch}
          title="Welcome to AstraFlow"
          description="Create your first data pipeline to start transforming and moving data across your systems. Connect to databases, transform data, and orchestrate complex workflows with ease."
          action={{
            label: "Create Your First Pipeline",
            onClick: () => navigate("/pipelines/new"),
            icon: Plus,
          }}
          secondaryAction={{
            label: "Explore Documentation",
            onClick: () => navigate("/docs"),
          }}
          className="min-h-[400px]"
        />
      ) : (
        <>
          {/* Metrics Grid - Improved Responsive Design */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
            <MetricCard
              title="Success Rate"
              value={successRate}
              icon={CheckCircle}
              trend={successRuns > 0 ? `${successRuns} successful` : undefined}
              className="hover:shadow-lg transition-shadow"
            />
            <MetricCard
              title="Total Runs"
              value={filteredRuns.length}
              icon={Activity}
              trend={`${timeRange} period`}
              className="hover:shadow-lg transition-shadow"
            />
            <MetricCard
              title="Failed Runs"
              value={failedRuns}
              icon={XCircle}
              trend={failedRuns > 0 ? "Needs attention" : "All good"}
              variant={failedRuns > 0 ? "destructive" : "default"}
              className="hover:shadow-lg transition-shadow"
            />
            <MetricCard
              title="Avg Latency"
              value={avgLatency}
              icon={Clock}
              trend={`~${totalRows > 0 ? formatRows(totalRows) : "0"} rows`}
              className="hover:shadow-lg transition-shadow"
            />
          </div>

          {/* Recent Runs Table - Enhanced */}
          <div className="rounded-lg border border-border bg-card overflow-hidden shadow-sm">
            <div className="p-6 border-b border-border bg-card/50">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-display font-bold text-foreground">Recent Pipeline Runs</h2>
                  <p className="text-sm text-muted-foreground mt-1">Latest executions across all pipelines</p>
                </div>
                <button
                  onClick={() => navigate("/logs")}
                  className="text-sm font-medium text-primary hover:text-primary/80 transition-colors flex items-center gap-1 group"
                >
                  View All
                  <Activity className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                </button>
              </div>
            </div>

            {recentRuns.length === 0 ? (
              <div className="p-12">
                <EmptyState
                  icon={TrendingUp}
                  title="No runs yet"
                  description="Execute a pipeline to see run history and metrics here."
                  action={{
                    label: "Run a Pipeline",
                    onClick: () => navigate("/pipelines"),
                  }}
                />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-muted/30">
                    <tr className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      <th className="px-6 py-3">Pipeline</th>
                      <th className="px-6 py-3">Status</th>
                      <th className="px-6 py-3">Duration</th>
                      <th className="px-6 py-3">Rows</th>
                      <th className="px-6 py-3">Started</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {recentRuns.map((run) => (
                      <tr
                        key={run.id}
                        onClick={() => navigate(`/logs?run=${run.id}`)}
                        className="hover:bg-muted/30 transition-colors cursor-pointer group"
                      >
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <GitBranch className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                            <span className="font-medium text-foreground group-hover:text-primary transition-colors">
                              {getPipelineName(run.pipeline_id)}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <StatusBadge status={statusMap(run.status)} />
                        </td>
                        <td className="px-6 py-4 text-sm text-muted-foreground font-mono">
                          {formatDuration(run.start_time, run.end_time)}
                        </td>
                        <td className="px-6 py-4 text-sm text-muted-foreground font-mono">
                          {formatRows(run.rows_processed)}
                        </td>
                        <td className="px-6 py-4 text-sm text-muted-foreground">
                          {formatTimeAgo(run.start_time)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* Onboarding Wizard */}
      <OnboardingWizard isOpen={isWizardOpen} onClose={() => setIsWizardOpen(false)} />
    </div>
  );
};

export default Dashboard;
            <GitBranch className="w-6 h-6 text-primary" />
          </div>
          <h3 className="text-sm font-display font-semibold text-foreground">No pipelines yet</h3>
          <p className="text-xs text-muted-foreground mt-1 max-w-sm">Create your first pipeline to see metrics here.</p>
          <button onClick={() => setIsWizardOpen(true)} className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors">
            <Plus className="w-3.5 h-3.5" /> Start Guided Setup
          </button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <MetricCard title="Active Pipelines" value={pipelines.filter((p) => p.status === "active").length} subtitle={`${pipelines.length} total`} icon={Activity} variant="primary" />
            <MetricCard title="Success Rate" value={successRate} subtitle={`${filteredRuns.length} runs`} icon={CheckCircle} variant="success" />
            <MetricCard title="Failed Runs" value={failedRuns} subtitle={timeRange} icon={XCircle} variant="destructive" />
            <MetricCard title="Avg Latency" value={avgLatency} subtitle="Completed runs" icon={Clock} variant="default" />
            <MetricCard title="SLA Health" value="98.2%" subtitle="2 breaches" icon={Shield} variant="primary" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-1 rounded-lg border border-border bg-card p-5 space-y-4">
              <h3 className="text-sm font-display font-semibold text-foreground">Overview</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Rows Processed</span>
                  <span className="font-display font-bold text-foreground">{formatRows(totalRows)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Connections</span>
                  <span className="font-display font-bold text-foreground">{connections.length}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Total Pipelines</span>
                  <span className="font-display font-bold text-foreground">{pipelines.length}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Total Runs</span>
                  <span className="font-display font-bold text-foreground">{allRuns.length}</span>
                </div>
              </div>
            </div>

            <div className="lg:col-span-2 rounded-lg border border-border bg-card p-5">
              <h3 className="text-sm font-display font-semibold text-foreground mb-4">Recent Pipeline Runs</h3>
              {recentRuns.length === 0 ? (
                <p className="text-xs text-muted-foreground py-4 text-center">No runs yet. Trigger a pipeline to see results here.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left text-xs font-medium text-muted-foreground px-3 py-2">Pipeline</th>
                        <th className="text-left text-xs font-medium text-muted-foreground px-3 py-2">Status</th>
                        <th className="text-left text-xs font-medium text-muted-foreground px-3 py-2">Duration</th>
                        <th className="text-left text-xs font-medium text-muted-foreground px-3 py-2">Rows</th>
                        <th className="text-left text-xs font-medium text-muted-foreground px-3 py-2">When</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentRuns.map((run) => (
                        <tr key={run.id} onClick={() => navigate(`/pipelines/${run.pipeline_id}`)} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors cursor-pointer">
                          <td className="px-3 py-2 text-sm font-medium text-foreground">{getPipelineName(run.pipeline_id)}</td>
                          <td className="px-3 py-2"><StatusBadge status={statusMap(run.status)} /></td>
                          <td className="px-3 py-2 text-xs font-display text-muted-foreground">{formatDuration(run.start_time, run.end_time)}</td>
                          <td className="px-3 py-2 text-xs font-display text-muted-foreground">{formatRows(run.rows_processed)}</td>
                          <td className="px-3 py-2 text-xs text-muted-foreground">{formatTimeAgo(run.start_time)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      <OnboardingWizard isOpen={isWizardOpen} onClose={() => setIsWizardOpen(false)} />
    </div>
  );
};

export default Dashboard;
