import { useState } from "react";
import {
  Plus, Search, CheckCircle, XCircle, Database, Snowflake, Server,
  X, Loader2, Zap, Trash2, Eye, ChevronRight, ArrowLeft, Shield,
  Clock, Table2, RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useConnections, useCreateConnection, useUpdateConnection,
  useDeleteConnection, useTestConnection, useSchemaDiscovery,
} from "@/hooks/use-connections";
import type { TestConnectionResult, SchemaTable } from "@/hooks/use-connections";
import type { Connection, ConnectionType, ConnectionFormData } from "@/types/connection";
import { DEFAULT_PORTS } from "@/types/connection";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// --- DB type configs ---
const DB_TYPES: {
  type: ConnectionType;
  label: string;
  icon: typeof Database;
  color: string;
  placeholder: { host: string; db: string };
}[] = [
  {
    type: "postgresql",
    label: "PostgreSQL",
    icon: Database,
    color: "text-blue-500",
    placeholder: { host: "db.example.com", db: "my_database" },
  },
  {
    type: "mysql",
    label: "MySQL",
    icon: Database,
    color: "text-orange-500",
    placeholder: { host: "mysql.example.com", db: "my_database" },
  },
  {
    type: "mssql",
    label: "SQL Server",
    icon: Server,
    color: "text-red-500",
    placeholder: { host: "sqlserver.example.com", db: "master" },
  },
  {
    type: "snowflake",
    label: "Snowflake",
    icon: Snowflake,
    color: "text-cyan-400",
    placeholder: { host: "acme.snowflakecomputing.com", db: "COMPUTE_WH" },
  },
];

const getDbConfig = (type: string) =>
  DB_TYPES.find((d) => d.type === type) ?? DB_TYPES[0];

const emptyForm: ConnectionFormData = {
  name: "",
  type: "postgresql",
  host: "",
  port: 5432,
  database_name: "",
  username: "",
  password: "",
  ssl_enabled: false,
  timeout_seconds: 30,
};

type Step = "type" | "details" | "test";

const Connections = () => {
  const { data: connections = [], isLoading } = useConnections();
  const createMutation = useCreateConnection();
  const updateMutation = useUpdateConnection();
  const deleteMutation = useDeleteConnection();
  const testMutation = useTestConnection();
  const schemaMutation = useSchemaDiscovery();

  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [step, setStep] = useState<Step>("type");
  const [form, setForm] = useState<ConnectionFormData>(emptyForm);
  const [testResult, setTestResult] = useState<TestConnectionResult | null>(null);
  const [search, setSearch] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Schema drawer
  const [schemaOpen, setSchemaOpen] = useState(false);
  const [schemaConn, setSchemaConn] = useState<Connection | null>(null);
  const [schemaPassword, setSchemaPassword] = useState("");
  const [schemaTables, setSchemaTables] = useState<SchemaTable[]>([]);
  const [schemaExpanded, setSchemaExpanded] = useState<string | null>(null);

  // --- Actions ---
  const openNew = () => {
    setForm(emptyForm);
    setEditingId(null);
    setTestResult(null);
    setStep("type");
    setOpen(true);
  };

  const openEdit = (conn: Connection) => {
    setForm({
      name: conn.name,
      type: conn.type as ConnectionType,
      host: conn.host,
      port: conn.port,
      database_name: conn.database_name,
      username: conn.username,
      password: "",
      ssl_enabled: conn.ssl_enabled,
      timeout_seconds: 30,
    });
    setEditingId(conn.id);
    setTestResult(null);
    setStep("details");
    setOpen(true);
  };

  const selectType = (type: ConnectionType) => {
    setForm((p) => ({ ...p, type, port: DEFAULT_PORTS[type] }));
    setStep("details");
  };

  const handleTest = async () => {
    setTestResult(null);
    try {
      const result = await testMutation.mutateAsync({
        type: form.type,
        host: form.host,
        port: form.port,
        database_name: form.database_name,
        username: form.username,
        password: form.password,
        ssl_enabled: form.ssl_enabled,
        timeout_seconds: form.timeout_seconds,
        ...(editingId ? { connection_id: editingId } : {}),
      });
      setTestResult(result);
      if (result.success) setStep("test");
    } catch (err: any) {
      setTestResult({ success: false, latency_ms: 0, error: err.message });
    }
  };

  const handleSave = async () => {
    try {
      if (editingId) {
        await updateMutation.mutateAsync({ id: editingId, ...form });
        toast({ title: "Connection updated" });
      } else {
        await createMutation.mutateAsync(form);
        toast({ title: "Connection created" });
      }
      setOpen(false);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteMutation.mutateAsync(deleteId);
      toast({ title: "Connection deleted" });
      setDeleteId(null);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const openSchema = (conn: Connection) => {
    setSchemaConn(conn);
    setSchemaPassword("");
    setSchemaTables([]);
    setSchemaExpanded(null);
    setSchemaOpen(true);
  };

  const handleDiscover = async () => {
    if (!schemaConn) return;
    try {
      const result = await schemaMutation.mutateAsync({
        connection_id: schemaConn.id,
        password: schemaPassword,
      });
      setSchemaTables(result.tables);
      if (!result.supported) {
        toast({ title: "Limited support", description: result.message });
      }
    } catch (err: any) {
      toast({ title: "Discovery failed", description: err.message, variant: "destructive" });
    }
  };

  const filtered = connections.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.host.toLowerCase().includes(search.toLowerCase()) ||
      c.type.toLowerCase().includes(search.toLowerCase())
  );

  const saving = createMutation.isPending || updateMutation.isPending;
  const dbConfig = getDbConfig(form.type);

  const canProceedToTest =
    form.name.trim() && form.host.trim() && form.database_name.trim() && form.username.trim();

  return (
    <div className="p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">Connections</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {connections.length} connection{connections.length !== 1 ? "s" : ""} configured
          </p>
        </div>
        <Button onClick={openNew} className="gap-2">
          <Plus className="w-4 h-4" /> New Connection
        </Button>
      </div>

      {/* Search */}
      {connections.length > 0 && (
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, host, or type…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      )}

      {/* Connection Cards */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-5">
                <div className="w-10 h-10 rounded-lg bg-muted mb-4" />
                <div className="h-4 bg-muted rounded w-2/3 mb-2" />
                <div className="h-3 bg-muted rounded w-1/2" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="p-16 flex flex-col items-center text-center">
            <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <Database className="w-6 h-6 text-primary" />
            </div>
            <h3 className="text-sm font-semibold text-foreground">
              {search ? "No matching connections" : "No connections yet"}
            </h3>
            <p className="text-xs text-muted-foreground mt-1 max-w-xs">
              {search
                ? "Try adjusting your search."
                : "Add your first database connection to start building data pipelines."}
            </p>
            {!search && (
              <Button onClick={openNew} size="sm" className="mt-4 gap-1.5">
                <Plus className="w-3.5 h-3.5" /> Add Connection
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((conn) => {
            const cfg = getDbConfig(conn.type);
            const Icon = cfg.icon;
            const connected = conn.status === "connected";
            return (
              <Card
                key={conn.id}
                className={cn(
                  "group cursor-pointer hover:border-primary/40 transition-all hover:shadow-md",
                  conn.status === "error" && "border-destructive/30"
                )}
                onClick={() => openEdit(conn)}
              >
                <CardContent className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div className={cn("w-10 h-10 rounded-lg bg-muted flex items-center justify-center", cfg.color)}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Badge
                        variant={connected ? "default" : "destructive"}
                        className={cn(
                          "text-[10px] h-5",
                          connected && "bg-success text-success-foreground hover:bg-success/90"
                        )}
                      >
                        {connected ? "Connected" : conn.status}
                      </Badge>
                    </div>
                  </div>

                  <h3 className="font-semibold text-sm text-foreground truncate">{conn.name}</h3>
                  <p className="text-xs text-muted-foreground mt-0.5 font-mono truncate">
                    {conn.host}:{conn.port}/{conn.database_name}
                  </p>

                  <div className="mt-4 pt-3 border-t border-border flex items-center justify-between">
                    <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {conn.last_tested_at
                        ? new Date(conn.last_tested_at).toLocaleDateString()
                        : "Never tested"}
                    </span>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {conn.status === "connected" && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={(e) => {
                            e.stopPropagation();
                            openSchema(conn);
                          }}
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 hover:text-destructive hover:bg-destructive/10"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteId(conn.id);
                        }}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* ===== New / Edit Connection Dialog ===== */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg p-0 gap-0 overflow-hidden">
          {/* Stepper header */}
          <div className="px-6 pt-5 pb-4 border-b border-border">
            <DialogHeader>
              <DialogTitle className="text-base font-display">
                {editingId ? "Edit Connection" : "New Connection"}
              </DialogTitle>
              <DialogDescription className="text-xs">
                {step === "type" && "Choose the database type to connect."}
                {step === "details" && "Enter your connection credentials."}
                {step === "test" && "Connection verified — ready to save."}
              </DialogDescription>
            </DialogHeader>
            {/* Step indicators */}
            <div className="flex items-center gap-2 mt-3">
              {(["type", "details", "test"] as Step[]).map((s, i) => (
                <div key={s} className="flex items-center gap-2">
                  <div
                    className={cn(
                      "w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-semibold transition-colors",
                      step === s
                        ? "bg-primary text-primary-foreground"
                        : (["type", "details", "test"].indexOf(step) > i
                          ? "bg-success text-success-foreground"
                          : "bg-muted text-muted-foreground")
                    )}
                  >
                    {["type", "details", "test"].indexOf(step) > i ? "✓" : i + 1}
                  </div>
                  {i < 2 && (
                    <ChevronRight className="w-3 h-3 text-muted-foreground" />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Step: Type Selection */}
          {step === "type" && (
            <div className="p-6 grid grid-cols-2 gap-3">
              {DB_TYPES.map((db) => (
                <button
                  key={db.type}
                  onClick={() => selectType(db.type)}
                  className={cn(
                    "flex items-center gap-3 p-4 rounded-lg border transition-all text-left hover:border-primary/50 hover:shadow-sm",
                    form.type === db.type
                      ? "border-primary bg-primary/5"
                      : "border-border"
                  )}
                >
                  <div className={cn("w-10 h-10 rounded-lg bg-muted flex items-center justify-center", db.color)}>
                    <db.icon className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{db.label}</p>
                    <p className="text-[10px] text-muted-foreground">Port {DEFAULT_PORTS[db.type]}</p>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Step: Connection Details */}
          {step === "details" && (
            <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
              {/* Back to type */}
              {!editingId && (
                <button
                  onClick={() => setStep("type")}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors mb-2"
                >
                  <ArrowLeft className="w-3 h-3" /> Change type
                </button>
              )}

              {/* Selected type badge */}
              <div className="flex items-center gap-2 mb-2">
                <div className={cn("w-6 h-6 rounded flex items-center justify-center bg-muted", dbConfig.color)}>
                  <dbConfig.icon className="w-3.5 h-3.5" />
                </div>
                <span className="text-xs font-medium text-foreground">{dbConfig.label}</span>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Connection Name</Label>
                <Input
                  placeholder="e.g. Production Sales DB"
                  value={form.name}
                  onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2 space-y-1.5">
                  <Label className="text-xs">
                    {form.type === "snowflake" ? "Account URL" : "Host"}
                  </Label>
                  <Input
                    placeholder={dbConfig.placeholder.host}
                    value={form.host}
                    onChange={(e) => setForm((p) => ({ ...p, host: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Port</Label>
                  <Input
                    type="number"
                    value={form.port}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, port: parseInt(e.target.value) || 0 }))
                    }
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">
                  {form.type === "snowflake" ? "Warehouse" : "Database"}
                </Label>
                <Input
                  placeholder={dbConfig.placeholder.db}
                  value={form.database_name}
                  onChange={(e) => setForm((p) => ({ ...p, database_name: e.target.value }))}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Username</Label>
                  <Input
                    value={form.username}
                    onChange={(e) => setForm((p) => ({ ...p, username: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Password</Label>
                  <Input
                    type="password"
                    value={form.password}
                    onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                <div className="flex items-center gap-2">
                  <Shield className="w-3.5 h-3.5 text-muted-foreground" />
                  <Label className="text-xs cursor-pointer">SSL / TLS</Label>
                  <Switch
                    checked={form.ssl_enabled}
                    onCheckedChange={(v) => setForm((p) => ({ ...p, ssl_enabled: v }))}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                  <Label className="text-xs">Timeout</Label>
                  <Input
                    type="number"
                    min={5}
                    max={300}
                    value={form.timeout_seconds}
                    onChange={(e) =>
                      setForm((p) => ({
                        ...p,
                        timeout_seconds: Math.max(5, Math.min(300, parseInt(e.target.value) || 30)),
                      }))
                    }
                    className="w-16 h-8 text-xs"
                  />
                  <span className="text-[10px] text-muted-foreground">sec</span>
                </div>
              </div>

              {/* Test result inline */}
              {testResult && !testResult.success && (
                <div className="flex items-start gap-2 p-3 rounded-md border border-destructive/30 bg-destructive/5">
                  <XCircle className="w-4 h-4 text-destructive mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs font-medium text-destructive">Connection failed</p>
                    {testResult.error && (
                      <p className="text-[10px] text-destructive/80 mt-0.5">{testResult.error}</p>
                    )}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" size="sm" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button
                  size="sm"
                  className="gap-1.5"
                  disabled={!canProceedToTest || testMutation.isPending}
                  onClick={handleTest}
                >
                  {testMutation.isPending ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Zap className="w-3.5 h-3.5" />
                  )}
                  {testMutation.isPending ? "Testing…" : "Test & Continue"}
                </Button>
              </div>
            </div>
          )}

          {/* Step: Test Success — Save */}
          {step === "test" && testResult?.success && (
            <div className="p-6 space-y-4">
              <div className="flex items-center gap-3 p-4 rounded-lg border border-success/30 bg-success/5">
                <CheckCircle className="w-8 h-8 text-success shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground">Connection verified!</p>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1">
                    {testResult.server_version && (
                      <span className="text-[11px] text-muted-foreground">
                        Version: <span className="text-foreground font-mono">{testResult.server_version}</span>
                      </span>
                    )}
                    <span className="text-[11px] text-muted-foreground">
                      Latency: <span className="text-foreground font-mono">{testResult.latency_ms}ms</span>
                    </span>
                    {testResult.tables_count !== undefined && (
                      <span className="text-[11px] text-muted-foreground">
                        Tables: <span className="text-foreground font-mono">{testResult.tables_count}</span>
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Summary */}
              <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-2">
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-muted-foreground">Name</span>
                    <p className="font-medium text-foreground truncate">{form.name}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Type</span>
                    <p className="font-medium text-foreground">{dbConfig.label}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Host</span>
                    <p className="font-medium text-foreground font-mono truncate">
                      {form.host}:{form.port}
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Database</span>
                    <p className="font-medium text-foreground font-mono truncate">
                      {form.database_name}
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex justify-between">
                <Button variant="outline" size="sm" onClick={() => setStep("details")}>
                  <ArrowLeft className="w-3 h-3 mr-1" /> Back
                </Button>
                <Button size="sm" className="gap-1.5" disabled={saving} onClick={handleSave}>
                  {saving ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <CheckCircle className="w-3.5 h-3.5" />
                  )}
                  {editingId ? "Update Connection" : "Save Connection"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ===== Delete Confirmation ===== */}
      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Connection</DialogTitle>
            <DialogDescription>
              This will permanently delete{" "}
              <span className="font-semibold text-foreground">
                {connections.find((c) => c.id === deleteId)?.name}
              </span>
              . Pipelines using this connection may break.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2 justify-end mt-2">
            <Button variant="outline" size="sm" onClick={() => setDeleteId(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              disabled={deleteMutation.isPending}
              onClick={handleDelete}
              className="gap-1"
            >
              {deleteMutation.isPending ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Trash2 className="w-3 h-3" />
              )}
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ===== Schema Browser Dialog ===== */}
      <Dialog open={schemaOpen} onOpenChange={setSchemaOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col p-0 gap-0">
          <div className="px-6 pt-5 pb-4 border-b border-border shrink-0">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-base font-display">
                <Table2 className="w-4 h-4 text-primary" />
                Schema Browser
                {schemaConn && (
                  <Badge variant="secondary" className="text-[10px] ml-1 font-mono">
                    {schemaConn.name}
                  </Badge>
                )}
              </DialogTitle>
              <DialogDescription className="text-xs">
                Explore tables and columns from this connection.
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {schemaTables.length === 0 ? (
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground">
                  Enter the password to discover the schema.
                </p>
                <div className="flex gap-2">
                  <Input
                    type="password"
                    placeholder="Database password"
                    value={schemaPassword}
                    onChange={(e) => setSchemaPassword(e.target.value)}
                    className="flex-1"
                  />
                  <Button
                    size="sm"
                    className="gap-1.5"
                    disabled={schemaMutation.isPending}
                    onClick={handleDiscover}
                  >
                    {schemaMutation.isPending ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <RefreshCw className="w-3.5 h-3.5" />
                    )}
                    Discover
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">
                    {schemaTables.length} table{schemaTables.length !== 1 ? "s" : ""} found
                  </p>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 gap-1 text-xs"
                    onClick={() => {
                      setSchemaTables([]);
                      setSchemaPassword("");
                    }}
                  >
                    <RefreshCw className="w-3 h-3" /> Re-scan
                  </Button>
                </div>

                <div className="space-y-1">
                  {schemaTables.map((tbl) => {
                    const key = `${tbl.schema_name}.${tbl.table_name}`;
                    const expanded = schemaExpanded === key;
                    return (
                      <div key={key} className="rounded-md border border-border overflow-hidden">
                        <button
                          onClick={() => setSchemaExpanded(expanded ? null : key)}
                          className="w-full flex items-center justify-between px-3 py-2 hover:bg-muted/50 transition-colors text-left"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <Table2 className="w-3.5 h-3.5 text-primary shrink-0" />
                            <span className="text-xs font-mono font-medium text-foreground truncate">
                              {tbl.schema_name}.{tbl.table_name}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <Badge variant="secondary" className="text-[10px] h-5">
                              ~{tbl.row_count_estimate.toLocaleString()} rows
                            </Badge>
                            <Badge variant="outline" className="text-[10px] h-5">
                              {tbl.columns.length} cols
                            </Badge>
                            <ChevronRight
                              className={cn(
                                "w-3 h-3 text-muted-foreground transition-transform",
                                expanded && "rotate-90"
                              )}
                            />
                          </div>
                        </button>
                        {expanded && (
                          <div className="border-t border-border">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead className="text-[10px] h-8">Column</TableHead>
                                  <TableHead className="text-[10px] h-8">Type</TableHead>
                                  <TableHead className="text-[10px] h-8">Nullable</TableHead>
                                  <TableHead className="text-[10px] h-8">PK</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {tbl.columns.map((col) => (
                                  <TableRow key={col.name}>
                                    <TableCell className="text-xs font-mono py-1.5">
                                      {col.name}
                                    </TableCell>
                                    <TableCell className="text-[10px] text-muted-foreground py-1.5 font-mono">
                                      {col.data_type}
                                    </TableCell>
                                    <TableCell className="py-1.5">
                                      {col.is_nullable ? (
                                        <span className="text-[10px] text-muted-foreground">yes</span>
                                      ) : (
                                        <span className="text-[10px] text-foreground font-medium">no</span>
                                      )}
                                    </TableCell>
                                    <TableCell className="py-1.5">
                                      {col.is_primary_key && (
                                        <Badge className="text-[9px] h-4 bg-primary/10 text-primary border-0">
                                          PK
                                        </Badge>
                                      )}
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Connections;
