import { useState, useEffect } from "react";
import { toast } from "@/hooks/use-toast";
import {
  Dialog, DialogContent, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { 
  Box, Search,
  Globe2,
  FileText,
  Activity,
  Loader2,
  Database as DatabaseIcon,
  Layers,
  Terminal,
  Monitor,
  CheckCircle2,
  Shield,
  Zap,
  ArrowLeft
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { 
  Tooltip, 
  TooltipContent, 
  TooltipProvider, 
  TooltipTrigger 
} from "@/components/ui/tooltip";
import { ConnectionFormData, ConnectionType, DEFAULT_PORTS } from "@/types/connection";
import { TestConnectionResult } from "@/hooks/use-connections";
import { Badge } from "@/components/ui/badge";

interface WizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingId: string | null;
  form: ConnectionFormData;
  setForm: React.Dispatch<React.SetStateAction<ConnectionFormData>>;
  onTest: () => Promise<void>;
  onSave: () => Promise<void>;
  onDiscoverResources: (params: any) => Promise<{ results: (string | any)[] }>;
  testResult: TestConnectionResult | null;
  dbConfigs: any[];
  connectorTypes: Record<string, { schema: any; capabilities: any }>;
  isTesting: boolean;
  isSaving: boolean;
}

type Step = "type" | "address" | "auth" | "verify" | "warehouse" | "database" | "schema" | "tables" | "name";

export default function ConnectionWizard({
  open, onOpenChange, editingId, form, setForm, 
  onTest, onSave, onDiscoverResources, testResult, dbConfigs, connectorTypes, isTesting, isSaving
}: WizardProps) {
  const [step, setStep] = useState<Step>("type");
  const [warehouses, setWarehouses] = useState<string[]>([]);
  const [databases, setDatabases] = useState<string[]>([]);
  const [schemas, setSchemas] = useState<string[]>([]);
  const [availableTables, setAvailableTables] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isLoadingResources, setIsLoadingResources] = useState(false);

  // Filtered lists
  const filteredDatabases = databases.filter(db => db.toLowerCase().includes(searchTerm.toLowerCase()));
  const filteredSchemas = schemas.filter(s => s.toLowerCase().includes(searchTerm.toLowerCase()));
  const filteredTables = availableTables.filter(t => {
    const name = typeof t === "string" ? t : t.name;
    return name.toLowerCase().includes(searchTerm.toLowerCase());
  });

  useEffect(() => {
    if (open) {
      setStep(editingId ? "address" : "type");
      setSearchTerm("");
    }
  }, [open, editingId]);

  const selectType = (type: ConnectionType) => {
    const schema = connectorTypes[type]?.schema;
    const defaultPort = schema?.properties?.port?.default || 0;
    setForm((p) => ({ ...p, type, port: defaultPort }));
    setStep("address");
  };

  const dbConfig = dbConfigs.find(c => c.type === form.type) || dbConfigs[0];

  const handleTestAndDiscover = async () => {
    await onTest();
  };

  useEffect(() => {
    if (testResult?.success && step === "verify") {
      fetchInitialResources();
    }
  }, [testResult, step]);

  const fetchInitialResources = async () => {
    setIsLoadingResources(true);
    try {
      // Validate required fields before attempting discovery
      if (!form.type) {
        throw new Error("Connection type is required");
      }
      if (!form.host) {
        throw new Error("Host/server address is required");
      }
      if (!form.username) {
        throw new Error("Username is required");
      }
      if (!form.password) {
        throw new Error("Password is required");
      }

      if (form.type === "snowflake") {
        const { results } = await onDiscoverResources({ 
          type: form.type,
          host: form.host,
          port: form.port,
          username: form.username,
          password: form.password,
          target: "warehouses" 
        });
        setWarehouses(results);
        setStep("warehouse");
      } else {
        const { results } = await onDiscoverResources({ 
          type: form.type,
          host: form.host,
          port: form.port,
          username: form.username,
          password: form.password,
          database_name: form.database_name,
          target: "databases" 
        });
        setDatabases(results);
        setStep("database");
      }
    } catch (err: any) {
      console.error("Failed to fetch initial resources:", err);
      // Try to extract error message from Supabase FunctionsHttpError
      let errorMessage = "Failed to fetch metadata from the source.";
      if (err.detail) {
        errorMessage = err.detail;
      } else if (err.message) {
        errorMessage = err.message;
      }
      
      toast({
        title: "Discovery Failed",
        description: errorMessage,
        variant: "destructive"
      });
    } finally {
      setIsLoadingResources(false);
    }
  };

  const handleWarehouseChange = async (warehouse: string) => {
    setForm(p => ({ ...p, warehouse_name: warehouse }));
    setIsLoadingResources(true);
    try {
      const { results } = await onDiscoverResources({ 
        type: form.type,
        host: form.host,
        port: form.port,
        username: form.username,
        password: form.password,
        warehouse_name: warehouse, 
        target: "databases" 
      });
      setDatabases(results);
      setStep("database");
    } catch (err: any) {
      console.error("Failed to fetch databases:", err);
      toast({
        title: "Database Discovery Failed",
        description: err.message,
        variant: "destructive"
      });
    } finally {
      setIsLoadingResources(false);
    }
  };

  const handleDatabaseChange = async (db: string) => {
    setForm(p => ({ ...p, database_name: db, schema_name: "", selected_tables: [] }));
    setIsLoadingResources(true);
    try {
      const { results } = await onDiscoverResources({ 
        type: form.type,
        host: form.host,
        port: form.port,
        username: form.username,
        password: form.password,
        warehouse_name: form.warehouse_name,
        database_name: db, 
        target: "schemas" 
      });
      setSchemas(results);
      setStep("schema");
    } catch (err: any) {
      console.error("Failed to fetch schemas:", err);
      toast({
        title: "Schema Discovery Failed",
        description: err.message,
        variant: "destructive"
      });
    } finally {
      setIsLoadingResources(false);
    }
  };

  const handleSchemaChange = async (schema: string) => {
    setForm(p => ({ ...p, schema_name: schema, selected_tables: [] }));
    setIsLoadingResources(true);
    try {
      const { results } = await onDiscoverResources({ 
        type: form.type,
        host: form.host,
        port: form.port,
        username: form.username,
        password: form.password,
        warehouse_name: form.warehouse_name,
        database_name: form.database_name,
        schema_name: schema, 
        target: "tables" 
      });
      setAvailableTables(results);
      setStep("tables");
    } catch (err) {
      console.error("Failed to fetch tables:", err);
    } finally {
      setIsLoadingResources(false);
    }
  };

  const toggleTable = (table: any) => {
    const name = typeof table === "string" ? table : table.name;
    setForm(p => {
      const selected = p.selected_tables || [];
      const isSelected = selected.includes(name);
      return {
        ...p,
        selected_tables: isSelected 
          ? selected.filter(t => t !== name) 
          : [...selected, name]
      };
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className="max-w-2xl p-0 gap-0 overflow-hidden bg-card/95 backdrop-blur-xl border-border/50 shadow-2xl"
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <div className="flex flex-col md:flex-row h-[600px] md:h-[480px]">
          {/* Sidebar Info */}
          <div className="w-full md:w-1/3 bg-muted/30 p-8 border-r border-border/50 flex flex-col justify-between">
            <div>
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary mb-6 shadow-sm">
                {step === "type" && <Layers className="w-5 h-5" />}
                {step === "address" && <Terminal className="w-5 h-5" />}
                {step === "auth" && <Terminal className="w-5 h-5" />}
                {step === "verify" && <Monitor className="w-5 h-5" />}
                {step === "warehouse" && <Monitor className="w-5 h-5" />}
                {step === "database" && <DatabaseIcon className="w-5 h-5" />}
                {step === "schema" && <DatabaseIcon className="w-5 h-5" />}
                {step === "tables" && <Layers className="w-5 h-5" />}
                {step === "name" && <CheckCircle2 className="w-5 h-5" />}
              </div>
              <h2 className="text-xl font-bold text-foreground mb-2">
                {editingId ? "Edit" : "Add"} <br /> Connection
              </h2>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Connect your heterogeneous data sources securely to build robust, scalable pipelines.
              </p>
            </div>
            
            <div className="hidden md:block space-y-4">
              {(["type" as Step, "address" as Step, "auth" as Step, "verify" as Step, "warehouse" as Step, "database" as Step, "schema" as Step, "tables" as Step, "name" as Step]).map((s, i) => {
                const isSnowflake = form.type === "snowflake";
                if (s === "warehouse" && !isSnowflake) return null;
                
                const steps = ["type", "address", "auth", "verify", ...(isSnowflake ? ["warehouse"] : []), "database", "schema", "tables", "name"];
                const activeIdx = steps.indexOf(step as any);
                const currentIdx = steps.indexOf(s as any);

                return (
                  <div key={s} className="flex items-center gap-3">
                    <div className={cn(
                      "w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold transition-all",
                      step === s ? "bg-primary text-primary-foreground scale-110 shadow-lg shadow-primary/20" : 
                      (currentIdx < activeIdx ? "bg-success text-success-foreground" : "bg-muted text-muted-foreground")
                    )}>
                      {currentIdx < activeIdx ? "✓" : currentIdx + 1}
                    </div>
                    <span className={cn(
                      "text-[11px] font-bold uppercase tracking-wider transition-colors",
                      step === s ? "text-foreground" : "text-muted-foreground/60"
                    )}>
                      {s.replace('_', ' ')}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Content Area */}
            <form 
              className="flex-1 flex flex-col h-full bg-background/50"
              onSubmit={(e) => e.preventDefault()}
            >
              {/* Accessibility: DialogTitle and Description are required by Radix UI */}
              <div className="sr-only">
                <DialogTitle>{editingId ? "Edit" : "Add"} Connection</DialogTitle>
                <DialogDescription>Configure your data source connection parameters and discover resources.</DialogDescription>
              </div>
              
              <div className="flex-1 p-8 overflow-y-auto">
              {step === "type" && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground mb-4">Select Source Type</h3>
                    <div className="grid grid-cols-2 gap-3">
                      {Object.keys(connectorTypes).map((type) => {
                        const db = dbConfigs.find(c => c.type === type) || {
                          type,
                          label: type.charAt(0).toUpperCase() + type.slice(1),
                          icon: DatabaseIcon,
                          color: "text-primary"
                        };
                        const schema = connectorTypes[type]?.schema;
                        const defaultPort = schema?.properties?.port?.default;

                        return (
                          <button
                            key={type}
                            onClick={() => selectType(type as ConnectionType)}
                            className={cn(
                              "flex flex-col items-center gap-3 p-5 rounded-2xl border transition-all hover:shadow-xl hover:-translate-y-0.5 group text-center",
                              form.type === type ? "border-primary bg-primary/5 shadow-lg shadow-primary/5" : "border-border/60 hover:border-primary/40"
                            )}
                          >
                            <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center shadow-inner group-hover:scale-110 transition-transform", db.color, "bg-muted/50")}>
                              <db.icon className="w-6 h-6" />
                            </div>
                            <div>
                              <p className="text-sm font-bold text-foreground">{db.label}</p>
                              {defaultPort && (
                                <p className="text-[10px] text-muted-foreground opacity-60">Standard Port {defaultPort}</p>
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {step === "address" && (
                <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                  <div>
                    <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground mb-1">Step 2: Server Address</h3>
                    <p className="text-xs text-muted-foreground mb-6">Tell us where your database server is located.</p>
                    <div className="grid grid-cols-4 gap-3">
                      {/* MongoDB/File specific fields */}
                      {form.type === 'mongodb' ? (
                        <div className="col-span-4 space-y-1.5">
                          <Label className="text-[11px] font-bold uppercase tracking-tight text-muted-foreground">MongoDB Connection URI</Label>
                          <Input 
                            placeholder="mongodb+srv://username:password@cluster.mongodb.net/database"
                            value={form.uri || ""}
                            onChange={(e) => setForm(p => ({...p, uri: e.target.value}))}
                            className="h-10 bg-muted/20 border-border/50 font-mono text-xs"
                          />
                        </div>
                      ) : (form.type === 'csv' || form.type === 'json' || form.type === 'parquet') ? (
                        <div className="col-span-4 space-y-1.5">
                          <Label className="text-[11px] font-bold uppercase tracking-tight text-muted-foreground">Local File Path</Label>
                          <Input 
                            placeholder="/path/to/your/data.csv"
                            value={form.file_path || ""}
                            onChange={(e) => setForm(p => ({...p, file_path: e.target.value}))}
                            className="h-10 bg-muted/20 border-border/50 font-mono text-xs"
                          />
                        </div>
                      ) : (
                        <>
                          {connectorTypes[form.type]?.schema?.properties?.host && (
                            <div className="col-span-3 space-y-1.5">
                              <Label className="text-[11px] font-bold uppercase tracking-tight text-muted-foreground">
                                {connectorTypes[form.type]?.schema?.properties?.host?.title || (form.type === "snowflake" ? "Account URL" : "Server Address (Host/IP)")}
                              </Label>
                              <Input 
                                placeholder={connectorTypes[form.type]?.schema?.properties?.host?.description || dbConfig.placeholder.host}
                                value={form.host}
                                onChange={(e) => setForm(p => ({...p, host: e.target.value}))}
                                className="h-10 bg-muted/20 border-border/50"
                              />
                            </div>
                          )}
                          {connectorTypes[form.type]?.schema?.properties?.port && (
                            <div className="space-y-1.5">
                              <Label className="text-[11px] font-bold uppercase tracking-tight text-muted-foreground">Port</Label>
                              <Input 
                                type="number"
                                value={form.port}
                                onChange={(e) => setForm(p => ({...p, port: parseInt(e.target.value) || 0}))}
                                className="h-10 bg-muted/20 border-border/50 text-center font-mono"
                              />
                            </div>
                          )}
                        </>
                      )}
                    </div>
                    
                    {/* Render extra fields that are not host/port/username/password but are in the schema */}
                    <div className="mt-4 space-y-4">
                      {Object.entries(connectorTypes[form.type]?.schema?.properties || {})
                        .filter(([key]) => !["host", "port", "username", "password", "ssl_enabled", "name", "type"].includes(key))
                        .map(([key, prop]: [string, any]) => (
                          <div key={key} className="space-y-1.5">
                            <Label className="text-[11px] font-bold uppercase tracking-tight text-muted-foreground">{prop.title || key}</Label>
                            {prop.type === "boolean" ? (
                              <div className="flex items-center justify-between p-3 rounded-xl bg-muted/20 border border-border/30">
                                <span className="text-xs text-muted-foreground">{prop.description}</span>
                                <Switch 
                                  checked={!!(form as any)[key]}
                                  onCheckedChange={(v) => setForm(p => ({...p, [key]: v}))}
                                />
                              </div>
                            ) : (
                              <Input 
                                placeholder={prop.description}
                                value={(form as any)[key] || ""}
                                onChange={(e) => setForm(p => ({...p, [key]: e.target.value}))}
                                className="h-10 bg-muted/20 border-border/50"
                              />
                            )}
                          </div>
                        ))}
                    </div>
                    
                    <div className="mt-6 flex items-center justify-between p-3 rounded-xl bg-muted/20 border border-border/30">
                      <div className="flex items-center gap-3">
                        <Shield className="w-4 h-4 text-primary" />
                        <div>
                          <p className="text-xs font-bold text-foreground">Secure Connection</p>
                          <p className="text-[10px] text-muted-foreground">Enable SSL/TLS encryption</p>
                        </div>
                      </div>
                      <Switch 
                        checked={form.ssl_enabled}
                        onCheckedChange={(v) => setForm(p => ({...p, ssl_enabled: v}))}
                      />
                    </div>
                  </div>
                </div>
              )}

              {step === "auth" && (
                <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                  <div>
                    <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground mb-1">Step 3: Credentials</h3>
                    <p className="text-xs text-muted-foreground mb-6">Provide access credentials to authorize the connection.</p>
                    <div className="grid grid-cols-1 gap-4">
                      {connectorTypes[form.type]?.schema?.properties?.username && (
                        <div className="space-y-1.5">
                          <Label className="text-[11px] font-bold uppercase tracking-tight text-muted-foreground">
                            {connectorTypes[form.type]?.schema?.properties?.username?.title || "Username"}
                          </Label>
                          <Input 
                            value={form.username}
                            onChange={(e) => setForm(p => ({...p, username: e.target.value}))}
                            className="h-10 bg-muted/20 border-border/50"
                          />
                        </div>
                      )}
                      {connectorTypes[form.type]?.schema?.properties?.password && (
                        <div className="space-y-1.5">
                          <Label className="text-[11px] font-bold uppercase tracking-tight text-muted-foreground">
                            {connectorTypes[form.type]?.schema?.properties?.password?.title || "Password"}
                          </Label>
                          <Input 
                            type="password"
                            value={form.password}
                            onChange={(e) => setForm(p => ({...p, password: e.target.value}))}
                            className="h-10 bg-muted/20 border-border/50"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {step === "verify" && (
                <div className="space-y-6 animate-in zoom-in-95 fade-in duration-300 flex flex-col items-center justify-center h-full text-center">
                  <div className={cn(
                    "w-20 h-20 rounded-full flex items-center justify-center mb-6 transition-all duration-500",
                    isTesting ? "animate-pulse bg-primary/20" : (testResult?.success ? "bg-success/10 text-success" : "bg-primary/10 text-primary")
                  )}>
                    {isTesting ? <Loader2 className="w-10 h-10 animate-spin" /> : 
                     (testResult?.success ? <CheckCircle2 className="w-10 h-10" /> : <Zap className="w-10 h-10" />)}
                  </div>
                  <h3 className="text-xl font-bold text-foreground mb-2">
                    {isTesting ? "Verifying Credentials..." : (testResult?.success ? "Verified Successfully!" : "Test Connection")}
                  </h3>
                  <p className="text-xs text-muted-foreground max-w-[280px]">
                    {testResult?.success 
                      ? "Great! We've established a bridge. Now let's discover your available resources."
                      : "We'll attempt to reach your server to confirm the host and credentials are valid."}
                  </p>
                  
                  {!testResult?.success && !isTesting && (
                    <Button 
                      onClick={handleTestAndDiscover}
                      className="mt-8 gap-2 px-8 h-12 shadow-xl shadow-primary/20"
                    >
                      <Zap className="w-4 h-4" /> Start Verification
                    </Button>
                  )}

                  {testResult?.diagnostics && (
                    <div className="mt-6 w-full max-w-[320px] space-y-2">
                      <div className="flex items-center justify-between p-2 rounded-lg bg-muted/10 border border-border/30">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">DNS Resolution</span>
                        <span className={cn(
                          "text-[10px] font-mono",
                          testResult.diagnostics.dns_resolution === "success" ? "text-success" : "text-destructive"
                        )}>
                          {testResult.diagnostics.dns_resolution}
                        </span>
                      </div>
                      <div className="flex items-center justify-between p-2 rounded-lg bg-muted/10 border border-border/30">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Port Connectivity</span>
                        <span className={cn(
                          "text-[10px] font-mono",
                          testResult.diagnostics.tcp_connection === "success" ? "text-success" : "text-destructive"
                        )}>
                          {testResult.diagnostics.tcp_connection}
                        </span>
                      </div>
                      <div className="flex items-center justify-between p-2 rounded-lg bg-muted/10 border border-border/30">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Authentication</span>
                        <span className={cn(
                          "text-[10px] font-mono",
                          testResult.diagnostics.authentication === "success" ? "text-success" : "text-destructive"
                        )}>
                          {testResult.diagnostics.authentication}
                        </span>
                      </div>
                      {testResult.latency_ms > 0 && (
                        <div className="text-center text-[10px] text-muted-foreground/60 italic">
                          Response time: {testResult.latency_ms}ms
                        </div>
                      )}
                      
                      {!testResult.success && (
                        <div className="mt-4 p-3 rounded-lg bg-primary/5 border border-primary/20 space-y-2">
                          <p className="text-[10px] font-bold text-primary flex items-center gap-1.5">
                            <Zap className="w-3 h-3" /> Troubleshooting Recommendation:
                          </p>
                          <p className="text-[10px] text-muted-foreground leading-relaxed">
                            {testResult.diagnostics.dns_resolution !== "success" ? "Check the hostname or AWS/Azure VPC settings. Verify if the host is reachable from the AstraFlow cluster." :
                             testResult.diagnostics.tcp_connection !== "success" ? `Confirm the database port (${form.port || (form.type === 'mysql' ? 3306 : 5432)}) is open and white-listed in your firewall.` :
                             testResult.diagnostics.authentication !== "success" ? "Verify your credentials. For Cloud databases, ensure the user has sufficient permissions for remote access." :
                             "The connection established but a specific permission check failed. Check your database user grants."}
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {testResult?.error && !testResult?.diagnostics && (
                    <div className="mt-4 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-[10px] text-destructive font-mono max-w-[280px]">
                      {testResult.error}
                    </div>
                  )}
                </div>
              )}

              {step === "warehouse" && (
                <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                  <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground mb-1">Step 4: Compute Warehouse</h3>
                  <p className="text-xs text-muted-foreground mb-6">Select the Snowflake warehouse for resource discovery.</p>
                  
                  <div className="space-y-1.5">
                    <Label className="text-[11px] font-bold uppercase tracking-tight text-muted-foreground">Select Warehouse</Label>
                    <Select value={form.warehouse_name || ""} onValueChange={handleWarehouseChange}>
                      <SelectTrigger className="h-10 bg-muted/20 border-border/50">
                        <SelectValue placeholder="Choose Warehouse..." />
                      </SelectTrigger>
                      <SelectContent>
                        {warehouses.map(w => <SelectItem key={w} value={w}>{w}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}

              {step === "database" && (
                <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                  <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground mb-1">Step 5: Select Database</h3>
                  <p className="text-xs text-muted-foreground mb-6">Choose the database instance you want to interface with.</p>
                  
                  <div className="space-y-1.5">
                    <Label className="text-[11px] font-bold uppercase tracking-tight text-muted-foreground">Select Database</Label>
                    <Select value={form.database_name || ""} onValueChange={handleDatabaseChange}>
                      <SelectTrigger className="h-10 bg-muted/20 border-border/50">
                        <SelectValue placeholder="Choose Database..." />
                      </SelectTrigger>
                      <SelectContent className="bg-card/95 backdrop-blur-xl border-border/50">
                        {databases.length > 5 && (
                          <div className="p-2 border-b border-border/40">
                            <Input 
                              placeholder="Search databases..." 
                              value={searchTerm}
                              onChange={(e) => setSearchTerm(e.target.value)}
                              className="h-8 text-xs bg-muted/20"
                            />
                          </div>
                        )}
                        {filteredDatabases.map(db => <SelectItem key={db} value={db}>{db}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}

              {step === "schema" && (
                <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                  <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground mb-1">Step 6: Select Schema</h3>
                  <p className="text-xs text-muted-foreground mb-6">Refine your scope to a specific schema.</p>
                  
                  <div className="space-y-1.5">
                    <Label className="text-[11px] font-bold uppercase tracking-tight text-muted-foreground">Select Schema</Label>
                    <Select value={form.schema_name || ""} onValueChange={handleSchemaChange}>
                      <SelectTrigger className="h-10 bg-muted/20 border-border/50">
                        <SelectValue placeholder={isLoadingResources ? "Fetching..." : "Choose Schema..."} />
                      </SelectTrigger>
                      <SelectContent className="bg-card/95 backdrop-blur-xl border-border/50">
                        {schemas.length > 5 && (
                          <div className="p-2 border-b border-border/40">
                            <Input 
                              placeholder="Search schemas..." 
                              value={searchTerm}
                              onChange={(e) => setSearchTerm(e.target.value)}
                              className="h-8 text-xs bg-muted/20"
                            />
                          </div>
                        )}
                        {filteredSchemas.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}

              {step === "tables" && (
                <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300 h-full flex flex-col">
                  <div>
                    <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground mb-1">Step 7: Table Selection</h3>
                    <p className="text-xs text-muted-foreground mb-4">Whitelisting tables for integration.</p>
                  </div>
                  
                  <div className="relative mb-4">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/40" />
                    <Input 
                      placeholder="Search tables..." 
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10 h-10 bg-muted/20 border-border/40 focus:ring-primary/20 rounded-xl"
                    />
                  </div>

                  <div className="flex-1 overflow-y-auto min-h-[160px] border border-border/40 rounded-xl bg-card/10 backdrop-blur-sm p-4 space-y-2 thin-scrollbar">
                    {filteredTables.map(table => {
                      const name = typeof table === "string" ? table : table.name;
                      const isSelected = form.selected_tables?.includes(name);
                      const rec = typeof table !== "string" ? table.recommendation : null;
                      
                      return (
                        <div 
                          key={name}
                          onClick={() => toggleTable(table)}
                          className={cn(
                            "group flex items-center justify-between p-3 rounded-xl cursor-pointer transition-all border",
                            isSelected 
                              ? "bg-primary/10 border-primary/30 text-foreground shadow-sm" 
                              : "hover:bg-muted/30 border-transparent text-muted-foreground"
                          )}
                        >
                          <div className="flex items-center gap-3">
                            <div className={cn(
                              "w-5 h-5 rounded-lg border flex items-center justify-center transition-all",
                              isSelected ? "bg-primary border-primary scale-110 shadow-lg shadow-primary/20" : "border-muted-foreground/30 bg-background/50"
                            )}>
                              {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-primary-foreground" />}
                            </div>
                            <div className="flex flex-col">
                              <span className="text-xs font-bold font-mono tracking-tight">{name}</span>
                              {rec && (
                                <span className="text-[9px] text-muted-foreground/60 font-medium">
                                  {rec.reason}
                                </span>
                              )}
                            </div>
                          </div>
                          
                          {rec && (
                            <div className="flex items-center gap-2">
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <div className={cn(
                                      "px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest border border-current opacity-70 group-hover:opacity-100 transition-opacity",
                                      rec.mode === 'cdc' ? "text-cyan-500" : 
                                      rec.mode === 'incremental' ? "text-amber-500" : "text-muted-foreground"
                                    )}>
                                      {rec.mode.replace('_', ' ')}
                                    </div>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p className="text-xs">Recommended Sync Strategy</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                              
                              {table.primary_key && (
                                <Activity className="w-3 h-3 text-success/50" />
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                    {filteredTables.length === 0 && (
                      <div className="flex flex-col items-center justify-center h-full text-center p-8 opacity-40">
                         <Box className="w-8 h-8 mb-2" />
                         <p className="text-xs font-bold uppercase tracking-widest">No Tables {searchTerm ? "Matching Filter" : "Found"}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {step === "name" && (
                <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                  <div>
                    <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground mb-1">Final Step: Naming</h3>
                    <p className="text-xs text-muted-foreground mb-6">Give your connection a unique name to identify it later.</p>
                    <div className="space-y-1.5">
                      <Label className="text-[11px] font-bold uppercase tracking-tight text-muted-foreground">Display Name</Label>
                      <Input 
                        placeholder="e.g. Sales Production DB" 
                        value={form.name} 
                        onChange={(e) => setForm(p => ({...p, name: e.target.value}))}
                        className="h-10 bg-muted/20 border-border/50 focus:ring-primary/20"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-8 pt-0 flex justify-end gap-3 bg-muted/5">
              <Button variant="ghost" className="text-xs font-bold" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>

              {step !== "type" && (
                <Button variant="outline" onClick={() => {
                   const isSnowflake = form.type === "snowflake";
                   const flow: Step[] = ["type", "address", "auth", "verify", ...(isSnowflake ? ["warehouse" as Step] : []), "database" as Step, "schema" as Step, "tables" as Step, "name" as Step];
                   const idx = flow.indexOf(step);
                   if (idx > 0) setStep(flow[idx - 1]);
                }}>
                  <ArrowLeft className="w-4 h-4 mr-1.5" /> Back
                </Button>
              )}

              {step === "address" && (
                <Button 
                  onClick={() => {
                    if (form.type === 'csv' || form.type === 'json' || form.type === 'parquet' || form.type === 'mongodb') {
                      setStep("verify");
                    } else {
                      setStep("auth");
                    }
                  }} 
                  disabled={form.type === 'mongodb' ? !form.uri : ((form.type === 'csv' || form.type === 'json' || form.type === 'parquet') ? !form.file_path : !form.host.trim())}
                >
                  Next: { (form.type === 'csv' || form.type === 'json' || form.type === 'parquet' || form.type === 'mongodb') ? "Verify" : "Credentials" }
                </Button>
              )}

              {step === "auth" && (
                <Button 
                  onClick={() => setStep("verify")} 
                  disabled={!form.username.trim() || !form.password.trim()}
                >
                  Next: Verify
                </Button>
              )}

              {step === "verify" && (
                <Button 
                  onClick={() => fetchInitialResources()} 
                  disabled={!testResult?.success || isLoadingResources}
                  className="gap-2"
                >
                  {isLoadingResources && <Loader2 className="w-4 h-4 animate-spin" />}
                  Next: Explore Resources
                </Button>
              )}

              {step === "tables" && (
                <Button onClick={() => setStep("name")}>
                  Next: Finalize
                </Button>
              )}

              {step === "name" && (
                <Button 
                  disabled={isSaving || !form.name.trim() || !testResult?.success}
                  onClick={onSave}
                  className="gap-2 px-8 h-10 shadow-lg shadow-primary/25"
                >

                  {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  Finish Setup
                </Button>
              )}
            </div>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
