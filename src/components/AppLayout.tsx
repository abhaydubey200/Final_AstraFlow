import AppSidebar from "./AppSidebar";
import NotificationBell from "./NotificationBell";

const AppLayout = ({ children }: { children: React.ReactNode }) => {
  return (
    <div className="flex min-h-screen bg-background">
      <AppSidebar />
      <div className="flex-1 flex flex-col overflow-auto">
        <header className="flex items-center justify-end px-6 h-14 border-b border-border bg-card/50 sticky top-0 z-30 backdrop-blur-sm">
          <NotificationBell />
        </header>
        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
};

export default AppLayout;
