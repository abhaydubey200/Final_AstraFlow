import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { UserProvider } from "@/components/UserContext";
import { ThemeProvider } from "@/components/ThemeProvider";
import AppLayout from "@/components/AppLayout";
import { SelfHealingErrorBoundary } from "@/components/SelfHealingErrorBoundary";
import Dashboard from "@/pages/Dashboard";
import Pipelines from "@/pages/Pipelines";
import PipelineDetail from "@/pages/PipelineDetail";
import PipelineBuilderPage from "@/pages/PipelineBuilderPage";
import Connections from "@/pages/Connections";
import Monitoring from "@/pages/Monitoring";
import ExecutionLogs from "@/pages/ExecutionLogs";
import Catalog from "@/pages/Catalog";
import SettingsPage from "@/pages/SettingsPage";
import AlertsPage from "@/pages/AlertsPage";
import DocsPage from "@/pages/DocsPage";
import AuditLogs from "@/pages/AuditLogs";
import SourceSelectionPage from "@/pages/connection-wizard/SourceSelectionPage";
import ConnectionConfigPage from "@/pages/connection-wizard/ConnectionConfigPage";
import SchemaSelectionPage from "@/pages/connection-wizard/SchemaSelectionPage";
import SyncConfigPage from "@/pages/connection-wizard/SyncConfigPage";
import ReviewPage from "@/pages/connection-wizard/ReviewPage";
import NotFound from "./pages/NotFound";


const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <SelfHealingErrorBoundary>
      <ThemeProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <UserProvider>
            <AppLayout>
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/pipelines" element={<Pipelines />} />
                <Route path="/pipelines/new" element={<PipelineBuilderPage />} />
                <Route path="/pipelines/:id" element={<PipelineDetail />} />
                <Route path="/pipelines/:id/edit" element={<PipelineBuilderPage />} />
                <Route path="/connections" element={<Connections />} />
                <Route path="/connections/new" element={<SourceSelectionPage />} />
                <Route path="/connections/new/config" element={<ConnectionConfigPage />} />
                <Route path="/connections/new/schema" element={<SchemaSelectionPage />} />
                <Route path="/connections/new/sync" element={<SyncConfigPage />} />
                <Route path="/connections/new/review" element={<ReviewPage />} />

                <Route path="/logs" element={<ExecutionLogs />} />
                <Route path="/monitoring" element={<Monitoring />} />
                <Route path="/catalog" element={<Catalog />} />
                <Route path="/alerts" element={<AlertsPage />} />
                <Route path="/docs" element={<DocsPage />} />
                <Route path="/settings" element={<SettingsPage />} />
                <Route path="/audit" element={<AuditLogs />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </AppLayout>
          </UserProvider>
        </BrowserRouter>
      </TooltipProvider>
      </ThemeProvider>
    </SelfHealingErrorBoundary>
  </QueryClientProvider>
);

export default App;
