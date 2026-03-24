import { useState } from "react";
import { BuilderNode } from "./types";
import { useConnections } from "@/hooks/use-connections";
import { Table, Code, FileText, Database, ChevronDown, Eye } from "lucide-react";
import ResourcePicker from "./ResourcePicker";
import DataPreview from "./DataPreview";
import { Button } from "@/components/ui/button";

interface Props {
  node: BuilderNode;
  onUpdate: (id: string, updates: Partial<BuilderNode>) => void;
}

export default function SourceNodeConfig({ node, onUpdate }: Props) {
  const { data: connections = [] } = useConnections();
  const [mode, setMode] = useState<"table" | "query" | "file">((node.config.source_mode as "table" | "query" | "file") || "table");
  const [previewOpen, setPreviewOpen] = useState(false);

  const selectedConnectionId = (node.config.connection_id as string) || "";
  const selectedConnection = connections.find(c => c.id === selectedConnectionId);
  
  const selectedTable = (node.config.source_table as string) || "";
  const selectedSchema = (node.config.source_schema as string) || "";
  const selectedDatabase = (node.config.source_database as string) || "";
  const selectedWarehouse = (node.config.source_warehouse as string) || "";
  
  const sqlQuery = (node.config.sql_query as string) || "";
  const filePath = (node.config.file_path as string) || "";
  const storageBucket = (node.config.storage_bucket as string) || "";
  const fileFormat = (node.config.file_format as string) || "csv";

  const updateConfig = (updates: Record<string, unknown>) => {
    onUpdate(node.id, { config: { ...node.config, ...updates } });
  };

  const selectedPath = selectedTable 
    ? `${selectedWarehouse ? `${selectedWarehouse}.` : ""}${selectedDatabase}.${selectedSchema}.${selectedTable}`
    : undefined;

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
            <Code className="w-3 h-3" /> Query
          </button>
          <button
            onClick={() => { setMode("file"); updateConfig({ source_mode: "file" }); }}
            className={`flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded text-[10px] font-medium transition-colors ${
              mode === "file" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"
            }`}
          >
            <FileText className="w-3 h-3" /> File
          </button>
        </div>
      </div>

      {mode !== "file" && (
        <>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                Bridge Node
              </label>
              <div className="relative group">
                <Database className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/60 group-focus-within:text-primary transition-colors" />
                <select
                  value={selectedConnectionId}
                  onChange={(e) => updateConfig({ 
                    connection_id: e.target.value,
                    source_warehouse: "",
                    source_database: "",
                    source_schema: "",
                    source_table: "" 
                  })}
                  className="w-full pl-9 pr-4 h-10 rounded-xl border border-border/50 bg-muted/20 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 hover:border-primary/30 transition-all appearance-none cursor-pointer"
                >
                  <option value="">Select Connection...</option>
                  {connections.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
              </div>
            </div>

            <div className="space-y-2">
               <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                  Select Entity
               </label>
               <ResourcePicker
                  connection={selectedConnection || null}
                  selectedPath={selectedPath}
                  onSelect={(path) => {
                    updateConfig({
                      source_warehouse: path.warehouse,
                      source_database: path.database,
                      source_schema: path.schema,
                      source_table: path.table,
                      source_columns: path.columns
                    });
                  }}
                  disabled={!selectedConnectionId}
               />
            </div>
          </div>

          {mode === "query" && selectedConnectionId && (
            <div className="pt-2">
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
        </>
      )}

      {mode === "file" && (
        <div className="space-y-3">
          <div>
            <label className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">Storage Bucket</label>
            <input
              type="text"
              value={storageBucket}
              onChange={(e) => updateConfig({ storage_bucket: e.target.value })}
              placeholder="e.g. raw-data-bucket"
              className="w-full px-2.5 py-1.5 rounded-md border border-input bg-background text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
          <div>
            <label className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">File Path</label>
            <input
              type="text"
              value={filePath}
              onChange={(e) => updateConfig({ file_path: e.target.value })}
              placeholder="e.g. path/to/file.csv"
              className="w-full px-2.5 py-1.5 rounded-md border border-input bg-background text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
          <div>
            <label className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">File Format</label>
            <select
              value={fileFormat}
              onChange={(e) => updateConfig({ file_format: e.target.value })}
              className="w-full px-2.5 py-1.5 rounded-md border border-input bg-background text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="csv">CSV</option>
              <option value="json">JSON</option>
              <option value="parquet">Parquet</option>
            </select>
          </div>
        </div>
      )}

      {/* Extraction Type */}
      {(mode === "file" || (selectedConnectionId && (selectedTable || sqlQuery))) && (
        <div>
          <label className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">Load Type</label>
          <select
            value={(node.config.extraction_mode as string) || "full_load"}
            onChange={(e) => updateConfig({ extraction_mode: e.target.value })}
            className="w-full px-2.5 py-1.5 rounded-md border border-input bg-background text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          >
            <option value="full_load">Full Load</option>
            <option value="incremental">Incremental (Timestamp)</option>
          </select>
        </div>
      )}

      {selectedConnectionId && (selectedTable || sqlQuery) && (
        <div className="pt-2">
           <Button 
            variant="outline" 
            size="sm" 
            onClick={() => setPreviewOpen(true)}
            className="w-full h-10 rounded-xl gap-2 font-black text-[10px] uppercase tracking-widest border-primary/20 hover:bg-primary/5 text-primary"
           >
             <Eye className="w-4 h-4" /> Preview Data Sample
           </Button>
        </div>
      )}

      <DataPreview
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        title="Source Data Observation"
        connectionId={selectedConnectionId}
        warehouse={selectedWarehouse}
        database={selectedDatabase}
        schema={selectedSchema}
        table={selectedTable}
        sqlQuery={sqlQuery}
      />
    </div>
  );
}
