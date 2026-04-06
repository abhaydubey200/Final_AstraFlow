import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  trend?: string; // Simplified - just a string description
  variant?: "default" | "primary" | "success" | "destructive";
  className?: string;
}

const variantStyles = {
  default: "border-border",
  primary: "border-primary/20 glow-primary",
  success: "border-success/20 glow-success",
  destructive: "border-destructive/20 glow-destructive",
};

const iconVariantStyles = {
  default: "bg-muted text-muted-foreground",
  primary: "bg-primary/10 text-primary",
  success: "bg-success/10 text-success",
  destructive: "bg-destructive/10 text-destructive",
};

const MetricCard = ({ title, value, subtitle, icon: Icon, trend, variant = "default", className = "" }: MetricCardProps) => (
  <div className={cn("rounded-lg border bg-card p-5 transition-all duration-200", variantStyles[variant], className)}>
    <div className="flex items-start justify-between">
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{title}</p>
        <p className="text-3xl font-display font-bold text-foreground mt-2 mb-1 tabular-nums">{value}</p>
        {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
        {trend && (
          <p className="text-xs mt-2 font-medium text-muted-foreground flex items-center gap-1">
            <span className="inline-block w-1 h-1 rounded-full bg-muted-foreground/50" />
            {trend}
          </p>
        )}
      </div>
      <div className={cn("w-12 h-12 rounded-lg flex items-center justify-center transition-transform hover:scale-110", iconVariantStyles[variant])}>
        <Icon className="w-6 h-6" />
      </div>
    </div>
  </div>
);

export default MetricCard;
