import { useState, useCallback, useRef } from "react";
import { BuilderNode, BuilderEdge, NodeType, snapToGrid, NODE_WIDTH, NODE_HEIGHT } from "./types";

export function useCanvasState(
  initialNodes: BuilderNode[] = [],
  initialEdges: BuilderEdge[] = []
) {
  const [nodes, setNodes] = useState<BuilderNode[]>(initialNodes);
  const [edges, setEdges] = useState<BuilderEdge[]>(initialEdges);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const idCounter = useRef(Date.now());

  const addNode = useCallback((type: NodeType) => {
    const id = `n${idCounter.current++}`;
    // Place near center, offset by existing count
    const x = snapToGrid(200 + (nodes.length % 4) * 180);
    const y = snapToGrid(80 + Math.floor(nodes.length / 4) * 100);
    const label = type.charAt(0).toUpperCase() + type.slice(1);
    setNodes((prev) => [...prev, { id, type, label, x, y, config: {} }]);
    return id;
  }, [nodes.length]);

  const moveNode = useCallback((id: string, x: number, y: number) => {
    setNodes((prev) => prev.map((n) => (n.id === id ? { ...n, x: snapToGrid(x), y: snapToGrid(y) } : n)));
  }, []);

  const updateNode = useCallback((id: string, updates: Partial<BuilderNode>) => {
    setNodes((prev) => prev.map((n) => (n.id === id ? { ...n, ...updates } : n)));
  }, []);

  const deleteNode = useCallback((id: string) => {
    setNodes((prev) => prev.filter((n) => n.id !== id));
    setEdges((prev) => prev.filter((e) => e.from !== id && e.to !== id));
    setSelectedNode((s) => (s === id ? null : s));
  }, []);

  const addEdge = useCallback((from: string, to: string) => {
    if (from === to) return;
    setEdges((prev) => {
      if (prev.some((e) => e.from === from && e.to === to)) return prev;
      return [...prev, { from, to }];
    });
  }, []);

  const deleteEdge = useCallback((from: string, to: string) => {
    setEdges((prev) => prev.filter((e) => !(e.from === from && e.to === to)));
  }, []);

  const zoomIn = useCallback(() => setZoom((z) => Math.min(2, z + 0.15)), []);
  const zoomOut = useCallback(() => setZoom((z) => Math.max(0.3, z - 0.15)), []);
  const resetZoom = useCallback(() => { setZoom(1); setPan({ x: 0, y: 0 }); }, []);

  return {
    nodes, edges, selectedNode, zoom, pan,
    setSelectedNode, setZoom, setPan,
    addNode, moveNode, updateNode, deleteNode,
    addEdge, deleteEdge, zoomIn, zoomOut, resetZoom,
  };
}
