import { useState, useEffect } from "react";
import { BuilderNode } from "./types";
import { useConnections, useSchemaDiscovery, SchemaTable } from "@/hooks/use-connections";
import { Database, Code, Table, Loader2, ChevronDown, ChevronRight, RefreshCw } from "lucide-react";

interface Props {
  node: BuilderNode;
  onUpdate: (id: string, updates: Partial<BuilderNode>) => void;
}

export default function SourceNodeConfig({ node, onUpdate }: Props) {
  const { data: connections = [], isLoading: loadingConns } = useConnections();
  const schemaDiscovery = useSchemaDiscovery();
  const [mode, setMode] = useState<"table" | "query">(node.config.source_mode as any || "table");
  const [tables, setTables] = useState<SchemaTable[]>([]);
  const [expandedTable, setExpandedTable] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [schemaLoaded, setSchemaLoaded] = useState(false);

  const selectedConnectionId = node.config.connection_id || "";
  const selectedTable = node.config.source_table || "";
  const selectedSchema = node.config.source_schema || "";
  const sqlQuery = node.config.sql_query || "";

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
      // error handled by mutation
    }
  };

  // Reset schema when connection changes
  useEffect(() => {
    setTables([]);
    setSchemaLoaded(false);
    setPassword("");
  }, [selectedConnectionId]);

  return (
    <div className="space-y-3">
      {/* Mode Toggle */}
      <div>
        <label className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">Extraction Mode</label>
        <div className="flex gap-1">
          <button
            onClick={() => { setMode("table"); updateConfig({ source_mode: "table" }); }}
            className={`flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded text-[10px] font-medium transition-colors ${
              mode === "table" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"
            }`}
          >
            <Table className="w-3 h-3" /> Table
          </button>
          <button
            onClick={() => { setMode("query"); updateConfig({ source_mode: "query" }); }}
            className={`flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded text-[10px] font-medium transition-colors ${
              mode === "query" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"
            }`}
          >
            <Code className="w-3 h-3" /> SQL Query
          </button>
        </div>
      </div>

      {/* Connection Picker */}
      <div>
        <label className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">Source Connection</label>
        {loadingConns ? (
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <Loader2 className="w-3 h-3 animate-spin" /> Loading...
          </div>
        ) : (
          <select
            value={selectedConnectionId}
            onChange={(e) => {
              updateConfig({ connection_id: e.target.value, source_table: "", source_schema: "", source_columns: "" });
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

      {mode === "table" && selectedConnectionId && (
        <>
          {/* Password for schema discovery */}
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

          {/* Table List */}
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
                  const isExpanded = expandedTable === tableKey;
                  return (
                    <div key={tableKey}>
                      <button
                        onClick={() => {
                          updateConfig({
                            source_table: t.table_name,
                            source_schema: t.schema_name,
                            source_columns: JSON.stringify(t.columns),
                          });
                          setExpandedTable(isExpanded ? null : tableKey);
                        }}
                        className={`w-full flex items-center gap-1 px-2 py-1 text-[10px] text-left hover:bg-muted/50 transition-colors ${
                          isSelected ? "bg-primary/10 text-primary font-medium" : "text-foreground"
                        }`}
                      >
                        {isExpanded ? <ChevronDown className="w-2.5 h-2.5 shrink-0" /> : <ChevronRight className="w-2.5 h-2.5 shrink-0" />}
                        <Table className="w-2.5 h-2.5 shrink-0" />
                        <span className="truncate">{t.schema_name}.{t.table_name}</span>
                        <span className="ml-auto text-muted-foreground shrink-0">~{t.row_count_estimate}</span>
                      </button>
                      {isExpanded && (
                        <div className="pl-6 pb-1 space-y-0.5">
                          {t.columns.map((col) => (
                            <div key={col.name} className="flex items-center gap-1 text-[9px] text-muted-foreground">
                              <span className={col.is_primary_key ? "text-warning font-medium" : ""}>{col.name}</span>
                              <span className="text-muted-foreground/60">{col.data_type}</span>
                              {col.is_primary_key && <span className="text-[8px] text-warning">PK</span>}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Selected Table Display */}
          {selectedTable && (
            <div className="p-2 rounded-md bg-success/10 border border-success/20">
              <p className="text-[10px] font-medium text-success">✓ Selected: {selectedSchema}.{selectedTable}</p>
            </div>
          )}
        </>
      )}

      {mode === "query" && selectedConnectionId && (
        <div>
          <label className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">SQL Query</label>
          <textarea
            value={sqlQuery}
            onChange={(e) => updateConfig({ sql_query: e.target.value })}
            placeholder="SELECT * FROM schema.table WHERE ..."
            rows={5}
            className="w-full px-2.5 py-1.5 rounded-md border border-input bg-background text-xs text-foreground font-mono focus:outline-none focus:ring-1 focus:ring-ring resize-none"
          />
          <p className="text-[9px] text-muted-foreground mt-0.5">Enter the extraction query. Use parameterized filters for incremental loads.</p>
        </div>
      )}

      {/* Extraction Type */}
      {selectedConnectionId && (selectedTable || sqlQuery) && (
        <div>
          <label className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">Load Type</label>
          <select
            value={node.config.extraction_mode || "full_load"}
            onChange={(e) => updateConfig({ extraction_mode: e.target.value })}
            className="w-full px-2.5 py-1.5 rounded-md border border-input bg-background text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          >
            <option value="full_load">Full Load</option>
            <option value="incremental">Incremental (Timestamp)</option>
          </select>
        </div>
      )}
    </div>
  );
}
