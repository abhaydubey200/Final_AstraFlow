import { useState, useEffect } from "react";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { 
  Database, Snowflake, ChevronRight, ChevronDown, 
  Table2, Box, Globe, Loader2, RefreshCw,
  Search, HardDrive, Layout, Activity, Zap, AlertCircle
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Connection } from "@/types/connection";
import { useResourceDiscovery } from "@/hooks/use-connections";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";

// Enterprise Components
import { CapabilityView } from "./CapabilityView";
import { PerformanceTab } from "./PerformanceTab";
import { SecurityTab } from "./SecurityTab";
import { SchemaCachePanel } from "./SchemaCachePanel";

interface ConnectionExplorerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  connection: Connection | null;
}

type ExplorerNode = {
  id: string;
  label: string;
  type: "warehouse" | "database" | "schema" | "table";
  children?: string[]; // Child labels
  parentId?: string;
};

export default function ConnectionExplorer({
  open, onOpenChange, connection
}: ConnectionExplorerProps) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [treeContent, setTreeContent] = useState<Record<string, string[]>>({});
  const [loadingNodes, setLoadingNodes] = useState<Record<string, boolean>>({});
  const [errorNodes, setErrorNodes] = useState<Record<string, string>>({});
  const [search, setSearch] = useState("");

  const resourceDiscovery = useResourceDiscovery();

  useEffect(() => {
    if (open && connection) {
      setExpanded({});
      setTreeContent({});
      setLoadingNodes({});
      setErrorNodes({});
      loadRoot();
    }
  }, [open, connection]);

  const loadRoot = async () => {
    if (!connection) return;
    const target = connection.type === "snowflake" ? "warehouses" : "databases";
    setLoadingNodes({ root: true });
    setErrorNodes({});
    try {
      const { results } = await resourceDiscovery.mutateAsync({
        connection_id: connection.id,
        type: connection.type,
        host: connection.host,
        port: connection.port,
        username: connection.username,
        database_name: connection.database_name,
        schema_name: connection.schema_name,
        warehouse_name: connection.warehouse_name,
        target: target as any,
      } as any);
      setTreeContent({ root: results });
    } catch (err) {
      console.error("Root load failed:", err);
      const errorMsg = err instanceof Error ? err.message : "Failed to load resources";
      setErrorNodes({ root: errorMsg });
      toast({
        title: "Discovery Failed",
        description: errorMsg,
        variant: "destructive",
      });
    } finally {
      setLoadingNodes({ root: false });
    }
  };

  const toggleNode = async (nodeId: string, label: string, type: ExplorerNode["type"], parentId?: string) => {
    const isExpanded = !!expanded[nodeId];
    setExpanded(p => ({ ...p, [nodeId]: !isExpanded }));

    if (!isExpanded && !treeContent[nodeId] && type !== "table") {
      setLoadingNodes(p => ({ ...p, [nodeId]: true }));
      setErrorNodes(p => {
        const newErrors = { ...p };
        delete newErrors[nodeId];
        return newErrors;
      });
      try {
        let target: "databases" | "schemas" | "tables" = "databases";
        const params: any = {
          connection_id: connection!.id,
          type: connection!.type,
          host: connection!.host,
          port: connection!.port,
          username: connection!.username,
          database_name: connection!.database_name,
          schema_name: connection!.schema_name,
          warehouse_name: connection!.warehouse_name,
        };
        
        if (type === "warehouse") {
          target = "databases";
          params.warehouse_name = label;
        } else if (type === "database") {
          target = "schemas";
          params.database_name = label;
          // Extract warehouse name from parentId if present
          if (parentId && parentId.startsWith('warehouse:')) {
            // parentId format: "warehouse:NAME"
            const warehouseName = parentId.substring('warehouse:'.length);
            params.warehouse_name = warehouseName;
          }
        } else if (type === "schema") {
          target = "tables";
          params.schema_name = label;
          // Extract database name from parentId
          // parentId format: "database:NAME-warehouse:WHNAME" or just "database:NAME"
          if (parentId && parentId.startsWith('database:')) {
            // Remove "database:" prefix and extract until first "-" (which separates from parent info)
            const dbPart = parentId.substring('database:'.length);
            // Find where "-warehouse:" or "-database:" starts to isolate the actual database name
            const separatorIndex = dbPart.indexOf('-warehouse:');
            params.database_name = separatorIndex > 0 ? dbPart.substring(0, separatorIndex) : dbPart;
          }
        }

        const { results } = await resourceDiscovery.mutateAsync({
          ...params,
          target,
        });
        setTreeContent(p => ({ ...p, [nodeId]: results }));
      } catch (err) {
        console.error(`Load node ${nodeId} failed:`, err);
        const errorMsg = err instanceof Error ? err.message : "Failed to load";
        setErrorNodes(p => ({ ...p, [nodeId]: errorMsg }));
        toast({
          title: "Discovery Failed",
          description: `Could not load ${type}s: ${errorMsg}`,
          variant: "destructive",
        });
      } finally {
        setLoadingNodes(p => ({ ...p, [nodeId]: false }));
      }
    }
  };

  const renderNode = (label: string, type: ExplorerNode["type"], depth: number, parentId?: string) => {
    const nodeId = `${type}:${label}${parentId ? `-${parentId}` : ""}`;
    const isOpen = !!expanded[nodeId];
    const isLoading = !!loadingNodes[nodeId];
    const nodeError = errorNodes[nodeId];
    const children = treeContent[nodeId] || [];

    const Icon = {
      warehouse: HardDrive,
      database: Database,
      schema: Layout,
      table: Table2
    }[type];

    if (search && type === "table" && !label.toLowerCase().includes(search.toLowerCase())) return null;

    return (
      <div key={nodeId} className="select-none">
        <div 
          onClick={() => type !== "table" && toggleNode(nodeId, label, type, parentId)}
          className={cn(
            "flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer transition-colors group",
            isOpen ? "bg-primary/5 text-foreground" : "hover:bg-muted/50 text-muted-foreground",
            depth === 0 && "mt-1",
            nodeError && "bg-destructive/5 hover:bg-destructive/10"
          )}
          style={{ paddingLeft: `${depth * 16 + 8}px` }}
        >
          {type !== "table" && (
            <div className="w-4 h-4 flex items-center justify-center">
              {isLoading ? (
                <Loader2 className="w-3 h-3 animate-spin text-primary" />
              ) : nodeError ? (
                <AlertCircle className="w-3 h-3 text-destructive" />
              ) : isOpen ? (
                <ChevronDown className="w-3 h-3" />
              ) : (
                <ChevronRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
              )}
            </div>
          )}
          {type === "table" && <div className="w-4" />}
          
          <Icon className={cn(
            "w-4 h-4 shrink-0 transition-colors",
            nodeError ? "text-destructive" :
            isOpen || type === "table" ? "text-primary" : "text-muted-foreground/40 group-hover:text-primary/60"
          )} />
          
          <span className={cn(
            "text-xs font-bold truncate",
            type === "table" ? "font-mono" : "tracking-tight",
            nodeError && "text-destructive"
          )}>
            {label}
          </span>
          
          {type === "table" && (
            <span className="text-[10px] font-black uppercase tracking-tighter opacity-0 group-hover:opacity-100 transition-opacity ml-auto text-muted-foreground/40 px-1.5 py-0.5 rounded-md bg-muted">
              TABLE
            </span>
          )}
        </div>

        {isOpen && nodeError && (
          <div 
            className="text-[10px] font-medium text-destructive/80 py-1 italic px-2"
            style={{ paddingLeft: `${(depth + 1) * 16 + 32}px` }}
          >
            ⚠ {nodeError}
          </div>
        )}

        {isOpen && !nodeError && (
          <div className="animate-in slide-in-from-top-1 duration-200">
            {children.map(child => {
              const nextType = type === "warehouse" ? "database" : type === "database" ? "schema" : "table";
              // Handle both string results (warehouses, databases, schemas) and object results (tables)
              const childLabel = typeof child === 'string' ? child : (child?.name || String(child));
              return renderNode(childLabel, nextType as ExplorerNode["type"], depth + 1, nodeId);
            })}
            {children.length === 0 && !isLoading && (
              <div 
                className="text-[10px] font-bold text-muted-foreground/30 italic py-1"
                style={{ paddingLeft: `${(depth + 1) * 16 + 32}px` }}
              >
                No resources found
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  const [activeTab, setActiveTab] = useState("resources");

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-xl p-0 gap-0 overflow-hidden bg-background/95 backdrop-blur-3xl border-l border-border/20 shadow-2xl flex flex-col">
        <SheetHeader className="p-8 pb-6 border-b border-border/40 bg-muted/10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shadow-inner">
                 {connection?.type === "snowflake" ? <Snowflake className="w-7 h-7" /> : <Database className="w-7 h-7" />}
              </div>
              <div>
                <SheetTitle className="text-2xl font-black font-display tracking-tight text-foreground">Infrastructure Node</SheetTitle>
                <SheetDescription className="text-xs font-bold text-muted-foreground/60 uppercase tracking-widest flex items-center gap-2">
                  <Globe className="w-3 h-3 text-primary/60" /> {connection?.name}
                </SheetDescription>
              </div>
            </div>
            <Badge variant="outline" className="h-6 px-3 rounded-full text-[9px] font-black uppercase tracking-widest border-primary/20 bg-primary/5 text-primary">
              {connection?.type}
            </Badge>
          </div>
        </SheetHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
          <div className="px-8 border-b border-border/20 bg-muted/5">
            <TabsList className="h-14 w-full justify-start bg-transparent gap-8 p-0">
              <TabsTrigger value="resources" className="h-14 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-0 font-black text-[10px] uppercase tracking-widest gap-2">
                <Layout className="w-3.5 h-3.5" /> Resources
              </TabsTrigger>
              <TabsTrigger value="capabilities" className="h-14 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-0 font-black text-[10px] uppercase tracking-widest gap-2">
                <Zap className="w-3.5 h-3.5" /> Capabilities
              </TabsTrigger>
              <TabsTrigger value="performance" className="h-14 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-0 font-black text-[10px] uppercase tracking-widest gap-2">
                <Activity className="w-3.5 h-3.5" /> Performance
              </TabsTrigger>
              <TabsTrigger value="security" className="h-14 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-0 font-black text-[10px] uppercase tracking-widest gap-2">
                <ShieldCheck className="w-3.5 h-3.5" /> Security
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="resources" className="flex-1 flex flex-col m-0 p-0 overflow-hidden">
            <div className="px-8 py-4 border-b border-border/20 bg-muted/10">
               <div className="relative group">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/40 group-focus-within:text-primary transition-colors" />
                  <Input 
                    placeholder="Search infrastructure tree..." 
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-10 h-10 bg-background/50 border-border/30 rounded-xl text-xs font-bold placeholder:text-muted-foreground/20"
                  />
               </div>
            </div>

            <div className="flex-1 overflow-y-auto p-8 scrollbar-thin scrollbar-thumb-primary/10 hover:scrollbar-thumb-primary/20 bg-muted/5">
              {loadingNodes.root ? (
                <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
                  <div className="w-12 h-12 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/40">Initiating Discovery Protocol...</p>
                </div>
              ) : (
                <div className="space-y-1">
                   {treeContent.root?.map(rootLabel => {
                     const type = connection?.type === "snowflake" ? "warehouse" : "database";
                     return renderNode(rootLabel, type as ExplorerNode["type"], 0);
                   })}
                   {treeContent.root?.length === 0 && (
                     <div className="flex flex-col items-center justify-center h-64 text-center opacity-30">
                        <Box className="w-12 h-12 mb-4" />
                        <p className="text-xs font-black uppercase tracking-widest leading-relaxed">No accessible infrastructure nodes<br/>detected on this bridge.</p>
                     </div>
                   )}
                </div>
              )}
            </div>

            <div className="p-8 border-t border-border/40 bg-muted/10">
              <SchemaCachePanel 
                connectionId={connection?.id || ""} 
                tableCount={connection?.selected_tables?.length || 0}
                lastRefreshed={connection?.updated_at}
              />
            </div>
          </TabsContent>

          <TabsContent value="capabilities" className="flex-1 overflow-y-auto m-0 p-8 space-y-6 bg-muted/5">
            <CapabilityView capabilities={connection?.capabilities} />
          </TabsContent>

          <TabsContent value="performance" className="flex-1 overflow-y-auto m-0 p-8 space-y-6 bg-muted/5">
            <PerformanceTab performance={connection?.performance} />
          </TabsContent>

          <TabsContent value="security" className="flex-1 overflow-y-auto m-0 p-8 space-y-6 bg-muted/5">
            {connection && <SecurityTab connection={connection} />}
          </TabsContent>
        </Tabs>

        <div className="p-6 border-t border-border/40 bg-background">
           <Button 
            variant="outline"
            className="w-full h-12 rounded-2xl font-black text-[11px] uppercase tracking-widest hover:bg-primary hover:text-white transition-all duration-300"
            onClick={() => onOpenChange(false)}
           >
             Close Node Explorer
           </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function ShieldCheck(props: any) {
  return <Globe {...props} className={cn(props.className, "text-success")} />;
}

function AlertCircle(props: any) {
  return <Box {...props} className={cn(props.className, "text-warning")} />;
}
