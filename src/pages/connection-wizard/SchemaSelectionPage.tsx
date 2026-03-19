import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { 
  ArrowLeft, ArrowRight, Database, Search, 
  Loader2, CheckCircle2, Box, Table as TableIcon, 
  Filter, Eye, RefreshCw, AlertCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  useResourceDiscovery, usePreviewData
} from "@/hooks/use-connections";
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { 
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { 
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger 
} from "@/components/ui/tooltip";

export default function SchemaSelectionPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const sourceId = searchParams.get("source");
  const configStr = searchParams.get("config");
  const config = configStr ? JSON.parse(decodeURIComponent(configStr)) : {};
  
  const [databases, setDatabases] = useState<string[]>([]);
  const [selectedDatabases, setSelectedDatabases] = useState<string[]>([]);
  const [tables, setTables] = useState<any[]>([]);
  const [selectedTables, setSelectedTables] = useState<string[]>([]);
  const [tableSearch, setTableSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [loadingTables, setLoadingTables] = useState(false);
  const [previewTable, setPreviewTable] = useState<string | null>(null);
  const [previewData, setPreviewData] = useState<{ data: any[]; columns: string[] } | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);

  const resourceDiscovery = useResourceDiscovery();
  const previewMutation = usePreviewData();

  useEffect(() => {
    fetchDatabases();
  }, [sourceId]);

  const fetchDatabases = async () => {
    setIsLoading(true);
    try {
      const { results } = await resourceDiscovery.mutateAsync({
        ...config,
        type: sourceId!,
        target: "databases",
      });
      setDatabases(results as string[]);
      if (results.length > 0) {
        setSelectedDatabases([results[0] as string]);
        fetchTables(results[0] as string);
      }
    } catch (err) {
      console.error("Failed to fetch databases", err);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchTables = async (databaseName: string) => {
    setLoadingTables(true);
    try {
      const { results } = await resourceDiscovery.mutateAsync({
        ...config,
        type: sourceId!,
        database_name: databaseName,
        target: "tables",
      });
      setTables(results);
    } catch (err) {
      console.error("Failed to fetch tables", err);
    } finally {
      setLoadingTables(false);
    }
  };

  const handleDatabaseToggle = (db: string) => {
    const next = selectedDatabases.includes(db) 
      ? selectedDatabases.filter(s => s !== db)
      : [...selectedDatabases, db];
    
    setSelectedDatabases(next);
    if (next.includes(db)) {
      fetchTables(db);
    }
  };

  const toggleTable = (tableName: string) => {
    setSelectedTables(prev => 
      prev.includes(tableName) 
        ? prev.filter(t => t !== tableName) 
        : [...prev, tableName]
    );
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const allNames = filteredTables.map(t => typeof t === "string" ? t : t.name);
      setSelectedTables(allNames);
    } else {
      setSelectedTables([]);
    }
  };

  const handlePreview = async (e: React.MouseEvent, tableName: string) => {
    e.stopPropagation();
    setPreviewTable(tableName);
    setIsPreviewLoading(true);
    setPreviewData(null);
    try {
      const result = await previewMutation.mutateAsync({
        ...config,
        type: sourceId!,
        table_name: tableName,
        database_name: selectedDatabases[0]
      });
      setPreviewData(result);
    } catch (err) {
      console.error("Preview failed", err);
    } finally {
      setIsPreviewLoading(false);
    }
  };

  const filteredTables = tables.filter(t => 
    (typeof t === "string" ? t : t.name).toLowerCase().includes(tableSearch.toLowerCase())
  );

  return (
    <div className="flex flex-col h-full animate-in slide-in-from-right-8 duration-700">
      <div className="p-8 lg:p-12 space-y-8 flex-1 flex flex-col min-h-0">
        <div className="space-y-4">
          <Button 
            variant="ghost" 
            onClick={() => navigate(-1)}
            className="group -ml-4 text-muted-foreground hover:text-primary"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Config
          </Button>
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shadow-inner">
              <Box className="w-7 h-7" />
            </div>
            <div>
              <h1 className="text-4xl font-black font-display text-foreground tracking-tight">Select Database</h1>
              <p className="text-sm font-bold text-muted-foreground/60 flex items-center gap-2 uppercase tracking-widest">
                Step 3: Discovering resources in {sourceId}
              </p>
            </div>
          </div>
        </div>

        <div className="flex-1 flex gap-8 min-h-0 overflow-hidden">
          {/* Left: Databases */}
          <Card className="w-80 rounded-[32px] border-border/40 bg-card/40 flex flex-col overflow-hidden">
            <div className="p-6 border-b border-border/40 bg-muted/10">
              <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground/60 mb-2">Databases</h3>
              <p className="text-[10px] font-bold text-muted-foreground/40 leading-relaxed italic">"A top-level container for all your data and schemas."</p>
            </div>
            <ScrollArea className="flex-1">
              <div className="p-4 space-y-1">
                {isLoading ? (
                  Array.from({ length: 8 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-3 p-3">
                       <Skeleton className="w-4 h-4 rounded" />
                       <Skeleton className="h-4 flex-1 rounded" />
                    </div>
                  ))
                ) : (
                  databases.map(db => (
                    <div 
                      key={db}
                      className={cn(
                        "flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all",
                        selectedDatabases.includes(db) ? "bg-primary/10 text-primary" : "hover:bg-muted/30 text-muted-foreground"
                      )}
                      onClick={() => handleDatabaseToggle(db)}
                    >
                      <Checkbox 
                        checked={selectedDatabases.includes(db)} 
                        onCheckedChange={() => handleDatabaseToggle(db)}
                        className="rounded-md border-border/60 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                      />
                      <span className="text-xs font-black tracking-tight">{db}</span>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </Card>

          {/* Right: Tables */}
          <Card className="flex-1 rounded-[32px] border-border/40 bg-card/40 flex flex-col overflow-hidden">
            <div className="p-6 border-b border-border/40 bg-muted/10 flex flex-col gap-6">
              <div className="flex items-center justify-between">
                <div>
                   <h3 className="text-xs font-black uppercase tracking-[0.2em] text-foreground/80">Table Inventory</h3>
                   <p className="text-[10px] font-bold text-muted-foreground/40 mt-1 italic">Discovering assets in {selectedDatabases[0] || "..."}</p>
                </div>
                <div className="flex items-center gap-3">
                  <Button variant="outline" size="icon" className="h-9 w-9 rounded-xl border-border/40 hover:bg-primary/5 hover:border-primary/20 transition-all" onClick={() => fetchTables(selectedDatabases[0])}>
                    <RefreshCw className={cn("w-3.5 h-3.5", loadingTables && "animate-spin")} />
                  </Button>
                  <Separator orientation="vertical" className="h-6 bg-border/20" />
                  <Badge variant="outline" className="h-9 px-4 rounded-xl bg-card border-border/40 text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">
                    {selectedTables.length} OF {filteredTables.length} SELECTED
                  </Badge>
                </div>
              </div>
              <div className="relative group">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/40 group-focus-within:text-primary transition-colors" />
                <Input 
                  placeholder="Filter by table name..." 
                  value={tableSearch}
                  onChange={(e) => setTableSearch(e.target.value)}
                  className="pl-11 h-12 bg-background/50 border-border/40 focus:ring-primary/10 rounded-2xl font-bold italic placeholder:font-normal"
                />
              </div>
            </div>

            <ScrollArea className="flex-1 p-0">
              <Table>
                <TableHeader className="sticky top-0 bg-card/95 backdrop-blur-xl z-10">
                  <TableRow className="border-border/40 hover:bg-transparent">
                    <TableHead className="w-12 p-6">
                      <Checkbox 
                        checked={selectedTables.length === filteredTables.length && filteredTables.length > 0}
                        onCheckedChange={handleSelectAll}
                        className="rounded-md"
                      />
                    </TableHead>
                    <TableHead className="text-[10px] font-black uppercase tracking-[0.2em] p-6 text-muted-foreground/40 italic">Asset Name</TableHead>
                    <TableHead className="text-[10px] font-black uppercase tracking-[0.2em] p-6 text-muted-foreground/40 italic">Volume</TableHead>
                    <TableHead className="text-[10px] font-black uppercase tracking-[0.2em] p-6 text-muted-foreground/40 italic">Health</TableHead>
                    <TableHead className="text-[10px] font-black uppercase tracking-[0.2em] p-6 text-right text-muted-foreground/40 italic">Inspect</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loadingTables ? (
                    Array.from({ length: 6 }).map((_, i) => (
                      <TableRow key={i} className="border-border/10">
                        <TableCell className="p-6"><Skeleton className="w-5 h-5 rounded" /></TableCell>
                        <TableCell className="p-6"><Skeleton className="h-5 w-48 rounded" /></TableCell>
                        <TableCell className="p-6"><Skeleton className="h-4 w-20 rounded" /></TableCell>
                        <TableCell className="p-6"><Skeleton className="h-4 w-24 rounded" /></TableCell>
                        <TableCell className="p-6 text-right"><Skeleton className="h-8 w-8 ml-auto rounded" /></TableCell>
                      </TableRow>
                    ))
                  ) : filteredTables.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="p-20 text-center">
                        <div className="flex flex-col items-center gap-4 opacity-40">
                          <TableIcon className="w-12 h-12" />
                          <p className="text-xs font-black uppercase tracking-widest">No Tables Found</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredTables.map((table) => {
                      const name = typeof table === "string" ? table : table.name;
                      const isSelected = selectedTables.includes(name);
                      return (
                        <TableRow 
                          key={name} 
                          className={cn(
                            "border-border/20 hover:bg-primary/5 transition-colors cursor-pointer group",
                            isSelected && "bg-primary/5"
                          )}
                          onClick={() => toggleTable(name)}
                        >
                          <TableCell className="p-6">
                            <Checkbox 
                              checked={isSelected}
                              onCheckedChange={() => toggleTable(name)}
                              className="rounded-md"
                            />
                          </TableCell>
                           <TableCell className="p-6">
                            <p className="text-sm font-black text-foreground tracking-tight group-hover:text-primary transition-colors flex items-center gap-2">
                              {name}
                              {(table.row_count_estimate > 1000000) && (
                                <Badge className="bg-amber-500/10 text-amber-500 border-none text-[8px] font-black px-1.5 py-0">LARGE</Badge>
                              )}
                            </p>
                            <p className="text-[10px] font-medium text-muted-foreground/40 italic">Type: BASE TABLE</p>
                          </TableCell>
                          <TableCell className="p-6">
                             <div className="space-y-1">
                                <p className="text-[11px] font-black italic">{table.row_count_estimate?.toLocaleString() || "---"}</p>
                                <p className="text-[9px] font-bold text-muted-foreground/40 uppercase">Rows</p>
                             </div>
                          </TableCell>
                          <TableCell className="p-6">
                             <div className="space-y-2">
                                {table.primary_key ? (
                                  <Badge variant="outline" className="text-[8px] font-black text-emerald-500 bg-emerald-500/5 border-emerald-500/20 px-2 py-0.5 rounded-full flex items-center w-fit gap-1">
                                    <CheckCircle2 className="w-2.5 h-2.5" /> PK: {table.primary_key}
                                  </Badge>
                                ) : (
                                  <Badge variant="outline" className="text-[8px] font-black text-muted-foreground/40 border-dashed px-2 py-0.5 rounded-full flex items-center w-fit gap-1">
                                    <AlertCircle className="w-2.5 h-2.5" /> NO PK
                                  </Badge>
                                )}
                                {table.recommendation?.mode && (
                                  <Badge className="text-[8px] font-black bg-primary/10 text-primary border-none px-2 py-0.5 rounded-full flex items-center w-fit gap-1">
                                    <RefreshCw className="w-2.5 h-2.5" /> {table.recommendation.mode.toUpperCase()}
                                  </Badge>
                                )}
                             </div>
                          </TableCell>
                          <TableCell className="p-6 text-right">
                             <Button 
                               variant="ghost" 
                               size="icon" 
                               className="h-8 w-8 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                               onClick={(e) => handlePreview(e, name)}
                             >
                                <Eye className="w-4 h-4" />
                             </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </ScrollArea>
          </Card>
        </div>
      </div>

      <div className="mt-auto border-t border-border/20 bg-card/30 backdrop-blur-xl p-8 flex justify-end items-center sticky bottom-0">
        <Button 
          size="lg"
          disabled={selectedTables.length === 0}
          onClick={() => {
            const selectedFull = tables.filter(t => selectedTables.includes(typeof t === "string" ? t : t.name));
            navigate(`/connections/new/sync?source=${sourceId}&config=${configStr}&tables=${encodeURIComponent(JSON.stringify(selectedFull))}`);
          }}
          className="rounded-2xl h-14 px-10 gap-3 font-black text-xs uppercase tracking-widest shadow-2xl shadow-primary/30"
        >
          Proceed to Sync Config <ArrowRight className="w-5 h-5" />
        </Button>
      </div>

      <Dialog open={!!previewTable} onOpenChange={(open) => !open && setPreviewTable(null)}>
        <DialogContent className="max-w-4xl rounded-[32px] border-border/40 bg-card/95 backdrop-blur-3xl p-0 overflow-hidden shadow-2xl">
          <DialogHeader className="p-8 border-b border-border/20 bg-muted/10">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                 <TableIcon className="w-6 h-6" />
              </div>
              <div>
                <DialogTitle className="text-2xl font-black tracking-tight">{previewTable}</DialogTitle>
                <DialogDescription className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">
                  Sample Data Preview (First 5 Rows)
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <div className="p-8">
            {isPreviewLoading ? (
              <div className="h-64 flex flex-col items-center justify-center gap-4 opacity-40">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                <p className="text-[10px] font-black uppercase tracking-widest animate-pulse">Fetching sample data...</p>
              </div>
            ) : previewData ? (
              <div className="rounded-2xl border border-border/20 overflow-hidden bg-background/50">
                <Table>
                  <TableHeader className="bg-muted/30">
                    <TableRow className="border-border/20">
                      {previewData.columns.map(col => (
                        <TableHead key={col} className="text-[9px] font-black uppercase tracking-widest p-4">{col}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {previewData.data.map((row, i) => (
                      <TableRow key={i} className="border-border/10 hover:bg-muted/5 transition-colors">
                        {previewData.columns.map(col => (
                          <TableCell key={col} className="p-4 text-xs font-medium text-muted-foreground/80">{String(row[col])}</TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="h-64 flex flex-col items-center justify-center gap-4 text-destructive opacity-60">
                <AlertCircle className="w-8 h-8" />
                <p className="text-xs font-bold uppercase tracking-widest">Could not fetch data preview</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

