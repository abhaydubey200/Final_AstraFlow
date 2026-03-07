import { cn } from "@/lib/utils";

interface StatusBadgeProps {
  status: "success" | "running" | "failed" | "pending";
}

const statusStyles = {
  success: "bg-success/10 text-success border-success/20",
  running: "bg-primary/10 text-primary border-primary/20",
  failed: "bg-destructive/10 text-destructive border-destructive/20",
  pending: "bg-warning/10 text-warning border-warning/20",
};

const statusLabels = {
  success: "Success",
  running: "Running",
  failed: "Failed",
  pending: "Pending",
};

const StatusBadge = ({ status }: StatusBadgeProps) => (
  <span
    className={cn(
      "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border",
      statusStyles[status]
    )}
  >
    <span
      className={cn("w-1.5 h-1.5 rounded-full", {
        "bg-success": status === "success",
        "bg-primary animate-pulse-glow": status === "running",
        "bg-destructive": status === "failed",
        "bg-warning": status === "pending",
      })}
    />
    {statusLabels[status]}
  </span>
);

export default StatusBadge;
