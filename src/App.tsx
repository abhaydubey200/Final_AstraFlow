import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/components/AuthProvider";
import { ThemeProvider } from "@/components/ThemeProvider";
import ProtectedRoute from "@/components/ProtectedRoute";
import AppLayout from "@/components/AppLayout";
import Dashboard from "@/pages/Dashboard";
import Pipelines from "@/pages/Pipelines";
import PipelineDetail from "@/pages/PipelineDetail";
import PipelineBuilderPage from "@/pages/PipelineBuilderPage";
import Connections from "@/pages/Connections";
import Monitoring from "@/pages/Monitoring";
import ExecutionLogs from "@/pages/ExecutionLogs";
import Catalog from "@/pages/Catalog";
import Governance from "@/pages/Governance";
import SettingsPage from "@/pages/SettingsPage";
import AuthPage from "@/pages/AuthPage";
import ResetPassword from "@/pages/ResetPassword";
import AlertsPage from "@/pages/AlertsPage";
import DocsPage from "@/pages/DocsPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/auth" element={<AuthPage />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route
              path="/*"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <Routes>
                      <Route path="/" element={<Dashboard />} />
                      <Route path="/pipelines" element={<Pipelines />} />
                      <Route path="/pipelines/new" element={<PipelineBuilderPage />} />
                      <Route path="/pipelines/:id" element={<PipelineDetail />} />
                      <Route path="/pipelines/:id/edit" element={<PipelineBuilderPage />} />
                      <Route path="/connections" element={<Connections />} />
                      <Route path="/logs" element={<ExecutionLogs />} />
                      <Route path="/monitoring" element={<Monitoring />} />
                      <Route path="/catalog" element={<Catalog />} />
                      <Route path="/governance" element={<Governance />} />
                      <Route path="/alerts" element={<AlertsPage />} />
                      <Route path="/docs" element={<DocsPage />} />
                      <Route path="/settings" element={<SettingsPage />} />
                      <Route path="*" element={<NotFound />} />
                    </Routes>
                  </AppLayout>
                </ProtectedRoute>
              }
            />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
