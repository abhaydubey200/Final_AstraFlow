import { useState } from "react";
import AppSidebar from "./AppSidebar";
import NotificationBell from "./NotificationBell";
import ThemeToggle from "./ThemeToggle";
import { Menu } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";

const AppLayout = ({ children }: { children: React.ReactNode }) => {
  const isMobile = useIsMobile();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-background">
      {/* Mobile overlay */}
      {isMobile && sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
      )}

      <div className={isMobile ? `fixed inset-y-0 left-0 z-50 transition-transform duration-300 ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}` : undefined}>
        <AppSidebar onClose={() => setSidebarOpen(false)} />
      </div>

      <div className="flex-1 flex flex-col overflow-auto">
        <header className="flex items-center justify-between px-4 md:px-6 h-14 border-b border-border bg-card/50 sticky top-0 z-30 backdrop-blur-sm">
          <div className="flex items-center gap-2">
            {isMobile && (
              <button onClick={() => setSidebarOpen(true)} className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                <Menu className="w-5 h-5" />
              </button>
            )}
          </div>
          <div className="flex items-center gap-1">
            <ThemeToggle />
            <NotificationBell />
          </div>
        </header>
        <main className="flex-1 animate-fade-in">{children}</main>
      </div>
    </div>
  );
};

export default AppLayout;
