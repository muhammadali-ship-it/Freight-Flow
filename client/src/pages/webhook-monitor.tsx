import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Copy, 
  RefreshCw, 
  Send,
  CheckCircle2,
  XCircle,
  Search,
  RotateCcw,
  Trash2
} from "lucide-react";
import { useState } from "react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import type { WebhookLog } from "@shared/schema";

interface WebhookLogsResponse {
  data: WebhookLog[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

export default function WebhookMonitor() {
  const { toast } = useToast();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<"all" | "updated">("all");
  const pageSize = 20;

  const buildQueryKey = () => {
    const params = new URLSearchParams();
    params.append('page', page.toString());
    params.append('pageSize', pageSize.toString());
    if (search.trim()) {
      params.append('search', search.trim());
    }
    if (activeTab === "all") {
      params.append('excludeOperation', 'UPDATE');
    } else if (activeTab === "updated") {
      params.append('operation', 'UPDATE');
    }
    return `/api/webhooks/tms/logs?${params.toString()}`;
  };

  const { data: webhookLogs, isLoading, refetch } = useQuery<WebhookLogsResponse>({
    queryKey: [buildQueryKey()],
    refetchInterval: 5000,
  });

  const testWebhookMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/test/webhook', {
        method: 'POST',
        body: JSON.stringify({
          referenceNumber: `TEST-${Date.now()}`,
          carrier: 'MAERSK',
          origin: 'CNSHA',
          destination: 'USNYC',
          status: 'IN_TRANSIT',
          milestones: [
            {
              code: 'DEPARTED',
              location: 'Shanghai, China',
              actualDate: new Date().toISOString(),
              status: 'completed'
            }
          ]
        }),
        headers: {
          'Content-Type': 'application/json',
        },
      });
      if (!response.ok) {
        throw new Error('Failed to send test webhook');
      }
      return response.json();
    },
    onSuccess: () => {
      refetch();
      toast({
        title: "Test webhook sent successfully",
        description: "Check the logs below to see the received webhook",
      });
    },
    onError: () => {
      toast({
        title: "Test failed",
        description: "Failed to send test webhook",
        variant: "destructive",
      });
    },
  });

  const retryWebhookMutation = useMutation({
    mutationFn: async (webhookId: string) => {
      const response = await fetch(`/api/webhooks/tms/retry/${webhookId}`, {
        method: 'POST',
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to retry webhook');
      }
      return response.json();
    },
    onSuccess: () => {
      refetch();
      toast({
        title: "Webhook reprocessed",
        description: "The webhook has been successfully reprocessed",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Retry failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const cleanTestDataMutation = useMutation({
    mutationFn: async () => {
      const testShipmentIds = [
        '999888777',
        '1761938377243',
        '888888888',
        '777777777',
        '999999999',
        'UNKNOWN',
      ];
      const response = await fetch('/api/webhooks/tms/logs/bulk-delete', {
        method: 'POST',
        body: JSON.stringify({ shipmentIds: testShipmentIds }),
        headers: {
          'Content-Type': 'application/json',
        },
      });
      if (!response.ok) {
        throw new Error('Failed to clean test data');
      }
      return response.json();
    },
    onSuccess: (data: any) => {
      refetch();
      toast({
        title: "Test data cleaned",
        description: `Deleted ${data.deletedCount} test webhook logs`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Clean failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteAllWebhooksMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/webhooks/tms/logs/all', {
        method: 'DELETE',
      });
      if (!response.ok) {
        throw new Error('Failed to delete all webhooks');
      }
      return response.json();
    },
    onSuccess: (data: any) => {
      refetch();
      toast({
        title: "All webhooks deleted",
        description: `Deleted ${data.deletedCount} webhook logs`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Delete failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const webhookUrl = `${import.meta.env.VITE_API_URL || 'https://freight-flow-steel.vercel.app'}/api/webhooks/tms`;

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied to clipboard",
      description: "Webhook URL copied successfully",
    });
  };

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">TMS Webhook Monitor</h1>
        <p className="text-muted-foreground">
          Real-time monitoring for TMS webhook integration
        </p>
      </div>

      {/* Search Input */}
      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by shipment ID, container number, or event type..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="pl-10"
            data-testid="input-search"
          />
        </div>
      </div>

      {/* Webhook URL Configuration Card */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Webhook URL</CardTitle>
          <CardDescription>
            Configure this URL in your TMS to receive shipment updates
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <input
              type="text"
              readOnly
              value={webhookUrl}
              className="flex-1 px-3 py-2 border rounded-md bg-muted font-mono text-sm"
              data-testid="input-webhook-url"
            />
            <Button
              variant="outline"
              size="icon"
              onClick={() => copyToClipboard(webhookUrl)}
              data-testid="button-copy-webhook-url"
            >
              <Copy className="h-4 w-4" />
            </Button>
          </div>

          <Alert>
            <AlertDescription className="space-y-2">
              <p className="font-medium">Setup Instructions:</p>
              <ol className="list-decimal list-inside space-y-1 text-sm ml-2">
                <li>Copy the webhook URL above</li>
                <li>Configure it in your TMS webhook settings</li>
                <li>Set the TMS_WEBHOOK_SECRET environment variable for security</li>
                <li>Use the test button below to verify connectivity</li>
              </ol>
            </AlertDescription>
          </Alert>

          <div className="flex gap-2">
            <Button
              onClick={() => testWebhookMutation.mutate()}
              disabled={testWebhookMutation.isPending}
              className="flex-1"
              data-testid="button-send-test-webhook"
            >
              {testWebhookMutation.isPending ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Sending Test...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Send Test Webhook
                </>
              )}
            </Button>
            <Button
              variant="outline"
              onClick={() => refetch()}
              data-testid="button-refresh"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
            <Button
              variant="destructive"
              onClick={() => cleanTestDataMutation.mutate()}
              disabled={cleanTestDataMutation.isPending}
              data-testid="button-clean-test-data"
            >
              {cleanTestDataMutation.isPending ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Cleaning...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Clean Test Data
                </>
              )}
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (confirm('⚠️ WARNING: This will delete ALL webhook logs. Are you sure?')) {
                  deleteAllWebhooksMutation.mutate();
                }
              }}
              disabled={deleteAllWebhooksMutation.isPending}
              data-testid="button-delete-all-webhooks"
            >
              {deleteAllWebhooksMutation.isPending ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete All
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Webhook Logs Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Webhook Logs</CardTitle>
              <CardDescription>
                Recent webhook events received from TMS
              </CardDescription>
            </div>
            <Badge variant="secondary">
              Total: {webhookLogs?.pagination.total || 0}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={(value) => {
            setActiveTab(value as "all" | "updated");
            setPage(1);
          }}>
            <TabsList className="mb-4">
              <TabsTrigger value="all" data-testid="tab-all-webhooks">
                All Webhooks
              </TabsTrigger>
              <TabsTrigger value="updated" data-testid="tab-updated-webhooks">
                Updated
              </TabsTrigger>
            </TabsList>

            <TabsContent value={activeTab} className="mt-0">
              {isLoading ? (
                <div className="flex items-center justify-center h-32">
                  <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : webhookLogs?.data.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <p>No webhooks received yet</p>
                  <p className="text-sm mt-2">Use the test button above to send a test webhook</p>
                </div>
              ) : (
                <div className="space-y-3">
              {webhookLogs?.data.map((log) => (
                <div
                  key={log.id}
                  className="p-4 border rounded-lg space-y-2 hover-elevate"
                  data-testid={`webhook-log-${log.id}`}
                >
                  <div className="flex items-start justify-between">
                    <div className="space-y-1 flex-1">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{log.eventType}</Badge>
                        {log.processedAt ? (
                          <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100">
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Processed
                          </Badge>
                        ) : log.errorMessage ? (
                          <Badge variant="destructive">
                            <XCircle className="h-3 w-3 mr-1" />
                            Failed
                          </Badge>
                        ) : (
                          <Badge variant="secondary">Pending</Badge>
                        )}
                      </div>
                      {log.shipmentId && (
                        <p className="text-sm text-muted-foreground">
                          Shipment: {log.shipmentId}
                        </p>
                      )}
                      {log.containerNumber && (
                        <p className="text-sm text-muted-foreground">
                          Container: {log.containerNumber}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right text-sm text-muted-foreground">
                        <p>{format(new Date(log.receivedAt), 'MMM dd, yyyy')}</p>
                        <p>{format(new Date(log.receivedAt), 'HH:mm:ss')}</p>
                      </div>
                      {!log.processedAt && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => retryWebhookMutation.mutate(log.id)}
                          disabled={retryWebhookMutation.isPending}
                          data-testid={`button-retry-${log.id}`}
                        >
                          <RotateCcw className="h-3 w-3 mr-1" />
                          Retry
                        </Button>
                      )}
                    </div>
                  </div>

                  {log.errorMessage && (
                    <Alert variant="destructive" className="mt-2">
                      <AlertDescription className="text-sm">
                        {log.errorMessage}
                      </AlertDescription>
                    </Alert>
                  )}

                  <details className="mt-2">
                    <summary className="text-sm text-muted-foreground cursor-pointer hover:text-foreground">
                      View Raw Payload
                    </summary>
                    <pre className="mt-2 p-3 bg-muted rounded text-xs overflow-x-auto">
                      {JSON.stringify(log.rawPayload, null, 2)}
                    </pre>
                  </details>
                </div>
                ))}
                </div>
              )}

              {webhookLogs && webhookLogs.pagination.totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 mt-6">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    data-testid="button-prev-page"
                  >
                    Previous
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    Page {page} of {webhookLogs.pagination.totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(p => Math.min(webhookLogs.pagination.totalPages, p + 1))}
                    disabled={page === webhookLogs.pagination.totalPages}
                    data-testid="button-next-page"
                  >
                    Next
                  </Button>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
