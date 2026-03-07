import { Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  GitBranch,
  Database,
  Activity,
  Settings,
  Layers,
  Shield,
  ChevronLeft,
  ChevronRight,
  ScrollText,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

const navItems = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/" },
  { icon: GitBranch, label: "Pipelines", path: "/pipelines" },
  { icon: Database, label: "Connections", path: "/connections" },
  { icon: ScrollText, label: "Execution Logs", path: "/logs" },
  { icon: Activity, label: "Monitoring", path: "/monitoring" },
  { icon: Layers, label: "Data Catalog", path: "/catalog" },
  { icon: Shield, label: "Governance", path: "/governance" },
  { icon: Settings, label: "Settings", path: "/settings" },
];

const AppSidebar = () => {
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside className={cn("flex flex-col border-r border-border bg-sidebar transition-all duration-300 h-screen sticky top-0", collapsed ? "w-16" : "w-60")}>
      <div className="flex items-center gap-2 px-4 h-14 border-b border-border">
        <div className="w-8 h-8 rounded-md bg-primary/20 flex items-center justify-center glow-primary">
          <Layers className="w-4 h-4 text-primary" />
        </div>
        {!collapsed && <span className="font-display font-bold text-foreground tracking-tight">AstraETL</span>}
      </div>
      <nav className="flex-1 py-4 px-2 space-y-1">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Link key={item.path} to={item.path} className={cn("flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors", isActive ? "bg-primary/10 text-primary" : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground")}>
              <item.icon className="w-4 h-4 flex-shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>
      <button onClick={() => setCollapsed(!collapsed)} className="flex items-center justify-center h-10 border-t border-border text-muted-foreground hover:text-foreground transition-colors">
        {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
      </button>
    </aside>
  );
};

export default AppSidebar;
