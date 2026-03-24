import React from "react";
import { cn } from "@/lib/utils";
import { CheckCircle2, Circle, Clock, AlertCircle, Loader2 } from "lucide-react";
import { Progress } from "@/components/ui/progress";

export interface TaskState {
  id: string;
  name: string;
  status: "pending" | "running" | "success" | "failed" | "retrying";
  progress: number;
  duration?: string;
}

interface ExecutionTimelineProps {
  tasks: TaskState[];
  className?: string;
}

export const ExecutionTimeline = ({ tasks, className }: ExecutionTimelineProps) => {
  return (
    <div className={cn("space-y-4 py-4", className)}>
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Execution Progress</h4>
        <span className="text-[10px] font-medium text-primary bg-primary/10 px-2 py-0.5 rounded-full">
          {tasks.filter(t => t.status === "success").length} / {tasks.length} Completed
        </span>
      </div>
      
      <div className="relative space-y-6 before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-0.5 before:bg-border">
        {tasks.map((task) => (
          <div key={task.id} className="relative pl-8 group">
            <div className={cn(
              "absolute left-0 top-1 w-6 h-6 rounded-full border-2 bg-background flex items-center justify-center z-10 transition-colors",
              task.status === "success" ? "border-success text-success" :
              task.status === "running" ? "border-primary text-primary" :
              task.status === "failed" ? "border-destructive text-destructive" :
              task.status === "retrying" ? "border-warning text-warning" :
              "border-muted text-muted-foreground"
            )}>
              {task.status === "success" && <CheckCircle2 className="w-3.5 h-3.5" />}
              {task.status === "running" && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {task.status === "failed" && <AlertCircle className="w-3.5 h-3.5" />}
              {task.status === "retrying" && <Clock className="w-3.5 h-3.5 animate-pulse" />}
              {task.status === "pending" && <Circle className="w-3.5 h-3.5 fill-current opacity-20" />}
            </div>
            
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <span className={cn(
                  "text-xs font-semibold capitalize",
                  task.status === "running" ? "text-primary" : "text-foreground"
                )}>
                  {task.name}
                </span>
                <span className="text-[10px] text-muted-foreground font-display">
                  {task.duration || (task.status === "running" ? "Calculating..." : "")}
                </span>
              </div>
              
              <div className="flex items-center gap-3">
                <Progress value={task.progress} className="h-1 flex-1" />
                <span className="text-[10px] font-display font-medium w-8 text-right">
                  {Math.round(task.progress)}%
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
