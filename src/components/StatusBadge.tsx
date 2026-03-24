import { cn } from "@/lib/utils";

interface StatusBadgeProps {
  status: "success" | "running" | "failed" | "pending" | "retrying";
}

const statusStyles = {
  success: "bg-success/10 text-success border-success/20",
  running: "bg-primary/10 text-primary border-primary/20",
  failed: "bg-destructive/10 text-destructive border-destructive/20",
  pending: "bg-muted/10 text-muted-foreground border-border/20",
  retrying: "bg-warning/10 text-warning border-warning/20",
};

const statusLabels = {
  success: "Success",
  running: "Running",
  failed: "Failed",
  pending: "Pending",
  retrying: "Retrying",
};

const StatusBadge = ({ status }: StatusBadgeProps) => (
  <span
    className={cn(
      "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold border uppercase tracking-tight",
      statusStyles[status]
    )}
  >
    <span
      className={cn("w-1 h-1 rounded-full", {
        "bg-success": status === "success",
        "bg-primary animate-pulse": status === "running",
        "bg-destructive": status === "failed",
        "bg-muted-foreground": status === "pending",
        "bg-warning animate-bounce": status === "retrying",
      })}
    />
    {statusLabels[status]}
  </span>
);

export default StatusBadge;
