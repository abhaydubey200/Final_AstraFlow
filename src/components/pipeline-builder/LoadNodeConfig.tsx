import { useState, useEffect } from "react";
import { BuilderNode } from "./types";
import { useConnections, useSchemaDiscovery, SchemaTable } from "@/hooks/use-connections";
import { Database, Table, Loader2, RefreshCw, Plus } from "lucide-react";

interface Props {
  node: BuilderNode;
  onUpdate: (id: string, updates: Partial<BuilderNode>) => void;
}

export default function LoadNodeConfig({ node, onUpdate }: Props) {
  const { data: connections = [], isLoading: loadingConns } = useConnections();
  const schemaDiscovery = useSchemaDiscovery();
  const [mode, setMode] = useState<"existing" | "auto">(node.config.load_mode as any || "existing");
  const [tables, setTables] = useState<SchemaTable[]>([]);
  const [password, setPassword] = useState("");
  const [schemaLoaded, setSchemaLoaded] = useState(false);

  const selectedConnectionId = node.config.target_connection_id || "";
  const selectedTable = node.config.target_table || "";
  const selectedSchema = node.config.target_schema || "";
  const newTableName = node.config.new_table_name || "";

  const updateConfig = (updates: Record<string, string>) => {
    onUpdate(node.id, { config: { ...node.config, ...updates } });
  };

  const handleDiscoverSchema = async () => {
    if (!selectedConnectionId || !password) return;
    try {
      const result = await schemaDiscovery.mutateAsync({ connection_id: selectedConnectionId, password });
      if (result.tables) {
        setTables(result.tables);
        setSchemaLoaded(true);
      }
    } catch {
      // handled by mutation
    }
  };

  useEffect(() => {
    setTables([]);
    setSchemaLoaded(false);
    setPassword("");
  }, [selectedConnectionId]);

  return (
    <div className="space-y-3">
      {/* Mode Toggle */}
      <div>
        <label className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">Target Mode</label>
        <div className="flex gap-1">
          <button
            onClick={() => { setMode("existing"); updateConfig({ load_mode: "existing" }); }}
            className={`flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded text-[10px] font-medium transition-colors ${
              mode === "existing" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"
            }`}
          >
            <Table className="w-3 h-3" /> Existing Table
          </button>
          <button
            onClick={() => { setMode("auto"); updateConfig({ load_mode: "auto" }); }}
            className={`flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded text-[10px] font-medium transition-colors ${
              mode === "auto" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"
            }`}
          >
            <Plus className="w-3 h-3" /> Auto-Create
          </button>
        </div>
      </div>

      {/* Connection Picker */}
      <div>
        <label className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">Target Connection</label>
        {loadingConns ? (
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <Loader2 className="w-3 h-3 animate-spin" /> Loading...
          </div>
        ) : (
          <select
            value={selectedConnectionId}
            onChange={(e) => {
              updateConfig({ target_connection_id: e.target.value, target_table: "", target_schema: "", target_columns: "" });
            }}
            className="w-full px-2.5 py-1.5 rounded-md border border-input bg-background text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          >
            <option value="">Select connection...</option>
            {connections.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.type})
              </option>
            ))}
          </select>
        )}
      </div>

      {mode === "existing" && selectedConnectionId && (
        <>
          {!schemaLoaded && (
            <div className="space-y-1.5">
              <label className="text-[10px] text-muted-foreground uppercase tracking-wider block">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password to browse tables..."
                className="w-full px-2.5 py-1.5 rounded-md border border-input bg-background text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              />
              <button
                onClick={handleDiscoverSchema}
                disabled={!password || schemaDiscovery.isPending}
                className="w-full flex items-center justify-center gap-1 px-2 py-1.5 rounded-md bg-primary text-primary-foreground text-[10px] font-medium disabled:opacity-50 hover:bg-primary/90 transition-colors"
              >
                {schemaDiscovery.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Database className="w-3 h-3" />}
                Browse Tables
              </button>
            </div>
          )}

          {schemaLoaded && tables.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Tables ({tables.length})</label>
                <button onClick={() => { setSchemaLoaded(false); setTables([]); }} className="p-0.5 rounded hover:bg-muted text-muted-foreground">
                  <RefreshCw className="w-2.5 h-2.5" />
                </button>
              </div>
              <div className="max-h-40 overflow-y-auto border border-input rounded-md bg-background">
                {tables.map((t) => {
                  const tableKey = `${t.schema_name}.${t.table_name}`;
                  const isSelected = selectedTable === t.table_name && selectedSchema === t.schema_name;
                  return (
                    <button
                      key={tableKey}
                      onClick={() => {
                        updateConfig({
                          target_table: t.table_name,
                          target_schema: t.schema_name,
                          target_columns: JSON.stringify(t.columns),
                        });
                      }}
                      className={`w-full flex items-center gap-1 px-2 py-1 text-[10px] text-left hover:bg-muted/50 transition-colors ${
                        isSelected ? "bg-primary/10 text-primary font-medium" : "text-foreground"
                      }`}
                    >
                      <Table className="w-2.5 h-2.5 shrink-0" />
                      <span className="truncate">{t.schema_name}.{t.table_name}</span>
                      <span className="ml-auto text-muted-foreground shrink-0">~{t.row_count_estimate}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {selectedTable && (
            <div className="p-2 rounded-md bg-success/10 border border-success/20">
              <p className="text-[10px] font-medium text-success">✓ Target: {selectedSchema}.{selectedTable}</p>
            </div>
          )}
        </>
      )}

      {mode === "auto" && selectedConnectionId && (
        <div className="space-y-2">
          <div>
            <label className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">New Table Name</label>
            <input
              type="text"
              value={newTableName}
              onChange={(e) => updateConfig({ new_table_name: e.target.value })}
              placeholder="e.g. stg_orders"
              className="w-full px-2.5 py-1.5 rounded-md border border-input bg-background text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
          <div>
            <label className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">Target Schema</label>
            <input
              type="text"
              value={node.config.target_schema || "public"}
              onChange={(e) => updateConfig({ target_schema: e.target.value })}
              placeholder="public"
              className="w-full px-2.5 py-1.5 rounded-md border border-input bg-background text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
          <p className="text-[9px] text-muted-foreground">Table will be auto-created based on source schema during execution.</p>
        </div>
      )}

      {/* Write Mode */}
      {selectedConnectionId && (selectedTable || newTableName) && (
        <div>
          <label className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">Write Mode</label>
          <select
            value={node.config.write_mode || "append"}
            onChange={(e) => updateConfig({ write_mode: e.target.value })}
            className="w-full px-2.5 py-1.5 rounded-md border border-input bg-background text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          >
            <option value="append">Append</option>
            <option value="overwrite">Overwrite (Truncate + Insert)</option>
            <option value="upsert">Upsert (Merge)</option>
          </select>
        </div>
      )}
    </div>
  );
}
