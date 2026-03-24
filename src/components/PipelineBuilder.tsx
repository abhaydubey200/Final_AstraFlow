import { useState, useMemo } from "react";
import { ArrowLeft, Play, Save, Loader2, CheckCircle, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";
import { useCreatePipeline, useUpdatePipeline } from "@/hooks/use-pipelines";
import { useTriggerRun, useRunTasks } from "@/hooks/use-executions";
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
  const { user } = useAuth();
  const createPipeline = useCreatePipeline();
  const updatePipeline = useUpdatePipeline();
  const triggerRun = useTriggerRun();
  const validatePipeline = useValidatePipeline();
  const saving = createPipeline.isPending || updatePipeline.isPending;
  const [validationStatus, setValidationStatus] = useState<"idle" | "valid" | "invalid">("idle");
  const [activeRunId, setActiveRunId] = useState<string | null>(null);

  const { data: runTasks } = useRunTasks(activeRunId || undefined);

  const {
    nodes, edges, selectedNode, zoom, pan,
    setSelectedNode, setPan, setZoom,
    addNode, moveNode, updateNode, deleteNode,
    addEdge, deleteEdge, zoomIn, zoomOut, resetZoom,
  } = useCanvasState(initialNodes, initialEdges);

  const selectedNodeData = nodes.find((n) => n.id === selectedNode);

  const nodeStatuses = useMemo(() => {
    if (!runTasks) return {};
    const statuses: Record<string, string> = {};
    runTasks.forEach((t) => {
      if (t.node_id) statuses[t.node_id] = t.status;
    });
    return statuses;
  }, [runTasks]);

  const nodesWithStatus = useMemo(() => {
    return nodes.map(n => ({
        ...n,
        status: nodeStatuses[n.id] as BuilderNode["status"]
    }));
  }, [nodes, nodeStatuses]);

  const handleSave = async () => {
    try {
      const mappedNodes = nodes.map((n, i) => ({
        id: n.id,
        node_type: n.type,
        label: n.label,
        config_json: n.config,
        position_x: n.x,
        position_y: n.y,
        order_index: i,
      }));

      const mappedEdges = edges.map((e) => ({
        source_node_id: e.from,
        target_node_id: e.to,
      }));

      const name = pipelineName.trim() || "Untitled Pipeline";

      if (pipelineId) {
        await updatePipeline.mutateAsync({ 
          id: pipelineId, 
          name: name,
          nodes: mappedNodes,
          edges: mappedEdges,
          execution_mode: 'DAG'
        });
        toast({ title: "Pipeline updated to DAG mode" });
      } else {
        await createPipeline.mutateAsync({
          pipeline: {
            name: name,
            description: "",
            status: "draft",
            schedule_type: "manual",
            schedule_config: {},
            created_by: undefined,
            last_run_at: undefined,
            next_run_at: undefined,
            execution_mode: 'DAG'
          },
          nodes: mappedNodes,
          edges: mappedEdges,
        });
        toast({ title: "Pipeline saved in DAG mode" });
        onBack();
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      toast({ title: "Error saving", description: message, variant: "destructive" });
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
          <Button
            size="sm"
            className="gap-1.5 h-7 text-xs bg-success text-success-foreground hover:bg-success/90"
            disabled={!pipelineId || triggerRun.isPending}
            onClick={async () => {
              if (!pipelineId) return;
              // Validate first
              try {
                const result = await validatePipeline.mutateAsync(pipelineId);
                if (!result.valid) {
                  setValidationStatus("invalid");
                  toast({
                    title: "Validation failed",
                    description: result.errors.map((e) => e.message).join("; "),
                    variant: "destructive",
                  });
                  return;
                }
                setValidationStatus("valid");
              } catch {
                // Proceed even if validation service fails
              }
              triggerRun.mutate(
                { pipelineId, userId: user?.id },
                {
                  onSuccess: (data: { run_id?: string; id?: string }) => {
                    toast({ title: "Pipeline execution started", description: "Watch logs for real-time progress." });
                    const runId = data?.run_id || data?.id;
                    if (runId) {
                      setActiveRunId(runId);
                    }
                  },
                  onError: (e) => toast({ title: "Error", description: e.message, variant: "destructive" }),
                }
              );
            }}
          >
            {triggerRun.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
            Run
          </Button>
          {validationStatus === "valid" && <CheckCircle className="w-3.5 h-3.5 text-success" />}
          {validationStatus === "invalid" && <AlertTriangle className="w-3.5 h-3.5 text-warning" />}
        </div>
      </div>

      {/* Toolbar with node types + zoom */}
      <Toolbar onAddNode={addNode} zoom={zoom} onZoomIn={zoomIn} onZoomOut={zoomOut} onResetZoom={resetZoom} />

      {/* Canvas + Inspector */}
      <div className="flex flex-1 overflow-hidden">
        <Canvas
          nodes={nodesWithStatus}
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
