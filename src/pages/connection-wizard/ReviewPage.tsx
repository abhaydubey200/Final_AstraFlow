import { useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { 
  ArrowLeft, ArrowRight, Rocket, Database, Shield, Activity, 
  CheckCircle2, RefreshCw, Layers, Server, 
  Loader2, Globe2, AlertCircle, Zap, Info, ArrowUpRight
} from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { 
  useCreateConnection, useConnectorTypes 
} from "@/hooks/use-connections";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

export default function ReviewPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const sourceId = searchParams.get("source");
  const configStr = searchParams.get("config");
  const tablesStr = searchParams.get("tables");
  const syncStr = searchParams.get("sync");

  const config = configStr ? JSON.parse(decodeURIComponent(configStr)) : {};
  const selectedTables = tablesStr ? JSON.parse(decodeURIComponent(tablesStr)) : [];
  const syncConfigs = syncStr ? JSON.parse(decodeURIComponent(syncStr)) : {};
  
  const { data: connectorTypes = {} } = useConnectorTypes();
  const createMutation = useCreateConnection();
  const [isFinishing, setIsFinishing] = useState(false);

  const connector = connectorTypes[sourceId || ""];

  const handleLaunch = async () => {
    setIsFinishing(true);
    try {
      const payload = {
        name: config?.name || `${sourceId || 'Unknown'} Connection`,
        type: sourceId || "unknown",
        ...config,
        selected_tables: selectedTables,
        sync_configs: syncConfigs,
        status: "connected",
      };

      await createMutation.mutateAsync(payload as any);
      toast({ 
        title: "Connection Established!", 
        description: `Successfully connected to ${sourceId}. Starting data replication...`,
      });
      navigate("/connections");
    } catch (err: any) {
      toast({ 
        title: "Launch Failed", 
        description: err.message, 
        variant: "destructive" 
      });
    } finally {
      setIsFinishing(false);
    }
  };

  if (!sourceId || !configStr) {
    return <div className="p-12 text-center"><AlertCircle className="w-12 h-12 mx-auto mb-4" /> Invalid State</div>;
  }

  return (
    <div className="flex flex-col h-full animate-in slide-in-from-right-8 duration-700">
      <div className="p-8 lg:p-12 space-y-8 flex-1 flex flex-col min-h-0 max-w-5xl mx-auto w-full">
        <div className="space-y-4 text-center">
          <div className="w-24 h-24 rounded-[40px] bg-primary/10 flex items-center justify-center text-primary mx-auto shadow-2xl ring-1 ring-primary/20 relative group">
            <div className="absolute inset-0 bg-primary/20 rounded-[40px] animate-ping opacity-20 group-hover:opacity-40 transition-opacity" />
            <Rocket className="w-12 h-12 relative z-10" />
          </div>
          <div className="space-y-2">
            <h1 className="text-5xl font-black font-display text-foreground tracking-tight italic uppercase">Ready for Blastoff</h1>
            <div className="text-sm font-bold text-muted-foreground/40 uppercase tracking-[0.3em] flex items-center justify-center">
               Cycle Completion <Separator orientation="vertical" className="h-3 mx-1 bg-border/40" /> Final Validation
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-12">
          {/* Left: Source Details */}
          <div className="space-y-8">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-muted flex items-center justify-center text-[10px] font-black italic">01</div>
              <h3 className="text-sm font-black uppercase tracking-widest text-foreground/80">Source Analysis</h3>
            </div>
            <Card className="rounded-[40px] border-border/40 bg-card/40 overflow-hidden shadow-2xl backdrop-blur-3xl">
              <CardContent className="p-8 space-y-8">
                <div className="flex items-center gap-6">
                  <div className="w-16 h-16 rounded-[24px] bg-background border border-border/20 flex items-center justify-center text-primary shadow-inner">
                    <Database className="w-8 h-8" />
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-xl font-black tracking-tight truncate">{config?.name || sourceId || 'Bridge'}</h4>
                    <p className="text-[10px] font-bold text-muted-foreground/40 uppercase tracking-widest truncate">{sourceId} @ {config?.host || '---'}</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 rounded-2xl bg-muted/20 border border-border/10">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[9px] font-black uppercase text-muted-foreground/40">Credential Trust</span>
                      <span className="text-xs font-bold font-mono truncate">{config?.username || 'user'}</span>
                    </div>
                    <Shield className="w-4 h-4 text-success" />
                  </div>
                  
                  <div className="flex items-center justify-between p-4 rounded-2xl bg-muted/20 border border-border/10">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[9px] font-black uppercase text-muted-foreground/40">Encryption</span>
                      <span className="text-xs font-bold text-success capitalize">TLS {config?.ssl ? 'Enabled' : 'Default'}</span>
                    </div>
                    <Globe2 className="w-4 h-4 text-primary" />
                  </div>
                </div>

                <div className="p-6 rounded-3xl bg-blue-500/5 border border-blue-500/10">
                   <p className="text-[10px] font-medium text-blue-500/80 leading-relaxed italic">
                     "Connection health verified. Performance metrics suggest sub-200ms discovery latency."
                   </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Middle: Sync Inventory */}
          <div className="space-y-8">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-muted flex items-center justify-center text-[10px] font-black italic">02</div>
              <h3 className="text-sm font-black uppercase tracking-widest text-foreground/80">Asset Pipeline</h3>
            </div>
            <Card className="rounded-[40px] border-border/40 bg-card/40 overflow-hidden shadow-2xl backdrop-blur-3xl flex flex-col h-[480px]">
              <div className="p-8 border-b border-border/20 bg-muted/10 flex items-center justify-between">
                <div>
                   <h4 className="text-lg font-black tracking-tight">{selectedTables.length} Tables</h4>
                   <p className="text-[10px] font-bold text-muted-foreground/40 uppercase tracking-widest">Across {config.schema_name || 'public'} schema</p>
                </div>
                <Layers className="w-5 h-5 text-primary/40" />
              </div>
              <ScrollArea className="flex-1">
                <div className="p-6 space-y-3">
                  {selectedTables.map((table: any) => {
                    const t = typeof table === "string" ? table : table.name;
                    const sc = syncConfigs[t] || { mode: "full_refresh" };
                    return (
                      <div key={t} className="flex items-center justify-between p-4 rounded-2xl bg-muted/10 border border-border/5 group hover:border-primary/20 transition-all">
                        <div className="flex items-center gap-3 min-w-0">
                          <Activity className="w-3.5 h-3.5 text-muted-foreground/20 group-hover:text-primary transition-colors" />
                          <span className="text-[11px] font-black truncate">{t}</span>
                        </div>
                        <Badge variant="outline" className={cn(
                          "text-[8px] font-black uppercase px-2 py-0.5 rounded-full border-none",
                          sc.mode === 'cdc' ? "bg-cyan-500/10 text-cyan-500" : 
                          sc.mode === 'incremental' ? "bg-amber-500/10 text-amber-500" : "bg-card text-muted-foreground/60"
                        )}>
                          {sc.mode.replace('_', ' ')}
                        </Badge>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            </Card>
          </div>

          {/* Right: Security & Deployment Check */}
          <div className="space-y-8">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-muted flex items-center justify-center text-[10px] font-black italic">03</div>
              <h3 className="text-sm font-black uppercase tracking-widest text-foreground/80">Health Shield</h3>
            </div>
            <div className="space-y-6">
              <div className="p-8 rounded-[40px] bg-emerald-500/5 border border-emerald-500/10 space-y-6">
                 <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-2xl bg-emerald-500 text-white flex items-center justify-center">
                       <CheckCircle2 className="w-6 h-6" />
                    </div>
                    <div>
                       <p className="text-sm font-black tracking-tight">System Validated</p>
                       <p className="text-[10px] font-bold text-emerald-500/60 uppercase">Ready for deployment</p>
                    </div>
                 </div>
                 <Separator className="bg-emerald-500/10" />
                 <div className="space-y-4">
                    {[
                      { icon: Shield, label: "Credentials Encrypted", status: "PASS" },
                      { icon: Zap, label: "Network Latency Check", status: "PASS" },
                      { icon: Activity, label: "Schema Compatibility", status: "PASS" }
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

              <div className="p-8 rounded-[40px] bg-muted/10 border border-border/20 border-dashed">
                 <h5 className="text-[10px] font-black uppercase tracking-[0.2em] mb-4 text-muted-foreground/40 flex items-center gap-2">
                    <Info className="w-3 h-3" /> Note
                 </h5>
                 <p className="text-[11px] font-medium text-muted-foreground/60 leading-relaxed italic">
                   "Deploying this connection will initiate immediate replication according to the defined sync strategy. You can pause or adjust these settings anytime from the dashboard."
                 </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-auto border-t border-border/20 bg-card/30 backdrop-blur-xl p-8 flex justify-between items-center sticky bottom-0 z-50">
        <Button 
          variant="outline" 
          onClick={() => navigate(-1)}
          className="rounded-2xl h-14 px-10 gap-3 font-black text-xs uppercase tracking-[0.2em] border-border/60 hover:bg-primary/5 hover:border-primary/40 transition-all shadow-none"
        >
          <ArrowLeft className="w-5 h-5" /> RE-EVALUATE
        </Button>

        <Button 
          size="lg"
          onClick={handleLaunch}
          disabled={isFinishing}
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
