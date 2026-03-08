import { useState } from "react";
import { cn } from "@/lib/utils";
import { Settings, Shield, Bell, Info, Key, Trash2, Plus, Globe, Lock, CheckCircle, Copy } from "lucide-react";

const tabs = [
  { key: "general" as const, label: "General", icon: Settings },
  { key: "security" as const, label: "Security", icon: Shield },
  { key: "notifications" as const, label: "Notifications", icon: Bell },
  { key: "about" as const, label: "About", icon: Info },
];

const apiKeys = [
  { name: "Production API Key", created: "2026-02-15", lastUsed: "2 hrs ago", prefix: "ask_prod_****" },
  { name: "CI/CD Pipeline Key", created: "2026-01-20", lastUsed: "5 min ago", prefix: "ask_cicd_****" },
];

const SettingsPage = () => {
  const [activeTab, setActiveTab] = useState<"general" | "security" | "notifications" | "about">("general");
  const [platformName, setPlatformName] = useState("AstraETL");
  const [timezone, setTimezone] = useState("UTC");
  const [retention, setRetention] = useState(90);
  const [sessionTimeout, setSessionTimeout] = useState(30);
  const [emailOnFail, setEmailOnFail] = useState(true);
  const [emailOnSuccess, setEmailOnSuccess] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState("");

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold text-foreground">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">Platform configuration and preferences</p>
      </div>

      <div className="flex gap-6">
        {/* Tab nav */}
        <div className="w-48 space-y-1 flex-shrink-0">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                "flex items-center gap-2 w-full px-3 py-2 rounded-md text-xs transition-colors text-left",
                activeTab === tab.key ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-muted"
              )}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="flex-1 max-w-2xl space-y-5">
          {activeTab === "general" && (
            <>
              <div className="rounded-lg border border-border bg-card p-5 space-y-4">
                <h3 className="text-sm font-display font-semibold text-foreground">General</h3>
                <div>
                  <label className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Platform Name</label>
                  <input type="text" value={platformName} onChange={(e) => setPlatformName(e.target.value)} className="w-full mt-1 px-3 py-2 rounded-md border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring" />
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Default Timezone</label>
                  <select value={timezone} onChange={(e) => setTimezone(e.target.value)} className="w-full mt-1 px-3 py-2 rounded-md border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring">
                    <option value="UTC">UTC</option>
                    <option value="US/Eastern">US/Eastern</option>
                    <option value="US/Pacific">US/Pacific</option>
                    <option value="Europe/London">Europe/London</option>
                    <option value="Asia/Tokyo">Asia/Tokyo</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Data Retention (days)</label>
                  <input type="number" value={retention} onChange={(e) => setRetention(Number(e.target.value))} className="w-full mt-1 px-3 py-2 rounded-md border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring" />
                </div>
                <button className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors">
                  Save Changes
                </button>
              </div>
            </>
          )}

          {activeTab === "security" && (
            <>
              <div className="rounded-lg border border-border bg-card p-5 space-y-4">
                <h3 className="text-sm font-display font-semibold text-foreground">Encryption</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center gap-2 p-3 rounded-md bg-muted/30 border border-border">
                    <Lock className="w-4 h-4 text-success" />
                    <div>
                      <p className="text-xs font-medium text-foreground">TLS 1.2+</p>
                      <p className="text-[10px] text-muted-foreground">Data in transit</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 p-3 rounded-md bg-muted/30 border border-border">
                    <Shield className="w-4 h-4 text-success" />
                    <div>
                      <p className="text-xs font-medium text-foreground">AES-256</p>
                      <p className="text-[10px] text-muted-foreground">Data at rest</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-lg border border-border bg-card p-5 space-y-4">
                <h3 className="text-sm font-display font-semibold text-foreground">Session</h3>
                <div>
                  <label className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Session Timeout (minutes)</label>
                  <input type="number" value={sessionTimeout} onChange={(e) => setSessionTimeout(Number(e.target.value))} className="w-full mt-1 px-3 py-2 rounded-md border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring" />
                </div>
              </div>

              <div className="rounded-lg border border-border bg-card p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-display font-semibold text-foreground">API Keys</h3>
                  <button className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors">
                    <Plus className="w-3 h-3" /> Generate Key
                  </button>
                </div>
                <div className="space-y-2">
                  {apiKeys.map((key, i) => (
                    <div key={i} className="flex items-center gap-3 p-3 rounded-md border border-border">
                      <Key className="w-4 h-4 text-muted-foreground" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-foreground">{key.name}</p>
                        <p className="text-[10px] text-muted-foreground font-display">{key.prefix}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] text-muted-foreground">Created: {key.created}</p>
                        <p className="text-[10px] text-muted-foreground">Last used: {key.lastUsed}</p>
                      </div>
                      <button className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {activeTab === "notifications" && (
            <div className="rounded-lg border border-border bg-card p-5 space-y-4">
              <h3 className="text-sm font-display font-semibold text-foreground">Notifications</h3>
              <div className="space-y-3">
                <label className="flex items-center justify-between cursor-pointer">
                  <div>
                    <p className="text-xs text-foreground">Email on pipeline failure</p>
                    <p className="text-[10px] text-muted-foreground">Receive an email when any pipeline fails</p>
                  </div>
                  <button
                    onClick={() => setEmailOnFail(!emailOnFail)}
                    className={cn("w-9 h-5 rounded-full transition-colors relative", emailOnFail ? "bg-primary" : "bg-muted")}
                  >
                    <span className={cn("absolute top-0.5 w-4 h-4 rounded-full bg-foreground transition-transform", emailOnFail ? "left-4" : "left-0.5")} />
                  </button>
                </label>
                <label className="flex items-center justify-between cursor-pointer">
                  <div>
                    <p className="text-xs text-foreground">Email on pipeline success</p>
                    <p className="text-[10px] text-muted-foreground">Receive an email when pipelines complete</p>
                  </div>
                  <button
                    onClick={() => setEmailOnSuccess(!emailOnSuccess)}
                    className={cn("w-9 h-5 rounded-full transition-colors relative", emailOnSuccess ? "bg-primary" : "bg-muted")}
                  >
                    <span className={cn("absolute top-0.5 w-4 h-4 rounded-full bg-foreground transition-transform", emailOnSuccess ? "left-4" : "left-0.5")} />
                  </button>
                </label>
              </div>
              <div className="pt-3 border-t border-border">
                <label className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Webhook URL</label>
                <input
                  type="text"
                  placeholder="https://hooks.slack.com/..."
                  value={webhookUrl}
                  onChange={(e) => setWebhookUrl(e.target.value)}
                  className="w-full mt-1 px-3 py-2 rounded-md border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
              <button className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors">
                Save Notifications
              </button>
            </div>
          )}

          {activeTab === "about" && (
            <div className="rounded-lg border border-border bg-card p-5 space-y-4">
              <h3 className="text-sm font-display font-semibold text-foreground">About AstraETL</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 rounded-md bg-muted/30 border border-border">
                  <span className="text-xs text-muted-foreground">Version</span>
                  <span className="text-xs font-display text-foreground">1.0.0-beta</span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-md bg-muted/30 border border-border">
                  <span className="text-xs text-muted-foreground">License</span>
                  <span className="text-xs font-display text-foreground">Enterprise</span>
                </div>
              </div>
              <div className="pt-3 border-t border-border">
                <h4 className="text-xs font-display font-semibold text-foreground mb-3">System Health</h4>
                <div className="space-y-2">
                  {[
                    { name: "API Server", status: "healthy" },
                    { name: "Database", status: "healthy" },
                    { name: "Spark Cluster", status: "healthy" },
                    { name: "Airflow Scheduler", status: "healthy" },
                  ].map((svc) => (
                    <div key={svc.name} className="flex items-center justify-between p-2 rounded-md border border-border">
                      <span className="text-xs text-foreground">{svc.name}</span>
                      <div className="flex items-center gap-1.5">
                        <CheckCircle className="w-3.5 h-3.5 text-success" />
                        <span className="text-xs text-success capitalize">{svc.status}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
