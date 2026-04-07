import React, { useState } from "react";
import { 
  ArrowLeft, Database, Table, Info, GitBranch, 
  Search, Filter, ChevronRight, Activity, Tag, 
  ExternalLink, Clock, User, AlertCircle, Save
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { LineageGraph } from "@/components/LineageGraph";
import { cn } from "@/lib/utils";
import { 
  Sheet, SheetContent, SheetDescription, SheetHeader, 
  SheetTitle, SheetTrigger 
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";

import { CatalogDataset } from "./Catalog";

interface DatasetDetailProps {
  dataset: CatalogDataset & { columns?: any[] }; // Temporary bridge until columns are fully typed
  onBack: () => void;
}

export default function DatasetDetail({ dataset, onBack }: DatasetDetailProps) {
  const [activeTab, setActiveTab] = useState("overview");

  return (
    <div className="space-y-8 animate-in slide-in-from-right-4 duration-500">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <button 
          onClick={onBack}
          className="flex items-center gap-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors w-fit"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to Catalog
        </button>
        
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-primary/10 rounded-xl text-primary">
              <Database className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-display font-bold text-foreground">{dataset.dataset_name}</h1>
                <Badge variant="outline" className="text-[10px] uppercase font-bold tracking-tight bg-primary/5 border-primary/20 text-primary">
                  {dataset.source_system}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground mt-1">{dataset.description || "Operational dataset synchronized from production environment."}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Sheet>
              <SheetTrigger asChild>
                <button className="px-4 py-2 bg-muted text-foreground rounded-lg text-xs font-bold flex items-center gap-2 hover:bg-muted/80 transition-all">
                  <GitBranch className="w-3.5 h-3.5" />
                  Impact Analysis
                </button>
              </SheetTrigger>
              <SheetContent className="w-[400px] sm:w-[540px]">
                <SheetHeader className="space-y-1">
                  <SheetTitle className="text-xl font-display font-bold flex items-center gap-2">
                    <AlertCircle className="w-5 h-5 text-amber-500" />
                    Downstream Impact Analysis
                  </SheetTitle>
                  <SheetDescription className="text-sm">
                    Analyze which systems and users will be affected by changes to <strong>{dataset.dataset_name}</strong>.
                  </SheetDescription>
                </SheetHeader>
                <div className="mt-8 space-y-8">
                  <div className="space-y-4">
                    <h4 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Affected Dashboards</h4>
                    <div className="grid grid-cols-1 gap-3">
                      <ImpactAssetCard name="Revenue Analytics" type="Dashboard" risk="High" />
                      <ImpactAssetCard name="Daily Sales Report" type="Tableau" risk="Medium" />
                    </div>
                  </div>
                  <Separator />
                  <div className="space-y-4">
                    <h4 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Downstream Pipelines</h4>
                    <div className="grid grid-cols-1 gap-3">
                      <ImpactAssetCard name="Financial_Summary_Sync" type="ETL" risk="Critical" />
                      <ImpactAssetCard name="Customer_Churn_Model" type="ML Training" risk="High" />
                    </div>
                  </div>
                  <Separator />
                  <div className="bg-muted/30 p-4 rounded-xl space-y-2">
                    <div className="flex items-center gap-2 text-xs font-bold">
                       <User className="w-3.5 h-3.5 text-primary" />
                       Primary Stakeholders (4)
                    </div>
                    <div className="flex -space-x-2">
                       {[1,2,3,4].map(i => (
                         <div key={i} className="w-8 h-8 rounded-full bg-primary/20 border-2 border-background flex items-center justify-center text-[10px] font-bold">U{i}</div>
                       ))}
                       <div className="w-8 h-8 rounded-full bg-muted border-2 border-background flex items-center justify-center text-[10px] font-bold text-muted-foreground">+</div>
                    </div>
                  </div>
                </div>
              </SheetContent>
            </Sheet>
            <button className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-xs font-bold flex items-center gap-2 shadow-lg shadow-primary/20 hover:scale-[1.02] transition-all">
              <Activity className="w-3.5 h-3.5" />
              Sync Now
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Sidebar Stats */}
        <div className="space-y-6">
          <div className="bg-card border border-border rounded-xl p-5 space-y-4">
            <h3 className="text-xs font-display font-bold text-foreground uppercase tracking-wider">Asset Metadata</h3>
            <div className="space-y-3">
              <MetricRow label="Rows" value="12.4M" />
              <MetricRow label="Size" value="4.2 GB" />
              <MetricRow label="Freshness" value="12m ago" />
              <MetricRow label="Owner" value="Abhay Dubey" />
            </div>
            <div className="pt-4 border-t border-border/50">
               <div className="text-[10px] text-muted-foreground uppercase font-bold mb-2">Service Health</div>
               <div className="flex items-center justify-between mb-1.5 text-[10px]">
                 <span>Uptime</span>
                 <span>99.9%</span>
               </div>
               <Progress value={99.9} className="h-1" />
            </div>
          </div>

        </div>

        {/* Content Tabs */}
        <div className="lg:col-span-3 space-y-6">
          <Tabs defaultValue="overview" className="w-full" onValueChange={setActiveTab}>
            <TabsList className="bg-muted/30 p-1 border border-border/50">
              <TabsTrigger value="overview" className="text-xs">Overview</TabsTrigger>
              <TabsTrigger value="schema" className="text-xs">Schema Explorer</TabsTrigger>
              <TabsTrigger value="lineage" className="text-xs">Data Lineage</TabsTrigger>
              <TabsTrigger value="samples" className="text-xs">Data Samples</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="pt-6 space-y-8">
              <div className="grid grid-cols-1 gap-6">
                 <div className="bg-card border border-border rounded-xl p-6 space-y-4">
                    <div className="flex justify-between items-center">
                       <h4 className="text-sm font-bold flex items-center gap-2">
                         <Info className="w-4 h-4 text-primary" />
                         Technical context
                       </h4>
                       <button className="text-xs font-medium text-primary hover:underline">Edit</button>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Primary transactional ledger for the e-commerce engine. This table contains verified order records used in financial reporting and customer service modules.
                    </p>
                    <div className="flex flex-wrap gap-2 pt-2">
                       {["Transactional", "Finance", "Daily_Refresh"].map(t => (
                         <Badge key={t} variant="secondary" className="bg-muted/50 text-[10px] font-medium">{t}</Badge>
                       ))}
                       <button className="p-1 rounded-full border border-dashed border-border text-muted-foreground hover:text-primary transition-colors">
                         <Plus className="w-3 h-3" />
                       </button>
                    </div>
                 </div>
              </div>

              <div className="space-y-4">
                 <h4 className="text-sm font-bold">Upstream Dependencies</h4>
                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <DependencyCard name="MySQL Prod" type="Source Database" />
                    <DependencyCard name="Order Extract Pipeline" type="AstraFlow Pipeline" />
                 </div>
              </div>
            </TabsContent>

            <TabsContent value="schema" className="pt-6">
              <div className="bg-card border border-border rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-muted/50 border-b border-border">
                    <tr>
                      <th className="px-6 py-3 font-semibold text-muted-foreground uppercase tracking-wider">Column</th>
                      <th className="px-6 py-3 font-semibold text-muted-foreground uppercase tracking-wider">Type</th>
                      <th className="px-6 py-3 font-semibold text-muted-foreground uppercase tracking-wider">Nulls</th>
                      <th className="px-6 py-3 font-semibold text-muted-foreground uppercase tracking-wider">Sensitivity</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {dataset.columns?.map((col: any) => (
                      <tr key={col.column_name} className="hover:bg-muted/20 transition-colors">
                        <td className="px-6 py-4 font-bold flex items-center gap-2">
                          <Table className="w-3.5 h-3.5 text-muted-foreground" />
                          {col.column_name}
                        </td>
                        <td className="px-6 py-4 font-display uppercase tracking-widest text-[9px] opacity-70">{col.data_type}</td>
                        <td className="px-6 py-4 font-display">0.0%</td>
                        <td className="px-6 py-4">
                           {col.sensitivity_level === 'pii' || col.column_name.includes('email') ? (
                             <Badge variant="outline" className="text-[8px] h-4 bg-amber-500/10 text-amber-500 border-amber-500/30 uppercase font-black">PII</Badge>
                           ) : (
                             <Badge variant="outline" className="text-[8px] h-4 bg-primary/5 text-primary border-primary/20 uppercase font-black">Internal</Badge>
                           )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </TabsContent>

            <TabsContent value="lineage" className="pt-6 space-y-6">
               <LineageGraph 
                 pipelineName="Sync_Orders_to_Warehouse" 
                 sourceTable="production.orders" 
                 targetTable="analytics.orders_refined" 
               />
               
               <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-5 flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-amber-500 mt-0.5" />
                  <div className="space-y-1">
                     <h4 className="text-xs font-bold text-amber-500 uppercase">Lineage Alert</h4>
                     <p className="text-xs text-muted-foreground">Upstream schema data has diverged. The source system "MySQL Prod" added 2 columns which are not yet mapped in this pipeline lineage.</p>
                  </div>
               </div>
            </TabsContent>

            <TabsContent value="samples" className="pt-6">
               <div className="flex flex-col items-center justify-center py-20 bg-muted/10 rounded-2xl border-2 border-dashed border-border">
                  <Lock className="w-10 h-10 text-muted-foreground opacity-20 mb-4" />
                  <h3 className="text-sm font-bold">Data Preview Restricted</h3>
                  <p className="text-xs text-muted-foreground max-w-xs text-center mt-2 leading-relaxed">
                    Previews for this dataset are disabled due to PII content. Request temporary access to view sample data.
                  </p>
                  <button className="mt-6 px-4 py-2 border border-primary text-primary hover:bg-primary/5 rounded-lg text-xs font-bold transition-all">
                    Request Data Access
                  </button>
               </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}

const MetricRow = ({ label, value }: { label: string, value: string }) => (
  <div className="flex items-center justify-between">
    <span className="text-xs text-muted-foreground">{label}</span>
    <span className="text-xs font-display font-bold text-foreground">{value}</span>
  </div>
);

const DependencyCard = ({ name, type }: { name: string, type: string }) => (
  <div className="bg-card border border-border rounded-lg p-3 hover:border-primary/50 transition-colors cursor-pointer group">
    <div className="flex items-center gap-3">
      <div className="p-1.5 bg-muted rounded text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary transition-colors">
        <GitBranch className="w-3.5 h-3.5" />
      </div>
      <div>
        <p className="text-[11px] font-bold text-foreground">{name}</p>
        <p className="text-[9px] text-muted-foreground">{type}</p>
      </div>
    </div>
  </div>
);

const Plus = ({ className }: { className?: string }) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /><path d="M12 5v14" /></svg>
);

const Lock = ({ className }: { className?: string }) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
);

const ImpactAssetCard = ({ name, type, risk }: { name: string, type: string, risk: string }) => (
  <div className="flex items-center justify-between p-4 bg-muted/20 border border-border rounded-xl group hover:border-primary/50 transition-all">
    <div className="flex items-center gap-3">
      <div className="w-10 h-10 rounded-lg bg-card border border-border flex items-center justify-center group-hover:bg-primary/5 group-hover:text-primary transition-all">
        <LayoutGrid className="w-5 h-5" />
      </div>
      <div>
        <p className="text-xs font-bold">{name}</p>
        <p className="text-[10px] text-muted-foreground">{type}</p>
      </div>
    </div>
    <Badge variant="outline" className={cn(
      "text-[9px] font-bold uppercase",
      risk === 'Critical' ? "bg-red-500/10 text-red-500 border-red-500/20" :
      risk === 'High' ? "bg-amber-500/10 text-amber-500 border-amber-500/20" :
      "bg-primary/10 text-primary border-primary/20"
    )}>
      {risk} Risk
    </Badge>
  </div>
);

const LayoutGrid = ({ className }: { className?: string }) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="7" height="7" x="3" y="3" rx="1" /><rect width="7" height="7" x="14" y="3" rx="1" /><rect width="7" height="7" x="14" y="14" rx="1" /><rect width="7" height="7" x="3" y="14" rx="1" /></svg>
);
