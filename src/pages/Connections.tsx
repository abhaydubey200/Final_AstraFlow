import { useState } from "react";
import { useNavigate } from "react-router-dom";

import {
  Plus, Search, Database, Snowflake, Server, Loader2, RefreshCw, Activity, ShieldCheck, Globe2, Eye, Trash2, FileText, Box
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useConnections, useDeleteConnection, useResourceDiscovery,
} from "@/hooks/use-connections";
import type { Connection, ConnectionType, ConnectionFormData } from "@/types/connection";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";

// Components
import ConnectionCard from "@/components/connections/ConnectionCard";
import ConnectionExplorer from "@/components/connections/ConnectionExplorer";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { LayoutGrid, List } from "lucide-react";

// PHASE 3A: StatusBadge component for consistent status display
const StatusBadge = ({ status }: { status: string }) => {
  const map: Record<string, { label: string; className: string }> = {
    connected: { label: "Connected", className: "bg-green-500/20 text-green-400 border-green-500/30" },
    failed:    { label: "Failed",    className: "bg-red-500/20 text-red-400 border-red-500/30" },
    error:     { label: "Error",     className: "bg-red-500/20 text-red-400 border-red-500/30" },
    testing:   { label: "Testing...", className: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" },
  };
  const { label, className } = map[status] ?? { label: "Not Tested", className: "bg-gray-500/20 text-gray-400 border-gray-500/30" };
  return (
    <span className={cn("text-xs font-semibold px-2 py-0.5 rounded-full border inline-flex items-center gap-1.5", className)}>
      <div className={cn("w-1.5 h-1.5 rounded-full", status === "connected" ? "bg-green-400 animate-pulse" : status === "error" || status === "failed" ? "bg-red-400" : "bg-gray-400")} />
      {label}
    </span>
  );
};

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
  {
    type: "mongodb",
    label: "MongoDB",
    icon: Database,
    color: "text-green-500",
    placeholder: { host: "mongodb+srv://...", db: "admin" },
  },
  {
    type: "oracle",
    label: "Oracle",
    icon: Database,
    color: "text-red-600",
    placeholder: { host: "oracle.example.com", db: "ORCL" },
  },
];

const emptyForm: ConnectionFormData = {
  name: "",
  type: "postgresql",
  host: "",
  port: 5432,
  database_name: "",
  username: "",
  password: "",
  ssl_enabled: true,
  security_level: "standard",
  timeout_seconds: 30,
};

const Connections = () => {
  const navigate = useNavigate();
  const { data: connections = [], isLoading } = useConnections();
  const deleteMutation = useDeleteConnection();

  const [search, setSearch] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [explorerOpen, setExplorerOpen] = useState(false);
  const [explorerConn, setExplorerConn] = useState<Connection | null>(null);
  const [view, setView] = useState<"grid" | "table">("grid");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");

  const openNew = () => navigate("/connections/new");

  const openEdit = (conn: Connection) => {
    // Open the connection explorer to view/browse the connection
    handleBrowseExplorer(conn);
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteMutation.mutateAsync(deleteId);
      toast({ title: "Source bridge dismantled" });
      setDeleteId(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      toast({ title: "Dismantle failed", description: message, variant: "destructive" });
    }
  };

  const handleBrowseExplorer = (conn: Connection) => {
    setExplorerConn(conn);
    setExplorerOpen(true);
  };


  const filtered = connections.filter((c) => {
    const matchesSearch = 
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.host.toLowerCase().includes(search.toLowerCase());
    const matchesType = typeFilter === "all" || c.type === typeFilter;
    const matchesStatus = statusFilter === "all" || c.status === statusFilter;
    return matchesSearch && matchesType && matchesStatus;
  });

  const stats = {
    total: connections.length,
    active: connections.filter(c => c.status === "connected").length,
    critical: connections.filter(c => c.status === "error").length,
    lastTest: connections
      .filter(c => c.last_tested_at)
      .sort((a, b) => new Date(b.last_tested_at!).getTime() - new Date(a.last_tested_at!).getTime())[0]?.last_tested_at,
  };

  const resourceDiscovery = useResourceDiscovery();

  return (
    <div className="p-8 lg:p-12 space-y-12 animate-in fade-in duration-700">
      {/* Premium Dashboard Header */}
      <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-10">
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shadow-inner">
              <Globe2 className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <h1 className="text-4xl font-black font-display text-foreground tracking-tightest">Infrastructure</h1>
              <p className="text-sm font-bold text-muted-foreground/60 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-success" /> Heterogeneous Node Network
              </p>
            </div>
          </div>
          
          <div className="flex flex-wrap items-center gap-8 pt-4">
            <div className="flex items-center gap-4">
              <div className="text-2xl font-black text-foreground leading-none">{stats.total}</div>
              <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/40 leading-tight">Total<br/>Bridges</div>
            </div>
            <div className="w-px h-8 bg-border/50 hidden sm:block" />
            <div className="flex items-center gap-4">
              <div className="text-2xl font-black text-success leading-none">{stats.active}</div>
              <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/40 leading-tight">Verified<br/>Active</div>
            </div>
            <div className="w-px h-8 bg-border/50 hidden sm:block" />
            <div className="flex items-center gap-4">
              <div className="text-2xl font-black text-destructive leading-none">{stats.critical}</div>
              <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/40 leading-tight">System<br/>Failures</div>
            </div>
            <div className="w-px h-8 bg-border/50 hidden lg:block" />
            <div className="hidden lg:flex items-center gap-4">
              <div className="text-lg font-black text-foreground leading-none">
                {stats.lastTest ? new Date(stats.lastTest).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "---"}
              </div>
              <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/40 leading-tight">Last<br/>Verification</div>
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-4 w-full xl:w-auto">
          <div className="relative group flex-1 sm:w-80">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/40 group-focus-within:text-primary transition-colors" />
            <Input
              placeholder="Search across nodes..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-11 h-12 bg-card/40 border-border/40 focus:ring-primary/10 rounded-2xl font-bold placeholder:text-muted-foreground/30 shadow-sm"
            />
          </div>
          
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <select 
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="h-12 px-4 rounded-2xl bg-card/40 border border-border/40 text-xs font-black uppercase tracking-widest focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all appearance-none pr-10 relative cursor-pointer"
              style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='currentColor'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 1rem center', backgroundSize: '1rem' }}
            >
              <option value="all">Any Type</option>
              <option value="postgresql">PostgreSQL</option>
              <option value="mysql">MySQL</option>
              <option value="mssql">SQL Server</option>
              <option value="snowflake">Snowflake</option>
              <option value="mongodb">MongoDB</option>
              <option value="oracle">Oracle</option>
            </select>

            <select 
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-12 px-4 rounded-2xl bg-card/40 border border-border/40 text-xs font-black uppercase tracking-widest focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all appearance-none pr-10 relative cursor-pointer"
              style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='currentColor'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 1rem center', backgroundSize: '1rem' }}
            >
              <option value="all">Any Status</option>
              <option value="connected">Live</option>
              <option value="error">Failure</option>
              <option value="disconnected">Offline</option>
            </select>

            <Button onClick={() => navigate("/connections/new")} className="h-12 px-8 rounded-2xl gap-3 font-black text-[11px] uppercase tracking-widest shadow-2xl shadow-primary/30 ring-1 ring-primary/20">
              <Plus className="w-5 h-5" /> Build Bridge
            </Button>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between mb-6">
        <h3 className="text-sm font-black uppercase tracking-widest text-muted-foreground/40">Network Nodes</h3>
        <div className="flex items-center gap-1 bg-card/40 p-1 rounded-xl border border-border/40">
           <Button 
            variant={view === "grid" ? "secondary" : "ghost"} 
            size="sm" 
            className="h-8 px-3 rounded-lg gap-2 text-[10px] font-black uppercase tracking-wider transition-all"
            onClick={() => setView("grid")}
           >
             <LayoutGrid className="w-3.5 h-3.5" /> Grid
           </Button>
           <Button 
            variant={view === "table" ? "secondary" : "ghost"} 
            size="sm" 
            className="h-8 px-3 rounded-lg gap-2 text-[10px] font-black uppercase tracking-wider transition-all"
            onClick={() => setView("table")}
           >
             <List className="w-3.5 h-3.5" /> Table
           </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-72 rounded-[32px] bg-card/40 animate-pulse border border-border/40" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="relative group overflow-hidden py-32 border border-border/40 rounded-[48px] bg-card/10 backdrop-blur-md flex flex-col items-center justify-center text-center">
          <div className="absolute inset-0 opacity-20 group-hover:opacity-30 transition-opacity duration-1000 grayscale group-hover:grayscale-0 pointer-events-none">
            <img 
              src="/assets/illustrations/no_connections.png" 
              alt="Empty State"
              className="w-full h-full object-cover scale-110 group-hover:scale-100 transition-transform duration-[3000ms]"
            />
          </div>
          
          <div className="relative z-10 space-y-6 max-w-lg px-6">
            <div className="w-24 h-24 mx-auto rounded-full bg-primary/10 flex items-center justify-center text-primary shadow-2xl backdrop-blur-xl border border-primary/20">
              <Database className="w-10 h-10 animate-bounce" />
            </div>
            <h3 className="text-3xl font-black text-foreground tracking-tight">No Active Bridges Identified</h3>
            <p className="text-sm font-bold text-muted-foreground/60 leading-relaxed uppercase tracking-tighter">
              Start by connecting your first data instance to initiate high-performance global pipelines across your enterprise infrastructure.
            </p>
            <div className="pt-4">
              <Button onClick={openNew} className="px-10 h-14 rounded-2xl font-black text-xs uppercase tracking-widest shadow-2xl shadow-primary/40">
                 Establish First Bridge <Plus className="ml-2 w-5 h-5" />
              </Button>
            </div>
          </div>
        </div>
      ) : view === "grid" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-8">
          {filtered.map((conn) => (
            <ConnectionCard
              key={conn.id}
              connection={conn}
              onEdit={openEdit}
              onDelete={setDeleteId}
              onBrowse={handleBrowseExplorer}
              dbConfigs={DB_TYPES}
            />
          ))}
        </div>
      ) : (
        <div className="rounded-[32px] border border-border/40 bg-card/30 backdrop-blur-xl overflow-hidden shadow-2xl">
          <Table>
            <TableHeader className="bg-muted/10">
              <TableRow className="hover:bg-transparent border-border/40">
                <TableHead className="text-[10px] font-black uppercase tracking-widest p-6">Name & Type</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-widest p-6">Host Endpoint</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-widest p-6">Warehouse / DB</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-widest p-6">Last Verified</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-widest p-6">Status</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-widest p-6 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((conn) => (
                <TableRow key={conn.id} className="border-border/20 hover:bg-primary/5 transition-colors group cursor-pointer" onClick={() => openEdit(conn)}>
                  <TableCell className="p-6">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "w-8 h-8 rounded-lg flex items-center justify-center border border-border/40",
                        DB_TYPES.find(d => d.type === conn.type)?.color.replace('text-', 'bg-').replace('-500', '/10').replace('-400', '/10')
                      )}>
                        {(() => {
                          const Icon = DB_TYPES.find(d => d.type === conn.type)?.icon || Database;
                          return <Icon className={cn("w-4 h-4", DB_TYPES.find(d => d.type === conn.type)?.color)} />;
                        })()}
                      </div>
                      <div>
                        <p className="text-sm font-black text-foreground tracking-tight">{conn.name}</p>
                        <p className="text-[9px] font-black uppercase tracking-tighter text-muted-foreground/40">{conn.type}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="p-6">
                    <p className="text-xs font-bold font-mono text-muted-foreground group-hover:text-primary transition-colors">{conn.host}:{conn.port}</p>
                  </TableCell>
                  <TableCell className="p-6">
                     <p className="text-[11px] font-bold text-foreground/80">
                        {conn.type === "snowflake" ? (conn.warehouse_name || 'N/A') : conn.database_name}
                        {conn.type === "snowflake" && <span className="text-muted-foreground/40 mx-2">/</span>}
                        {conn.type === "snowflake" && conn.database_name}
                     </p>
                  </TableCell>
                  <TableCell className="p-6">
                    <p className="text-[11px] font-bold text-muted-foreground">
                      {conn.last_tested_at ? new Date(conn.last_tested_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "Never"}
                    </p>
                  </TableCell>
                  <TableCell className="p-6">
                    <StatusBadge status={conn.status || "unknown"} />
                  </TableCell>
                  <TableCell className="p-6 text-right">
                    <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={(e) => { e.stopPropagation(); handleBrowseExplorer(conn); }}>
                        <Eye className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg hover:text-destructive" onClick={(e) => { e.stopPropagation(); setDeleteId(conn.id); }}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* New connections use the full-page wizard at /connections/new */}

      <ConnectionExplorer
        open={explorerOpen}
        onOpenChange={setExplorerOpen}
        connection={explorerConn}
      />

      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent className="max-w-sm rounded-3xl p-8 bg-card/95 backdrop-blur-xl border-border/50">
          <div className="flex flex-col items-center text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center text-destructive mb-2">
              <RefreshCw className="w-8 h-8" />
            </div>
            <DialogHeader>
              <DialogTitle className="text-xl font-bold">Dismantle Bridge?</DialogTitle>
              <DialogDescription className="text-xs leading-relaxed">
                You are about to permanently disconnect <span className="text-foreground font-bold">{connections.find(c => c.id === deleteId)?.name}</span>. This may impact downstream pipelines.
              </DialogDescription>
            </DialogHeader>
            <div className="flex gap-2 w-full pt-4">
              <Button variant="ghost" className="flex-1 font-bold" onClick={() => setDeleteId(null)}>
                Abort
              </Button>
              <Button
                variant="destructive"
                className="flex-1 font-bold shadow-lg shadow-destructive/20"
                disabled={deleteMutation.isPending}
                onClick={handleDelete}
              >
                {deleteMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Confirm"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Connections;
