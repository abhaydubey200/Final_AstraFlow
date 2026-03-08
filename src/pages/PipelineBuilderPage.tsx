import { useNavigate, useParams } from "react-router-dom";
import PipelineBuilder from "@/components/PipelineBuilder";
import { usePipeline } from "@/hooks/use-pipelines";
import { Loader2 } from "lucide-react";

const PipelineBuilderPage = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const { data: pipeline, isLoading } = usePipeline(id);

  if (id && isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Map DB nodes/edges to builder format
  const initialNodes = pipeline?.pipeline_nodes?.map((n) => ({
    id: n.id,
    type: n.node_type as any,
    label: n.label,
    x: n.position_x,
    y: n.position_y,
    config: (n.config_json as Record<string, string>) || {},
  }));

  const initialEdges = pipeline?.pipeline_edges?.map((e) => ({
    from: e.source_node_id,
    to: e.target_node_id,
  }));

  return (
    <PipelineBuilder
      onBack={() => navigate("/pipelines")}
      pipelineId={id}
      initialName={pipeline?.name}
      initialNodes={initialNodes}
      initialEdges={initialEdges}
    />
  );
};

export default PipelineBuilderPage;
