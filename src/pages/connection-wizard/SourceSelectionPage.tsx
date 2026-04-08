import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Database, Snowflake, Server, Search,
  ArrowRight, Layers, FileText, Box, HardDrive
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

const SOURCES = [
  {
    id: "postgresql",
    name: "PostgreSQL",
    category: "Database",
    icon: Database,
    color: "text-blue-500",
    bg: "bg-blue-500/10",
    description: "Connect to production or analytical Postgres clusters.",
  },
  {
    id: "mysql",
    name: "MySQL",
    category: "Database",
    icon: Database,
    color: "text-orange-500",
    bg: "bg-orange-500/10",
    description: "Standard open-source relational database connectivity.",
  },
  {
    id: "mssql",
    name: "SQL Server",
    category: "Database",
    icon: Server,
    color: "text-red-500",
    bg: "bg-red-500/10",
    description: "Microsoft SQL Server enterprise data integration.",
  },
  {
    id: "oracle",
    name: "Oracle",
    category: "Database",
    icon: HardDrive,
    color: "text-amber-500",
    bg: "bg-amber-500/10",
    description: "Oracle Database — thin-mode connection, no Instant Client required.",
  },
  {
    id: "snowflake",
    name: "Snowflake",
    category: "Data Warehouse",
    icon: Snowflake,
    color: "text-cyan-400",
    bg: "bg-cyan-400/10",
    description: "Cloud-native data warehouse for high-scale analytics.",
  },
  {
    id: "mongodb",
    name: "MongoDB",
    category: "NoSQL",
    icon: Database,
    color: "text-green-500",
    bg: "bg-green-500/10",
    description: "Document-oriented database for flexible data models.",
  },
];

const CATEGORIES = ["All", "Database", "Data Warehouse", "NoSQL"];

/** File-based connectors skip schema/sync steps and go directly to review */
export const FILE_CONNECTOR_IDS = new Set<string>([]);

export default function SourceSelectionPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [selectedSource, setSelectedSource] = useState<string | null>(null);

  const filteredSources = SOURCES.filter((s) => {
    const matchesSearch = s.name.toLowerCase().includes(search.toLowerCase());
    const matchesCategory =
      selectedCategory === "All" || s.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const handleProceed = () => {
    if (!selectedSource) return;
    navigate(`/connections/new/config?source=${selectedSource}`);
  };

  return (
    <div className="flex flex-col h-full animate-in fade-in duration-700">
      <div className="p-8 lg:p-12 space-y-12">
        {/* Header */}
        <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-10">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shadow-inner">
                <Layers className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-4xl font-black font-display text-foreground tracking-tight">
                  Select Source
                </h1>
                <p className="text-sm font-bold text-muted-foreground/60 flex items-center gap-2 uppercase tracking-widest">
                  Step 1 of 5 — Choose your data origin
                </p>
              </div>
            </div>
          </div>

          {/* Search */}
          <div className="relative group w-full xl:w-80">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/40 group-focus-within:text-primary transition-colors" />
            <Input
              placeholder="Search sources..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-11 h-12 bg-card/40 border-border/40 focus:ring-primary/10 rounded-2xl font-bold"
            />
          </div>
        </div>

        {/* Category Filter */}
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((cat) => (
            <Button
              key={cat}
              variant={selectedCategory === cat ? "default" : "outline"}
              onClick={() => setSelectedCategory(cat)}
              className="rounded-full h-8 px-5 text-[10px] font-black uppercase tracking-widest"
            >
              {cat}
            </Button>
          ))}
        </div>

        {/* Source Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredSources.map((source) => (
            <Card
              key={source.id}
              className={cn(
                "group relative overflow-hidden transition-all duration-300 cursor-pointer",
                "hover:-translate-y-2 border-border/40 bg-card/40 hover:bg-card/60",
                "hover:shadow-2xl hover:shadow-primary/5 rounded-[32px] flex flex-col h-full",
                selectedSource === source.id
                  ? "ring-2 ring-primary border-primary bg-primary/5"
                  : ""
              )}
              onClick={() => setSelectedSource(source.id)}
            >
              <CardContent className="p-8 space-y-6 flex-1 flex flex-col">
                <div
                  className={cn(
                    "w-16 h-16 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110",
                    "shadow-inner border border-border/20",
                    source.bg,
                    source.color
                  )}
                >
                  <source.icon className="w-8 h-8" />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-black text-foreground tracking-tight">
                      {source.name}
                    </h3>
                    <Badge
                      variant="outline"
                      className="text-[8px] font-black uppercase tracking-tighter opacity-60"
                    >
                      {source.category}
                    </Badge>
                  </div>
                  <p className="text-xs font-medium text-muted-foreground/80 leading-relaxed">
                    {source.description}
                  </p>
                </div>
              </CardContent>

              {selectedSource === source.id && (
                <div className="absolute inset-0 bg-primary/5 pointer-events-none animate-in fade-in duration-300" />
              )}
            </Card>
          ))}

          {filteredSources.length === 0 && (
            <div className="col-span-full py-20 flex flex-col items-center gap-4 opacity-40">
              <Search className="w-12 h-12" />
              <p className="text-xs font-black uppercase tracking-widest">
                No sources match "{search}"
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Footer CTA */}
      <div className="mt-auto border-t border-border/20 bg-card/30 backdrop-blur-xl p-8 flex justify-between items-center sticky bottom-0">
        <p className="text-[10px] font-bold text-muted-foreground/40 uppercase tracking-widest">
          {selectedSource
            ? `Selected: ${SOURCES.find((s) => s.id === selectedSource)?.name}`
            : "Select a source to continue"}
        </p>
        <Button
          size="lg"
          disabled={!selectedSource}
          onClick={handleProceed}
          className="rounded-2xl h-14 px-10 gap-3 font-black text-xs uppercase tracking-widest shadow-2xl shadow-primary/30"
        >
          Proceed to Configuration <ArrowRight className="w-5 h-5" />
        </Button>
      </div>
    </div>
  );
}
