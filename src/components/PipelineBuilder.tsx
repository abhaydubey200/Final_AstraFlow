import { useState } from "react";
import { ArrowLeft, Play, Save, Loader2, CheckCircle, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";
import { useCreatePipeline, useUpdatePipeline } from "@/hooks/use-pipelines";
import { useTriggerRun } from "@/hooks/use-executions";
import { useValidatePipeline } from "@/hooks/use-connections";
import { useAuth } from "@/components/AuthProvider";
import { toast } from "@/hooks/use-toast";
import { BuilderNode, BuilderEdge } from "./pipeline-builder/types";
import { useCanvasState } from "./pipeline-builder/useCanvasState";
import Canvas from "./pipeline-builder/Canvas";
import Toolbar from "./pipeline-builder/Toolbar";
import NodeInspector from "./pipeline-builder/NodeInspector";

interface PipelineBuilderProps {
  onBack: () => void;
  pipelineId?: string;
  initialName?: string;
  initialNodes?: BuilderNode[];
  initialEdges?: BuilderEdge[];
}

const PipelineBuilder = ({ onBack, pipelineId, initialName, initialNodes, initialEdges }: PipelineBuilderProps) => {
  const isMobile = useIsMobile();
  const [pipelineName, setPipelineName] = useState(initialName || "Untitled Pipeline");
  const createPipeline = useCreatePipeline();
  const updatePipeline = useUpdatePipeline();
  const saving = createPipeline.isPending || updatePipeline.isPending;

  const {
    nodes, edges, selectedNode, zoom, pan,
    setSelectedNode, setPan, setZoom,
    addNode, moveNode, updateNode, deleteNode,
    addEdge, deleteEdge, zoomIn, zoomOut, resetZoom,
  } = useCanvasState(initialNodes, initialEdges);

  const selectedNodeData = nodes.find((n) => n.id === selectedNode);

  const handleSave = async () => {
    try {
      const mappedNodes = nodes.map((n, i) => ({
        node_type: n.type as any,
        label: n.label,
        config_json: n.config as any,
        position_x: n.x,
        position_y: n.y,
        order_index: i,
      }));

      if (pipelineId) {
        await updatePipeline.mutateAsync({ id: pipelineId, name: pipelineName });
        toast({ title: "Pipeline updated" });
      } else {
        await createPipeline.mutateAsync({
          pipeline: {
            name: pipelineName,
            description: null,
            status: "draft",
            schedule_type: "manual",
            schedule_config: { edges } as any,
            created_by: null,
            last_run_at: null,
            next_run_at: null,
          },
          nodes: mappedNodes,
          edges: [],
        });
        toast({ title: "Pipeline saved" });
        onBack();
      }
    } catch (err: any) {
      toast({ title: "Error saving", description: err.message, variant: "destructive" });
    }
  };

  return (
    <div className="flex flex-col h-[100vh]">
      {/* Top bar */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-card gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <button onClick={onBack} className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors shrink-0">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <input
            type="text"
            value={pipelineName}
            onChange={(e) => setPipelineName(e.target.value)}
            className="text-sm font-semibold text-foreground bg-transparent border-none outline-none w-full max-w-[200px] sm:max-w-[280px]"
            placeholder="Pipeline name..."
          />
          <span className="text-[10px] text-muted-foreground whitespace-nowrap shrink-0">
            {nodes.length}n · {edges.length}e
          </span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <Button variant="outline" size="sm" onClick={handleSave} disabled={saving} className="gap-1.5 h-7 text-xs">
            {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
            Save
          </Button>
          <Button size="sm" className="gap-1.5 h-7 text-xs bg-success text-success-foreground hover:bg-success/90">
            <Play className="w-3 h-3" /> Run
          </Button>
        </div>
      </div>

      {/* Toolbar with node types + zoom */}
      <Toolbar onAddNode={addNode} zoom={zoom} onZoomIn={zoomIn} onZoomOut={zoomOut} onResetZoom={resetZoom} />

      {/* Canvas + Inspector */}
      <div className="flex flex-1 overflow-hidden">
        <Canvas
          nodes={nodes}
          edges={edges}
          selectedNode={selectedNode}
          zoom={zoom}
          pan={pan}
          onSelectNode={setSelectedNode}
          onMoveNode={moveNode}
          onDeleteNode={deleteNode}
          onAddEdge={addEdge}
          onDeleteEdge={deleteEdge}
          onPanChange={setPan}
          onZoomChange={setZoom}
        />

        {/* Desktop Inspector */}
        {selectedNodeData && !isMobile && (
          <NodeInspector
            node={selectedNodeData}
            edges={edges}
            nodes={nodes}
            onUpdate={updateNode}
            onDelete={deleteNode}
            onClose={() => setSelectedNode(null)}
          />
        )}

        {/* Mobile Inspector */}
        {selectedNodeData && isMobile && (
          <Sheet open={!!selectedNodeData} onOpenChange={(open) => !open && setSelectedNode(null)}>
            <SheetContent side="bottom" className="h-[50vh] rounded-t-2xl p-3">
              <NodeInspector
                node={selectedNodeData}
                edges={edges}
                nodes={nodes}
                onUpdate={updateNode}
                onDelete={deleteNode}
                onClose={() => setSelectedNode(null)}
              />
            </SheetContent>
          </Sheet>
        )}
      </div>
    </div>
  );
};

export default PipelineBuilder;
