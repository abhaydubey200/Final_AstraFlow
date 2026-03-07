import { Plus, Search, CheckCircle, XCircle, Database, Server, Globe, FileSpreadsheet } from "lucide-react";
import { cn } from "@/lib/utils";

const connections = [
  { id: "CN-001", name: "Sales DB Primary", type: "MSSQL", host: "sql-prod-01.corp.net", status: "connected", lastTested: "5 min ago", icon: Database },
  { id: "CN-002", name: "Inventory DB", type: "MSSQL", host: "sql-prod-02.corp.net", status: "connected", lastTested: "12 min ago", icon: Database },
  { id: "CN-003", name: "Analytics Warehouse", type: "Snowflake", host: "acme.snowflakecomputing.com", status: "connected", lastTested: "1 min ago", icon: Server },
  { id: "CN-004", name: "Marketing API", type: "REST API", host: "api.marketing-platform.io", status: "error", lastTested: "3 hrs ago", icon: Globe },
  { id: "CN-005", name: "Customer DB", type: "PostgreSQL", host: "pg-prod.corp.net:5432", status: "connected", lastTested: "8 min ago", icon: Database },
  { id: "CN-006", name: "Product Feed", type: "CSV / S3", host: "s3://acme-data/products/", status: "connected", lastTested: "30 min ago", icon: FileSpreadsheet },
];

const Connections = () => {
  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">Connections</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage source and destination connections</p>
        </div>
        <button className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors">
          <Plus className="w-4 h-4" />
          New Connection
        </button>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search connections..."
          className="w-full pl-9 pr-4 py-2 rounded-md border border-border bg-card text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        />
      </div>

      {/* Connection Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {connections.map((conn) => (
          <div
            key={conn.id}
            className={cn(
              "rounded-lg border bg-card p-5 hover:border-primary/30 transition-colors cursor-pointer",
              conn.status === "error" ? "border-destructive/30" : "border-border"
            )}
          >
            <div className="flex items-start justify-between mb-4">
              <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                <conn.icon className="w-5 h-5 text-primary" />
              </div>
              <div className="flex items-center gap-1.5">
                {conn.status === "connected" ? (
                  <CheckCircle className="w-4 h-4 text-success" />
                ) : (
                  <XCircle className="w-4 h-4 text-destructive" />
                )}
                <span className={cn("text-xs font-medium", conn.status === "connected" ? "text-success" : "text-destructive")}>
                  {conn.status === "connected" ? "Connected" : "Error"}
                </span>
              </div>
            </div>
            <h3 className="text-sm font-semibold text-foreground">{conn.name}</h3>
            <p className="text-xs text-muted-foreground mt-1 font-display">{conn.type}</p>
            <p className="text-xs text-muted-foreground mt-0.5 truncate">{conn.host}</p>
            <div className="mt-4 pt-3 border-t border-border flex items-center justify-between">
              <span className="text-[10px] text-muted-foreground">Last tested: {conn.lastTested}</span>
              <button className="text-xs text-primary hover:underline">Test</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Connections;
