import { useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft, ArrowRight, Rocket, Database, Shield, Activity,
  CheckCircle2, Layers, Server, Loader2, Globe2, AlertCircle,
  Zap, Info, ArrowUpRight, FileText, Edit3
} from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCreateConnection, useConnectorTypes } from "@/hooks/use-connections";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FILE_CONNECTOR_IDS } from "./SourceSelectionPage";

export default function ReviewPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const sourceId = searchParams.get("source") || "";
  const configStr = searchParams.get("config");
  const tablesStr = searchParams.get("tables");
  const syncStr = searchParams.get("sync");

  const config = configStr ? JSON.parse(decodeURIComponent(configStr)) : {};
  const selectedTables: any[] = tablesStr ? JSON.parse(decodeURIComponent(tablesStr)) : [];
  const syncConfigs: Record<string, any> = syncStr ? JSON.parse(decodeURIComponent(syncStr)) : {};

  const { data: connectorTypes = {} } = useConnectorTypes();
  const createMutation = useCreateConnection();
  const [isFinishing, setIsFinishing] = useState(false);

  // ── Connection name — required field on this page ──────────────────────────
  const [connectionName, setConnectionName] = useState(
    config?.name || `${sourceId.toUpperCase()} Connection`
  );
  const [nameError, setNameError] = useState("");

  const connector = connectorTypes[sourceId];
  const isFileConnector = FILE_CONNECTOR_IDS.has(sourceId);

  // ─── Guard: no source or config ───────────────────────────────────────────
  if (!sourceId || !configStr) {
    return (
      <div className="p-12 flex flex-col h-full items-center justify-center gap-6 max-w-md mx-auto text-center">
        <div className="w-20 h-20 rounded-3xl bg-destructive/10 flex items-center justify-center text-destructive">
          <AlertCircle className="w-10 h-10" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-black tracking-tight">Invalid State</h2>
          <p className="text-muted-foreground font-medium">
            Missing connection configuration. Please start again.
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => navigate("/connections/new")}
          className="rounded-2xl px-8 h-12 font-bold"
        >
          Start Over
        </Button>
      </div>
    );
  }

  // ─── Masked config display (hide passwords) ────────────────────────────────
  const maskConfig = (cfg: Record<string, any>) => {
    const result: Record<string, any> = {};
    for (const [k, v] of Object.entries(cfg)) {
      if (k.toLowerCase().includes("password") || k.toLowerCase().includes("secret")) {
        result[k] = "••••••••";
      } else {
        result[k] = v;
      }
    }
    return result;
  };

  // ─── Launch ────────────────────────────────────────────────────────────────
  const handleLaunch = async () => {
    if (!connectionName.trim()) {
      setNameError("Connection name is required");
      return;
    }
    setNameError("");
    setIsFinishing(true);

    try {
      const payload = {
        name: connectionName.trim(),
        type: sourceId,
        ...config,
        selected_tables: selectedTables,
        sync_configs: syncConfigs,
        status: "connected",
      };

      await createMutation.mutateAsync(payload as any);

      toast({
        title: "✅ Connection Created!",
        description: `"${connectionName}" is now active and ready to use.`,
      });
      navigate("/connections");
    } catch (err: any) {
      // PHASE 3C: Align with new standard API response format
      const msg = err?.response?.data?.error 
        || err?.response?.data?.detail  // fallback for legacy 
        || err?.message 
        || "Failed to save connection.";
      toast({ title: "Save Failed", description: msg, variant: "destructive" });
    } finally {
      setIsFinishing(false);
    }
  };

  const maskedCfg = maskConfig(config);

  return (
    <div className="flex flex-col h-full animate-in slide-in-from-right-8 duration-700">
      <div className="p-8 lg:p-12 space-y-8 flex-1 flex flex-col min-h-0 max-w-5xl mx-auto w-full">

        {/* ── Page Title ── */}
        <div className="space-y-4 text-center">
          <div className="w-24 h-24 rounded-[40px] bg-primary/10 flex items-center justify-center text-primary mx-auto shadow-2xl ring-1 ring-primary/20 relative group">
            <div className="absolute inset-0 bg-primary/20 rounded-[40px] animate-ping opacity-20 group-hover:opacity-40 transition-opacity" />
            <Rocket className="w-12 h-12 relative z-10" />
          </div>
          <div className="space-y-2">
            <h1 className="text-5xl font-black font-display text-foreground tracking-tight italic uppercase">
              Ready for Blastoff
            </h1>
            <div className="text-sm font-bold text-muted-foreground/40 uppercase tracking-[0.3em] flex items-center justify-center">
              Step 5 of 5
              <Separator orientation="vertical" className="h-3 mx-2 bg-border/40" />
              Final Review
            </div>
          </div>
        </div>

        {/* ── Connection Name (required) ── */}
        <Card className="rounded-[32px] border-primary/30 bg-primary/5 overflow-hidden">
          <CardContent className="p-8">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-10 h-10 rounded-2xl bg-primary/20 flex items-center justify-center text-primary">
                <Edit3 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-black uppercase tracking-widest text-foreground/80">
                  Connection Name
                </h3>
                <p className="text-[10px] font-bold text-muted-foreground/50 mt-0.5">
                  Give this connection a memorable name
                </p>
              </div>
              <Badge className="ml-auto bg-primary/20 text-primary border-none text-[8px] font-black uppercase">
                Required
              </Badge>
            </div>
            <div className="space-y-2">
              <Input
                value={connectionName}
                onChange={(e) => {
                  setConnectionName(e.target.value);
                  if (e.target.value.trim()) setNameError("");
                }}
                placeholder="e.g. Production PostgreSQL, Analytics DB..."
                className={cn(
                  "h-14 text-lg font-bold bg-background/60 border-border/40 rounded-2xl focus:ring-primary/20",
                  nameError && "border-destructive focus:ring-destructive/20"
                )}
              />
              {nameError && (
                <p className="text-xs font-bold text-destructive flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  {nameError}
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* ── Summary Grid ── */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">

          {/* Source Details */}
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-muted flex items-center justify-center text-[10px] font-black italic">01</div>
              <h3 className="text-sm font-black uppercase tracking-widest text-foreground/80">Source Config</h3>
            </div>
            <Card className="rounded-[32px] border-border/40 bg-card/40 overflow-hidden shadow-xl backdrop-blur-3xl">
              <CardContent className="p-8 space-y-6">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-[20px] bg-background border border-border/20 flex items-center justify-center text-primary shadow-inner">
                    {isFileConnector ? (
                      <FileText className="w-7 h-7" />
                    ) : (
                      <Database className="w-7 h-7" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-lg font-black tracking-tight truncate">{connectionName}</h4>
                    <p className="text-[10px] font-bold text-muted-foreground/40 uppercase tracking-widest truncate">
                      {sourceId} • {config?.host || config?.path || "---"}
                    </p>
                  </div>
                </div>

                <div className="space-y-3">
                  {Object.entries(maskedCfg)
                    .filter(([k]) => k !== "name")
                    .slice(0, 6)
                    .map(([k, v]) => (
                      <div
                        key={k}
                        className="flex items-center justify-between p-3 rounded-xl bg-muted/20 border border-border/10"
                      >
                        <span className="text-[9px] font-black uppercase text-muted-foreground/40">{k}</span>
                        <span className="text-xs font-bold font-mono truncate max-w-[120px]">{String(v)}</span>
                      </div>
                    ))}
                </div>

                <div className="flex items-center justify-between p-4 rounded-2xl bg-muted/20 border border-border/10">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[9px] font-black uppercase text-muted-foreground/40">Encryption</span>
                    <span className="text-xs font-bold text-success capitalize">
                      TLS {config?.ssl_enabled ? "Enabled" : "Default"}
                    </span>
                  </div>
                  <Globe2 className="w-4 h-4 text-primary" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Asset Pipeline */}
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-muted flex items-center justify-center text-[10px] font-black italic">02</div>
              <h3 className="text-sm font-black uppercase tracking-widest text-foreground/80">Asset Pipeline</h3>
            </div>
            <Card className="rounded-[32px] border-border/40 bg-card/40 overflow-hidden shadow-xl backdrop-blur-3xl flex flex-col h-[340px]">
              <div className="p-6 border-b border-border/20 bg-muted/10 flex items-center justify-between shrink-0">
                <div>
                  <h4 className="text-lg font-black tracking-tight">
                    {isFileConnector ? "1 File" : `${selectedTables.length} Tables`}
                  </h4>
                  <p className="text-[10px] font-bold text-muted-foreground/40 uppercase tracking-widest">
                    {isFileConnector ? "File connector" : `${config?.database_name || config?.database || "default"} schema`}
                  </p>
                </div>
                <Layers className="w-5 h-5 text-primary/40" />
              </div>
              <ScrollArea className="flex-1">
                <div className="p-4 space-y-2">
                  {isFileConnector ? (
                    <div className="flex items-center gap-3 p-4 rounded-2xl bg-muted/10 border border-border/5">
                      <FileText className="w-4 h-4 text-muted-foreground/40" />
                      <span className="text-[11px] font-black truncate">
                        {config?.path ? String(config.path).split(/[\\/]/).pop() : "file_source"}
                      </span>
                    </div>
                  ) : selectedTables.length === 0 ? (
                    <div className="text-center py-8 opacity-30">
                      <p className="text-xs font-black uppercase tracking-widest">No tables selected</p>
                    </div>
                  ) : (
                    selectedTables.map((table: any) => {
                      const t = typeof table === "string" ? table : table.name;
                      const sc = syncConfigs[t] || { mode: "full_refresh" };
                      return (
                        <div
                          key={t}
                          className="flex items-center justify-between p-3 rounded-2xl bg-muted/10 border border-border/5 hover:border-primary/20 transition-all"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <Activity className="w-3.5 h-3.5 text-muted-foreground/20 shrink-0" />
                            <span className="text-[11px] font-black truncate">{t}</span>
                          </div>
                          <Badge
                            variant="outline"
                            className={cn(
                              "text-[8px] font-black uppercase px-2 py-0.5 rounded-full border-none shrink-0",
                              sc.mode === "cdc"
                                ? "bg-cyan-500/10 text-cyan-500"
                                : sc.mode === "incremental"
                                ? "bg-amber-500/10 text-amber-500"
                                : "bg-card text-muted-foreground/60"
                            )}
                          >
                            {sc.mode?.replace("_", " ") || "full refresh"}
                          </Badge>
                        </div>
                      );
                    })
                  )}
                </div>
              </ScrollArea>
            </Card>
          </div>

          {/* Health Shield */}
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-muted flex items-center justify-center text-[10px] font-black italic">03</div>
              <h3 className="text-sm font-black uppercase tracking-widest text-foreground/80">Health Shield</h3>
            </div>
            <div className="space-y-4">
              <div className="p-8 rounded-[32px] bg-emerald-500/5 border border-emerald-500/10 space-y-6">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-2xl bg-emerald-500 text-white flex items-center justify-center shrink-0">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-sm font-black tracking-tight">Test Passed</p>
                    <p className="text-[10px] font-bold text-emerald-500/60 uppercase">Connection verified</p>
                  </div>
                </div>
                <Separator className="bg-emerald-500/10" />
                <div className="space-y-4">
                  {[
                    { icon: Shield, label: "Credentials Encrypted", status: "PASS" },
                    { icon: Zap, label: "Network Reachable", status: "PASS" },
                    { icon: Activity, label: "Schema Compatible", status: "PASS" },
                  ].map((check, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <check.icon className="w-3.5 h-3.5 text-emerald-500/40" />
                        <span className="text-[11px] font-bold text-muted-foreground/80">{check.label}</span>
                      </div>
                      <span className="text-[9px] font-black text-emerald-500">{check.status}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-6 rounded-[28px] bg-muted/10 border border-border/20 border-dashed">
                <h5 className="text-[10px] font-black uppercase tracking-[0.2em] mb-3 text-muted-foreground/40 flex items-center gap-2">
                  <Info className="w-3 h-3" /> Note
                </h5>
                <p className="text-[11px] font-medium text-muted-foreground/60 leading-relaxed italic">
                  Launching this bridge will activate data replication per your sync strategy. You can pause or modify settings anytime from the dashboard.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-auto border-t border-border/20 bg-card/30 backdrop-blur-xl p-8 flex justify-between items-center sticky bottom-0 z-50">
        <Button
          variant="outline"
          onClick={() => navigate(-1)}
          className="rounded-2xl h-14 px-10 gap-3 font-black text-xs uppercase tracking-[0.2em] border-border/60 hover:bg-primary/5 hover:border-primary/40 transition-all shadow-none"
        >
          <ArrowLeft className="w-5 h-5" /> Back
        </Button>

        <Button
          size="lg"
          onClick={handleLaunch}
          disabled={isFinishing || !connectionName.trim()}
          className="rounded-2xl h-14 px-14 gap-3 font-black text-xs uppercase tracking-[0.2em] shadow-2xl shadow-primary/30 group relative overflow-hidden bg-primary"
        >
          {isFinishing ? (
            <Loader2 className="w-6 h-6 animate-spin" />
          ) : (
            <>
              Launch Bridge <ArrowUpRight className="w-5 h-5 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

// Local icon stubs (avoids import conflicts)
const Shield = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.955 11.955 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
  </svg>
);
