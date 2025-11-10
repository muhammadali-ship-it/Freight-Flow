import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertIntegrationConfigSchema, type IntegrationConfig } from "@shared/schema";
import { z } from "zod";
import { Plus, RefreshCw, Trash2, Settings, Check, X } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

const formSchema = insertIntegrationConfigSchema.extend({
  pollingIntervalMinutes: z.number().min(5).max(1440),
});

type FormValues = z.infer<typeof formSchema>;

export default function Integrations() {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingIntegration, setEditingIntegration] = useState<IntegrationConfig | null>(null);

  const { data: integrations = [], isLoading } = useQuery<IntegrationConfig[]>({
    queryKey: ["/api/integrations"],
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      type: "shipping_line",
      carrier: "Maersk",
      apiEndpoint: "",
      apiKeyName: "",
      isActive: false,
      pollingIntervalMinutes: 60,
      webhookSecret: "",
      config: {},
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: FormValues) => {
      return await apiRequest("POST", "/api/integrations", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/integrations"] });
      toast({ title: "Integration created successfully" });
      setDialogOpen(false);
      form.reset();
    },
    onError: () => {
      toast({ title: "Failed to create integration", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<FormValues> }) => {
      return await apiRequest("PATCH", `/api/integrations/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/integrations"] });
      toast({ title: "Integration updated successfully" });
    },
    onError: () => {
      toast({ title: "Failed to update integration", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/integrations/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/integrations"] });
      toast({ title: "Integration deleted successfully" });
    },
    onError: () => {
      toast({ title: "Failed to delete integration", variant: "destructive" });
    },
  });

  const syncMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("POST", `/api/integrations/${id}/sync`);
    },
    onSuccess: () => {
      toast({ title: "Sync started successfully" });
    },
    onError: () => {
      toast({ title: "Failed to start sync", variant: "destructive" });
    },
  });

  const handleSubmit = (values: FormValues) => {
    createMutation.mutate(values);
  };

  const toggleActive = (integration: IntegrationConfig) => {
    updateMutation.mutate({
      id: integration.id,
      data: { isActive: !integration.isActive },
    });
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold" data-testid="heading-integrations">Shipping Line Integrations</h1>
          <p className="text-sm sm:text-base text-muted-foreground">
            Connect with ocean carriers to automatically sync container data
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-integration">
              <Plus className="mr-2 h-4 w-4" />
              Add Integration
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Add Shipping Line Integration</DialogTitle>
              <DialogDescription>
                Configure API connection to a shipping line carrier
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Integration Name</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="My Maersk Integration" data-testid="input-integration-name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="carrier"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Carrier</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-carrier">
                            <SelectValue placeholder="Select carrier" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="Maersk">Maersk</SelectItem>
                          <SelectItem value="MSC">MSC</SelectItem>
                          <SelectItem value="COSCO">COSCO</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="apiEndpoint"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>API Endpoint</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="https://api.maersk.com/v1" data-testid="input-api-endpoint" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="apiKeyName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>API Key Environment Variable</FormLabel>
                      <FormControl>
                        <Input {...field} value={field.value || ""} placeholder="MAERSK_API_KEY" data-testid="input-api-key-name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="pollingIntervalMinutes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Polling Interval (minutes)</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type="number"
                          min={5}
                          max={1440}
                          onChange={(e) => field.onChange(parseInt(e.target.value))}
                          data-testid="input-polling-interval"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="isActive"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                      <div className="space-y-0.5">
                        <FormLabel>Active</FormLabel>
                        <FormDescription className="text-xs">
                          Start syncing immediately after creation
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value || false}
                          onCheckedChange={field.onChange}
                          data-testid="switch-active"
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <DialogFooter>
                  <Button type="submit" disabled={createMutation.isPending} data-testid="button-save-integration">
                    {createMutation.isPending ? "Creating..." : "Create Integration"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="text-center py-8">Loading integrations...</div>
      ) : integrations.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center text-muted-foreground">
              <Settings className="h-12 w-12 mx-auto mb-4 opacity-20" />
              <p>No integrations configured yet</p>
              <p className="text-sm mt-1">Add your first shipping line integration to start syncing data</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {integrations.map((integration) => (
            <Card key={integration.id} data-testid={`card-integration-${integration.id}`}>
              <CardHeader>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <CardTitle className="text-lg">{integration.name}</CardTitle>
                    <CardDescription className="flex items-center gap-2 mt-1">
                      <span>{integration.carrier}</span>
                      <Badge variant={integration.isActive ? "default" : "secondary"} className="text-xs">
                        {integration.isActive ? (
                          <>
                            <Check className="mr-1 h-3 w-3" />
                            Active
                          </>
                        ) : (
                          <>
                            <X className="mr-1 h-3 w-3" />
                            Inactive
                          </>
                        )}
                      </Badge>
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 text-sm">
                  <div>
                    <span className="text-muted-foreground">Endpoint:</span>
                    <p className="font-mono text-xs mt-1 truncate">{integration.apiEndpoint}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Polling Interval:</span>
                    <p className="mt-1">{integration.pollingIntervalMinutes} minutes</p>
                  </div>
                  {integration.lastSyncAt && (
                    <div>
                      <span className="text-muted-foreground">Last Sync:</span>
                      <p className="mt-1">{new Date(integration.lastSyncAt).toLocaleString()}</p>
                    </div>
                  )}
                  <div className="flex gap-2 pt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => toggleActive(integration)}
                      disabled={updateMutation.isPending}
                      data-testid={`button-toggle-${integration.id}`}
                    >
                      {integration.isActive ? "Deactivate" : "Activate"}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => syncMutation.mutate(integration.id)}
                      disabled={syncMutation.isPending || !integration.isActive}
                      data-testid={`button-sync-${integration.id}`}
                    >
                      <RefreshCw className="mr-2 h-3 w-3" />
                      Sync Now
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => deleteMutation.mutate(integration.id)}
                      disabled={deleteMutation.isPending}
                      data-testid={`button-delete-${integration.id}`}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
