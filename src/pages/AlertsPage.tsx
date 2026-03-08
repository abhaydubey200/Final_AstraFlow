import { useState } from "react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/components/AuthProvider";
import { usePipelines } from "@/hooks/use-pipelines";
import {
  useNotifications, useAlertRules, useCreateAlertRule,
  useToggleAlertRule, useDeleteAlertRule, useMarkNotificationRead,
  useMarkAllRead, useUpdateAlertRule, type Notification,
} from "@/hooks/use-notifications";
import {
  Bell, Plus, Trash2, AlertTriangle, CheckCircle, Info,
  ToggleLeft, ToggleRight, Loader2, Mail, MailX,
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { toast } from "@/hooks/use-toast";

const severityConfig: Record<string, { icon: typeof Info; color: string }> = {
  error: { icon: AlertTriangle, color: "text-destructive" },
  success: { icon: CheckCircle, color: "text-success" },
  warning: { icon: AlertTriangle, color: "text-warning" },
  info: { icon: Info, color: "text-primary" },
};

const ruleTypes = [
  { value: "pipeline_failure", label: "Pipeline Failure" },
  { value: "pipeline_success", label: "Pipeline Success" },
  { value: "any_completion", label: "Any Completion" },
];

const AlertsPage = () => {
  const { user } = useAuth();
  const { data: notifications = [], isLoading: loadingNotifs } = useNotifications();
  const { data: rules = [], isLoading: loadingRules } = useAlertRules();
  const { data: pipelines = [] } = usePipelines();
  const createRule = useCreateAlertRule();
  const toggleRule = useToggleAlertRule();
  const deleteRule = useDeleteAlertRule();
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllRead();
  const updateRule = useUpdateAlertRule();

  const [tab, setTab] = useState<"notifications" | "rules">("notifications");
  const [showCreate, setShowCreate] = useState(false);
  const [newRuleName, setNewRuleName] = useState("");
  const [newRuleType, setNewRuleType] = useState("pipeline_failure");
  const [newRulePipeline, setNewRulePipeline] = useState("");
  const [newRuleEmail, setNewRuleEmail] = useState("");
  const [editingEmailId, setEditingEmailId] = useState<string | null>(null);
  const [editEmailValue, setEditEmailValue] = useState("");

  const handleCreate = () => {
    if (!newRuleName.trim()) return;
    createRule.mutate(
      {
        name: newRuleName,
        description: null,
        pipeline_id: newRulePipeline || null,
        rule_type: newRuleType,
        config: {},
        enabled: true,
        created_by: user?.id ?? null,
        notify_email: newRuleEmail.trim() || null,
      },
      {
        onSuccess: () => {
          setShowCreate(false);
          setNewRuleName("");
          setNewRuleType("pipeline_failure");
          setNewRulePipeline("");
          setNewRuleEmail("");
          toast({ title: newRuleEmail ? "Alert rule created with email notifications" : "Alert rule created" });
        },
      }
    );
  };

  const handleSaveEmail = (ruleId: string) => {
    updateRule.mutate(
      { id: ruleId, notify_email: editEmailValue.trim() || null },
      {
        onSuccess: () => {
          setEditingEmailId(null);
          toast({ title: editEmailValue.trim() ? "Email alert enabled" : "Email alert disabled" });
        },
      }
    );
  };

  const unread = notifications.filter((n) => !n.read);

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">Alerts & Notifications</h1>
          <p className="text-sm text-muted-foreground mt-1">Real-time pipeline alerts and notification rules</p>
        </div>
        {tab === "rules" && (
          <button onClick={() => setShowCreate(true)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors">
            <Plus className="w-3.5 h-3.5" /> New Rule
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border">
        {[
          { key: "notifications" as const, label: `Notifications${unread.length > 0 ? ` (${unread.length})` : ""}` },
          { key: "rules" as const, label: "Alert Rules" },
        ].map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)} className={cn("px-4 py-2 text-xs font-medium transition-colors border-b-2 -mb-px", tab === t.key ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground")}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Notifications Tab */}
      {tab === "notifications" && (
        <div className="space-y-3">
          {unread.length > 0 && (
            <div className="flex justify-end">
              <button onClick={() => markAllRead.mutate()} className="text-xs text-primary hover:underline">
                Mark all as read
              </button>
            </div>
          )}

          {loadingNotifs ? (
            <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
          ) : notifications.length === 0 ? (
            <div className="rounded-lg border border-border bg-card p-12 flex flex-col items-center text-center">
              <Bell className="w-10 h-10 text-muted-foreground mb-3" />
              <h3 className="text-sm font-display font-semibold text-foreground">No notifications</h3>
              <p className="text-xs text-muted-foreground mt-1">Notifications will appear here when alert rules are triggered.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {notifications.map((n) => {
                const cfg = severityConfig[n.severity] ?? severityConfig.info;
                const Icon = cfg.icon;
                return (
                  <div key={n.id} className={cn("rounded-lg border border-border bg-card p-4 flex gap-3 transition-colors", !n.read && "border-primary/20 bg-primary/5")}>
                    <Icon className={cn("w-5 h-5 mt-0.5 flex-shrink-0", cfg.color)} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className={cn("text-xs font-medium", n.read ? "text-muted-foreground" : "text-foreground")}>{n.title}</p>
                        {!n.read && (
                          <button onClick={() => markRead.mutate(n.id)} className="text-[10px] text-primary hover:underline flex-shrink-0">
                            Mark read
                          </button>
                        )}
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-1">{n.message}</p>
                      <p className="text-[10px] text-muted-foreground/60 mt-1.5">
                        {format(new Date(n.created_at), "PPp")}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Alert Rules Tab */}
      {tab === "rules" && (
        <div className="space-y-3">
          {/* Create form */}
          {showCreate && (
            <div className="rounded-lg border border-primary/30 bg-card p-5 space-y-4">
              <h3 className="text-sm font-display font-semibold text-foreground">New Alert Rule</h3>
              <div>
                <label className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Name</label>
                <input type="text" value={newRuleName} onChange={(e) => setNewRuleName(e.target.value)} className="w-full mt-1 px-3 py-2 rounded-md border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring" placeholder="e.g. Alert on ETL failure" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Rule Type</label>
                  <select value={newRuleType} onChange={(e) => setNewRuleType(e.target.value)} className="w-full mt-1 px-3 py-2 rounded-md border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring">
                    {ruleTypes.map((rt) => (
                      <option key={rt.value} value={rt.value}>{rt.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Pipeline (optional)</label>
                  <select value={newRulePipeline} onChange={(e) => setNewRulePipeline(e.target.value)} className="w-full mt-1 px-3 py-2 rounded-md border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring">
                    <option value="">All pipelines</option>
                    {pipelines.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold flex items-center gap-1">
                  <Mail className="w-3 h-3" /> Email Notification (optional)
                </label>
                <input
                  type="email"
                  value={newRuleEmail}
                  onChange={(e) => setNewRuleEmail(e.target.value)}
                  className="w-full mt-1 px-3 py-2 rounded-md border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                  placeholder="team@company.com"
                />
                <p className="text-[10px] text-muted-foreground mt-1">Leave empty for in-app notifications only</p>
              </div>
              <div className="flex gap-2">
                <button onClick={handleCreate} disabled={createRule.isPending} className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors disabled:opacity-50">
                  {createRule.isPending ? "Creating..." : "Create Rule"}
                </button>
                <button onClick={() => setShowCreate(false)} className="px-4 py-2 rounded-md border border-border text-xs text-muted-foreground hover:text-foreground transition-colors">
                  Cancel
                </button>
              </div>
            </div>
          )}

          {loadingRules ? (
            <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
          ) : rules.length === 0 && !showCreate ? (
            <div className="rounded-lg border border-border bg-card p-12 flex flex-col items-center text-center">
              <AlertTriangle className="w-10 h-10 text-muted-foreground mb-3" />
              <h3 className="text-sm font-display font-semibold text-foreground">No alert rules</h3>
              <p className="text-xs text-muted-foreground mt-1">Create an alert rule to get notified on pipeline events.</p>
              <button onClick={() => setShowCreate(true)} className="mt-4 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-medium">
                <Plus className="w-3.5 h-3.5" /> Create Rule
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {rules.map((rule) => {
                const pName = pipelines.find((p) => p.id === rule.pipeline_id)?.name;
                const isEditingEmail = editingEmailId === rule.id;
                return (
                  <div key={rule.id} className="rounded-lg border border-border bg-card p-4 space-y-2">
                    <div className="flex items-center gap-3">
                      <button onClick={() => toggleRule.mutate({ id: rule.id, enabled: !rule.enabled })} className="flex-shrink-0">
                        {rule.enabled ? <ToggleRight className="w-6 h-6 text-primary" /> : <ToggleLeft className="w-6 h-6 text-muted-foreground" />}
                      </button>
                      <div className="flex-1 min-w-0">
                        <p className={cn("text-xs font-medium", rule.enabled ? "text-foreground" : "text-muted-foreground")}>{rule.name}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          {ruleTypes.find((rt) => rt.value === rule.rule_type)?.label ?? rule.rule_type}
                          {pName ? ` · ${pName}` : " · All pipelines"}
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => {
                            if (isEditingEmail) {
                              setEditingEmailId(null);
                            } else {
                              setEditingEmailId(rule.id);
                              setEditEmailValue(rule.notify_email || "");
                            }
                          }}
                          className={cn(
                            "p-1.5 rounded transition-colors",
                            rule.notify_email
                              ? "text-primary hover:bg-primary/10"
                              : "text-muted-foreground hover:bg-muted"
                          )}
                          title={rule.notify_email ? `Email: ${rule.notify_email}` : "Add email alert"}
                        >
                          {rule.notify_email ? <Mail className="w-3.5 h-3.5" /> : <MailX className="w-3.5 h-3.5" />}
                        </button>
                        <button onClick={() => deleteRule.mutate(rule.id)} className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                    {isEditingEmail && (
                      <div className="flex items-center gap-2 pl-9">
                        <Mail className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                        <input
                          type="email"
                          value={editEmailValue}
                          onChange={(e) => setEditEmailValue(e.target.value)}
                          className="flex-1 px-2.5 py-1.5 rounded-md border border-border bg-background text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                          placeholder="recipient@company.com"
                          autoFocus
                        />
                        <button
                          onClick={() => handleSaveEmail(rule.id)}
                          disabled={updateRule.isPending}
                          className="px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-[10px] font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setEditingEmailId(null)}
                          className="px-2 py-1.5 text-[10px] text-muted-foreground hover:text-foreground"
                        >
                          Cancel
                        </button>
                      </div>
                    )}
                    {rule.notify_email && !isEditingEmail && (
                      <p className="text-[10px] text-muted-foreground pl-9 flex items-center gap-1">
                        <Mail className="w-3 h-3" /> {rule.notify_email}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AlertsPage;
