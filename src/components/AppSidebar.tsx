import { Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard, GitBranch, Database, Activity, 
  Settings, Layers, Shield, ChevronLeft, ChevronRight, 
  ScrollText, LogOut, Bell, BookOpen, DollarSign,
  Monitor, Cpu, Zap, Search
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/components/AuthProvider";
import { Tooltip, TooltipProvider } from "@/components/ui/tooltip";

const sections = [
  {
    title: "Data Engine",
    items: [
      { icon: LayoutDashboard, label: "Dashboard", path: "/" },
      { icon: GitBranch, label: "Pipelines", path: "/pipelines" },
      { icon: Database, label: "Connections", path: "/connections" },
      { icon: Layers, label: "Data Catalog", path: "/catalog" },
    ]
  },
  {
    title: "Operations Hub",
    items: [
      { icon: Activity, label: "Monitoring", path: "/monitoring" },
      { icon: ScrollText, label: "Execution Logs", path: "/logs" },
      { icon: DollarSign, label: "Costs", path: "/costs" },
      { icon: Shield, label: "Audit Logs", path: "/audit" },
      { icon: Zap, label: "Marketplace", path: "/marketplace" },
      { icon: Bell, label: "Alerting", path: "/alerts" },
    ]
  },
  {
    title: "Platform",
    items: [
      { icon: Shield, label: "Governance", path: "/governance" },
      { icon: BookOpen, label: "User Guide", path: "/docs" },
      { icon: Settings, label: "Settings", path: "/settings" },
    ]
  }
];

const AppSidebar = ({ onClose }: { onClose?: () => void }) => {
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const { user, signOut } = useAuth();

  const NavItem = ({ item, isActive }: { item: typeof sections[0]['items'][0]; isActive: boolean }) => {
    const link = (
      <Link 
        key={item.path} 
        to={item.path} 
        onClick={onClose} 
        className={cn(
          "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all group relative",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          isActive 
            ? "bg-primary/10 text-primary font-bold" 
            : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        )}
        aria-label={item.label}
        aria-current={isActive ? "page" : undefined}
      >
        <item.icon className={cn(
          "w-4 h-4 flex-shrink-0 transition-transform group-hover:scale-110",
          isActive ? "text-primary" : "text-muted-foreground"
        )} />
        {!collapsed && <span>{item.label}</span>}
        {isActive && !collapsed && (
          <div className="absolute right-2 w-1 h-6 bg-primary rounded-full" />
        )}
      </Link>
    );

    // Wrap with tooltip when sidebar is collapsed
    if (collapsed) {
      return (
        <Tooltip content={item.label} side="right">
          {link}
        </Tooltip>
      );
    }

    return link;
  };

  return (
    <TooltipProvider>
      <aside className={cn(
        "flex flex-col border-r border-border bg-sidebar transition-all duration-300 h-screen sticky top-0",
        collapsed ? "w-16" : "w-60"
      )}>
        {/* Logo/Header */}
        <div className="flex items-center gap-2 px-4 h-14 border-b border-border">
          <div className="w-8 h-8 rounded-md bg-primary/20 flex items-center justify-center glow-primary">
            <Zap className="w-4 h-4 text-primary" />
          </div>
          {!collapsed && (
            <span className="font-display font-bold text-foreground tracking-tight">
              AstraFlow
            </span>
          )}
        </div>
        
        {/* Navigation */}
        <nav className="flex-1 py-6 px-3 space-y-8 overflow-y-auto" aria-label="Main navigation">
          {sections.map((section) => (
            <div key={section.title} className="space-y-2">
              {!collapsed && (
                <h4 className="px-3 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/50">
                  {section.title}
                </h4>
              )}
              <div className="space-y-1" role="list">
                {section.items.map((item) => {
                  const isActive = location.pathname === item.path;
                  return <NavItem key={item.path} item={item} isActive={isActive} />;
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* User Profile + Sign Out */}
        <div className="px-3 py-4 border-t border-border space-y-3 bg-muted/20">
          {!collapsed && user && (
            <div className="flex items-center gap-3 px-3">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary border border-primary/20">
                {user.email?.[0].toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-foreground truncate">Admin User</p>
                <p className="text-[10px] text-muted-foreground truncate">{user.email}</p>
              </div>
            </div>
          )}
          <Tooltip content={collapsed ? "Sign Out" : ""} side="right">
            <button
              onClick={signOut}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-lg text-sm",
                "text-muted-foreground hover:text-destructive hover:bg-destructive/10",
                "transition-colors w-full group",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              )}
              aria-label="Sign out"
            >
              <LogOut className="w-4 h-4 flex-shrink-0 group-hover:-translate-x-1 transition-transform" />
              {!collapsed && <span>Sign Out</span>}
            </button>
          </Tooltip>
        </div>

        {/* Collapse/Expand Toggle */}
        <Tooltip content={collapsed ? "Expand sidebar" : "Collapse sidebar"} side="right">
          <button
            onClick={() => setCollapsed(!collapsed)}
            className={cn(
              "flex items-center justify-center h-10 border-t border-border",
              "text-muted-foreground hover:text-foreground transition-colors group",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            )}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-expanded={!collapsed}
          >
            {collapsed ? (
              <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            ) : (
              <ChevronLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
            )}
          </button>
        </Tooltip>
      </aside>
    </TooltipProvider>
  );
};

export default AppSidebar;
