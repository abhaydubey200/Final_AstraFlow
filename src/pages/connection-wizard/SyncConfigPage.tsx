import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { 
  ArrowLeft, ArrowRight, Activity, 
  Settings2, Zap, RefreshCw, Key, 
  ChevronDown, Search, CheckCircle2,
  Info
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue 
} from "@/components/ui/select";
import { 
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger 
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";

type SyncMode = "full_refresh" | "incremental" | "cdc";

interface TableSyncConfig {
  tableName: string;
  mode: SyncMode;
  cursorField?: string;
  primaryKey?: string;
  columns?: { name: string; type: string; selected: boolean }[];
}

export default function SyncConfigPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const sourceId = searchParams.get("source");
  const configStr = searchParams.get("config");
  const tablesStr = searchParams.get("tables");
  const selectedTablesList = tablesStr ? JSON.parse(decodeURIComponent(tablesStr)) : [];
  
  const [syncConfigs, setSyncConfigs] = useState<Record<string, TableSyncConfig>>({});
  const [search, setSearch] = useState("");

  useEffect(() => {
    const initial: Record<string, TableSyncConfig> = {};
    selectedTablesList.forEach((t: any) => {
      const name = typeof t === "string" ? t : t.name;
      initial[name] = {
        tableName: name,
        mode: t.recommendation?.mode || "full_refresh",
        primaryKey: t.primary_key || "",
        cursorField: t.recommended_cursor || "",
        columns: (t.columns || []).map((c: any) => ({
           name: c.name,
           type: c.type,
           selected: true
        }))
      };
    });
    setSyncConfigs(initial);
  }, [tablesStr]);

  const updateConfig = (tableName: string, field: keyof TableSyncConfig, value: any) => {
    setSyncConfigs(prev => ({
      ...prev,
      [tableName]: { ...prev[tableName], [field]: value }
    }));
  };

  const handleBulkApply = (mode: SyncMode) => {
    const next = { ...syncConfigs };
    Object.keys(next).forEach(t => {
      next[t].mode = mode;
    });
    setSyncConfigs(next);
  };

  const filteredTables = selectedTablesList.filter((t: any) => 
    (typeof t === "string" ? t : t.name).toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex flex-col h-full animate-in slide-in-from-right-8 duration-700">
      <div className="p-8 lg:p-12 space-y-8 flex-1 flex flex-col min-h-0">
        <div className="flex flex-col xl:flex-row xl:items-start justify-between gap-10">
          <div className="space-y-4">
            <Button 
              variant="ghost" 
              onClick={() => navigate(-1)}
              className="group -ml-4 text-muted-foreground hover:text-primary transition-colors"
            >
              <ArrowLeft className="w-4 h-4 mr-2 group-hover:-translate-x-1 transition-transform" />
              Change Table Selection
            </Button>
            <div className="flex items-center gap-6">
              <div className="w-16 h-16 rounded-[28px] bg-primary/10 flex items-center justify-center text-primary shadow-inner ring-1 ring-primary/20">
                <RefreshCw className="w-8 h-8" />
              </div>
              <div>
                <h1 className="text-4xl font-black font-display text-foreground tracking-tight italic uppercase">Sync Strategy</h1>
                <div className="text-sm font-bold text-muted-foreground/60 flex items-center gap-2 uppercase tracking-[0.2em]">
                   Step 04 <Separator orientation="vertical" className="h-3 mx-1 bg-border/40" /> Replication Logic
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-4 p-6 rounded-[32px] bg-card/40 border border-border/40 shadow-xl backdrop-blur-xl">
              <div className="flex flex-col gap-1 pr-4 border-r border-border/20">
                <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/40 font-mono">Bulk Control</span>
                <span className="text-[8px] font-bold text-primary italic">Apply to all {selectedTablesList.length} tables</span>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" className="h-9 px-4 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-primary/5 transition-all" onClick={() => handleBulkApply("full_refresh")}>OVERWRITE</Button>
                <Button size="sm" variant="outline" className="h-9 px-4 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-primary/5 transition-all" onClick={() => handleBulkApply("incremental")}>INCREMENTAL</Button>
                <Button size="sm" variant="outline" className="h-9 px-4 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-cyan-500/10 hover:text-cyan-500 hover:border-cyan-500/40 transition-all" onClick={() => handleBulkApply("cdc")}>CDC (LIVE)</Button>
              </div>
            </div>
          </div>
        </div>

        <div className="flex-1 min-h-0 flex flex-col gap-6">
          <div className="relative group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/40 group-focus-within:text-primary transition-colors" />
            <Input 
              placeholder="Search selected tables..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-11 h-12 bg-card/40 border-border/40 focus:ring-primary/10 rounded-2xl font-bold"
            />
          </div>

          <ScrollArea className="flex-1 -mx-4 px-4">
            <div className="grid grid-cols-1 gap-4 pb-8">
              {filteredTables.map((table: any) => {
                const tableName = typeof table === "string" ? table : table.name;
                const config = (syncConfigs[tableName] || { 
                  tableName, 
                  mode: "full_refresh",
                  primaryKey: "",
                  cursorField: "",
                  columns: []
                }) as TableSyncConfig;
                const [expanded, setExpanded] = useState(false);

                return (
                  <Card key={tableName} className="rounded-[28px] border-border/40 bg-card/40 hover:bg-card/60 transition-all group overflow-hidden">
                    <CardContent className="p-0">
                      <div className="p-8 flex flex-col lg:flex-row lg:items-center justify-between gap-8">
                        <div className="flex items-center gap-6">
                          <div className={cn(
                            "w-12 h-12 rounded-xl bg-background shadow-inner border border-border/20 flex items-center justify-center transition-all",
                            config.mode === 'cdc' ? "text-cyan-500 shadow-cyan-500/10" : "text-primary"
                          )}>
                            {config.mode === 'cdc' ? <Zap className="w-6 h-6" /> : <Activity className="w-6 h-6" />}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                               <p className="text-lg font-black text-foreground tracking-tight">{tableName}</p>
                               {table.recommendation?.mode && (
                                 <Badge variant="outline" className="bg-success/5 text-success border-success/20 text-[8px] font-black uppercase tracking-widest px-1.5 py-0 h-4">
                                   Recommended
                                 </Badge>
                               )}
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                               <Badge variant="outline" className="text-[9px] font-black uppercase tracking-widest opacity-60">Schema: {table.schema || 'public'}</Badge>
                               <div className="w-1 h-1 rounded-full bg-border" />
                               <button 
                                 onClick={() => setExpanded(!expanded)}
                                 className="text-[10px] font-black uppercase tracking-widest text-primary hover:underline flex items-center gap-1"
                               >
                                 {config.columns?.length || 0} Columns Detected <ChevronDown className={cn("w-3 h-3 transition-transform", expanded && "rotate-180")} />
                               </button>
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-6">
                          <div className="space-y-2 w-56">
                            <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/40 flex items-center gap-2 px-1">
                              Replication Mode
                            </Label>
                            <Select 
                              value={config.mode} 
                              onValueChange={(v) => updateConfig(tableName, "mode", v)}
                            >
                              <SelectTrigger className="h-12 rounded-[20px] bg-background/50 border-border/40 font-black text-xs italic">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent className="bg-card/95 backdrop-blur-xl border-border/40 rounded-[24px] p-2">
                                <SelectItem value="full_refresh" className="rounded-xl p-3 focus:bg-primary/10">
                                   <div className="flex flex-col gap-0.5">
                                      <span className="text-xs font-black uppercase tracking-widest">Full Refresh</span>
                                      <span className="text-[9px] font-medium text-muted-foreground/60">Overwrites destination on every sync</span>
                                   </div>
                                </SelectItem>
                                <SelectItem value="incremental" className="rounded-xl p-3 focus:bg-primary/10">
                                   <div className="flex flex-col gap-0.5">
                                      <span className="text-xs font-black uppercase tracking-widest">Incremental</span>
                                      <span className="text-[9px] font-medium text-muted-foreground/60">Only appends new or modified records</span>
                                   </div>
                                </SelectItem>
                                <SelectItem value="cdc" className="rounded-xl p-3 focus:bg-cyan-500/10">
                                   <div className="flex flex-col gap-0.5">
                                      <span className="text-xs font-black uppercase tracking-widest text-cyan-600">CDC (Real-time)</span>
                                      <span className="text-[9px] font-medium text-muted-foreground/60">Continuous stream of changes</span>
                                   </div>
                                </SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          {config.mode === "incremental" && (
                            <div className="space-y-2 w-56 animate-in slide-in-from-left-2 duration-300">
                               <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/40 px-1">Cursor Column</Label>
                               <div className="relative">
                                 <Activity className="absolute left-4 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/40" />
                                 <Input 
                                    placeholder="e.g. updated_at"
                                    className="h-12 pl-11 rounded-[20px] bg-background/50 border-border/40 font-mono text-xs italic"
                                    value={config.cursorField || ""}
                                    onChange={(e) => updateConfig(tableName, "cursorField", e.target.value)}
                                 />
                               </div>
                            </div>
                          )}

                          <div className="space-y-2 w-56">
                             <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/40 px-1">Primary Identifier</Label>
                             <div className="relative">
                               <Key className="absolute left-4 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/40" />
                               <Input 
                                  placeholder="e.g. unique_id"
                                  className="h-12 pl-11 rounded-[20px] bg-background/50 border-border/40 font-mono text-xs italic"
                                  value={config.primaryKey || ""}
                                  onChange={(e) => updateConfig(tableName, "primaryKey", e.target.value)}
                               />
                             </div>
                          </div>
                        </div>
                      </div>

                      {expanded && config.columns && (
                        <div className="px-8 pb-8 animate-in slide-in-from-top-4 duration-300">
                           <div className="p-6 rounded-[24px] bg-background/40 border border-border/20 shadow-inner">
                              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                                {config.columns.map((col, idx) => (
                                  <div key={idx} className="flex items-center gap-3 p-3 rounded-xl bg-card/40 border border-border/10 hover:border-primary/20 transition-all cursor-pointer">
                                    <Checkbox 
                                      checked={col.selected} 
                                      onCheckedChange={(checked) => {
                                        const nextCols = [...config.columns!];
                                        nextCols[idx] = { ...col, selected: !!checked };
                                        updateConfig(tableName, "columns", nextCols);
                                      }}
                                      className="rounded-md"
                                    />
                                    <div className="flex flex-col min-w-0">
                                       <span className="text-[11px] font-black tracking-tight truncate">{col.name}</span>
                                       <span className="text-[8px] font-bold text-muted-foreground/40 uppercase tracking-widest">{col.type}</span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                           </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </ScrollArea>
        </div>
      </div>

      <div className="mt-auto border-t border-border/20 bg-card/30 backdrop-blur-xl p-8 flex justify-end items-center sticky bottom-0">
        <Button 
          size="lg"
          onClick={() => navigate(`/connections/new/review?source=${sourceId}&config=${configStr}&tables=${tablesStr}&sync=${encodeURIComponent(JSON.stringify(syncConfigs))}`)}
          className="rounded-2xl h-14 px-10 gap-3 font-black text-xs uppercase tracking-widest shadow-2xl shadow-primary/30"
        >
          Review & Launch <CheckCircle2 className="w-5 h-5" />
        </Button>
      </div>
    </div>
  );
}
