import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import { AppSidebar } from "@/components/app-sidebar";
import { NotificationsBell } from "@/components/notifications-bell";
import { AuthProvider } from "@/hooks/use-auth";
import { ProtectedRoute } from "@/lib/protected-route";
import Dashboard from "@/pages/dashboard";
import AddContainer from "@/pages/add-container";
import ContainerDetail from "@/pages/container-detail";
import Shipments from "@/pages/shipments";
import ShipmentForm from "@/pages/shipment-form";
import ShipmentDetail from "@/pages/shipment-detail";
import CargoesFlowShipmentDetail from "@/pages/cargoes-flow-shipment-detail";
import Integrations from "@/pages/integrations";
import Users from "@/pages/users";
import BulkImport from "@/pages/bulk-import";
import Settings from "@/pages/settings";
import CostAnalytics from "@/pages/cost-analytics";
import ShipNexusWebhooks from "@/pages/shipnexus-webhooks";
import CargoesFlowTracking from "@/pages/cargoes-flow-tracking";
import CargoesFlowSyncLogs from "@/pages/cargoes-flow-sync-logs";
import CargoesFlowUpdateLogs from "@/pages/cargoes-flow-update-logs";
import DocumentUploadLogs from "@/pages/document-upload-logs";
import WebhookMonitor from "@/pages/webhook-monitor";
import CarrierLogs from "@/pages/carrier-logs";
import AuthPage from "@/pages/auth-page";
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <Switch>
      <ProtectedRoute path="/" component={Dashboard} />
      <ProtectedRoute path="/add" component={AddContainer} />
      <ProtectedRoute path="/container/:id" component={ContainerDetail} />
      <ProtectedRoute path="/shipments/new" component={ShipmentForm} />
      <ProtectedRoute path="/shipments/:id/edit" component={ShipmentForm} />
      <ProtectedRoute path="/shipments/:id" component={CargoesFlowShipmentDetail} />
      <ProtectedRoute path="/shipments" component={Shipments} />
      <ProtectedRoute path="/bulk-import" component={BulkImport} />
      <ProtectedRoute path="/analytics" component={CostAnalytics} />
      <ProtectedRoute path="/webhooks" component={ShipNexusWebhooks} />
      <ProtectedRoute path="/cargoes-flow" component={CargoesFlowTracking} />
      <ProtectedRoute path="/cargoes-flow/sync-logs" component={CargoesFlowSyncLogs} />
      <ProtectedRoute path="/cargoes-flow/update-logs" component={CargoesFlowUpdateLogs} />
      <ProtectedRoute path="/cargoes-flow/document-upload-logs" component={DocumentUploadLogs} />
      <ProtectedRoute path="/cargoes-flow/carrier-logs" component={CarrierLogs} />
      <ProtectedRoute path="/webhook-monitor" component={WebhookMonitor} />
      <ProtectedRoute path="/integrations" component={Integrations} />
      <ProtectedRoute path="/users" component={Users} />
      <ProtectedRoute path="/settings" component={Settings} />
      <Route path="/auth" component={AuthPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <ThemeProvider defaultTheme="light">
            <SidebarProvider style={style as React.CSSProperties}>
              <div className="flex h-screen w-full">
                <AppSidebar />
                <div className="flex flex-col flex-1">
                  <header className="flex items-center justify-between gap-2 sm:gap-4 p-3 sm:p-4 border-b">
                    <SidebarTrigger data-testid="button-sidebar-toggle" />
                    <div className="flex items-center gap-1 sm:gap-2">
                      <NotificationsBell />
                      <ThemeToggle />
                    </div>
                  </header>
                  <main className="flex-1 overflow-auto p-3 sm:p-4 md:p-6">
                    <Router />
                  </main>
                </div>
              </div>
            </SidebarProvider>
            <Toaster />
          </ThemeProvider>
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
