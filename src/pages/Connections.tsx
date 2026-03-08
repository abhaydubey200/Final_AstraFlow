import { useState } from "react";
import { Plus, Search, CheckCircle, XCircle, Database, Server, Globe, X, Loader2, Zap, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useConnections, useCreateConnection, useUpdateConnection, useDeleteConnection, useTestConnection, useSchemaDiscovery } from "@/hooks/use-connections";
import type { TestConnectionResult, SchemaTable } from "@/hooks/use-connections";
import type { Connection, ConnectionType, ConnectionFormData } from "@/types/connection";
import { CONNECTION_TYPE_LABELS, DEFAULT_PORTS } from "@/types/connection";
import { toast } from "@/hooks/use-toast";

const connectionTypes: { type: ConnectionType; label: string; icon: typeof Database }[] = [
  { type: "mssql", label: "SQL Server", icon: Database },
  { type: "snowflake", label: "Snowflake", icon: Server },
  { type: "postgresql", label: "PostgreSQL", icon: Database },
  { type: "mysql", label: "MySQL", icon: Database },
];

const getIcon = (type: string) => connectionTypes.find((c) => c.type === type)?.icon || Database;

const emptyForm: ConnectionFormData = {
  name: "", type: "mssql", host: "", port: 1433, database_name: "", username: "", password: "", ssl_enabled: false,
};

const Connections = () => {
  const { data: connections = [], isLoading } = useConnections();
  const createMutation = useCreateConnection();
  const updateMutation = useUpdateConnection();
  const deleteMutation = useDeleteConnection();

  const testConnection = useTestConnection();
  const schemaDiscovery = useSchemaDiscovery();

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<TestConnectionResult | null>(null);
  const [formData, setFormData] = useState<ConnectionFormData>(emptyForm);
  const [search, setSearch] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [schemaData, setSchemaData] = useState<SchemaTable[] | null>(null);
  const [showSchema, setShowSchema] = useState(false);

  const openNew = () => {
    setFormData(emptyForm);
    setEditingId(null);
    setTestResult(null);
    setShowForm(true);
  };

  const openEdit = (conn: Connection) => {
    setFormData({
      name: conn.name,
      type: conn.type as ConnectionType,
      host: conn.host,
      port: conn.port,
      database_name: conn.database_name,
      username: conn.username,
      password: "",
      ssl_enabled: conn.ssl_enabled,
    });
    setEditingId(conn.id);
    setTestResult(null);
    setShowForm(true);
  };

  const handleTypeChange = (type: ConnectionType) => {
    setFormData((prev) => ({ ...prev, type, port: DEFAULT_PORTS[type] }));
    setTestResult(null);
  };

  const handleTestConnection = async () => {
    setTestResult(null);
    try {
      const result = await testConnection.mutateAsync({
        type: formData.type,
        host: formData.host,
        port: formData.port,
        database_name: formData.database_name,
        username: formData.username,
        password: formData.password,
        ssl_enabled: formData.ssl_enabled,
        ...(editingId ? { connection_id: editingId } : {}),
      });
      setTestResult(result);
    } catch (err: any) {
      setTestResult({ success: false, latency_ms: 0, error: err.message });
    }
  };

  const handleDiscoverSchema = async (connId: string) => {
    try {
      const result = await schemaDiscovery.mutateAsync({ connection_id: connId, password: formData.password || "" });
      setSchemaData(result.tables);
      setShowSchema(true);
    } catch (err: any) {
      toast({ title: "Schema discovery failed", description: err.message, variant: "destructive" });
    }
  };

  const handleSave = async () => {
    try {
      if (editingId) {
        await updateMutation.mutateAsync({ id: editingId, ...formData });
        toast({ title: "Connection updated" });
      } else {
        await createMutation.mutateAsync(formData);
        toast({ title: "Connection created" });
      }
      setShowForm(false);
      setTestResult(null);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteMutation.mutateAsync(id);
      toast({ title: "Connection deleted" });
      setShowDeleteConfirm(null);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const filtered = connections.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()) || c.host.toLowerCase().includes(search.toLowerCase())
  );

  const saving = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">Connections</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage source and destination connections</p>
        </div>
        <button onClick={openNew} className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors">
          <Plus className="w-4 h-4" /> New Connection
        </button>
      </div>

      {/* Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-lg border border-border bg-card shadow-xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h2 className="text-sm font-display font-semibold text-foreground">{editingId ? "Edit Connection" : "New Connection"}</h2>
              <button onClick={() => { setShowForm(false); setTestResult(null); }} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
            </div>
            <div className="px-6 py-5 space-y-4 max-h-[70vh] overflow-y-auto">
              <div>
                <label className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Connection Type</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2">
                  {connectionTypes.map((ct) => (
                    <button key={ct.type} onClick={() => handleTypeChange(ct.type)} className={cn("flex flex-col items-center gap-1.5 p-3 rounded-md border text-xs transition-colors", formData.type === ct.type ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:text-foreground hover:border-muted-foreground/30")}>
                      <ct.icon className="w-5 h-5" />{ct.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Connection Name</label>
                <input type="text" placeholder="e.g. Production Sales DB" value={formData.name} onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))} className="w-full mt-1 px-3 py-2 rounded-md border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring" />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">{formData.type === "snowflake" ? "Account URL" : "Host"}</label>
                  <input type="text" placeholder={formData.type === "snowflake" ? "acme.snowflakecomputing.com" : "hostname.example.com"} value={formData.host} onChange={(e) => setFormData((p) => ({ ...p, host: e.target.value }))} className="w-full mt-1 px-3 py-2 rounded-md border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Port</label>
                  <input type="number" value={formData.port} onChange={(e) => setFormData((p) => ({ ...p, port: parseInt(e.target.value) || 0 }))} className="w-full mt-1 px-3 py-2 rounded-md border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring" />
                </div>
              </div>
              <div>
                <label className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">{formData.type === "snowflake" ? "Warehouse" : "Database"}</label>
                <input type="text" placeholder={formData.type === "snowflake" ? "COMPUTE_WH" : "database_name"} value={formData.database_name} onChange={(e) => setFormData((p) => ({ ...p, database_name: e.target.value }))} className="w-full mt-1 px-3 py-2 rounded-md border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Username</label>
                  <input type="text" value={formData.username} onChange={(e) => setFormData((p) => ({ ...p, username: e.target.value }))} className="w-full mt-1 px-3 py-2 rounded-md border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Password</label>
                  <input type="password" value={formData.password} onChange={(e) => setFormData((p) => ({ ...p, password: e.target.value }))} className="w-full mt-1 px-3 py-2 rounded-md border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring" />
                </div>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={formData.ssl_enabled} onChange={(e) => setFormData((p) => ({ ...p, ssl_enabled: e.target.checked }))} className="rounded border-border" />
                <span className="text-xs text-muted-foreground">Enable SSL/TLS</span>
              </label>
              {testResult && (
                <div className={cn("flex items-center gap-2 p-3 rounded-md border", testResult.success ? "border-success/30 bg-success/5" : "border-destructive/30 bg-destructive/5")}>
                  {testResult.success ? <CheckCircle className="w-4 h-4 text-success" /> : <XCircle className="w-4 h-4 text-destructive" />}
                  <div className="flex-1">
                    <span className={cn("text-xs font-medium", testResult.success ? "text-success" : "text-destructive")}>
                      {testResult.success ? "Connection successful!" : "Connection failed."}
                    </span>
                    {testResult.server_version && (
                      <span className="text-[10px] text-muted-foreground ml-2">{testResult.server_version} • {testResult.latency_ms}ms</span>
                    )}
                    {testResult.tables_count !== undefined && testResult.success && (
                      <span className="text-[10px] text-muted-foreground ml-2">• {testResult.tables_count} tables found</span>
                    )}
                    {testResult.error && <p className="text-[10px] text-destructive mt-1">{testResult.error}</p>}
                  </div>
                </div>
              )}
            </div>
            <div className="flex items-center justify-between px-6 py-4 border-t border-border">
              <button onClick={handleTestConnection} disabled={testConnection.isPending} className="inline-flex items-center gap-2 px-4 py-2 rounded-md border border-border text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50">
                {testConnection.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
                {testConnection.isPending ? "Testing..." : "Test Connection"}
              </button>
              <div className="flex gap-2">
                <button onClick={() => { setShowForm(false); setTestResult(null); }} className="px-4 py-2 rounded-md border border-border text-xs text-muted-foreground hover:text-foreground transition-colors">Cancel</button>
                <button
                  onClick={handleSave}
                  disabled={!testResult?.success || saving}
                  className={cn("px-4 py-2 rounded-md text-xs font-medium transition-colors", testResult?.success && !saving ? "bg-primary text-primary-foreground hover:bg-primary/90" : "bg-muted text-muted-foreground cursor-not-allowed")}
                >
                  {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : editingId ? "Update Connection" : "Save Connection"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-lg border border-border bg-card shadow-xl p-6 space-y-4">
            <h3 className="text-sm font-display font-semibold text-foreground">Delete Connection</h3>
            <p className="text-xs text-muted-foreground">
              This will permanently delete <span className="text-foreground font-medium">{connections.find((c) => c.id === showDeleteConfirm)?.name}</span>. Pipelines using this connection may break.
            </p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowDeleteConfirm(null)} className="px-3 py-1.5 rounded-md border border-border text-xs text-muted-foreground hover:text-foreground transition-colors">Cancel</button>
              <button onClick={() => handleDelete(showDeleteConfirm)} disabled={deleteMutation.isPending} className="px-3 py-1.5 rounded-md bg-destructive text-destructive-foreground text-xs font-medium hover:bg-destructive/90 transition-colors">
                {deleteMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <><Trash2 className="w-3 h-3 inline mr-1" /> Delete</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input type="text" placeholder="Search connections..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full pl-9 pr-4 py-2 rounded-md border border-border bg-card text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring" />
      </div>

      {/* Loading */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-lg border border-border bg-card p-5 animate-pulse">
              <div className="w-10 h-10 rounded-lg bg-muted mb-4" />
              <div className="h-4 bg-muted rounded w-2/3 mb-2" />
              <div className="h-3 bg-muted rounded w-1/3 mb-1" />
              <div className="h-3 bg-muted rounded w-full" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-16 flex flex-col items-center text-center">
          <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mb-4">
            <Database className="w-6 h-6 text-primary" />
          </div>
          <h3 className="text-sm font-display font-semibold text-foreground">
            {search ? "No matching connections" : "No connections configured"}
          </h3>
          <p className="text-xs text-muted-foreground mt-1">
            {search ? "Try adjusting your search." : "Add your first connection to start building pipelines."}
          </p>
          {!search && (
            <button onClick={openNew} className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-primary text-primary-foreground text-xs font-medium">
              <Plus className="w-3.5 h-3.5" /> Add Connection
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((conn) => {
            const Icon = getIcon(conn.type);
            const isConnected = conn.status === "connected";
            return (
              <div
                key={conn.id}
                onClick={() => openEdit(conn)}
                className={cn("rounded-lg border bg-card p-5 hover:border-primary/30 transition-colors cursor-pointer group relative", conn.status === "error" ? "border-destructive/30" : "border-border")}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center"><Icon className="w-5 h-5 text-primary" /></div>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1.5">
                      {isConnected ? <CheckCircle className="w-4 h-4 text-success" /> : <XCircle className="w-4 h-4 text-destructive" />}
                      <span className={cn("text-xs font-medium", isConnected ? "text-success" : "text-destructive")}>{isConnected ? "Connected" : conn.status}</span>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); setShowDeleteConfirm(conn.id); }}
                      className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                <h3 className="text-sm font-semibold text-foreground">{conn.name}</h3>
                <p className="text-xs text-muted-foreground mt-1 font-display uppercase">{conn.type}</p>
                <p className="text-xs text-muted-foreground mt-0.5 truncate">{conn.host}:{conn.port}</p>
                <div className="mt-4 pt-3 border-t border-border flex items-center justify-between">
                  <span className="text-[10px] text-muted-foreground">
                    {conn.last_tested_at ? `Tested: ${new Date(conn.last_tested_at).toLocaleString()}` : "Never tested"}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Connections;
