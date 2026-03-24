import { useState } from "react";
import { BuilderNode } from "./types";
import { useConnections } from "@/hooks/use-connections";
import { Table, Plus, Database, ChevronDown, Save, Eye } from "lucide-react";
import ResourcePicker from "./ResourcePicker";
import DataPreview from "./DataPreview";
import { Button } from "@/components/ui/button";

interface Props {
  node: BuilderNode;
  onUpdate: (id: string, updates: Partial<BuilderNode>) => void;
}

export default function LoadNodeConfig({ node, onUpdate }: Props) {
  const { data: connections = [] } = useConnections();
  const [mode, setMode] = useState<"existing" | "auto">((node.config.load_mode as "existing" | "auto") || "existing");
  const [previewOpen, setPreviewOpen] = useState(false);

  const selectedConnectionId = (node.config.target_connection_id as string) || "";
  const selectedConnection = connections.find(c => c.id === selectedConnectionId);
  
  const selectedTable = (node.config.target_table as string) || "";
  const selectedSchema = (node.config.target_schema as string) || "";
  const selectedDatabase = (node.config.target_database as string) || "";
  const selectedWarehouse = (node.config.target_warehouse as string) || "";
  
  const newTableName = (node.config.new_table_name as string) || "";

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

      <div className="space-y-4">
        <div className="space-y-2">
          <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
            Target Node
          </label>
          <div className="relative group">
            <Database className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/60 group-focus-within:text-primary transition-colors" />
            <select
              value={selectedConnectionId}
              onChange={(e) => updateConfig({ 
                target_connection_id: e.target.value,
                target_warehouse: "",
                target_database: "",
                target_schema: "",
                target_table: "" 
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

        {mode === "existing" && (
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
               Target Entity
            </label>
            <ResourcePicker
               connection={selectedConnection || null}
               selectedPath={selectedPath}
               onSelect={(path) => {
                 updateConfig({
                   target_warehouse: path.warehouse,
                   target_database: path.database,
                   target_schema: path.schema,
                   target_table: path.table,
                   target_columns: path.columns
                 });
               }}
               disabled={!selectedConnectionId}
            />
          </div>
        )}
      </div>

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
              value={(node.config.target_schema as string) || "public"}
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
        <div className="space-y-2">
          <label className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">Write Mode</label>
          <select
            value={(node.config.write_mode as string) || "append"}
            onChange={(e) => updateConfig({ write_mode: e.target.value })}
            className="w-full px-2.5 py-1.5 rounded-md border border-input bg-background text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring appearance-none cursor-pointer"
          >
            <option value="append">Append (Insert Only)</option>
            <option value="overwrite">Overwrite (Truncate + Insert)</option>
            <option value="upsert">Upsert (Merge by PK)</option>
          </select>
        </div>
      )}

      {selectedConnectionId && selectedTable && (
        <div className="pt-2">
           <Button 
            variant="outline" 
            size="sm" 
            onClick={() => setPreviewOpen(true)}
            className="w-full h-10 rounded-xl gap-2 font-black text-[10px] uppercase tracking-widest border-primary/20 hover:bg-primary/5 text-primary"
           >
             <Eye className="w-4 h-4" /> Preview Target Sample
           </Button>
        </div>
      )}

      <DataPreview
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        title="Target Data Observation"
        connectionId={selectedConnectionId}
        warehouse={selectedWarehouse}
        database={selectedDatabase}
        schema={selectedSchema}
        table={selectedTable}
      />
    </div>
  );
}
