import { ReactNode } from "react";
import { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
    icon?: LucideIcon;
  };
  secondaryAction?: {
    label: string;
    onClick: () => void;
  };
  illustration?: ReactNode;
  className?: string;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  secondaryAction,
  illustration,
  className = "",
}: EmptyStateProps) {
  return (
    <div className={`flex flex-col items-center justify-center text-center py-12 px-4 ${className}`}>
      {/* Animated Icon Container */}
      <div className="relative mb-6">
        <div className="absolute inset-0 bg-primary/10 rounded-full blur-2xl animate-pulse-glow" />
        <div className="relative w-20 h-20 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center border border-primary/20">
          <Icon className="w-10 h-10 text-primary animate-scale-in" />
        </div>
      </div>

      {/* Custom Illustration (optional) */}
      {illustration && <div className="mb-6">{illustration}</div>}

      {/* Title */}
      <h3 className="text-xl font-display font-bold text-foreground mb-2 animate-fade-in">
        {title}
      </h3>

      {/* Description */}
      <p className="text-sm text-muted-foreground max-w-md mb-8 animate-fade-in animation-delay-100">
        {description}
      </p>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-3 animate-fade-in animation-delay-200">
        {action && (
          <Button
            onClick={action.onClick}
            size="lg"
            className="gap-2 shadow-lg hover:shadow-xl transition-shadow"
          >
            {action.icon && <action.icon className="w-4 h-4" />}
            {action.label}
          </Button>
        )}
        {secondaryAction && (
          <Button
            onClick={secondaryAction.onClick}
            variant="outline"
            size="lg"
          >
            {secondaryAction.label}
          </Button>
        )}
      </div>
    </div>
  );
}

// Preset Empty States for common scenarios
export function NoDataEmptyState({ 
  onAction, 
  actionLabel = "Get Started",
  title = "No data yet",
  description = "Create your first item to get started."
}: { 
  onAction: () => void;
  actionLabel?: string;
  title?: string;
  description?: string;
}) {
  return (
    <EmptyState
      icon={require("lucide-react").Database}
      title={title}
      description={description}
      action={{ label: actionLabel, onClick: onAction }}
    />
  );
}
