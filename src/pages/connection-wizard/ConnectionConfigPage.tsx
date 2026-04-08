import { useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft, ArrowRight, Database, Shield, Zap,
  Loader2, CheckCircle2, AlertCircle, Info, ChevronDown, ChevronUp,
  Activity, FileText
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import { useConnectorTypes, useTestConnection } from "@/hooks/use-connections";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { FILE_CONNECTOR_IDS } from "./SourceSelectionPage";

/** Fields classified as "connection basics" (host/endpoint row) */
const BASICS_KEYS = ["host", "port", "database_name", "database", "account", "service_name", "path", "uri"];
/** Fields classified as "auth" */
const AUTH_KEYS = ["username", "user", "password", "account"];

export default function ConnectionConfigPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const sourceId = (searchParams.get("source") || "").toLowerCase();
  const { data: connectorTypes = {}, isLoading: typesLoading } = useConnectorTypes();
  const testMutation = useTestConnection();

  const [formData, setFormData] = useState<Record<string, any>>({});
  const [showOptional, setShowOptional] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testPassed, setTestPassed] = useState(false);
  const [testSteps, setTestSteps] = useState<
    { label: string; status: "pending" | "loading" | "success" | "error" }[]
  >([
    { label: "Reachability", status: "pending" },
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
  } | null>(null);

  const isFileConnector = FILE_CONNECTOR_IDS.has(sourceId);
  const connector = connectorTypes[sourceId];
  const schema = connector?.schema;

  // ─── File connector — for file types, skip schema/sync flow ───────────────
  const handleProceedAfterTest = () => {
    const encoded = encodeURIComponent(JSON.stringify(formData));
    if (isFileConnector) {
      // File connectors jump straight to review
      navigate(`/connections/new/review?source=${sourceId}&config=${encoded}`);
    } else {
      navigate(`/connections/new/schema?source=${sourceId}&config=${encoded}`);
    }
  };

  // ─── Input handling ────────────────────────────────────────────────────────
  const handleInputChange = (key: string, value: any) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
    // Reset test result whenever user edits
    setTestResult(null);
    setTestPassed(false);
    setTestSteps((prev) => prev.map((s) => ({ ...s, status: "pending" })));
  };

  // ─── Test connection ────────────────────────────────────────────────────────
  const handleTest = async () => {
    setIsTesting(true);
    setTestResult(null);
    setTestPassed(false);
    setTestSteps((s) => s.map((x) => ({ ...x, status: "pending" })));

    // Animate step 1 immediately
    setTestSteps((s) => s.map((x, i) => (i === 0 ? { ...x, status: "loading" } : x)));

    try {
      const result = await testMutation.mutateAsync({
        ...formData,
        type: sourceId,
        timeout_seconds: 15,
      });

      const diag = result.diagnostics || {};

      // Map diagnostics → step statuses
      setTestSteps([
        { label: "Reachability", status: diag.dns_resolution === "success" ? "success" : "error" },
        {
          label: "TCP Handshake",
          status:
            diag.tcp_connection === "success"
              ? "success"
              : diag.dns_resolution === "success"
              ? "error"
              : "pending",
        },
        {
          label: "Authentication",
          status:
            diag.authentication === "success"
              ? "success"
              : diag.tcp_connection === "success"
              ? "error"
              : "pending",
        },
        {
          label: "Metadata Fetch",
          status: result.success ? "success" : diag.authentication === "success" ? "error" : "pending",
        },
      ]);

      setTestResult(result);
      if (result.success) {
        setTestPassed(true);
        toast({ title: "✅ Connection Verified", description: `Established in ${result.latency_ms}ms.` });
      } else {
        toast({
          title: "Connection Failed",
          description: result.error || "Check credentials and try again.",
          variant: "destructive",
        });
      }
    } catch (err: any) {
      setTestSteps((s) => s.map((x) => (x.status === "loading" ? { ...x, status: "error" } : x)));
      let userError = err?.message || "Connection error";
      if (userError.includes("ECONNREFUSED")) userError = "Connection refused — check host and port.";
      if (userError.includes("ETIMEDOUT") || userError.includes("timed out"))
        userError = "Connection timed out — check firewall or network.";
      if (userError.includes("auth") || userError.includes("password"))
        userError = "Authentication failed — check username and password.";
      setTestResult({ success: false, latency_ms: 0, error: userError });
      toast({ title: "Test Failed", description: userError, variant: "destructive" });
    } finally {
      setIsTesting(false);
    }
  };

  // ─── Field rendering ────────────────────────────────────────────────────────
  const renderField = (key: string, prop: any) => {
    const isPassword =
      key.toLowerCase().includes("password") || prop.format === "password";
    const isBoolean = prop.type === "boolean";
    const isNumber = prop.type === "integer" || prop.type === "number";
    const isRequired = schema?.required?.includes(key);

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
          {isRequired && (
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
            placeholder={prop.examples?.[0] || prop.placeholder || prop.description || `Enter ${key}...`}
            value={formData[key] ?? ""}
            onChange={(e) =>
              handleInputChange(key, isNumber ? (e.target.value ? parseInt(e.target.value) : "") : e.target.value)
            }
            className="h-12 bg-card/40 border-border/40 focus:ring-primary/10 rounded-2xl font-bold placeholder:text-muted-foreground/30 shadow-none border-dashed hover:border-solid transition-all"
          />
        )}
      </div>
    );
  };

  // ─── Error / loading states ────────────────────────────────────────────────
  if (!sourceId) {
    return (
      <div className="p-12 flex flex-col h-full items-center justify-center gap-6 max-w-md mx-auto text-center">
        <div className="w-20 h-20 rounded-3xl bg-destructive/10 flex items-center justify-center text-destructive">
          <AlertCircle className="w-10 h-10" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-black tracking-tight">No Source Selected</h2>
          <p className="text-muted-foreground font-medium">
            Return to source selection and choose a connector.
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => navigate("/connections/new")}
          className="rounded-2xl px-8 h-12 font-bold"
        >
          Back to Sources
        </Button>
      </div>
    );
  }

  if (typesLoading) {
    return (
      <div className="p-8 lg:p-12 space-y-12 max-w-4xl mx-auto w-full animate-pulse">
        <Skeleton className="h-8 w-32 rounded-lg" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-20 rounded-3xl" />
          ))}
        </div>
      </div>
    );
  }

  if (!connector) {
    return (
      <div className="p-12 flex flex-col h-full items-center justify-center gap-6 max-w-md mx-auto text-center">
        <div className="w-20 h-20 rounded-3xl bg-destructive/10 flex items-center justify-center text-destructive">
          <AlertCircle className="w-10 h-10" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-black tracking-tight">Source not found</h2>
          <p className="text-muted-foreground font-medium">
            The connector for <strong>{sourceId}</strong> is not registered in the backend.
          </p>
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

  // ─── Field grouping ────────────────────────────────────────────────────────
  const allProps = Object.entries(schema?.properties || {});

  const connectionFields = allProps.filter(
    ([key]) =>
      schema?.required?.includes(key) &&
      BASICS_KEYS.some((k) => key.toLowerCase().includes(k))
  );
  const authFields = allProps.filter(
    ([key]) =>
      schema?.required?.includes(key) &&
      AUTH_KEYS.some((k) => key.toLowerCase().includes(k)) &&
      !connectionFields.find(([k]) => k === key)
  );
  const otherRequired = allProps.filter(
    ([key]) =>
      schema?.required?.includes(key) &&
      !connectionFields.find(([k]) => k === key) &&
      !authFields.find(([k]) => k === key)
  );
  const optionalFields = allProps.filter(
    ([key, prop]: [string, any]) =>
      !schema?.required?.includes(key) &&
      key !== "type"
  );

  const isFileType = ["csv", "json", "parquet"].includes(sourceId);

  return (
    <div className="flex flex-col h-full animate-in slide-in-from-right-8 duration-700">
      <div className="p-8 lg:p-12 space-y-12 max-w-5xl mx-auto w-full">
        {/* Header */}
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
              {isFileType ? <FileText className="w-8 h-8" /> : <Database className="w-8 h-8" />}
            </div>
            <div>
              <h1 className="text-4xl font-black font-display text-foreground tracking-tight italic uppercase">
                Configure Bridge
              </h1>
              <div className="text-sm font-bold text-muted-foreground/60 flex items-center gap-2 uppercase tracking-[0.2em]">
                {sourceId} Connector
                <Separator orientation="vertical" className="h-3 mx-1 bg-border/40" />
                Step 02
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-12">
          {/* ── Form Columns ── */}
          <div className="xl:col-span-2 space-y-12">
            {/* Connection Details */}
            {connectionFields.length > 0 && (
              <div className="space-y-6">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-muted flex items-center justify-center text-[10px] font-black italic">01</div>
                  <h3 className="text-sm font-black uppercase tracking-widest text-foreground/80">
                    {isFileType ? "File Details" : "Connection Details"}
                  </h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-8 rounded-[40px] bg-card/20 border border-border/40">
                  {connectionFields.map(([key, prop]) => renderField(key, prop))}
                </div>
              </div>
            )}

            {/* Auth */}
            {authFields.length > 0 && (
              <div className="space-y-6">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-muted flex items-center justify-center text-[10px] font-black italic">02</div>
                  <h3 className="text-sm font-black uppercase tracking-widest text-foreground/80">Security & Auth</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-8 rounded-[40px] bg-card/20 border border-border/40">
                  {authFields.map(([key, prop]) => renderField(key, prop))}
                  {otherRequired.map(([key, prop]) => renderField(key, prop))}
                </div>
              </div>
            )}

            {/* If all required fields are connection-type only (e.g. file connector has only "path") */}
            {connectionFields.length === 0 && allProps.filter(([key]) => schema?.required?.includes(key)).length > 0 && (
              <div className="space-y-6">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-muted flex items-center justify-center text-[10px] font-black italic">01</div>
                  <h3 className="text-sm font-black uppercase tracking-widest text-foreground/80">Configuration</h3>
                </div>
                <div className="grid grid-cols-1 gap-6 p-8 rounded-[40px] bg-card/20 border border-border/40">
                  {allProps
                    .filter(([key]) => schema?.required?.includes(key))
                    .map(([key, prop]) => renderField(key, prop))}
                </div>
              </div>
            )}

            {/* Advanced (optional) */}
            {optionalFields.length > 0 && (
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
            )}
          </div>

          {/* ── Diagnostics Panel ── */}
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
                          <div
                            className={cn(
                              "w-8 h-8 rounded-xl flex items-center justify-center text-[10px] font-black transition-all",
                              step.status === "success"
                                ? "bg-success/20 text-success"
                                : step.status === "error"
                                ? "bg-destructive/20 text-destructive"
                                : step.status === "loading"
                                ? "bg-primary/20 text-primary animate-pulse"
                                : "bg-muted text-muted-foreground/20"
                            )}
                          >
                            {step.status === "success" ? (
                              <CheckCircle2 className="w-4 h-4" />
                            ) : step.status === "error" ? (
                              <AlertCircle className="w-4 h-4" />
                            ) : (
                              idx + 1
                            )}
                          </div>
                          <span
                            className={cn(
                              "text-xs font-bold transition-colors",
                              step.status === "success"
                                ? "text-foreground"
                                : step.status === "error"
                                ? "text-destructive"
                                : "text-muted-foreground/40"
                            )}
                          >
                            {step.label}
                          </span>
                        </div>
                        {step.status === "success" && (
                          <Badge className="bg-success text-white border-none text-[8px] font-black h-4 px-1">
                            OK
                          </Badge>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <Separator className="bg-border/20" />

                <div className="min-h-[140px] flex flex-col justify-center">
                  {testResult ? (
                    <div className="space-y-4 animate-in zoom-in-95 duration-500">
                      <div
                        className={cn(
                          "p-6 rounded-3xl border flex items-start gap-4",
                          testResult.success
                            ? "bg-success/5 border-success/20"
                            : "bg-destructive/5 border-destructive/20"
                        )}
                      >
                        {testResult.success ? (
                          <div className="w-10 h-10 rounded-2xl bg-success text-white flex items-center justify-center shadow-lg shadow-success/40 shrink-0">
                            <CheckCircle2 className="w-6 h-6" />
                          </div>
                        ) : (
                          <div className="w-10 h-10 rounded-2xl bg-destructive text-white flex items-center justify-center shadow-lg shadow-destructive/40 shrink-0">
                            <AlertCircle className="w-6 h-6" />
                          </div>
                        )}
                        <div className="space-y-1 pt-1 min-w-0">
                          <p className="text-sm font-black tracking-tight">
                            {testResult.success ? "Bridge Healthy" : "Connection Blocked"}
                          </p>
                          <p className="text-xs font-bold text-muted-foreground/80 leading-relaxed">
                            {testResult.success
                              ? `Verified in ${testResult.latency_ms}ms`
                              : testResult.error}
                          </p>
                        </div>
                      </div>

                      {!testResult.success && (
                        <div className="flex items-center gap-2 p-3 rounded-2xl bg-blue-500/10 text-blue-500 text-[10px] font-black uppercase tracking-widest border border-blue-500/10">
                          <Zap className="w-3.5 h-3.5 shrink-0" />
                          {testResult.suggestion || "Verify host, port, and credentials"}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center text-center space-y-4 py-8 opacity-20">
                      <Shield className="w-10 h-10" />
                      <p className="text-[10px] font-black uppercase tracking-widest">
                        Run a health check first
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </Card>

            {isFileType && (
              <div className="p-6 rounded-[32px] bg-violet-500/5 border border-violet-500/20 border-dashed">
                <p className="text-[10px] font-medium text-violet-400/80 leading-relaxed italic">
                  File connectors go directly to review after a successful health check — no schema step required.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-auto border-t border-border/20 bg-card/30 backdrop-blur-xl p-8 flex justify-between items-center sticky bottom-0 z-50">
        <Button
          variant="outline"
          onClick={handleTest}
          disabled={isTesting}
          className="rounded-2xl h-14 px-10 gap-3 font-black text-xs uppercase tracking-[0.2em] border-border/60 hover:bg-primary/5 hover:border-primary/40 transition-all shadow-none group"
        >
          {isTesting ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <Zap className="w-5 h-5 text-yellow-500 group-hover:scale-125 transition-transform" />
          )}
          Run Health Check
        </Button>

        <Button
          size="lg"
          disabled={!testPassed || isTesting}
          onClick={handleProceedAfterTest}
          className="rounded-2xl h-14 px-12 gap-3 font-black text-xs uppercase tracking-[0.2em] shadow-2xl shadow-primary/30 group disabled:opacity-30"
        >
          {isFileConnector ? "Go to Review" : "Discover Schema"}{" "}
          <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
        </Button>
      </div>
    </div>
  );
}

// Missing import added at top:
const Shield = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.955 11.955 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
  </svg>
);
