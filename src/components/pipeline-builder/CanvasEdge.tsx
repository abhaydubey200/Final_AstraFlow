import { memo } from "react";
import { BuilderNode, NODE_WIDTH, NODE_HEIGHT } from "./types";

interface Props {
  fromNode: BuilderNode;
  toNode: BuilderNode;
  onDoubleClick?: () => void;
}

function edgePath(from: BuilderNode, to: BuilderNode): string {
  const x1 = from.x + NODE_WIDTH / 2;
  const y1 = from.y + NODE_HEIGHT;
  const x2 = to.x + NODE_WIDTH / 2;
  const y2 = to.y;
  const dy = Math.abs(y2 - y1) * 0.5;
  return `M ${x1} ${y1} C ${x1} ${y1 + dy}, ${x2} ${y2 - dy}, ${x2} ${y2}`;
}

const CanvasEdge = memo(({ fromNode, toNode, onDoubleClick }: Props) => {
  const d = edgePath(fromNode, toNode);
  return (
    <g onDoubleClick={onDoubleClick} className="cursor-pointer">
      {/* Wider invisible hit area */}
      <path d={d} fill="none" stroke="transparent" strokeWidth={12} />
      {/* Visible edge */}
      <path
        d={d}
        fill="none"
        stroke="hsl(var(--primary))"
        strokeWidth={2}
        opacity={0.6}
        className="transition-opacity hover:opacity-100"
      />
      {/* Arrow head */}
      <circle
        cx={toNode.x + NODE_WIDTH / 2}
        cy={toNode.y}
        r={3}
        fill="hsl(var(--primary))"
        opacity={0.8}
      />
    </g>
  );
});

CanvasEdge.displayName = "CanvasEdge";
export default CanvasEdge;
