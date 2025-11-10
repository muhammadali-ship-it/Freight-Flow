import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users as UsersIcon, Plug, Upload, Building2, Ship, Activity, Package2 } from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

// Import existing pages
import UsersPage from "./users";
import IntegrationsPage from "./integrations";
import CargoesFlowTracking from "./cargoes-flow-tracking";
import WebhookMonitor from "./webhook-monitor";
import { BulkDocumentUpload } from "@/components/bulk-document-upload";
import { CarriersWidget } from "@/components/carriers-widget";

type Organization = {
  id: string;
  name: string;
  type: string;
  address?: string;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  createdAt: string;
};

export default function Settings() {
  const [activeTab, setActiveTab] = useState("cargoes-tracking");
  const { toast } = useToast();

  // Fetch organizations
  const { data: organizations, isLoading: orgsLoading } = useQuery<Organization[]>({
    queryKey: ["/api/organizations"],
  });

  return (
    <div className="h-full overflow-auto">
      <div className="container mx-auto p-6 space-y-6">
        <div>
          <h1 className="text-3xl font-bold" data-testid="text-settings-title">Settings</h1>
          <p className="text-muted-foreground">Manage your application settings and configurations</p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-7 gap-1">
            <TabsTrigger value="cargoes-tracking" className="flex items-center gap-2" data-testid="tab-cargoes-tracking">
              <Ship className="h-4 w-4" />
              Cargoes Tracking
            </TabsTrigger>
            <TabsTrigger value="webhook-monitor" className="flex items-center gap-2" data-testid="tab-webhook-monitor">
              <Activity className="h-4 w-4" />
              Webhook Monitor
            </TabsTrigger>
            <TabsTrigger value="carriers" className="flex items-center gap-2" data-testid="tab-carriers">
              <Package2 className="h-4 w-4" />
              Carriers
            </TabsTrigger>
            <TabsTrigger value="organizations" className="flex items-center gap-2" data-testid="tab-organizations">
              <Building2 className="h-4 w-4" />
              Organizations
            </TabsTrigger>
            <TabsTrigger value="users" className="flex items-center gap-2" data-testid="tab-users">
              <UsersIcon className="h-4 w-4" />
              Users
            </TabsTrigger>
            <TabsTrigger value="integrations" className="flex items-center gap-2" data-testid="tab-integrations">
              <Plug className="h-4 w-4" />
              Integrations
            </TabsTrigger>
            <TabsTrigger value="bulk-import" className="flex items-center gap-2" data-testid="tab-bulk-import">
              <Upload className="h-4 w-4" />
              Bulk Import
            </TabsTrigger>
          </TabsList>

          {/* Cargoes Tracking */}
          <TabsContent value="cargoes-tracking">
            <CargoesFlowTracking />
          </TabsContent>

          {/* Webhook Monitor */}
          <TabsContent value="webhook-monitor">
            <WebhookMonitor />
          </TabsContent>

          {/* Carriers */}
          <TabsContent value="carriers">
            <CarriersWidget />
          </TabsContent>

          {/* Organizations Database */}
          <TabsContent value="organizations" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Organizations Database</CardTitle>
                <CardDescription>
                  View and manage all shippers and consignees in your database
                </CardDescription>
              </CardHeader>
              <CardContent>
                {orgsLoading ? (
                  <div className="text-center py-8 text-muted-foreground">Loading organizations...</div>
                ) : organizations && organizations.length > 0 ? (
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Contact Name</TableHead>
                          <TableHead>Contact Email</TableHead>
                          <TableHead>Contact Phone</TableHead>
                          <TableHead>Address</TableHead>
                          <TableHead>Created</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {organizations.map((org) => (
                          <TableRow key={org.id} data-testid={`row-organization-${org.id}`}>
                            <TableCell className="font-medium" data-testid={`text-org-name-${org.id}`}>
                              {org.name}
                            </TableCell>
                            <TableCell>
                              <Badge 
                                variant={org.type === "shipper" ? "default" : org.type === "consignee" ? "secondary" : "outline"}
                                data-testid={`badge-org-type-${org.id}`}
                              >
                                {org.type === "both" ? "Shipper & Consignee" : org.type.charAt(0).toUpperCase() + org.type.slice(1)}
                              </Badge>
                            </TableCell>
                            <TableCell data-testid={`text-contact-name-${org.id}`}>
                              {org.contactName || "-"}
                            </TableCell>
                            <TableCell data-testid={`text-contact-email-${org.id}`}>
                              {org.contactEmail || "-"}
                            </TableCell>
                            <TableCell data-testid={`text-contact-phone-${org.id}`}>
                              {org.contactPhone || "-"}
                            </TableCell>
                            <TableCell data-testid={`text-address-${org.id}`}>
                              {org.address || "-"}
                            </TableCell>
                            <TableCell data-testid={`text-created-${org.id}`}>
                              {new Date(org.createdAt).toLocaleDateString()}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    <Building2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No organizations found</p>
                    <p className="text-sm">Organizations will appear here when you add them in shipment forms</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* User Management */}
          <TabsContent value="users">
            <UsersPage />
          </TabsContent>

          {/* Integrations */}
          <TabsContent value="integrations">
            <IntegrationsPage />
          </TabsContent>

          {/* Bulk Import */}
          <TabsContent value="bulk-import" className="space-y-4">
            <BulkDocumentUpload />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
