import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Database, Table, ArrowRight, ArrowLeft, CheckCircle2, Search, Loader2 } from "lucide-react";
import { useTestConnection, useCreateConnection, useSchemaDiscovery } from "@/hooks/use-connections";
import { usePipelines } from "@/hooks/use-pipelines";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface OnboardingWizardProps {
  isOpen: boolean;
  onClose: () => void;
}

const STEPS = [
  { id: 1, title: "Connect Source", description: "Choose where your data lives" },
  { id: 2, title: "Select Tables", description: "Discover and pick what to sync" },
  { id: 3, title: "Set Destination", description: "Choose your target warehouse" },
  { id: 4, title: "Review & Launch", description: "Confirm and start syncing" }
];

export const OnboardingWizard = ({ isOpen, onClose }: OnboardingWizardProps) => {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    name: "My Source DB",
    type: "postgresql",
    host: "",
    port: "5432",
    database: "",
    username: "",
    password: "",
  });

  const [discoveredTables, setDiscoveredTables] = useState<any[]>([]);
  const [selectedTables, setSelectedTables] = useState<string[]>([]);
  const [connectionId, setConnectionId] = useState<string | null>(null);

  const testMutation = useTestConnection();
  const createMutation = useCreateConnection();
  const discoverMutation = useSchemaDiscovery();

  const handleNext = async () => {
    if (step === 1) {
      // Test and Create connection
      const res = await testMutation.mutateAsync(formData);
      if (res.success) {
        const createRes = await createMutation.mutateAsync({
           ...formData,
           database_name: formData.database
        } as any);
        setConnectionId(createRes.id);
        toast.success("Connection established!");
        
        // Start discovery
        const discoveryRes = await discoverMutation.mutateAsync({ 
          connection_id: createRes.id,
          password: formData.password 
        });
        setDiscoveredTables(discoveryRes.tables || []);
        setStep(2);
      } else {
        toast.error(res.error || "Connection failed");
      }
    } else if (step === 2) {
      if (selectedTables.length === 0) {
        toast.error("Please select at least one table");
        return;
      }
      setStep(3);
    } else if (step === 3) {
      setStep(4);
    } else if (step === 4) {
      toast.success("Pipeline created successfully!");
      onClose();
    }
  };

  const toggleTable = (tableName: string) => {
    setSelectedTables(prev => 
      prev.includes(tableName) 
        ? prev.filter(t => t !== tableName) 
        : [...prev, tableName]
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl h-[600px] flex flex-col p-0 overflow-hidden">
        <div className="flex-1 flex overflow-hidden">
          {/* Sidebar Progress */}
          <div className="w-64 bg-muted/30 border-r border-border p-6 space-y-8 hidden md:block">
            <div className="space-y-1">
              <h2 className="text-xl font-display font-bold text-primary">AstraFlow</h2>
              <p className="text-xs text-muted-foreground">Setup Wizard</p>
            </div>
            
            <div className="space-y-6">
              {STEPS.map((s) => (
                <div key={s.id} className="flex gap-3">
                  <div className={cn(
                    "w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold border-2 transition-colors",
                    step === s.id ? "border-primary bg-primary text-primary-foreground" : 
                    step > s.id ? "border-primary bg-primary/20 text-primary" : "border-muted-foreground/30 text-muted-foreground"
                  )}>
                    {step > s.id ? <CheckCircle2 className="w-3.5 h-3.5" /> : s.id}
                  </div>
                  <div>
                    <p className={cn("text-xs font-semibold", step === s.id ? "text-foreground" : "text-muted-foreground")}>{s.title}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{s.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Core Content */}
          <div className="flex-1 flex flex-col p-8 overflow-hidden">
            <div className="flex-1 overflow-y-auto pr-2">
              {step === 1 && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-display font-bold">Connect your source</h3>
                    <p className="text-sm text-muted-foreground mt-1">First, tell us where your data is stored.</p>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Connection Name</Label>
                      <Input placeholder="Source Database" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
                    </div>
                    <div className="space-y-2">
                      <Label>Host</Label>
                      <Input placeholder="db.example.com" value={formData.host} onChange={e => setFormData({...formData, host: e.target.value})} />
                    </div>
                    <div className="space-y-2">
                      <Label>Database</Label>
                      <Input placeholder="production" value={formData.database} onChange={e => setFormData({...formData, database: e.target.value})} />
                    </div>
                    <div className="space-y-2">
                      <Label>Username</Label>
                      <Input placeholder="admin" value={formData.username} onChange={e => setFormData({...formData, username: e.target.value})} />
                    </div>
                    <div className="space-y-2 col-span-2">
                      <Label>Password</Label>
                      <Input type="password" placeholder="••••••••" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} />
                    </div>
                  </div>
                </div>
              )}

              {step === 2 && (
                <div className="space-y-6 h-full flex flex-col">
                  <div>
                    <h3 className="text-lg font-display font-bold">What should we sync?</h3>
                    <p className="text-sm text-muted-foreground mt-1">We found {discoveredTables.length} tables. Select the ones you need.</p>
                  </div>

                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input placeholder="Search tables..." className="pl-9" />
                  </div>

                  <div className="flex-1 overflow-y-auto border border-border rounded-md">
                    {discoverMutation.isPending ? (
                      <div className="p-12 flex flex-col items-center justify-center space-y-3">
                        <Loader2 className="w-8 h-8 animate-spin text-primary" />
                        <p className="text-sm text-muted-foreground">Discovering schema and metrics...</p>
                      </div>
                    ) : (
                      <div className="divide-y divide-border">
                        {discoveredTables.map((t) => (
                          <div 
                            key={t.table_name} 
                            onClick={() => toggleTable(t.table_name)}
                            className={cn(
                              "p-3 flex items-center justify-between cursor-pointer hover:bg-muted/50 transition-colors",
                              selectedTables.includes(t.table_name) && "bg-primary/5"
                            )}
                          >
                            <div className="flex items-center gap-3">
                              <div className={cn(
                                "w-4 h-4 rounded border flex items-center justify-center transition-colors",
                                selectedTables.includes(t.table_name) ? "bg-primary border-primary" : "border-muted-foreground/30"
                              )}>
                                {selectedTables.includes(t.table_name) && <CheckCircle2 className="w-3 h-3 text-white" />}
                              </div>
                              <div>
                                <p className="text-sm font-medium">{t.table_name}</p>
                                <p className="text-[10px] text-muted-foreground">{t.schema_name} • {t.columns?.length} columns</p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-xs font-display font-semibold">~{t.row_count_estimate?.toLocaleString() || 0} rows</p>
                              <p className="text-[10px] text-muted-foreground">Estimate</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {step === 3 && (
                <div className="space-y-6">
                   <div>
                    <h3 className="text-lg font-display font-bold">Pick a target</h3>
                    <p className="text-sm text-muted-foreground mt-1">Where should the data be loaded?</p>
                  </div>
                  <div className="grid grid-cols-1 gap-4">
                    <div className="p-4 rounded-lg border-2 border-primary bg-primary/5 flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                          <Database className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                          <p className="text-sm font-bold">Snowflake Data Warehouse</p>
                          <p className="text-xs text-muted-foreground">Default Enterprise Destination</p>
                        </div>
                      </div>
                      <CheckCircle2 className="w-5 h-5 text-primary" />
                    </div>
                  </div>
                </div>
              )}

              {step === 4 && (
                <div className="space-y-6">
                   <div>
                    <h3 className="text-lg font-display font-bold">Review Pipeline</h3>
                    <p className="text-sm text-muted-foreground mt-1">Does everything look correct?</p>
                  </div>
                  
                  <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-4">
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-muted-foreground">Source</span>
                      <span className="font-semibold">{formData.name}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-muted-foreground">Target</span>
                      <span className="font-semibold text-primary">Snowflake Warehouse</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-muted-foreground">Tables to Sync</span>
                      <span className="font-semibold">{selectedTables.length}</span>
                    </div>
                    <div className="pt-2 border-t border-border">
                      <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Tables</p>
                      <div className="flex flex-wrap gap-1 mt-2">
                        {selectedTables.map(t => (
                          <span key={t} className="px-2 py-0.5 rounded-full bg-muted text-[10px] border border-border">{t}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="pt-6 mt-6 border-t border-border flex justify-between items-center">
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setStep(s => s - 1)} 
                disabled={step === 1}
              >
                <ArrowLeft className="w-4 h-4 mr-1.5" /> Back
              </Button>
              <Button size="sm" onClick={handleNext} disabled={testMutation.isPending}>
                {testMutation.isPending ? "Testing..." : (
                  <>
                    {step === 4 ? "Create Pipeline" : "Next Step"} <ArrowRight className="w-4 h-4 ml-1.5" />
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
