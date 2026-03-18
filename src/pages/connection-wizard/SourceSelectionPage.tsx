import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { 
  Database, Snowflake, Server, Search, Globe2, 
  ArrowRight, Layers, LayoutGrid, List, Filter
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
    description: "Connect to your production or analytical Postgres clusters."
  },
  {
    id: "mysql",
    name: "MySQL",
    category: "Database",
    icon: Database,
    color: "text-orange-500",
    description: "Standard open-source relational database connectivity."
  },
  {
    id: "mssql",
    name: "SQL Server",
    category: "Database",
    icon: Server,
    color: "text-red-500",
    description: "Microsoft SQL Server enterprise data integration."
  },
  {
    id: "snowflake",
    name: "Snowflake",
    category: "Data Warehouse",
    icon: Snowflake,
    color: "text-cyan-400",
    description: "Cloud-native data warehouse for high-scale analytics."
  },
  {
    id: "mongodb",
    name: "MongoDB",
    category: "NoSQL",
    icon: Database,
    color: "text-green-500",
    description: "Document-oriented database for flexible data models."
  },
  {
    id: "google_analytics",
    name: "Google Analytics 4",
    category: "Marketing",
    icon: Globe2,
    color: "text-yellow-500",
    description: "Import web and app analytics data directly into AstraFlow."
  }
];

const CATEGORIES = ["All", "Database", "Data Warehouse", "NoSQL", "Marketing", "SaaS"];

export default function SourceSelectionPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [selectedSource, setSelectedSource] = useState<string | null>(null);

  const filteredSources = SOURCES.filter(s => {
    const matchesSearch = s.name.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = selectedCategory === "All" || s.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="flex flex-col h-full animate-in fade-in duration-700">
      <div className="p-8 lg:p-12 space-y-12">
        <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-10">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shadow-inner">
                <Layers className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-4xl font-black font-display text-foreground tracking-tight">Select Source</h1>
                <p className="text-sm font-bold text-muted-foreground/60 flex items-center gap-2 uppercase tracking-widest">
                  Step 1: Choose your data origin
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-4 w-full xl:w-auto">
            <div className="relative group flex-1 sm:w-80">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/40 group-focus-within:text-primary transition-colors" />
              <Input
                placeholder="Search sources..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-11 h-12 bg-card/40 border-border/40 focus:ring-primary/10 rounded-2xl font-bold"
              />
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map(cat => (
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

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredSources.map((source) => (
            <Card 
              key={source.id}
              className={cn(
                "group relative overflow-hidden transition-all duration-300 cursor-pointer hover:-translate-y-2 border-border/40 bg-card/40 hover:bg-card/60 hover:shadow-2xl hover:shadow-primary/5 rounded-[32px] flex flex-col h-full",
                selectedSource === source.id ? "ring-2 ring-primary border-primary bg-primary/5" : ""
              )}
              onClick={() => setSelectedSource(source.id)}
            >
              <CardContent className="p-8 space-y-6 flex-1 flex flex-col">
                <div className={cn(
                  "w-16 h-16 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110",
                  "bg-background/80 shadow-inner border border-border/20",
                  source.color
                )}>
                  <source.icon className="w-8 h-8" />
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-black text-foreground tracking-tight">{source.name}</h3>
                    <Badge variant="outline" className="text-[8px] font-black uppercase tracking-tighter opacity-60">
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
        </div>
      </div>

      <div className="mt-auto border-t border-border/20 bg-card/30 backdrop-blur-xl p-8 flex justify-end items-center sticky bottom-0">
        <Button 
          size="lg"
          disabled={!selectedSource}
          onClick={() => navigate(`/connections/new/config?source=${selectedSource}`)}
          className="rounded-2xl h-14 px-10 gap-3 font-black text-xs uppercase tracking-widest shadow-2xl shadow-primary/30"
        >
          Proceed to Configuration <ArrowRight className="w-5 h-5" />
        </Button>
      </div>
    </div>
  );
}
