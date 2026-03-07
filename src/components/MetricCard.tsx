import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  trend?: { value: string; positive: boolean };
  variant?: "default" | "primary" | "success" | "destructive";
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

const MetricCard = ({ title, value, subtitle, icon: Icon, trend, variant = "default" }: MetricCardProps) => (
  <div className={cn("rounded-lg border bg-card p-5", variantStyles[variant])}>
    <div className="flex items-start justify-between">
      <div>
        <p className="text-sm text-muted-foreground">{title}</p>
        <p className="text-2xl font-display font-bold text-foreground mt-1">{value}</p>
        {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
        {trend && (
          <p className={cn("text-xs mt-2 font-medium", trend.positive ? "text-success" : "text-destructive")}>
            {trend.positive ? "↑" : "↓"} {trend.value}
          </p>
        )}
      </div>
      <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center", iconVariantStyles[variant])}>
        <Icon className="w-5 h-5" />
      </div>
    </div>
  </div>
);

export default MetricCard;
