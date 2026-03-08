import { usePipelineRuns } from "@/hooks/use-executions";
import { usePipelines } from "@/hooks/use-pipelines";
import { useConnections } from "@/hooks/use-connections";
import { cn } from "@/lib/utils";
import { Shield, Lock, Users, Activity, CheckCircle, XCircle, Clock, Database, Loader2 } from "lucide-react";
import { format } from "date-fns";

const Governance = () => {
  const { data: runs = [], isLoading: loadingRuns } = usePipelineRuns();
  const { data: pipelines = [] } = usePipelines();
  const { data: connections = [] } = useConnections();

  const pipelineMap = Object.fromEntries(pipelines.map((p) => [p.id, p.name]));

  // Security posture cards
  const sslConnections = connections.filter((c) => c.ssl_enabled).length;
  const totalConnections = connections.length;
  const rlsEnabled = true; // All tables have RLS

  // Audit trail = recent runs
  const recentRuns = runs.slice(0, 20);

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold text-foreground">Governance</h1>
        <p className="text-sm text-muted-foreground mt-1">Security posture, audit trail, and compliance overview</p>
      </div>

      {/* Security posture */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "RLS Policies", value: "Active", sub: "All tables protected", icon: Shield, color: "text-success" },
          { label: "SSL Connections", value: `${sslConnections}/${totalConnections}`, sub: totalConnections ? `${Math.round((sslConnections / totalConnections) * 100)}% encrypted` : "No connections", icon: Lock, color: sslConnections === totalConnections && totalConnections > 0 ? "text-success" : "text-warning" },
          { label: "Pipelines", value: `${pipelines.length}`, sub: `${pipelines.filter((p) => p.status === "active").length} active`, icon: Activity, color: "text-primary" },
          { label: "Auth Status", value: "Open (v1)", sub: "RBAC planned for Phase 6", icon: Users, color: "text-warning" },
        ].map((card) => (
          <div key={card.label} className="rounded-lg border border-border bg-card p-4">
            <div className="flex items-center gap-2 mb-2">
              <card.icon className={cn("w-4 h-4", card.color)} />
              <span className="text-xs text-muted-foreground">{card.label}</span>
            </div>
            <span className="text-lg font-display font-bold text-foreground">{card.value}</span>
            <p className="text-[10px] text-muted-foreground mt-0.5">{card.sub}</p>
          </div>
        ))}
      </div>

      {/* Data protection checklist */}
      <div className="rounded-lg border border-border bg-card p-5 space-y-3">
        <h3 className="text-sm font-display font-semibold text-foreground">Data Protection Checklist</h3>
        <div className="space-y-2">
          {[
            { check: true, label: "Row-Level Security enabled on all tables" },
            { check: true, label: "Database functions use SECURITY DEFINER where needed" },
            { check: true, label: "Cascade deletes configured for referential integrity" },
            { check: sslConnections === totalConnections && totalConnections > 0, label: "All connections use SSL/TLS encryption" },
            { check: false, label: "User authentication and RBAC enforced (Phase 6)" },
            { check: false, label: "Secrets stored in HashiCorp Vault (future)" },
          ].map((item, i) => (
            <div key={i} className="flex items-center gap-2">
              {item.check ? <CheckCircle className="w-3.5 h-3.5 text-success" /> : <XCircle className="w-3.5 h-3.5 text-muted-foreground" />}
              <span className={cn("text-xs", item.check ? "text-foreground" : "text-muted-foreground")}>{item.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Audit trail */}
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <div className="px-5 py-3 border-b border-border bg-muted/30">
          <h3 className="text-sm font-display font-semibold text-foreground">Audit Trail — Recent Pipeline Executions</h3>
        </div>
        {loadingRuns ? (
          <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
        ) : recentRuns.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">No executions recorded yet.</p>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left text-xs font-medium text-muted-foreground px-5 py-2">Pipeline</th>
                <th className="text-left text-xs font-medium text-muted-foreground px-5 py-2">Status</th>
                <th className="text-left text-xs font-medium text-muted-foreground px-5 py-2">Triggered By</th>
                <th className="text-left text-xs font-medium text-muted-foreground px-5 py-2">Started</th>
                <th className="text-left text-xs font-medium text-muted-foreground px-5 py-2">Rows</th>
              </tr>
            </thead>
            <tbody>
              {recentRuns.map((run) => (
                <tr key={run.id} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors">
                  <td className="px-5 py-2.5 text-xs text-foreground">{pipelineMap[run.pipeline_id] || run.pipeline_id.slice(0, 8)}</td>
                  <td className="px-5 py-2.5">
                    <span className={cn("text-[10px] px-2 py-0.5 rounded font-medium",
                      run.status === "success" ? "bg-success/10 text-success" :
                      run.status === "failed" ? "bg-destructive/10 text-destructive" :
                      run.status === "running" ? "bg-primary/10 text-primary" :
                      "bg-muted text-muted-foreground"
                    )}>{run.status}</span>
                  </td>
                  <td className="px-5 py-2.5 text-xs text-muted-foreground capitalize">{run.triggered_by || "manual"}</td>
                  <td className="px-5 py-2.5 text-xs text-muted-foreground">{format(new Date(run.start_time), "PPp")}</td>
                  <td className="px-5 py-2.5 text-xs font-display text-muted-foreground">{run.rows_processed.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default Governance;
