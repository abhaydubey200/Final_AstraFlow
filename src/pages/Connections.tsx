import { useState } from "react";
import { Plus, Search, CheckCircle, XCircle, Database, Server, Globe, FileSpreadsheet, X, Loader2, Zap, Edit, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

type ConnectionType = "mssql" | "snowflake" | "postgresql" | "mysql" | "api" | "csv";

interface ConnectionFormData {
  name: string;
  type: ConnectionType;
  host: string;
  port: string;
  database: string;
  username: string;
  password: string;
}

interface ExistingConnection {
  id: string;
  name: string;
  type: ConnectionType;
  host: string;
  status: "connected" | "error";
  lastTested: string;
}

const connectionTypes: { type: ConnectionType; label: string; icon: typeof Database; defaultPort: string }[] = [
  { type: "mssql", label: "SQL Server", icon: Database, defaultPort: "1433" },
  { type: "snowflake", label: "Snowflake", icon: Server, defaultPort: "443" },
  { type: "postgresql", label: "PostgreSQL", icon: Database, defaultPort: "5432" },
  { type: "mysql", label: "MySQL", icon: Database, defaultPort: "3306" },
  { type: "api", label: "REST API", icon: Globe, defaultPort: "443" },
  { type: "csv", label: "CSV / S3", icon: FileSpreadsheet, defaultPort: "" },
];

const existingConnections: ExistingConnection[] = [
  { id: "CN-001", name: "Sales DB Primary", type: "mssql", host: "sql-prod-01.corp.net", status: "connected", lastTested: "5 min ago" },
  { id: "CN-002", name: "Inventory DB", type: "mssql", host: "sql-prod-02.corp.net", status: "connected", lastTested: "12 min ago" },
  { id: "CN-003", name: "Analytics Warehouse", type: "snowflake", host: "acme.snowflakecomputing.com", status: "connected", lastTested: "1 min ago" },
  { id: "CN-004", name: "Marketing API", type: "api", host: "api.marketing-platform.io", status: "error", lastTested: "3 hrs ago" },
  { id: "CN-005", name: "Customer DB", type: "postgresql", host: "pg-prod.corp.net:5432", status: "connected", lastTested: "8 min ago" },
  { id: "CN-006", name: "Product Feed", type: "csv", host: "s3://acme-data/products/", status: "connected", lastTested: "30 min ago" },
];

const getIcon = (type: ConnectionType) => connectionTypes.find((c) => c.type === type)?.icon || Database;

const emptyForm: ConnectionFormData = { name: "", type: "mssql", host: "", port: "1433", database: "", username: "", password: "" };

const Connections = () => {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<"success" | "failed" | null>(null);
  const [formData, setFormData] = useState<ConnectionFormData>(emptyForm);
  const [search, setSearch] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);

  const openNew = () => {
    setFormData(emptyForm);
    setEditingId(null);
    setTestResult(null);
    setShowForm(true);
  };

  const openEdit = (conn: ExistingConnection) => {
    const cfg = connectionTypes.find((c) => c.type === conn.type);
    setFormData({ name: conn.name, type: conn.type, host: conn.host, port: cfg?.defaultPort || "", database: "", username: "", password: "" });
    setEditingId(conn.id);
    setTestResult(null);
    setShowForm(true);
  };

  const handleTypeChange = (type: ConnectionType) => {
    const cfg = connectionTypes.find((c) => c.type === type);
    setFormData((prev) => ({ ...prev, type, port: cfg?.defaultPort || "" }));
    setTestResult(null);
  };

  const handleTestConnection = () => {
    setTesting(true);
    setTestResult(null);
    setTimeout(() => { setTesting(false); setTestResult(formData.host ? "success" : "failed"); }, 2000);
  };

  const filtered = existingConnections.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()) || c.host.toLowerCase().includes(search.toLowerCase())
  );

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
                <div className="grid grid-cols-3 gap-2 mt-2">
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
                  <label className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">{formData.type === "snowflake" ? "Account URL" : formData.type === "csv" ? "S3 Path" : "Host"}</label>
                  <input type="text" placeholder={formData.type === "snowflake" ? "acme.snowflakecomputing.com" : "hostname.example.com"} value={formData.host} onChange={(e) => setFormData((p) => ({ ...p, host: e.target.value }))} className="w-full mt-1 px-3 py-2 rounded-md border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring" />
                </div>
                {formData.type !== "csv" && (
                  <div>
                    <label className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Port</label>
                    <input type="text" value={formData.port} onChange={(e) => setFormData((p) => ({ ...p, port: e.target.value }))} className="w-full mt-1 px-3 py-2 rounded-md border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring" />
                  </div>
                )}
              </div>
              {formData.type !== "api" && formData.type !== "csv" && (
                <div>
                  <label className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">{formData.type === "snowflake" ? "Warehouse" : "Database"}</label>
                  <input type="text" placeholder={formData.type === "snowflake" ? "COMPUTE_WH" : "database_name"} value={formData.database} onChange={(e) => setFormData((p) => ({ ...p, database: e.target.value }))} className="w-full mt-1 px-3 py-2 rounded-md border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring" />
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">{formData.type === "api" ? "API Key Name" : "Username"}</label>
                  <input type="text" value={formData.username} onChange={(e) => setFormData((p) => ({ ...p, username: e.target.value }))} className="w-full mt-1 px-3 py-2 rounded-md border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">{formData.type === "api" ? "API Key" : "Password"}</label>
                  <input type="password" value={formData.password} onChange={(e) => setFormData((p) => ({ ...p, password: e.target.value }))} className="w-full mt-1 px-3 py-2 rounded-md border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring" />
                </div>
              </div>
              {testResult && (
                <div className={cn("flex items-center gap-2 p-3 rounded-md border", testResult === "success" ? "border-success/30 bg-success/5" : "border-destructive/30 bg-destructive/5")}>
                  {testResult === "success" ? <CheckCircle className="w-4 h-4 text-success" /> : <XCircle className="w-4 h-4 text-destructive" />}
                  <span className={cn("text-xs font-medium", testResult === "success" ? "text-success" : "text-destructive")}>{testResult === "success" ? "Connection successful!" : "Connection failed. Check your credentials."}</span>
                </div>
              )}
            </div>
            <div className="flex items-center justify-between px-6 py-4 border-t border-border">
              <button onClick={handleTestConnection} disabled={testing} className="inline-flex items-center gap-2 px-4 py-2 rounded-md border border-border text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50">
                {testing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
                {testing ? "Testing..." : "Test Connection"}
              </button>
              <div className="flex gap-2">
                <button onClick={() => { setShowForm(false); setTestResult(null); }} className="px-4 py-2 rounded-md border border-border text-xs text-muted-foreground hover:text-foreground transition-colors">Cancel</button>
                <button
                  disabled={testResult !== "success"}
                  className={cn("px-4 py-2 rounded-md text-xs font-medium transition-colors", testResult === "success" ? "bg-primary text-primary-foreground hover:bg-primary/90" : "bg-muted text-muted-foreground cursor-not-allowed")}
                >
                  {editingId ? "Update Connection" : "Save Connection"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search connections..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2 rounded-md border border-border bg-card text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        />
      </div>

      {/* Cards or Empty State */}
      {filtered.length === 0 ? (
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
            return (
              <div
                key={conn.id}
                onClick={() => openEdit(conn)}
                className={cn("rounded-lg border bg-card p-5 hover:border-primary/30 transition-colors cursor-pointer group", conn.status === "error" ? "border-destructive/30" : "border-border")}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center"><Icon className="w-5 h-5 text-primary" /></div>
                  <div className="flex items-center gap-1.5">
                    {conn.status === "connected" ? <CheckCircle className="w-4 h-4 text-success" /> : <XCircle className="w-4 h-4 text-destructive" />}
                    <span className={cn("text-xs font-medium", conn.status === "connected" ? "text-success" : "text-destructive")}>{conn.status === "connected" ? "Connected" : "Error"}</span>
                  </div>
                </div>
                <h3 className="text-sm font-semibold text-foreground">{conn.name}</h3>
                <p className="text-xs text-muted-foreground mt-1 font-display uppercase">{conn.type}</p>
                <p className="text-xs text-muted-foreground mt-0.5 truncate">{conn.host}</p>
                <div className="mt-4 pt-3 border-t border-border flex items-center justify-between">
                  <span className="text-[10px] text-muted-foreground">Last tested: {conn.lastTested}</span>
                  <button
                    onClick={(e) => { e.stopPropagation(); }}
                    className="text-xs text-primary hover:underline"
                  >
                    Test
                  </button>
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
