import { useEffect, useRef } from "react";
import * as d3 from "d3";
import { useEnterpriseLineage } from "@/hooks/use-pipelines";
import { Loader2, Share2 } from "lucide-react";

interface Node extends d3.SimulationNodeDatum {
  id: string;
  name: string;
  type: "dataset" | "pipeline";
  subType?: string;
  x?: number;
  y?: number;
  fx?: number | null;
  fy?: number | null;
}

interface Link extends d3.SimulationLinkDatum<Node> {
  source: string | Node;
  target: string | Node;
}

interface LineageData {
  pipelines: Array<{ id: string; name: string; status: string }>;
  datasets: Array<{ id: string; name: string; connection_id: string }>;
  dependencies: Array<{ upstream_dataset?: string; downstream_dataset?: string; pipeline_id: string }>;
}

export default function DataLineage() {
  const { data, isLoading } = useEnterpriseLineage() as { data: LineageData; isLoading: boolean };
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!data || !svgRef.current) return;

    const width = svgRef.current.clientWidth;
    const height = 500;

    const svg = d3.select(svgRef.current)
      .attr("viewBox", [0, 0, width, height])
      .attr("width", width)
      .attr("height", height);

    svg.selectAll("*").remove();

    const nodes: Node[] = [];
    const links: Link[] = [];

    // Add Pipeline Nodes
    data.pipelines.forEach((p) => {
      nodes.push({ id: `pipe-${p.id}`, name: p.name, type: "pipeline", subType: p.status });
    });

    // Add Dataset Nodes
    data.datasets.forEach((d) => {
      nodes.push({ id: `data-${d.id}`, name: d.name, type: "dataset", subType: d.connection_id });
    });

    // Add Edges from dependencies table
    data.dependencies.forEach((dep) => {
      if (dep.upstream_dataset) {
        links.push({ source: `data-${dep.upstream_dataset}`, target: `pipe-${dep.pipeline_id}` });
      }
      if (dep.downstream_dataset) {
        links.push({ source: `pipe-${dep.pipeline_id}`, target: `data-${dep.downstream_dataset}` });
      }
    });

    // Handle isolated nodes if needed, or just let them float
    const simulation = d3.forceSimulation<Node>(nodes)
      .force("link", d3.forceLink<Node, Link>(links).id((d) => d.id).distance(150))
      .force("charge", d3.forceManyBody().strength(-300))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("x", d3.forceX(width / 2).strength(0.05))
      .force("y", d3.forceY(height / 2).strength(0.05));

    const g = svg.append("g");

    // Add zoom
    svg.call(d3.zoom<SVGSVGElement, unknown>().scaleExtent([0.1, 4]).on("zoom", (event) => {
      g.attr("transform", event.transform);
    }));

    // Draw Links
    const link = g.append("g")
      .attr("stroke", "hsl(222, 30%, 25%)")
      .attr("stroke-opacity", 0.6)
      .selectAll("path")
      .data(links)
      .join("path")
      .attr("fill", "none")
      .attr("stroke-width", 1.5)
      .attr("marker-end", "url(#arrowhead)");

    // Arrow markers
    svg.append("defs").append("marker")
      .attr("id", "arrowhead")
      .attr("viewBox", "-0 -5 10 10")
      .attr("refX", 22)
      .attr("refY", 0)
      .attr("orient", "auto")
      .attr("markerWidth", 6)
      .attr("markerHeight", 6)
      .attr("xoverflow", "visible")
      .append("svg:path")
      .attr("d", "M 0,-5 L 10 ,0 L 0,5")
      .attr("fill", "hsl(222, 30%, 25%)");

    // Draw Nodes
    const node = g.append("g")
      .selectAll<SVGGElement, Node>("g")
      .data(nodes)
      .join("g")
      .call(d3.drag<SVGGElement, Node>()
        .on("start", dragstarted)
        .on("drag", dragged)
        .on("end", dragended));

    // Shapes based on type
    node.each(function(d) {
      const el = d3.select(this);
      if (d.type === "dataset") {
        // Cylinders for Datasets
        el.append("rect")
          .attr("x", -12).attr("y", -14).attr("width", 24).attr("height", 28).attr("rx", 4)
          .attr("fill", "hsl(187, 85%, 53%)")
          .attr("stroke", "hsl(222, 30%, 16%)").attr("stroke-width", 2);
      } else {
        // Hexagons/Circles for Pipelines
        el.append("circle")
          .attr("r", 15)
          .attr("fill", "hsl(152, 69%, 45%)")
          .attr("stroke", "hsl(222, 30%, 16%)").attr("stroke-width", 2);
      }
    });

    // Node Labels
    node.append("text")
      .attr("dy", 26)
      .attr("text-anchor", "middle")
      .text(d => d.name)
      .attr("font-size", "11px")
      .attr("font-weight", "bold")
      .attr("fill", "hsl(210, 40%, 92%)")
      .attr("pointer-events", "none")
      .attr("font-family", "var(--font-display)");

    node.append("title")
      .text(d => `${d.type.toUpperCase()}: ${d.name}\n${d.subType || ''}`);

    simulation.on("tick", () => {
      link.attr("d", (d) => {
        const source = d.source as Node;
        const target = d.target as Node;
        const dx = (target.x || 0) - (source.x || 0),
              dy = (target.y || 0) - (source.y || 0),
              dr = Math.sqrt(dx * dx + dy * dy);
        return `M${source.x || 0},${source.y || 0}A${dr},${dr} 0 0,1 ${target.x || 0},${target.y || 0}`;
      });

      node.attr("transform", (d) => `translate(${d.x || 0},${d.y || 0})`);
    });

    function dragstarted(event: d3.D3DragEvent<SVGGElement, Node, Node>) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      event.subject.fx = event.subject.x;
      event.subject.fy = event.subject.y;
    }

    function dragged(event: d3.D3DragEvent<SVGGElement, Node, Node>) {
      event.subject.fx = event.x;
      event.subject.fy = event.y;
    }

    function dragended(event: d3.D3DragEvent<SVGGElement, Node, Node>) {
      if (!event.active) simulation.alphaTarget(0);
      event.subject.fx = null;
      event.subject.fy = null;
    }

    return () => { simulation.stop(); };
  }, [data]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12 min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground/50" />
      </div>
    );
  }

  return (
    <div className="relative border border-border bg-card/50 rounded-xl overflow-hidden min-h-[500px]">
      <div className="absolute top-5 left-5 z-10 flex items-start gap-4 pointer-events-none">
        <div className="p-2 rounded-lg bg-primary/10 text-primary border border-primary/20 backdrop-blur-md">
          <Share2 className="w-5 h-5" />
        </div>
        <div>
          <h4 className="text-sm font-display font-semibold text-foreground">Global Lineage Map</h4>
          <p className="text-xs text-muted-foreground mt-0.5 max-w-sm">
            Interactive map tracing data flow from source datasets through transformation pipelines to their final destinations.
          </p>
        </div>
      </div>
      <svg ref={svgRef} className="w-full h-full cursor-grab active:cursor-grabbing min-h-[500px]" />
      <div className="absolute bottom-5 right-5 flex gap-5 bg-background/80 backdrop-blur-md px-4 py-2.5 rounded-lg border border-border pointer-events-none">
        <div className="flex items-center gap-2 text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
          <div className="w-3 h-3.5 rounded-sm bg-primary border border-primary/50" /> Dataset
        </div>
        <div className="flex items-center gap-2 text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
          <div className="w-3.5 h-3.5 rounded-full bg-success border border-success/50" /> Pipeline
        </div>
      </div>
    </div>
  );
}
