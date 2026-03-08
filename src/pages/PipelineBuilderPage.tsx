import { useNavigate } from "react-router-dom";
import PipelineBuilder from "@/components/PipelineBuilder";

const PipelineBuilderPage = () => {
  const navigate = useNavigate();
  return <PipelineBuilder onBack={() => navigate("/pipelines")} />;
};

export default PipelineBuilderPage;
