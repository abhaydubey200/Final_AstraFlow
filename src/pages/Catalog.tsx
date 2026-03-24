import React, { useState } from "react";
import { 
  Search, Database, GitBranch, Search as SearchIcon, 
  Filter, Layers, ChevronRight, Activity, Shield, 
  Tag, Info, AlertCircle, LayoutGrid, List
} from "lucide-react";
import { usePipelines } from "@/hooks/use-pipelines";
import { useConnections } from "@/hooks/use-connections";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import DatasetDetail from "./DatasetDetail";

export interface CatalogDataset {
  id: string;
  dataset_name: string;
  source_system: string;
  description?: string;
  has_pii: boolean;
  owner?: string;
  created_at: string;
  updated_at: string;
  schema_json: Record<string, unknown>;
}

export default function Catalog() {
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [selectedDataset, setSelectedDataset] = useState<CatalogDataset | null>(null);
  
  const { data: pipelines = [] } = usePipelines();
  const { data: connections = [] } = useConnections();
  
  const { data: datasets = [], isLoading: loadingDatasets } = useQuery({
    queryKey: ["catalog-datasets", search],
    queryFn: () => apiClient.get<CatalogDataset[]>(`/catalog/search?q=${search}`),
  });

  if (selectedDataset) {
    return <DatasetDetail dataset={selectedDataset} onBack={() => setSelectedDataset(null)} />;
  }

  return (
    <div className="p-6 lg:p-8 space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-display font-bold text-foreground bg-gradient-to-r from-foreground to-muted-foreground bg-clip-text text-transparent">
          Enterprise Data Catalog
        </h1>
        <p className="text-sm text-muted-foreground max-w-2xl">
          Discover, govern, and analyze datasets across your entire ecosystem. 
          Enforce compliance and track data lineage across all pipelines.
        </p>
      </div>

      <div className="flex items-center gap-4 bg-card shadow-sm p-4 rounded-xl border border-border">
        <div className="relative flex-1 group">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
          <input
            type="text"
            placeholder="Search keywords, columns, or owners..."
            className="w-full bg-muted/50 border-border rounded-lg pl-10 pr-4 py-2.5 text-sm transition-all focus:ring-2 focus:ring-primary/20 focus:border-primary"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="h-6 w-px bg-border mx-2" />
        <div className="flex bg-muted/50 p-1 rounded-lg border border-border">
          <button 
            onClick={() => setViewMode('grid')}
            className={cn("p-1.5 rounded-md transition-all", viewMode === 'grid' ? "bg-background text-primary shadow-sm" : "text-muted-foreground hover:text-foreground")}
          >
            <LayoutGrid className="w-4 h-4" />
          </button>
          <button 
            onClick={() => setViewMode('list')}
            className={cn("p-1.5 rounded-md transition-all", viewMode === 'list' ? "bg-background text-primary shadow-sm" : "text-muted-foreground hover:text-foreground")}
          >
            <List className="w-4 h-4" />
          </button>
        </div>
        <button className="flex items-center gap-2 px-4 py-2.5 bg-muted/50 hover:bg-muted border border-border rounded-lg text-xs font-bold transition-all">
          <Filter className="w-3.5 h-3.5" />
          Refine
        </button>
      </div>

      <Tabs defaultValue="datasets" className="space-y-6">
        <div className="flex items-center justify-between border-b border-border pb-px">
          <TabsList className="bg-transparent h-auto p-0 gap-8">
            <TabsTrigger value="datasets" className="bg-transparent data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-0 pb-3 text-xs font-bold uppercase tracking-widest text-muted-foreground transition-all">Datasets</TabsTrigger>
            <TabsTrigger value="pipelines" className="bg-transparent data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-0 pb-3 text-xs font-bold uppercase tracking-widest text-muted-foreground transition-all">Pipelines</TabsTrigger>
            <TabsTrigger value="connections" className="bg-transparent data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-0 pb-3 text-xs font-bold uppercase tracking-widest text-muted-foreground transition-all">Infrastructure</TabsTrigger>
          </TabsList>
          <span className="text-[10px] uppercase font-black text-muted-foreground/30 hidden sm:block tracking-[0.2em]">Source: Global Metadata Service</span>
        </div>

        <TabsContent value="datasets" className="space-y-4 outline-none">
          <div className={cn(
            "grid gap-6",
            viewMode === 'grid' ? "grid-cols-1 md:grid-cols-2 lg:grid-cols-3" : "grid-cols-1"
          )}>
            {loadingDatasets ? (
              [1, 2, 3].map(i => <div key={i} className="h-64 rounded-xl bg-muted/20 animate-pulse border border-border/50" />)
            ) : (
              datasets.map((ds: CatalogDataset) => (
                <DatasetCard 
                  key={ds.id} 
                  dataset={ds} 
                  viewMode={viewMode} 
                  onClick={() => setSelectedDataset(ds)}
                />
              ))
            )}
          </div>
          {!loadingDatasets && datasets.length === 0 && (
            <div className="text-center py-20 border-2 border-dashed border-border rounded-2xl">
              <Database className="w-12 h-12 text-muted-foreground opacity-20 mx-auto mb-4" />
              <p className="text-muted-foreground font-medium">No results found for "{search}"</p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="pipelines" className="outline-none">
          <div className="grid grid-cols-1 gap-3">
             {pipelines.filter(p => p.name.toLowerCase().includes(search.toLowerCase())).map(p => (
               <div key={p.id} className="flex items-center justify-between p-4 bg-card border border-border rounded-lg hover:border-primary/50 hover:shadow-lg hover:shadow-primary/5 transition-all group">
                 <div className="flex items-center gap-4">
                    <div className="p-3 bg-primary/10 rounded-xl text-primary group-hover:bg-primary group-hover:text-white transition-all shadow-sm">
                      <GitBranch className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold">{p.name}</h4>
                      <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground mt-0.5">{p.schedule_type} • Created {new Date(p.created_at).toLocaleDateString()}</p>
                    </div>
                 </div>
                 <div className="flex items-center gap-8">
                    <div className="flex -space-x-2">
                       {[1, 2, 3].map(i => <div key={i} className="w-7 h-7 rounded-full bg-muted border-2 border-background flex items-center justify-center font-bold text-[8px] text-muted-foreground">U{i}</div>)}
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                 </div>
               </div>
             ))}
          </div>
        </TabsContent>
        
        <TabsContent value="connections" className="outline-none">
            <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
              <table className="w-full text-xs text-left">
                <thead className="bg-muted/30 border-b border-border">
                  <tr>
                    <th className="px-6 py-4 font-bold uppercase tracking-wider text-muted-foreground">Source System</th>
                    <th className="px-6 py-4 font-bold uppercase tracking-wider text-muted-foreground">Provider</th>
                    <th className="px-6 py-4 font-bold uppercase tracking-wider text-muted-foreground">Stability</th>
                    <th className="px-6 py-4 font-bold uppercase tracking-wider text-muted-foreground">Security</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                   {connections.map(c => (
                     <tr key={c.id} className="hover:bg-muted/10 transition-colors">
                       <td className="px-6 py-5 font-bold flex items-center gap-3">
                         <div className="w-8 h-8 rounded-lg bg-primary/5 flex items-center justify-center text-primary">
                           <Database className="w-4 h-4" />
                         </div>
                         {c.name}
                       </td>
                       <td className="px-6 py-5 font-display text-[10px] uppercase font-black text-muted-foreground">{c.type}</td>
                       <td className="px-6 py-5">
                         <div className="flex items-center gap-2">
                            <div className={cn("w-1.5 h-1.5 rounded-full", c.status === 'connected' ? "bg-emerald-500 animate-pulse" : "bg-muted")} />
                            <span className={cn("font-bold uppercase tracking-tighter text-[9px]", c.status === 'connected' ? "text-emerald-500" : "text-muted-foreground")}>
                              {c.status === 'connected' ? 'Steady' : 'Disconnected'}
                            </span>
                         </div>
                       </td>
                       <td className="px-6 py-5 flex items-center gap-2">
                         {c.ssl_enabled && <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-500 border-none text-[8px] h-5">SSL</Badge>}
                         <Badge variant="secondary" className="bg-muted text-muted-foreground border-none text-[8px] h-5">AES-256</Badge>
                       </td>
                     </tr>
                   ))}
                </tbody>
              </table>
            </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function DatasetCard({ dataset, viewMode, onClick }: { dataset: CatalogDataset, viewMode: 'grid' | 'list', onClick: () => void }) {
  if (viewMode === 'list') {
    return (
      <div 
        onClick={onClick}
        className="bg-card border border-border rounded-xl p-4 flex items-center justify-between hover:border-primary/50 hover:shadow-lg hover:shadow-primary/5 transition-all cursor-pointer group"
      >
        <div className="flex items-center gap-4">
          <div className="p-3 bg-primary/10 rounded-xl text-primary group-hover:bg-primary group-hover:text-white transition-all shadow-sm">
            <Layers className="w-4 h-4" />
          </div>
          <div>
            <h4 className="font-bold text-sm tracking-tight">{dataset.dataset_name}</h4>
            <div className="flex items-center gap-3 mt-0.5">
              <span className="text-[9px] uppercase font-black text-primary/50 tracking-widest">{dataset.source_system}</span>
              <div className="h-1 w-1 rounded-full bg-border" />
              <span className="text-[9px] text-muted-foreground font-medium italic">Synchronized 12m ago</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-6">
          {dataset.has_pii && (
            <Badge variant="outline" className="text-[8px] h-5 bg-amber-500/10 text-amber-500 border-amber-500/30 font-black tracking-widest uppercase">PII</Badge>
          )}
          <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
        </div>
      </div>
    );
  }

  return (
    <div 
      onClick={onClick}
      className="bg-card border border-border rounded-2xl overflow-hidden hover:shadow-2xl hover:shadow-primary/10 hover:-translate-y-1 transition-all duration-300 cursor-pointer group flex flex-col h-full"
    >
      <div className="p-6 space-y-5 flex-1">
        <div className="flex justify-between items-start">
          <div className="p-3 bg-muted rounded-xl text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary transition-all shadow-sm">
            <Layers className="w-5 h-5" />
          </div>
          <div className="flex gap-2">
            {dataset.has_pii && (
              <Badge variant="outline" className="bg-amber-500 text-amber-500 border-amber-500/20 bg-amber-500/5 text-[9px] h-6 font-bold uppercase tracking-tight">PII</Badge>
            )}
            <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 text-[9px] h-6 font-bold uppercase tracking-tight">
              {dataset.source_system}
            </Badge>
          </div>
        </div>
        <div>
          <h4 className="font-display font-bold text-lg mb-2 group-hover:text-primary transition-colors">{dataset.dataset_name}</h4>
          <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
            {dataset.description || "Production data asset synchronized for operational analytics and master data management."}
          </p>
        </div>
      </div>
      <div className="px-6 py-4 bg-muted/20 border-t border-border/50 flex items-center justify-between mt-auto">
        <div className="flex items-center gap-2">
           <div className="w-6 h-6 rounded-lg bg-primary/20 flex items-center justify-center text-[10px] font-black tracking-tighter">AD</div>
           <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Abhay Dubey</span>
        </div>
        <ChevronRight className="w-4 h-4 text-primary opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
      </div>
    </div>
  );
}
