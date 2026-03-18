import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { 
  ArrowLeft, ArrowRight, Database, Shield, Zap, 
  Loader2, CheckCircle2, AlertCircle, Info, ChevronDown, ChevronUp, Activity
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import { 
  useConnectorTypes, useTestConnection 
} from "@/hooks/use-connections";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { 
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger 
} from "@/components/ui/tooltip";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";

export default function ConnectionConfigPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const sourceId = searchParams.get("source")?.toLowerCase();
  const { data: connectorTypes = {} } = useConnectorTypes();
  const testMutation = useTestConnection();
  
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [showOptional, setShowOptional] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testSteps, setTestSteps] = useState<{label: string, status: 'pending' | 'loading' | 'success' | 'error'}[]>([
    { label: "DNS Resolution", status: "pending" },
    { label: "TCP Handshake", status: "pending" },
    { label: "Authentication", status: "pending" },
    { label: "Metadata Fetch", status: "pending" },
  ]);
  const [testResult, setTestResult] = useState<{ 
    success: boolean; 
    message?: string; 
    latency_ms?: number; 
    error?: string;
    suggestion?: string;
    ai_suggestion?: any;
  } | null>(null);

  const connector = connectorTypes[sourceId || ""];
  const schema = connector?.schema;

  useEffect(() => {
    if (schema) {
      const defaults: Record<string, any> = {};
      Object.entries(schema.properties || {}).forEach(([key, prop]: [string, any]) => {
        if (prop.default !== undefined) {
          defaults[key] = prop.default;
        }
      });
      setFormData(prev => ({ ...defaults, ...prev }));
    }
  }, [schema]);

  if (!sourceId || (!connector && !connectorTypes[sourceId || ""])) {
    return (
      <div className="p-12 flex flex-col h-full items-center justify-center space-y-6 max-w-md mx-auto text-center">
        <div className="w-20 h-20 rounded-3xl bg-destructive/10 flex items-center justify-center text-destructive">
          <AlertCircle className="w-10 h-10" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-black tracking-tight">Source not found</h2>
          <div className="text-muted-foreground font-medium">We couldn't initialize the configuration for this source type.</div>
        </div>
        <Button 
          variant="outline" 
          onClick={() => navigate("/connections/new")}
          className="rounded-2xl px-8 h-12 font-bold"
        >
          Return to Selection
        </Button>
      </div>
    );
  }

  // Loading state
  if (!connector) {
    return (
      <div className="p-8 lg:p-12 space-y-12 max-w-4xl mx-auto w-full animate-pulse">
        <div className="space-y-4">
          <Skeleton className="h-8 w-32 rounded-lg" />
          <div className="flex items-center gap-4">
            <Skeleton className="w-14 h-14 rounded-2xl" />
            <div className="space-y-2">
              <Skeleton className="h-10 w-64 rounded-lg" />
              <Skeleton className="h-4 w-48 rounded-lg" />
            </div>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {[1,2,3,4].map(i => <Skeleton key={i} className="h-20 rounded-3xl" />)}
        </div>
      </div>
    );
  }

  const handleInputChange = (key: string, value: any) => {
    setFormData(prev => ({ ...prev, [key]: value }));
    setTestResult(null);
  };

  const handleTest = async () => {
    setIsTesting(true);
    setTestResult(null);
    setTestSteps(prev => prev.map(s => ({ ...s, status: 'pending' })));

    try {
      // Step 1: DNS
      setTestSteps(prev => prev.map((s, i) => i === 0 ? { ...s, status: 'loading' } : s));
      const result = await testMutation.mutateAsync({
        ...formData,
        type: sourceId!,
        timeout_seconds: 15
      });
      
      const diag = result.diagnostics || {};
      
      setTestSteps(prev => prev.map((s, i) => {
        if (i === 0) return { ...s, status: diag.dns_resolution === 'success' ? 'success' : 'error' };
        if (i === 1) return { ...s, status: diag.tcp_connection === 'success' ? 'success' : (diag.dns_resolution === 'success' ? 'error' : 'pending') };
        if (i === 2) return { ...s, status: diag.authentication === 'success' ? 'success' : (diag.tcp_connection === 'success' ? 'error' : 'pending') };
        if (i === 3) return { ...s, status: result.success ? 'success' : (diag.authentication === 'success' ? 'error' : 'pending') };
        return s;
      }));

      setTestResult(result);
      if (result.success) {
        toast({ title: "Connected!", description: `Found resources in ${result.latency_ms}ms.` });
      }
    } catch (err: any) {
      setTestSteps(prev => prev.map(s => s.status === 'loading' ? { ...s, status: 'error' } : s));
      // Map technical errors to user friendly messages
      let userError = err.message;
      if (err.message.includes("ECONNREFUSED")) userError = "Connection refused. Check host and port.";
      if (err.message.includes("ETIMEDOUT")) userError = "Connection timed out. Check firewall / network.";
      if (err.message.includes("authentication failed")) userError = "Authentication failed. Check username and password.";

      setTestResult({ success: false, latency_ms: 0, error: userError });
    } finally {
      setIsTesting(false);
    }
  };

  const basicsFields = ["host", "port", "database_name", "database", "name"];
  const authFields = ["username", "user", "password"];

  const connectionFields = Object.entries(schema.properties || {})
    .filter(([key]) => schema.required?.includes(key) && basicsFields.includes(key.toLowerCase()));
  
  const authenticationFields = Object.entries(schema.properties || {})
    .filter(([key]) => schema.required?.includes(key) && authFields.includes(key.toLowerCase()));

  const otherRequiredFields = Object.entries(schema.properties || {})
    .filter(([key]) => schema.required?.includes(key) && !basicsFields.includes(key.toLowerCase()) && !authFields.includes(key.toLowerCase()));

  const optionalFields = Object.entries(schema.properties || {})
    .filter(([key, prop]: [string, any]) => !schema.required?.includes(key) && !["type"].includes(key));

  const renderField = (key: string, prop: any) => {
    const isPassword = key.toLowerCase().includes("password") || prop.format === "password";
    const isBoolean = prop.type === "boolean";
    const isNumber = prop.type === "integer" || prop.type === "number";

    return (
      <div key={key} className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-[11px] font-black uppercase tracking-widest text-muted-foreground/60 flex items-center gap-2">
            {prop.title || key}
            {prop.description && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <Info className="w-3 h-3 cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="max-w-xs">{prop.description}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </Label>
          {schema.required?.includes(key) && (
            <span className="text-[8px] font-black text-primary uppercase">Required</span>
          )}
        </div>

        {isBoolean ? (
          <div className="flex items-center justify-between p-4 rounded-2xl bg-card/20 border border-border/40 hover:border-primary/20 transition-all">
            <span className="text-xs font-bold text-muted-foreground">{prop.title || key}</span>
            <Switch 
              checked={!!formData[key]}
              onCheckedChange={(v) => handleInputChange(key, v)}
            />
          </div>
        ) : (
          <Input 
            type={isPassword ? "password" : isNumber ? "number" : "text"}
            placeholder={prop.examples?.[0] || prop.description || `Enter ${key}...`}
            value={formData[key] || ""}
            onChange={(e) => handleInputChange(key, isNumber ? parseInt(e.target.value) : e.target.value)}
            className="h-12 bg-card/40 border-border/40 focus:ring-primary/10 rounded-2xl font-bold placeholder:text-muted-foreground/30 shadow-none border-dashed hover:border-solid transition-all"
          />
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full animate-in slide-in-from-right-8 duration-700">
      <div className="p-8 lg:p-12 space-y-12 max-w-5xl mx-auto w-full">
        <div className="space-y-4">
          <Button 
            variant="ghost" 
            onClick={() => navigate("/connections/new")}
            className="group -ml-4 text-muted-foreground hover:text-primary transition-colors"
          >
            <ArrowLeft className="w-4 h-4 mr-2 group-hover:-translate-x-1 transition-transform" />
            Back to Sources
          </Button>
          <div className="flex items-center gap-6">
            <div className="w-16 h-16 rounded-[28px] bg-primary/10 flex items-center justify-center text-primary shadow-inner ring-1 ring-primary/20">
              <Database className="w-8 h-8" />
            </div>
            <div>
              <h1 className="text-4xl font-black font-display text-foreground tracking-tight italic uppercase">Configure Bridge</h1>
              <div className="text-sm font-bold text-muted-foreground/60 flex items-center gap-2 uppercase tracking-[0.2em]">
                {sourceId} Connector <Separator orientation="vertical" className="h-3 mx-1 bg-border/40" /> Step 02
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-12">
          {/* Form Sections */}
          <div className="xl:col-span-2 space-y-12">
            
            {/* Basics */}
            <div className="space-y-6">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-muted flex items-center justify-center text-[10px] font-black italic">01</div>
                <h3 className="text-sm font-black uppercase tracking-widest text-foreground/80">Connection Details</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-8 rounded-[40px] bg-card/20 border border-border/40">
                {connectionFields.map(([key, prop]) => renderField(key, prop))}
              </div>
            </div>

            {/* Authentication */}
            <div className="space-y-6">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-muted flex items-center justify-center text-[10px] font-black italic">02</div>
                <h3 className="text-sm font-black uppercase tracking-widest text-foreground/80">Security & Auth</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-8 rounded-[40px] bg-card/20 border border-border/40">
                {authenticationFields.map(([key, prop]) => renderField(key, prop))}
                {otherRequiredFields.map(([key, prop]) => renderField(key, prop))}
              </div>
            </div>

            {/* Advanced (Collapsed) */}
            <div className="space-y-6">
              <button 
                onClick={() => setShowOptional(!showOptional)}
                className="flex items-center gap-4 w-full group py-2"
              >
                <div className="h-px flex-1 bg-border/20" />
                <Badge variant="outline" className="text-[10px] font-black px-4 py-1.5 border-border/40 group-hover:border-primary/40 transition-all rounded-full bg-card/50">
                  {showOptional ? "HIDE ADVANCED" : "SHOW ADVANCED SETTINGS"}
                  {showOptional ? <ChevronUp className="w-3 h-3 ml-2" /> : <ChevronDown className="w-3 h-3 ml-2" />}
                </Badge>
                <div className="h-px flex-1 bg-border/20" />
              </button>
              
              {showOptional && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-8 rounded-[40px] bg-muted/20 border border-border/20 border-dashed animate-in slide-in-from-top-4 duration-500">
                  {optionalFields.map(([key, prop]) => renderField(key, prop))}
                </div>
              )}
            </div>
          </div>

          {/* Diagnostics Column */}
          <div className="space-y-8 h-fit lg:sticky lg:top-8">
            <Card className="rounded-[40px] border-border/40 bg-card/40 overflow-hidden shadow-2xl backdrop-blur-3xl">
              <div className="p-8 space-y-8">
                <div className="space-y-4">
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/40 flex items-center gap-2">
                    <Activity className={cn("w-3 h-3", isTesting && "animate-pulse")} />
                    Live Health Check
                  </h4>
                  
                  <div className="space-y-4">
                    {testSteps.map((step, idx) => (
                      <div key={idx} className="flex items-center justify-between group">
                        <div className="flex items-center gap-4">
                          <div className={cn(
                            "w-8 h-8 rounded-xl flex items-center justify-center text-[10px] font-black transition-all",
                            step.status === 'success' ? "bg-success/20 text-success" :
                            step.status === 'error' ? "bg-destructive/20 text-destructive" :
                            step.status === 'loading' ? "bg-primary/20 text-primary animate-pulse" : "bg-muted text-muted-foreground/20"
                          )}>
                            {step.status === 'success' ? <CheckCircle2 className="w-4 h-4" /> : 
                             step.status === 'error' ? <AlertCircle className="w-4 h-4" /> : idx + 1}
                          </div>
                          <span className={cn(
                            "text-xs font-bold transition-colors",
                            step.status === 'success' ? "text-foreground" : 
                            step.status === 'error' ? "text-destructive" : "text-muted-foreground/40"
                          )}>{step.label}</span>
                        </div>
                        {step.status === 'success' && <Badge className="bg-success text-white border-none text-[8px] font-black h-4 px-1">OK</Badge>}
                      </div>
                    ))}
                  </div>
                </div>

                <Separator className="bg-border/20" />

                <div className="min-h-[140px] flex flex-col justify-center">
                  {testResult ? (
                    <div className="space-y-4 animate-in zoom-in-95 duration-500">
                      <div className={cn(
                        "p-6 rounded-3xl border flex items-start gap-4",
                        testResult.success ? "bg-success/5 border-success/10" : "bg-destructive/5 border-destructive/10"
                      )}>
                        {testResult.success ? (
                          <div className="w-10 h-10 rounded-2xl bg-success text-white flex items-center justify-center shadow-lg shadow-success/40">
                             <CheckCircle2 className="w-6 h-6" />
                          </div>
                        ) : (
                          <div className="w-10 h-10 rounded-2xl bg-destructive text-white flex items-center justify-center shadow-lg shadow-destructive/40">
                             <AlertCircle className="w-6 h-6" />
                          </div>
                        )}
                        <div className="space-y-1 pt-1 min-w-0">
                          <p className="text-sm font-black tracking-tight">{testResult.success ? "Bridge Healthy" : "Connection Blocked"}</p>
                          <p className="text-xs font-bold text-muted-foreground/80 leading-relaxed truncate">
                            {testResult.success 
                              ? `Verified in ${testResult.latency_ms}ms`
                              : testResult.error}
                          </p>
                        </div>
                      </div>

                      {!testResult.success && (
                        <div className="space-y-3">
                          <div className="flex items-center gap-2 p-3 rounded-2xl bg-blue-500/10 text-blue-500 text-[10px] font-black uppercase tracking-widest border border-blue-500/10">
                            <Zap className="w-3.5 h-3.5" /> 
                            Fix: {testResult.suggestion || "Verify host & port"}
                          </div>
                          <Button 
                            variant="link" 
                            size="sm" 
                            className="w-full text-[10px] font-black uppercase text-muted-foreground/40 hover:text-primary transition-colors h-auto p-0"
                            onClick={() => navigate(`/connections/new/schema?source=${sourceId}&config=${encodeURIComponent(JSON.stringify(formData))}`)}
                          >
                            Skip Verification? Proceed Anyway →
                          </Button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center text-center space-y-4 py-8 opacity-20">
                      <Shield className="w-10 h-10" />
                      <p className="text-[10px] font-black uppercase tracking-widest">Security Scan Required</p>
                    </div>
                  )}
                </div>
              </div>
            </Card>

            <div className="p-6 rounded-[32px] bg-muted/10 border border-border/20 border-dashed">
               <p className="text-[10px] font-medium text-muted-foreground/60 leading-relaxed italic">
                 "Bridge diagnostics ensure metadata can be fetched securely. Successful tests activate real-time schema discovery."
               </p>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-auto border-t border-border/20 bg-card/30 backdrop-blur-xl p-8 flex justify-between items-center sticky bottom-0 z-50">
        <Button 
          variant="outline" 
          onClick={handleTest}
          disabled={isTesting}
          className="rounded-2xl h-14 px-10 gap-3 font-black text-xs uppercase tracking-[0.2em] border-border/60 hover:bg-primary/5 hover:border-primary/40 transition-all shadow-none group"
        >
          {isTesting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Zap className="w-5 h-5 text-yellow-500 group-hover:scale-125 transition-transform" />}
          Run Health Check
        </Button>

        <Button 
          size="lg"
          disabled={!testResult?.success || isTesting}
          onClick={() => navigate(`/connections/new/schema?source=${sourceId}&config=${encodeURIComponent(JSON.stringify(formData))}`)}
          className="rounded-2xl h-14 px-12 gap-3 font-black text-xs uppercase tracking-[0.2em] shadow-2xl shadow-primary/30 group disabled:opacity-30"
        >
          Discover Schema <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
        </Button>
      </div>
    </div>
  );
}
