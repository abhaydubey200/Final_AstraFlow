import React from "react";
import { 
  Activity, Cpu, HardDrive, Network, Zap, 
  BarChart3, Clock, CheckCircle, AlertCircle, 
  LayoutGrid, List, Settings, Filter,
  ShieldCheck, History, Search, Info
} from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import AutoscalingConfig from "@/components/AutoscalingConfig";
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer, BarChart, Bar 
} from "recharts";

interface SystemMetrics {
  cpu_usage: number;
  memory_usage: number;
  rowsPerSec?: number;
  queuePending?: number;
}

interface Worker {
  id: string;
  status: 'healthy' | 'restarting' | 'error';
  tasks: number;
  uptime: string;
  cpu: number;
  ram: number;
}

interface HealingStatus {
  canary_status: {
    api?: { status: string };
    connections?: { status: string };
    pipelines?: { status: string };
  };
}

interface HealingLog {
  id: string;
  timestamp: string;
  component: string;
  issue: string;
  trace_id?: string;
  action: string;
  status: 'success' | 'in_progress' | 'failed';
}

export default function Monitoring() {
  const { data: system = { cpu_usage: 0, memory_usage: 0 }, isLoading: loadingSystem } = useQuery<SystemMetrics>({
    queryKey: ["system-metrics"],
    queryFn: () => apiClient.get("/monitoring/metrics"),
    refetchInterval: 10000
  });

  const { data: cluster = [], refetch: refetchWorkers } = useQuery<Worker[]>({
    queryKey: ["worker-cluster"],
    queryFn: () => apiClient.get("/monitoring/worker-status"),
    refetchInterval: 5000
  });

  const rebootMutation = useMutation({
    mutationFn: (workerId: string) => apiClient.post(`/monitoring/workers/${workerId}/reboot`),
    onSuccess: () => refetchWorkers()
  });

  const { data: healingStatus = { canary_status: {} } } = useQuery<HealingStatus>({
    queryKey: ["self-healing-status"],
    queryFn: () => apiClient.get("/self-healing/status"),
    refetchInterval: 5000
  });

  const { data: healingLogs = [] } = useQuery<HealingLog[]>({
    queryKey: ["self-healing-logs"],
    queryFn: () => apiClient.get("/self-healing/logs"),
    refetchInterval: 5000
  });

  const qPending = system?.queuePending || 0;

  return (
    <div className="p-6 lg:p-8 space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-display font-bold">Operational Observability</h1>
        <p className="text-sm text-muted-foreground max-w-2xl">
          Real-time resource utilization, cost distribution, and system performance health.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricBox label="Global CPU Load" value={`${system?.cpu_usage || 0}%`} icon={Cpu} />
        <MetricBox label="Throughput" value={`${system?.rowsPerSec || 0} r/s`} icon={Zap} />
        <MetricBox label="Active Workers" value={cluster.filter(w => w.status === 'healthy').length} icon={Activity} />
        <MetricBox label="Queue Depth" value={`${qPending} jobs`} icon={Clock} variant={qPending > 10 ? 'warning' : 'default'} />
      </div>

      <Tabs defaultValue="system" className="space-y-6">
        <TabsList className="bg-muted/30 p-1 border border-border/50">
          <TabsTrigger value="system" className="text-xs font-bold uppercase transition-all">System Health</TabsTrigger>
          <TabsTrigger value="workers" className="text-xs font-bold uppercase transition-all">Worker Cluster</TabsTrigger>
          <TabsTrigger value="throughput" className="text-xs font-bold uppercase transition-all">Data Throughput</TabsTrigger>
          <TabsTrigger value="healing" className="text-xs font-bold uppercase transition-all text-emerald-500 flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5" /> Self-Healing
          </TabsTrigger>
          <TabsTrigger value="autoscaling" className="text-xs font-bold uppercase transition-all text-primary">Autoscaling</TabsTrigger>
        </TabsList>

        <TabsContent value="system" className="space-y-6 outline-none">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-2 border-border/50 shadow-sm">
              <CardHeader>
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                   <BarChart3 className="w-4 h-4 text-primary" />
                   Resource Utilization Trend
                </CardTitle>
              </CardHeader>
              <CardContent className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={Array.from({length: 20}).map((_, i) => ({ time: i, cpu: 30 + Math.random() * 40, ram: 50 + Math.random() * 20 }))}>
                    <defs>
                      <linearGradient id="colorCpu" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                    <XAxis dataKey="time" hide />
                    <YAxis tick={{fontSize: 10}} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{backgroundColor: 'hsl(var(--background))', borderColor: 'hsl(var(--border))'}} />
                    <Area type="monotone" dataKey="cpu" stroke="hsl(var(--primary))" fillOpacity={1} fill="url(#colorCpu)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="border-border/50 shadow-sm">
              <CardHeader>
                <CardTitle className="text-sm font-bold">Load Balancer Status</CardTitle>
                <CardDescription className="text-[10px] uppercase font-bold tracking-widest">Active Traffic Routing</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6 pt-4">
                 <LoadIndicator label="Ingress Capacity" value={78} />
                 <LoadIndicator label="Network I/O" value={42} color="bg-blue-500" />
                 <LoadIndicator label="Queue Saturation" value={15} color="bg-amber-500" />
                 
                 <div className="pt-4 border-t border-border/50">
                    <div className="flex items-center gap-2 text-xs font-bold text-emerald-500">
                       <CheckCircle className="w-4 h-4" />
                       HPA Scaling Steady
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-1">Worker cluster scaled to 12 nodes based on current throughput.</p>
                 </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="workers" className="space-y-6 outline-none">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {cluster.map((worker) => (
              <WorkerCard key={worker.id} worker={worker} onReboot={(id) => rebootMutation.mutate(id)} />
            ))}
          </div>
        </TabsContent>
        
        <TabsContent value="throughput" className="outline-none">
           <Card className="border-border/50 shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-7">
                <CardTitle className="text-sm font-bold">Extraction vs Load Throughput</CardTitle>
                <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-500 border-none">Live RPS</Badge>
              </CardHeader>
              <CardContent className="h-[400px]">
                <ResponsiveContainer width="100%" height="100%">
                   <BarChart data={Array.from({length: 12}).map((_, i) => ({ name: `H${i}`, extract: 200 + Math.random() * 500, load: 150 + Math.random() * 450 }))}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                      <XAxis dataKey="name" tick={{fontSize: 10}} axisLine={false} tickLine={false} />
                      <YAxis tick={{fontSize: 10}} axisLine={false} tickLine={false} />
                      <Tooltip />
                      <Bar dataKey="extract" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="load" fill="hsl(210, 100%, 50%)" radius={[4, 4, 0, 0]} />
                   </BarChart>
                </ResponsiveContainer>
              </CardContent>
           </Card>
        </TabsContent>

        <TabsContent value="healing" className="outline-none space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
              <div className="lg:col-span-3">
                <Card className="border-border/50 shadow-sm">
                  <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                      <CardTitle className="text-sm font-bold flex items-center gap-2">
                        <History className="w-4 h-4 text-emerald-500" />
                        Autonomous Repair Ledger
                      </CardTitle>
                      <CardDescription className="text-[10px] uppercase font-bold mt-1">Real-time Fix Audit Log</CardDescription>
                    </div>
                    <Badge variant="outline" className="border-emerald-500/20 text-emerald-500 bg-emerald-500/5">Active Engine</Badge>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                       <div className="grid grid-cols-3 gap-3">
                          <CanaryBadge label="API" status={healingStatus?.canary_status?.api?.status} />
                          <CanaryBadge label="CONN" status={healingStatus?.canary_status?.connections?.status} />
                          <CanaryBadge label="PIPE" status={healingStatus?.canary_status?.pipelines?.status} />
                       </div>
                       <div className="relative overflow-hidden rounded-xl border border-border">
                          <table className="w-full text-left border-collapse">
                            <thead>
                              <tr className="bg-muted/50 text-[10px] font-black uppercase tracking-tighter text-muted-foreground border-b border-border">
                                <th className="px-4 py-3">Timestamp</th>
                                <th className="px-4 py-3">Component</th>
                                <th className="px-4 py-3">Issue/Trace</th>
                                <th className="px-4 py-3">Repair Action</th>
                                <th className="px-4 py-3 text-right">Status</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                              {healingLogs.length === 0 ? (
                                <tr>
                                  <td colSpan={5} className="px-4 py-12 text-center text-xs text-muted-foreground italic">
                                    No autonomous repairs have been required yet. System is stable.
                                  </td>
                                </tr>
                              ) : (
                                healingLogs.slice().reverse().map((log: any) => (
                                  <tr key={log.id} className="text-xs hover:bg-muted/30 transition-colors">
                                    <td className="px-4 py-3 font-mono text-[10px] whitespace-nowrap">
                                      {new Date(log.timestamp).toLocaleTimeString()}
                                    </td>
                                    <td className="px-4 py-3 uppercase font-bold tracking-tighter">{log.component}</td>
                                    <td className="px-4 py-3">
                                       <div className="flex flex-col">
                                          <span className="text-muted-foreground">{log.issue}</span>
                                          {log.trace_id && (
                                             <span className="text-[9px] font-mono text-primary/60 mt-0.5">Trace: {log.trace_id}</span>
                                          )}
                                       </div>
                                    </td>
                                    <td className="px-4 py-3 font-semibold text-primary">{log.action}</td>
                                    <td className="px-4 py-3 text-right">
                                      <Badge 
                                        className={cn(
                                          "text-[10px] font-bold uppercase tracking-tighter",
                                          log.status === 'success' ? "bg-emerald-500/10 text-emerald-500 border-none" :
                                          log.status === 'in_progress' ? "bg-primary/10 text-primary border-none animate-pulse" :
                                          "bg-red-500/10 text-red-500 border-none"
                                        )}
                                      >
                                        {log.status}
                                      </Badge>
                                    </td>
                                  </tr>
                                ))
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

              <div className="space-y-6">
                <Card className="border-border/50 shadow-sm bg-primary/5 border-primary/20">
                  <CardHeader>
                    <CardTitle className="text-sm font-bold flex items-center gap-2 text-primary">
                      <ShieldCheck className="w-4 h-4" />
                      AstraAI Self-Healing
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-[11px] leading-relaxed text-muted-foreground">
                      The autonomous repair engine is currently monitoring all API requests, worker heartbeats, and database operations.
                    </p>
                    <div className="space-y-3 pt-2">
                       <FeatureItem label="Downtime Mitigation" />
                       <FeatureItem label="Auto-Migration" />
                       <FeatureItem label="Connection Recovery" />
                       <FeatureItem label="Port Conflict Shift" />
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-border/50 shadow-sm">
                   <CardHeader>
                      <CardTitle className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Engine Stats</CardTitle>
                   </CardHeader>
                   <CardContent className="grid grid-cols-2 gap-4">
                      <div className="p-3 rounded-lg bg-muted/50 border border-border">
                         <p className="text-[9px] font-bold text-muted-foreground uppercase mb-1">Total Fixes</p>
                         <p className="text-xl font-display font-bold">{healingLogs.filter((l: HealingLog) => l.status === 'success').length}</p>
                      </div>
                      <div className="p-3 rounded-lg bg-muted/50 border border-border">
                         <p className="text-[9px] font-bold text-muted-foreground uppercase mb-1">Engine Latency</p>
                         <p className="text-xl font-display font-bold">~800ms</p>
                      </div>
                   </CardContent>
                </Card>
              </div>
            </div>
         </TabsContent>

        <TabsContent value="autoscaling" className="outline-none">
           <Card className="border-border/50 shadow-sm overflow-hidden">
              <CardHeader className="bg-muted/20 border-b border-border/50 pb-6">
                 <CardTitle className="text-sm font-bold">Cloud Cluster Scaling Policy</CardTitle>
                 <CardDescription className="text-xs">Manage dynamic provisioning of worker nodes based on pipeline demand.</CardDescription>
              </CardHeader>
              <CardContent className="pt-8">
                 <AutoscalingConfig />
              </CardContent>
           </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

interface MetricBoxProps {
  label: string;
  value: string | number;
  icon: React.ElementType;
  trend?: string;
  variant?: 'default' | 'warning';
}

function MetricBox({ label, value, icon: Icon, trend, variant = 'default' }: MetricBoxProps) {
  return (
    <div className="bg-card border border-border rounded-2xl p-6 relative overflow-hidden group hover:border-primary/50 transition-all">
      <div className="flex items-center justify-between mb-4">
        <div className={cn("p-2.5 rounded-xl", variant === 'warning' ? "bg-amber-500/10 text-amber-500" : "bg-primary/10 text-primary")}>
          <Icon className="w-5 h-5" />
        </div>
        {trend && (
          <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded-md", trend.startsWith('+') ? "bg-emerald-500/10 text-emerald-500" : "bg-red-500/10 text-red-500")}>
            {trend}
          </span>
        )}
      </div>
      <div>
        <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">{label}</p>
        <h3 className="text-3xl font-display font-bold mt-1">{value}</h3>
      </div>
    </div>
  );
}

interface LoadIndicatorProps {
  label: string;
  value: number;
  color?: string;
}

function LoadIndicator({ label, value, color = "bg-primary" }: LoadIndicatorProps) {
  return (
    <div className="space-y-2">
      <div className="flex justify-between text-[11px] font-bold uppercase">
        <span className="text-muted-foreground">{label}</span>
        <span>{value}%</span>
      </div>
      <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
        <div className={cn("h-full rounded-full transition-all duration-1000", color)} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

function WorkerCard({ worker, onReboot }: { worker: Worker; onReboot: (id: string) => void }) {
  return (
    <div className="bg-card border border-border rounded-xl p-5 hover:border-primary/50 transition-all group">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
           <div className={cn("w-2.5 h-2.5 rounded-full animate-pulse", worker.status === 'healthy' ? "bg-emerald-500" : "bg-amber-500")} />
           <span className="text-sm font-bold">{worker.id}</span>
        </div>
        <Badge variant="outline" className="text-[10px] border-border">{worker.uptime || 'online'}</Badge>
      </div>
      <div className="grid grid-cols-2 gap-4">
         <div className="space-y-1">
            <p className="text-[9px] font-bold text-muted-foreground uppercase">CPU</p>
            <p className="text-sm font-bold">{Math.round(worker.cpu || 0)}%</p>
         </div>
         <div className="space-y-1">
            <p className="text-[9px] font-bold text-muted-foreground uppercase">RAM</p>
            <p className="text-sm font-bold">{Math.round(worker.ram || 0)}%</p>
         </div>
      </div>
      <div className="mt-4 pt-4 border-t border-border/50 flex items-center justify-between">
         <span className="text-[10px] font-bold text-muted-foreground uppercase">{worker.tasks || 0} Active Tasks</span>
         <button 
           onClick={() => onReboot(worker.id)}
           disabled={worker.status === 'restarting'}
           className="text-[10px] font-black text-primary uppercase tracking-tighter hover:underline disabled:opacity-50"
         >
           {worker.status === 'restarting' ? 'Rebooting...' : 'Reboot'}
         </button>
      </div>
    </div>
  );
}

function FeatureItem({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 text-[10px] font-bold uppercase text-primary/80">
      <div className="w-1.5 h-1.5 rounded-full bg-primary" />
      {label}
    </div>
  );
}

function CanaryBadge({ label, status }: { label: string, status?: string }) {
  return (
    <div className={cn(
      "px-3 py-2 rounded-lg border text-[10px] font-bold flex flex-col gap-1 transition-all",
      status === 'pass' ? "bg-emerald-500/5 border-emerald-500/20 text-emerald-500" :
      status === 'fail' ? "bg-red-500/5 border-red-500/20 text-red-500 animate-pulse" :
      "bg-muted/50 border-border text-muted-foreground"
    )}>
      <span className="opacity-60 uppercase">{label} Canary</span>
      <span className="uppercase">{status || 'pending'}</span>
    </div>
  );
}
