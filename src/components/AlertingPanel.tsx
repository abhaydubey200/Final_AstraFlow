import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  Bell, Plus, Trash2, Globe, Mail, MessageSquare,
  CheckCircle, XCircle, Loader2, BellOff, AlertTriangle, Zap,
} from "lucide-react";

interface AlertRule {
  id: string;
  pipeline_id?: string | null;
  alert_name: string;
  channel: "webhook" | "email" | "slack";
  trigger_on: string[];
  webhook_url?: string | null;
  email_address?: string | null;
  slack_webhook?: string | null;
  threshold_minutes?: number;
  is_active: boolean;
  created_at?: string;
}

const TRIGGER_OPTIONS = [
  { value: "failure",           label: "Pipeline Failure",    icon: XCircle,      color: "text-red-400" },
  { value: "success",           label: "Pipeline Success",    icon: CheckCircle,  color: "text-emerald-400" },
  { value: "long_runtime",      label: "Slow Execution",      icon: AlertTriangle, color: "text-amber-400" },
  { value: "drift_detected",    label: "Schema Drift",        icon: Zap,          color: "text-purple-400" },
];
const CHANNEL_ICONS: Record<string, typeof Globe> = { webhook: Globe, email: Mail, slack: MessageSquare };

import { apiClient } from "@/lib/api-client";

function useAlerts(pipelineId?: string) {
  return useQuery({
    queryKey: ["pipeline_alerts", pipelineId],
    queryFn: async () => {
      const params = pipelineId ? { pipeline_id: pipelineId } : {};
      return apiClient.get<AlertRule[]>("/monitoring/alert-rules", params);
    },
  });
}

function useCreateAlert() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Omit<AlertRule, "id">) => {
      return apiClient.post<AlertRule>("/monitoring/alert-rules", payload);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pipeline_alerts"] }),
  });
}

function useDeleteAlert() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      return apiClient.delete(`/monitoring/alert-rules/${id}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pipeline_alerts"] }),
  });
}


export default function AlertingPanel({ pipelineId }: { pipelineId?: string }) {
  const { data: alerts = [], isLoading } = useAlerts(pipelineId);
  const createAlert = useCreateAlert();
  const deleteAlert = useDeleteAlert();
  const { toast } = useToast();

  const [showForm, setShowForm] = useState(false);
  const [filter, setFilter] = useState<"all" | "open" | "resolved">("all");
  const [alertName, setAlertName] = useState("");
  const [channel, setChannel] = useState<"webhook" | "email" | "slack">("webhook");
  const [webhookUrl, setWebhookUrl] = useState("");
  const [email, setEmail] = useState("");
  const [slackUrl, setSlackUrl] = useState("");
  const [triggers, setTriggers] = useState<string[]>(["failure"]);
  const [threshold, setThreshold] = useState(30);

  const toggleTrigger = (val: string) => {
    setTriggers(prev => prev.includes(val) ? prev.filter(t => t !== val) : [...prev, val]);
  };

  const handleCreate = () => {
    if (!alertName.trim()) { toast({ title: "Alert name is required", variant: "destructive" }); return; }
    if (triggers.length === 0) { toast({ title: "Select at least one trigger", variant: "destructive" }); return; }

    createAlert.mutate({
      pipeline_id: pipelineId || null,
      alert_name: alertName,
      channel,
      trigger_on: triggers,
      webhook_url: channel === "webhook" ? webhookUrl : null,
      email_address: channel === "email" ? email : null,
      slack_webhook: channel === "slack" ? slackUrl : null,
      threshold_minutes: threshold,
      is_active: true,
    }, {
      onSuccess: () => {
        toast({ title: "Alert created", description: `"${alertName}" will notify via ${channel}.` });
        setShowForm(false);
        setAlertName(""); setWebhookUrl(""); setEmail(""); setSlackUrl(""); setTriggers(["failure"]);
      },
      onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
    });
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bell className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">Pipeline Alerts</h3>
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-primary/10 text-primary">
            {alerts.length} configured
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex bg-muted/50 p-1 rounded-lg border border-border">
            <button onClick={() => setFilter("all")} className={cn("px-2 py-1 text-[10px] font-bold rounded-md transition-all", filter === 'all' ? "bg-background shadow-sm" : "text-muted-foreground")}>ALL</button>
            <button onClick={() => setFilter("open")} className={cn("px-2 py-1 text-[10px] font-bold rounded-md transition-all", filter === 'open' ? "bg-background shadow-sm" : "text-muted-foreground")}>OPEN</button>
          </div>
          <button
            onClick={() => setShowForm(!showForm)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20"
          >
            <Plus className="w-3.5 h-3.5" /> New Alert
          </button>
        </div>
      </div>

      {/* Create Form */}
      {showForm && (
        <div className="rounded-lg border border-primary/30 bg-card p-5 space-y-4">
          <h4 className="text-xs font-semibold text-foreground">Configure Alert</h4>
          
          <div>
            <label className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">Alert Name</label>
            <input value={alertName} onChange={e => setAlertName(e.target.value)} placeholder="e.g. Critical Failure Alert"
              className="w-full mt-1 px-3 py-2 rounded-md border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring" />
          </div>

          <div>
            <label className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">Triggers</label>
            <div className="flex flex-wrap gap-2 mt-1">
              {TRIGGER_OPTIONS.map(t => (
                <button key={t.value} onClick={() => toggleTrigger(t.value)}
                  className={cn("inline-flex items-center gap-1 px-2.5 py-1 rounded-md border text-xs font-medium transition-colors",
                    triggers.includes(t.value) ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:text-foreground")}>
                  <t.icon className={cn("w-3 h-3", triggers.includes(t.value) ? "text-primary" : t.color)} />
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">Channel</label>
            <div className="flex gap-2 mt-1">
              {(["webhook", "email", "slack"] as const).map(ch => {
                const Icon = CHANNEL_ICONS[ch];
                return (
                  <button key={ch} onClick={() => setChannel(ch)}
                    className={cn("inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-xs font-medium capitalize transition-colors",
                      channel === ch ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:text-foreground")}>
                    <Icon className="w-3 h-3" />{ch}
                  </button>
                );
              })}
            </div>
          </div>

          {channel === "webhook" && (
            <div>
              <label className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">Webhook URL</label>
              <input value={webhookUrl} onChange={e => setWebhookUrl(e.target.value)} placeholder="https://your-endpoint.com/webhook"
                className="w-full mt-1 px-3 py-2 rounded-md border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring" />
            </div>
          )}
          {channel === "email" && (
            <div>
              <label className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">Email Address</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@company.com"
                className="w-full mt-1 px-3 py-2 rounded-md border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring" />
            </div>
          )}
          {channel === "slack" && (
            <div>
              <label className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">Slack Webhook URL</label>
              <input value={slackUrl} onChange={e => setSlackUrl(e.target.value)} placeholder="https://hooks.slack.com/services/..."
                className="w-full mt-1 px-3 py-2 rounded-md border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring" />
            </div>
          )}

          {triggers.includes("long_runtime") && (
            <div>
              <label className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">Runtime Threshold (minutes)</label>
              <input type="number" value={threshold} onChange={e => setThreshold(Number(e.target.value))}
                className="w-32 mt-1 px-3 py-2 rounded-md border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring" />
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <button onClick={handleCreate} disabled={createAlert.isPending}
              className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-xs font-medium disabled:opacity-50 hover:bg-primary/90 transition-colors">
              {createAlert.isPending ? <><Loader2 className="w-3.5 h-3.5 animate-spin inline mr-1" />Creating...</> : "Create Alert"}
            </button>
            <button onClick={() => setShowForm(false)} className="px-4 py-2 rounded-md border border-border text-xs text-muted-foreground hover:text-foreground transition-colors">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Alert List */}
      {isLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
      ) : alerts.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-10 flex flex-col items-center text-center gap-3">
          <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
            <BellOff className="w-5 h-5 text-muted-foreground" />
          </div>
          <h4 className="text-sm font-semibold text-foreground">No alerts configured</h4>
          <p className="text-xs text-muted-foreground max-w-xs">Alerts notify you via Webhook, Email, or Slack when a pipeline fails, takes too long, or detects schema drift.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {alerts.map((alert: AlertRule) => {
            const Icon = CHANNEL_ICONS[alert.channel] || Globe;
            return (
              <div key={alert.id} className="flex items-start gap-3 px-4 py-3 rounded-lg border border-border bg-card hover:bg-muted/10 transition-colors">
                <div className={cn("mt-0.5 w-7 h-7 rounded-md flex items-center justify-center shrink-0", alert.is_active ? "bg-primary/10" : "bg-muted")}>
                  <Icon className={cn("w-3.5 h-3.5", alert.is_active ? "text-primary" : "text-muted-foreground")} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-foreground">{alert.alert_name}</span>
                    {!alert.is_active && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-muted text-muted-foreground">DISABLED</span>}
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    via <span className="font-medium capitalize">{alert.channel}</span> · triggers on: {(alert.trigger_on || []).join(", ")}
                  </p>
                  {alert.webhook_url && <p className="text-[10px] text-muted-foreground/70 truncate mt-0.5">{alert.webhook_url}</p>}
                  {alert.email_address && <p className="text-[10px] text-muted-foreground/70 truncate mt-0.5">{alert.email_address}</p>}
                </div>
                <button onClick={() => deleteAlert.mutate(alert.id)}
                  className="mt-0.5 text-muted-foreground/50 hover:text-destructive transition-colors shrink-0">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
