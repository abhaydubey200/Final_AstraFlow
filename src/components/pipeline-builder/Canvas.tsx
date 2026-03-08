import { useRef, useCallback, useState } from "react";
import { BuilderNode, BuilderEdge, NODE_WIDTH, NODE_HEIGHT, GRID_SIZE } from "./types";
import CanvasNode from "./CanvasNode";
import CanvasEdge from "./CanvasEdge";
import { GitBranch } from "lucide-react";

interface Props {
  nodes: BuilderNode[];
  edges: BuilderEdge[];
  selectedNode: string | null;
  zoom: number;
  pan: { x: number; y: number };
  onSelectNode: (id: string | null) => void;
  onMoveNode: (id: string, x: number, y: number) => void;
  onDeleteNode: (id: string) => void;
  onAddEdge: (from: string, to: string) => void;
  onDeleteEdge: (from: string, to: string) => void;
  onPanChange: (pan: { x: number; y: number }) => void;
  onZoomChange: (zoom: number) => void;
}

export default function Canvas({
  nodes, edges, selectedNode, zoom, pan,
  onSelectNode, onMoveNode, onDeleteNode,
  onAddEdge, onDeleteEdge, onPanChange, onZoomChange,
}: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [dragging, setDragging] = useState<{ id: string; offsetX: number; offsetY: number } | null>(null);
  const [panning, setPanning] = useState<{ startX: number; startY: number; panX: number; panY: number } | null>(null);
  const [wiring, setWiring] = useState<{ fromId: string; fromPort: "in" | "out"; mouseX: number; mouseY: number } | null>(null);

  const svgPoint = useCallback((clientX: number, clientY: number) => {
    if (!svgRef.current) return { x: 0, y: 0 };
    const rect = svgRef.current.getBoundingClientRect();
    return {
      x: (clientX - rect.left - pan.x) / zoom,
      y: (clientY - rect.top - pan.y) / zoom,
    };
  }, [zoom, pan]);

  // Node dragging
  const handleNodeMouseDown = useCallback((e: React.MouseEvent, id: string) => {
    const pt = svgPoint(e.clientX, e.clientY);
    const node = nodes.find((n) => n.id === id);
    if (!node) return;
    setDragging({ id, offsetX: pt.x - node.x, offsetY: pt.y - node.y });
    onSelectNode(id);
  }, [nodes, svgPoint, onSelectNode]);

  // Port wiring
  const handlePortDown = useCallback((e: React.MouseEvent, nodeId: string, port: "out" | "in") => {
    const pt = svgPoint(e.clientX, e.clientY);
    setWiring({ fromId: nodeId, fromPort: port, mouseX: pt.x, mouseY: pt.y });
  }, [svgPoint]);

  const handlePortUp = useCallback((_e: React.MouseEvent, nodeId: string, _port: "out" | "in") => {
    if (!wiring) return;
    if (wiring.fromPort === "out") {
      onAddEdge(wiring.fromId, nodeId);
    } else {
      onAddEdge(nodeId, wiring.fromId);
    }
    setWiring(null);
  }, [wiring, onAddEdge]);

  // Canvas panning
  const handleCanvasMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.target === svgRef.current || (e.target as Element).tagName === "rect") {
      onSelectNode(null);
      setPanning({ startX: e.clientX, startY: e.clientY, panX: pan.x, panY: pan.y });
    }
  }, [pan, onSelectNode]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (dragging) {
      const pt = svgPoint(e.clientX, e.clientY);
      onMoveNode(dragging.id, pt.x - dragging.offsetX, pt.y - dragging.offsetY);
    } else if (panning) {
      onPanChange({
        x: panning.panX + (e.clientX - panning.startX),
        y: panning.panY + (e.clientY - panning.startY),
      });
    } else if (wiring) {
      const pt = svgPoint(e.clientX, e.clientY);
      setWiring((w) => w ? { ...w, mouseX: pt.x, mouseY: pt.y } : null);
    }
  }, [dragging, panning, wiring, svgPoint, onMoveNode, onPanChange]);

  const handleMouseUp = useCallback(() => {
    setDragging(null);
    setPanning(null);
    setWiring(null);
  }, []);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.08 : 0.08;
    onZoomChange(Math.max(0.3, Math.min(2, zoom + delta)));
  }, [zoom, onZoomChange]);

  // Wiring preview line
  const wiringLine = wiring ? (() => {
    const node = nodes.find((n) => n.id === wiring.fromId);
    if (!node) return null;
    const x1 = wiring.fromPort === "out" ? node.x + NODE_WIDTH / 2 : node.x + NODE_WIDTH / 2;
    const y1 = wiring.fromPort === "out" ? node.y + NODE_HEIGHT : node.y;
    return (
      <line x1={x1} y1={y1} x2={wiring.mouseX} y2={wiring.mouseY}
        stroke="hsl(var(--primary))" strokeWidth={2} strokeDasharray="6 3" opacity={0.6} />
    );
  })() : null;

  return (
    <div className="flex-1 relative overflow-hidden bg-background">
      <svg
        ref={svgRef}
        className="w-full h-full"
        onMouseDown={handleCanvasMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
        style={{ cursor: panning ? "grabbing" : wiring ? "crosshair" : "default" }}
      >
        <defs>
          <pattern id="grid-dots" width={GRID_SIZE} height={GRID_SIZE} patternUnits="userSpaceOnUse" patternTransform={`translate(${pan.x % (GRID_SIZE * zoom)},${pan.y % (GRID_SIZE * zoom)}) scale(${zoom})`}>
            <circle cx={GRID_SIZE / 2} cy={GRID_SIZE / 2} r={0.8} fill="hsl(var(--muted-foreground))" opacity={0.2} />
          </pattern>
        </defs>

        {/* Background grid */}
        <rect width="100%" height="100%" fill="url(#grid-dots)" />

        {/* Transform group for zoom/pan */}
        <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
          {/* Edges */}
          {edges.map((edge) => {
            const fromNode = nodes.find((n) => n.id === edge.from);
            const toNode = nodes.find((n) => n.id === edge.to);
            if (!fromNode || !toNode) return null;
            return (
              <CanvasEdge
                key={`${edge.from}-${edge.to}`}
                fromNode={fromNode}
                toNode={toNode}
                onDoubleClick={() => onDeleteEdge(edge.from, edge.to)}
              />
            );
          })}

          {/* Wiring preview */}
          {wiringLine}

          {/* Nodes */}
          {nodes.map((node) => (
            <CanvasNode
              key={node.id}
              node={node}
              selected={selectedNode === node.id}
              zoom={zoom}
              onMouseDown={handleNodeMouseDown}
              onClick={(e, id) => { e.stopPropagation(); onSelectNode(id); }}
              onPortDown={handlePortDown}
              onPortUp={handlePortUp}
              onDelete={onDeleteNode}
            />
          ))}
        </g>
      </svg>

      {/* Empty state */}
      {nodes.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-center">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
              <GitBranch className="w-5 h-5 text-primary" />
            </div>
            <p className="text-sm font-medium text-foreground">Start building</p>
            <p className="text-xs text-muted-foreground mt-1">Add nodes from the toolbar above</p>
          </div>
        </div>
      )}
    </div>
  );
}
