import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Search, Webhook, ChevronLeft, ChevronRight, RefreshCcw, Package, CheckCircle2, Download } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface ShipnexusWebhook {
  id: string;
  payload: any;
  shipmentReference: string | null;
  eventType: string | null;
  status: string;
  processedAt: string | null;
  receivedAt: string;
  createdAt: string;
}

interface WebhooksResponse {
  data: ShipnexusWebhook[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

interface Shipment {
  id: string;
  referenceNumber: string;
  bookingNumber: string | null;
  masterBillOfLading: string | null;
  shipper: string | null;
  consignee: string | null;
  originPort: string | null;
  destinationPort: string | null;
  carrier: string | null;
  status: string;
  receivedViaWebhook?: boolean;
}

interface ShipmentsResponse {
  data: Shipment[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

export default function ShipNexusWebhooks() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("shipments");
  const [webhookPage, setWebhookPage] = useState(1);
  const [shipmentPage, setShipmentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [eventTypeFilter, setEventTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedWebhook, setSelectedWebhook] = useState<ShipnexusWebhook | null>(null);
  const [selectedShipment, setSelectedShipment] = useState<Shipment | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [shipmentDetailsOpen, setShipmentDetailsOpen] = useState(false);

  const { data: webhooksData, isLoading: webhooksLoading, refetch: refetchWebhooks } = useQuery<WebhooksResponse>({
    queryKey: [`/api/webhooks/tms/logs?page=${webhookPage}&pageSize=50&eventType=${eventTypeFilter}`],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: webhookPage.toString(),
        pageSize: "50",
        ...(eventTypeFilter !== "all" && { eventType: eventTypeFilter }),
      });
      const response = await fetch(`/api/webhooks/tms/logs?${params}`);
      if (!response.ok) throw new Error("Failed to fetch webhooks");
      return response.json();
    },
  });

  const { data: shipmentsData, isLoading: shipmentsLoading, refetch: refetchShipments } = useQuery<ShipmentsResponse>({
    queryKey: ["/api/shipments/webhook", shipmentPage],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: shipmentPage.toString(),
        pageSize: "50",
      });
      const response = await fetch(`/api/shipments/webhook?${params}`);
      if (!response.ok) throw new Error("Failed to fetch webhook shipments");
      return response.json();
    },
    enabled: activeTab === "shipments",
  });

  const handleViewDetails = (webhook: ShipnexusWebhook) => {
    setSelectedWebhook(webhook);
    setDetailsOpen(true);
  };

  const handleViewShipmentDetails = (shipment: Shipment) => {
    setSelectedShipment(shipment);
    setShipmentDetailsOpen(true);
  };

  const importMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/shipnexus/import-shipments", {
        method: "POST",
      });
      if (!response.ok) throw new Error("Failed to import shipments");
      return response.json();
    },
    onSuccess: (data: any) => {
      toast({
        title: "Import Complete",
        description: `Successfully imported ${data.imported} shipments from ShipNexus. ${data.errors > 0 ? `${data.errors} errors occurred.` : ''}`,
      });
      refetchShipments();
    },
    onError: (error: Error) => {
      toast({
        title: "Import Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case "received":
        return "default";
      case "processed":
        return "secondary";
      case "failed":
        return "destructive";
      default:
        return "outline";
    }
  };

  const getShipmentStatusVariant = (status: string) => {
    switch (status) {
      case "delivered":
        return "secondary";
      case "in-transit":
        return "default";
      case "delayed":
        return "destructive";
      default:
        return "outline";
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">TAI TMS Integration</h1>
        <p className="text-sm text-muted-foreground mt-1">
          View webhook data and all shipments from TAI TMS
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="shipments" data-testid="tab-shipments">
            <Package className="h-4 w-4 mr-2" />
            TMS Shipments
          </TabsTrigger>
          <TabsTrigger value="webhooks" data-testid="tab-webhooks">
            <Webhook className="h-4 w-4 mr-2" />
            Webhook Logs
          </TabsTrigger>
        </TabsList>

        <TabsContent value="webhooks" className="mt-6">
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Webhook className="h-5 w-5" />
                    Webhook History
                  </CardTitle>
                  <CardDescription>
                    {webhooksData?.pagination.total || 0} total webhooks received
                  </CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => refetchWebhooks()}
                  data-testid="button-refresh-webhooks"
                >
                  <RefreshCcw className="h-4 w-4 mr-2" />
                  Refresh
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search by reference or event type..."
                      value={searchQuery}
                      onChange={(e) => {
                        setSearchQuery(e.target.value);
                        setWebhookPage(1);
                      }}
                      className="pl-10"
                      data-testid="input-search-webhooks"
                    />
                  </div>
                  <Select
                    value={eventTypeFilter}
                    onValueChange={(value) => {
                      setEventTypeFilter(value);
                      setWebhookPage(1);
                    }}
                  >
                    <SelectTrigger className="w-full sm:w-[180px]" data-testid="select-event-type">
                      <SelectValue placeholder="Event Type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Events</SelectItem>
                      <SelectItem value="shipment.created">Created</SelectItem>
                      <SelectItem value="shipment.updated">Updated</SelectItem>
                      <SelectItem value="shipment.deleted">Deleted</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select
                    value={statusFilter}
                    onValueChange={(value) => {
                      setStatusFilter(value);
                      setWebhookPage(1);
                    }}
                  >
                    <SelectTrigger className="w-full sm:w-[180px]" data-testid="select-status">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="received">Received</SelectItem>
                      <SelectItem value="processed">Processed</SelectItem>
                      <SelectItem value="failed">Failed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {webhooksLoading ? (
                  <div className="text-center py-12 text-muted-foreground">
                    Loading webhooks...
                  </div>
                ) : webhooksData?.data.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Webhook className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p className="text-lg font-medium">No webhooks found</p>
                    <p className="text-sm mt-1">
                      Webhooks from ShipNexus will appear here
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="border rounded-md overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Received At</TableHead>
                            <TableHead>Reference</TableHead>
                            <TableHead>Event Type</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Processed At</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {webhooksData?.data.map((webhook) => (
                            <TableRow key={webhook.id} data-testid={`row-webhook-${webhook.id}`}>
                              <TableCell className="font-mono text-sm">
                                {format(new Date(webhook.receivedAt), "MMM dd, HH:mm:ss")}
                              </TableCell>
                              <TableCell>
                                <span className="font-medium" data-testid={`text-reference-${webhook.id}`}>
                                  {webhook.shipmentReference || "—"}
                                </span>
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline" data-testid={`badge-event-${webhook.id}`}>
                                  {webhook.eventType || "Unknown"}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <Badge
                                  variant={getStatusBadgeVariant(webhook.status)}
                                  data-testid={`badge-status-${webhook.id}`}
                                >
                                  {webhook.status}
                                </Badge>
                              </TableCell>
                              <TableCell className="font-mono text-sm text-muted-foreground">
                                {webhook.processedAt
                                  ? format(new Date(webhook.processedAt), "MMM dd, HH:mm:ss")
                                  : "—"}
                              </TableCell>
                              <TableCell className="text-right">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleViewDetails(webhook)}
                                  data-testid={`button-view-${webhook.id}`}
                                >
                                  View Payload
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>

                    {webhooksData && webhooksData.pagination.totalPages > 1 && (
                      <div className="flex items-center justify-between">
                        <p className="text-sm text-muted-foreground">
                          Page {webhooksData.pagination.page} of {webhooksData.pagination.totalPages} ({webhooksData.pagination.total} total)
                        </p>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setWebhookPage(webhookPage - 1)}
                            disabled={webhookPage === 1}
                            data-testid="button-prev-page"
                          >
                            <ChevronLeft className="h-4 w-4" />
                            Previous
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setWebhookPage(webhookPage + 1)}
                            disabled={webhookPage >= webhooksData.pagination.totalPages}
                            data-testid="button-next-page"
                          >
                            Next
                            <ChevronRight className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="shipments" className="mt-6">
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Package className="h-5 w-5" />
                    All Shipments
                  </CardTitle>
                  <CardDescription>
                    {shipmentsData?.pagination.total || 0} total shipments in database
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => importMutation.mutate()}
                    disabled={importMutation.isPending}
                    data-testid="button-import-shipments"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    {importMutation.isPending ? "Importing..." : "Import from ShipNexus"}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => refetchShipments()}
                    data-testid="button-refresh-shipments"
                  >
                    <RefreshCcw className="h-4 w-4 mr-2" />
                    Refresh
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {shipmentsLoading ? (
                <div className="text-center py-12 text-muted-foreground">
                  Loading shipments...
                </div>
              ) : shipmentsData?.data.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p className="text-lg font-medium">No shipments found</p>
                  <p className="text-sm mt-1">
                    Shipments will appear here once created
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="border rounded-md overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Reference</TableHead>
                          <TableHead>Master B/L</TableHead>
                          <TableHead>Booking #</TableHead>
                          <TableHead>Shipper</TableHead>
                          <TableHead>Consignee</TableHead>
                          <TableHead>Origin</TableHead>
                          <TableHead>Destination</TableHead>
                          <TableHead>Carrier</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Webhook</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {shipmentsData?.data.map((shipment: any) => (
                          <TableRow key={shipment.id} data-testid={`row-shipment-${shipment.id}`}>
                            <TableCell>
                              <span className="font-medium font-mono text-sm" data-testid={`text-reference-${shipment.id}`}>
                                {shipment.referenceNumber || "—"}
                              </span>
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {shipment.masterBillOfLading || "—"}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {shipment.bookingNumber || "—"}
                            </TableCell>
                            <TableCell className="text-sm">
                              <div className="max-w-[150px] truncate" title={shipment.shipper || "—"}>
                                {shipment.shipper || "—"}
                              </div>
                            </TableCell>
                            <TableCell className="text-sm">
                              <div className="max-w-[150px] truncate" title={shipment.consignee || "—"}>
                                {shipment.consignee || "—"}
                              </div>
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {shipment.originPort || "—"}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {shipment.destinationPort || "—"}
                            </TableCell>
                            <TableCell className="text-sm">
                              {shipment.carrier || "—"}
                            </TableCell>
                            <TableCell>
                              <Badge variant={getShipmentStatusVariant(shipment.status)}>
                                {shipment.status}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {shipment.receivedViaWebhook ? (
                                <div className="flex items-center gap-1 text-green-600 dark:text-green-500">
                                  <CheckCircle2 className="h-4 w-4" />
                                  <span className="text-xs font-medium">Yes</span>
                                </div>
                              ) : (
                                <span className="text-xs text-muted-foreground">No</span>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleViewShipmentDetails(shipment)}
                                data-testid={`button-view-shipment-${shipment.id}`}
                              >
                                View Details
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  {shipmentsData && shipmentsData.pagination.totalPages > 1 && (
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-muted-foreground">
                        Page {shipmentsData.pagination.page} of {shipmentsData.pagination.totalPages} ({shipmentsData.pagination.total} total)
                      </p>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setShipmentPage(shipmentPage - 1)}
                          disabled={shipmentPage === 1}
                          data-testid="button-shipments-prev-page"
                        >
                          <ChevronLeft className="h-4 w-4" />
                          Previous
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setShipmentPage(shipmentPage + 1)}
                          disabled={shipmentPage >= shipmentsData.pagination.totalPages}
                          data-testid="button-shipments-next-page"
                        >
                          Next
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto" data-testid="dialog-webhook-details">
          <DialogHeader>
            <DialogTitle>Webhook Payload Details</DialogTitle>
            <DialogDescription>
              {selectedWebhook && (
                <span>
                  Received at {format(new Date(selectedWebhook.receivedAt), "PPpp")}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          {selectedWebhook && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium">Shipment Reference</p>
                  <p className="text-sm text-muted-foreground">
                    {selectedWebhook.shipmentReference || "Not provided"}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium">Event Type</p>
                  <p className="text-sm text-muted-foreground">
                    {selectedWebhook.eventType || "Unknown"}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium">Status</p>
                  <Badge variant={getStatusBadgeVariant(selectedWebhook.status)}>
                    {selectedWebhook.status}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm font-medium">Processed At</p>
                  <p className="text-sm text-muted-foreground">
                    {selectedWebhook.processedAt
                      ? format(new Date(selectedWebhook.processedAt), "PPpp")
                      : "Not processed"}
                  </p>
                </div>
              </div>
              <div>
                <p className="text-sm font-medium mb-2">Full Payload</p>
                <pre className="bg-muted p-4 rounded-md overflow-x-auto text-xs font-mono">
                  {JSON.stringify(selectedWebhook.payload, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={shipmentDetailsOpen} onOpenChange={setShipmentDetailsOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto" data-testid="dialog-shipment-details">
          <DialogHeader>
            <DialogTitle>Shipment Details</DialogTitle>
            <DialogDescription>
              {selectedShipment && (
                <span className="flex items-center gap-2">
                  Reference: {selectedShipment.referenceNumber}
                  {selectedShipment.receivedViaWebhook && (
                    <Badge variant="outline" className="text-green-600 border-green-600">
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      Received via Webhook
                    </Badge>
                  )}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          {selectedShipment && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium">Reference Number</p>
                  <p className="text-sm text-muted-foreground font-mono">
                    {selectedShipment.referenceNumber}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium">Booking Number</p>
                  <p className="text-sm text-muted-foreground">
                    {selectedShipment.bookingNumber || "Not provided"}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium">Master Bill of Lading</p>
                  <p className="text-sm text-muted-foreground">
                    {selectedShipment.masterBillOfLading || "Not provided"}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium">Status</p>
                  <Badge variant={getShipmentStatusVariant(selectedShipment.status)}>
                    {selectedShipment.status}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm font-medium">Shipper</p>
                  <p className="text-sm text-muted-foreground">
                    {selectedShipment.shipper || "Not provided"}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium">Consignee</p>
                  <p className="text-sm text-muted-foreground">
                    {selectedShipment.consignee || "Not provided"}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium">Origin Port</p>
                  <p className="text-sm text-muted-foreground">
                    {selectedShipment.originPort || "Not provided"}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium">Destination Port</p>
                  <p className="text-sm text-muted-foreground">
                    {selectedShipment.destinationPort || "Not provided"}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium">Carrier</p>
                  <p className="text-sm text-muted-foreground">
                    {selectedShipment.carrier || "Not provided"}
                  </p>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
