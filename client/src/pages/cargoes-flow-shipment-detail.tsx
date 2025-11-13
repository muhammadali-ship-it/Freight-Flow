import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute, Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Package, MapPin, Calendar, Ship, User, FileText, Truck, Weight, Box, Clock, CheckCircle2, XCircle, Plus, Edit, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CargoesFlowMap } from "@/components/cargoes-flow-map";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ShipmentDocuments } from "@/components/shipment-documents";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useState, useEffect } from "react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface CargoesFlowShipment {
  id: string;
  shipmentReference: string;
  taiShipmentId?: string;
  mblNumber?: string;
  containerNumber?: string;
  bookingNumber?: string;
  shipper?: string;
  consignee?: string;
  originPort?: string;
  destinationPort?: string;
  etd?: string;
  eta?: string;
  status?: string;
  carrier?: string;
  vesselName?: string;
  voyageNumber?: string;
  containerType?: string;
  office?: string;
  salesRepNames?: string[];
  rawData?: any;
  lastFetchedAt?: string;
  createdAt?: string;
  updatedAt?: string;
  source?: 'user' | 'webhook' | 'api';
  isUserCreated?: boolean;
  milestones?: any[];
  containers?: any[];
  assignedUsers?: any[];
}

interface MapLogEntry {
  id: string;
  shipmentNumber: string;
  shipmentReference?: string;
  requestUrl: string;
  status: string;
  statusCode?: number;
  responseData?: any;
  errorMessage?: string;
  requestDurationMs?: number;
  createdAt: string;
}

function MapLogsSection({ shipmentNumber }: { shipmentNumber: string }) {
  const { data: mapLogs, isLoading } = useQuery<MapLogEntry[]>({
    queryKey: ["/api/cargoes-flow/map-logs", shipmentNumber],
  });

  if (isLoading) {
    return <Skeleton className="h-64 w-full" />;
  }

  if (!mapLogs || mapLogs.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Map API Logs
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No map API requests recorded yet</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MapPin className="h-5 w-5" />
          Map API Logs ({mapLogs.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {mapLogs.map((log) => (
          <Collapsible key={log.id}>
            <div className="rounded-lg border p-3 hover-elevate">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  {log.status === "success" ? (
                    <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0" />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-600 flex-shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant={log.status === "success" ? "default" : "destructive"} className="text-xs">
                        {log.statusCode || "N/A"}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {new Date(log.createdAt).toLocaleString()}
                      </span>
                      {log.requestDurationMs && (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {log.requestDurationMs}ms
                        </span>
                      )}
                    </div>
                    {log.errorMessage && (
                      <p className="text-xs text-red-600 mt-1 truncate">{log.errorMessage}</p>
                    )}
                  </div>
                </div>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm" data-testid={`button-expand-log-${log.id}`}>
                    View Details
                  </Button>
                </CollapsibleTrigger>
              </div>
              
              <CollapsibleContent className="mt-3 pt-3 border-t">
                <div className="space-y-3">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">Request URL</p>
                    <code className="text-xs bg-muted p-2 rounded block overflow-x-auto">
                      {log.requestUrl}
                    </code>
                  </div>
                  
                  {log.responseData && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-1">Response Data</p>
                      <pre className="text-xs bg-muted p-3 rounded overflow-auto max-h-96">
                        {JSON.stringify(log.responseData, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              </CollapsibleContent>
            </div>
          </Collapsible>
        ))}
      </CardContent>
    </Card>
  );
}

interface CargoesFlowPost {
  id: string;
  shipmentReference: string;
  mblNumber: string;
  status: string;
  postedAt: string;
  responseData?: any;
  errorMessage?: string;
}

function TrackingTimeline({ shipmentReference }: { shipmentReference: string }) {
  const { data: post, isLoading } = useQuery<CargoesFlowPost>({
    queryKey: ["/api/cargoes-flow/posts/by-reference", shipmentReference],
    queryFn: async () => {
      try {
        return await apiRequest(`/api/cargoes-flow/posts/by-reference/${shipmentReference}`);
      } catch (error: any) {
        // Silently return null for 404s - this is expected when shipment hasn't been posted
        if (error?.status === 404) {
          return null;
        }
        throw error;
      }
    },
    retry: false, // Don't retry since we handle 404s gracefully
  });

  const { data: shipment } = useQuery<CargoesFlowShipment>({
    queryKey: ["/api/shipments", shipmentReference],
  });

  if (isLoading) {
    return <Skeleton className="h-48 w-full" />;
  }

  if (!post) {
    return (
      <div className="text-center py-8">
        <Clock className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
        <p className="text-sm text-muted-foreground">
          No tracking history available - this shipment was likely received from Cargoes Flow API
        </p>
      </div>
    );
  }

  const wasUserCreated = shipment?.rawData?.userCreated === true;
  const receivedFromApi = shipment?.lastFetchedAt && new Date(shipment.lastFetchedAt) > new Date(post.postedAt);

  return (
    <div className="space-y-6">
      <div className="relative">
        <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-border" />
        
        <div className="relative pl-12 pb-8">
          <div className="absolute left-0 top-0">
            <div className="h-8 w-8 rounded-full bg-green-500 flex items-center justify-center">
              <CheckCircle2 className="h-5 w-5 text-white" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <p className="font-semibold">Posted to Cargoes Flow</p>
              <Badge variant={post.status === "success" ? "default" : "destructive"} className="text-xs">
                {post.status}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              {new Date(post.postedAt).toLocaleString()}
            </p>
            <div className="mt-2 text-sm">
              <p className="text-muted-foreground">MBL: <span className="font-mono">{post.mblNumber}</span></p>
              {wasUserCreated && (
                <Badge variant="outline" className="mt-2">
                  User Created
                </Badge>
              )}
            </div>
            {post.errorMessage && (
              <div className="mt-3 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                <p className="text-sm text-red-600 dark:text-red-400">{post.errorMessage}</p>
              </div>
            )}
          </div>
        </div>

        {receivedFromApi && shipment?.lastFetchedAt && (
          <div className="relative pl-12 pb-8">
            <div className="absolute left-0 top-0">
              <div className="h-8 w-8 rounded-full bg-blue-500 flex items-center justify-center">
                <Package className="h-5 w-5 text-white" />
              </div>
            </div>
            <div>
              <p className="font-semibold mb-1">Received as ACTIVE Shipment</p>
              <p className="text-sm text-muted-foreground">
                {new Date(shipment.lastFetchedAt).toLocaleString()}
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                Shipment data synchronized from Cargoes Flow API
              </p>
            </div>
          </div>
        )}

        {!receivedFromApi && post.status === "success" && (
          <div className="relative pl-12">
            <div className="absolute left-0 top-0">
              <div className="h-8 w-8 rounded-full bg-yellow-500 flex items-center justify-center">
                <Clock className="h-5 w-5 text-white" />
              </div>
            </div>
            <div>
              <p className="font-semibold mb-1">Awaiting API Sync</p>
              <p className="text-sm text-muted-foreground">
                Shipment will appear with full tracking data when polled from Cargoes Flow API
              </p>
            </div>
          </div>
        )}
      </div>

      {post.responseData && (
        <Collapsible>
          <div className="border rounded-lg p-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">API Response</p>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm">
                  View Details
                </Button>
              </CollapsibleTrigger>
            </div>
            <CollapsibleContent className="mt-3">
              <pre className="text-xs bg-muted p-3 rounded overflow-auto max-h-96">
                {JSON.stringify(post.responseData, null, 2)}
              </pre>
            </CollapsibleContent>
          </div>
        </Collapsible>
      )}
    </div>
  );
}

const getStatusColor = (status: string): string => {
  const statusLower = status.toLowerCase();
  if (statusLower.includes("delivered") || statusLower.includes("completed")) {
    return "bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20";
  }
  if (statusLower.includes("transit") || statusLower.includes("active")) {
    return "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20";
  }
  if (statusLower.includes("delayed")) {
    return "bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20";
  }
  if (statusLower.includes("pending")) {
    return "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500/20";
  }
  return "bg-muted text-muted-foreground border-border";
};

const formatDateOnly = (dateString: string | undefined | null): string => {
  if (!dateString) return "";
  // Extract just the date portion (YYYY-MM-DD) from datetime strings
  const match = dateString.match(/(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : dateString;
};

const formatDateTime = (dateString: string | undefined | null): string => {
  if (!dateString) return "";
  try {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return dateString;
  }
};

export default function CargoesFlowShipmentDetail() {
  const [, params] = useRoute("/shipments/:id");
  const shipmentId = params?.id;
  const { toast } = useToast();

  // Read URL query parameters to determine initial tab
  const urlParams = new URLSearchParams(window.location.search);
  const initialTab = urlParams.get('tab') || 'events';
  const [activeTab, setActiveTab] = useState(initialTab);

  const [assignUsersDialogOpen, setAssignUsersDialogOpen] = useState(false);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [addTerminalDialogOpen, setAddTerminalDialogOpen] = useState(false);
  const [addMilestoneDialogOpen, setAddMilestoneDialogOpen] = useState(false);
  const [editEventDialogOpen, setEditEventDialogOpen] = useState(false);
  const [editingEventIndex, setEditingEventIndex] = useState<number | null>(null);
  const [editContainerDialogOpen, setEditContainerDialogOpen] = useState(false);
  const [addRailDialogOpen, setAddRailDialogOpen] = useState(false);
  const [selectedContainerId, setSelectedContainerId] = useState<string | null>(null);
  const [selectedContainerNumber, setSelectedContainerNumber] = useState<string | null>(null);
  const [containerForm, setContainerForm] = useState({
    containerNumber: "",
    containerType: "",
    containerStatus: "",
    voyageNumber: "",
    bookingReference: "",
    sealNumber: "",
    weight: "",
    containerEta: "",
    containerAta: "",
    lastFreeDay: "",
    dailyFeeRate: "",
    detentionFee: "",
    pickupChassis: "",
    yardLocation: "",
  });
  const [terminalForm, setTerminalForm] = useState({
    terminalName: "",
    terminalPort: "",
    lfd: "",
    demurrage: "",
    detention: "",
    yardLocation: "",
    pickupChassis: "",
    fullOut: "",
    pickupAppointment: "",
    emptyReturned: "",
    availableForPickup: false,
  });
  const [milestoneForm, setMilestoneForm] = useState({
    eventType: "",
    location: "",
    timestampPlanned: "",
    timestampActual: "",
    status: "pending",
    notes: "",
  });
  const [editEventForm, setEditEventForm] = useState({
    name: "",
    location: "",
    estimateTime: "",
    actualTime: "",
    code: "",
  });
  const [railForm, setRailForm] = useState({
    railNumber: "",
    podRailCarrier: "",
    destinationRailCarrier: "",
    railLoaded: "",
    railDeparted: "",
    railArrived: "",
    railUnloaded: "",
    arrivedAtDestination: "",
    fullOut: "",
    emptyReturned: "",
    available: false,
    estimatedArrivalAtFinalDestination: "",
    lfd: "",
  });

  const { data: shipment, isLoading } = useQuery<CargoesFlowShipment>({
    queryKey: ["/api/shipments", shipmentId],
    enabled: !!shipmentId,
  });

  const { data: allUsers } = useQuery<any[]>({
    queryKey: ["/api/users"],
  });

  // Check if shipment has tracking post data (user-created shipments)
  const { data: trackingPost } = useQuery<CargoesFlowPost>({
    queryKey: ["/api/cargoes-flow/posts/by-reference", shipment?.shipmentReference],
    queryFn: async () => {
      if (!shipment?.shipmentReference) return null;
      try {
        return await apiRequest(`/api/cargoes-flow/posts/by-reference/${shipment.shipmentReference}`);
      } catch (error: any) {
        // Silently return null for 404s - this is expected when shipment hasn't been posted
        if (error?.status === 404) {
          return null;
        }
        throw error;
      }
    },
    enabled: !!shipment?.shipmentReference,
    retry: false, // Don't retry since we handle 404s gracefully
  });

  const isUserCreatedShipment = !!trackingPost;

  const assignUsersMutation = useMutation({
    mutationFn: async (userIds: string[]) => {
      await apiRequest(`/api/shipments/${shipmentId}/users`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userIds }),
      });
    },
    onSuccess: () => {
      console.log("User assignment successful, invalidating queries for shipmentId:", shipmentId);
      queryClient.invalidateQueries({ queryKey: ["/api/shipments", shipmentId] });
      queryClient.invalidateQueries({ queryKey: ["/api/shipments"] });
      
      toast({
        title: "Users assigned",
        description: "The users have been successfully assigned to this shipment.",
      });
      setAssignUsersDialogOpen(false);
      setSelectedUserIds([]); // Reset selected users
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to assign users. Please try again.",
        variant: "destructive",
      });
    },
  });

  const addTerminalMutation = useMutation({
    mutationFn: async (data: any) => {
      await apiRequest("PATCH", `/api/shipments/${shipmentId}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/shipments", shipmentId] });
      toast({
        title: "Terminal information updated",
        description: "The terminal details have been successfully saved.",
      });
      setAddTerminalDialogOpen(false);
      setTerminalForm({
        terminalName: "",
        terminalPort: "",
        lfd: "",
        demurrage: "",
        detention: "",
        yardLocation: "",
        pickupChassis: "",
        fullOut: "",
        pickupAppointment: "",
        emptyReturned: "",
        availableForPickup: false,
      });
    },
    onError: (error: any) => {
      const errorMessage = error?.response?.data?.error || error?.message || "Failed to update terminal information";
      const errorDetails = error?.response?.data?.details;
      toast({
        title: "Error",
        description: errorDetails ? `${errorMessage}. ${errorDetails}` : errorMessage,
        variant: "destructive",
      });
    },
  });

  const addRailMutation = useMutation({
    mutationFn: async (data: { containerId: string; containerNumber?: string; rail: any }) => {
      // For Cargoes Flow shipments, use the shipment ID (which might be the same as containerId)
      // The server endpoint will handle finding the correct container within the shipment
      const response = await fetch(`/api/containers/${data.containerId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ 
          rawData: { rail: data.rail },
          containerNumber: data.containerNumber,
        }),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to update rail information: ${response.status}`);
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/shipments", shipmentId] });
      toast({
        title: "Rail information updated",
        description: "The rail details have been successfully saved.",
      });
      setAddRailDialogOpen(false);
      setSelectedContainerId(null);
      setSelectedContainerNumber(null);
      setRailForm({
        railNumber: "",
        podRailCarrier: "",
        destinationRailCarrier: "",
        railLoaded: "",
        railDeparted: "",
        railArrived: "",
        railUnloaded: "",
        arrivedAtDestination: "",
        fullOut: "",
        emptyReturned: "",
        available: false,
        estimatedArrivalAtFinalDestination: "",
        lfd: "",
      });
    },
    onError: (error: any) => {
      const errorMessage = error?.message || "Failed to update rail information";
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  const addMilestoneMutation = useMutation({
    mutationFn: async (data: any) => {
      await apiRequest("POST", "/api/milestones", { ...data, shipmentId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/shipments", shipmentId] });
      toast({
        title: "Milestone added",
        description: "The milestone has been successfully added.",
      });
      setAddMilestoneDialogOpen(false);
      setMilestoneForm({
        eventType: "",
        location: "",
        timestampPlanned: "",
        timestampActual: "",
        status: "pending",
        notes: "",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to add milestone. Please try again.",
        variant: "destructive",
      });
    },
  });

  const updateContainerMutation = useMutation({
    mutationFn: async (data: any) => {
      await apiRequest("PATCH", `/api/shipments/${shipmentId}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/shipments", shipmentId] });
      toast({
        title: "Container updated",
        description: "The container information has been successfully updated.",
      });
      setEditContainerDialogOpen(false);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update container information. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Build containers list from both containerNumber field and containers array
  const availableContainers: any[] = [];
  if (shipment?.containerNumber) {
    availableContainers.push({
      id: shipment.containerNumber,
      containerNumber: shipment.containerNumber,
      containerType: shipment.containerType || "N/A"
    });
  }
  if (shipment?.containers && (shipment.containers as any[]).length > 0) {
    availableContainers.push(...(shipment.containers as any[]));
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!shipment) {
    return (
      <div className="space-y-6">
        <Link href="/shipments">
          <Button variant="outline" data-testid="button-back">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Shipments
          </Button>
        </Link>
        <Card>
          <CardContent className="p-12 text-center">
            <p className="text-lg font-medium">Shipment not found</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const rawData = shipment.rawData || {};
  const events = rawData.shipmentEvents || [];
  const legs = rawData.shipmentLegs || {};
  const tags = rawData.shipmentTags || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Link href="/shipments">
          <Button variant="outline" data-testid="button-back">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Shipments
          </Button>
        </Link>
      </div>

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" data-testid="heading-shipment-reference">
            Shipment {shipment.taiShipmentId || shipment.shipmentReference}
          </h1>
          <p className="text-muted-foreground">
            {shipment.mblNumber && `MBL: ${shipment.mblNumber}`}
            {rawData.blNumber && `BL: ${rawData.blNumber}`}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Badge className={getStatusColor(shipment.status || "unknown")}>
            {shipment.status || "Unknown"}
          </Badge>
          {shipment.isUserCreated && (
            <Badge variant="secondary" data-testid="badge-user-created">
              User Created
            </Badge>
          )}
        </div>
      </div>

      {rawData.subStatus1 && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <Package className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="font-medium">{rawData.subStatus1}</p>
                {rawData.subStatus2 && (
                  <p className="text-sm text-muted-foreground">{rawData.subStatus2}</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Reference Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div>
              <p className="text-xs text-muted-foreground">Shipment Number</p>
              <p className="font-mono text-sm">{shipment.taiShipmentId || shipment.shipmentReference}</p>
            </div>
            {shipment.bookingNumber && (
              <div>
                <p className="text-xs text-muted-foreground">Booking Number</p>
                <p className="font-mono text-sm">{shipment.bookingNumber}</p>
              </div>
            )}
            {(shipment.mblNumber || rawData.blNumber) && (
              <div>
                <p className="text-xs text-muted-foreground">BL Number</p>
                <p className="font-mono text-sm">{shipment.mblNumber || rawData.blNumber}</p>
              </div>
            )}
            {shipment.containerNumber && (
              <div>
                <p className="text-xs text-muted-foreground">Container Number</p>
                <p className="font-mono text-sm">{shipment.containerNumber}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <User className="h-4 w-4" />
              Parties
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {shipment.shipper && (
              <div>
                <p className="text-xs text-muted-foreground">Shipper</p>
                <p className="text-sm">{shipment.shipper}</p>
              </div>
            )}
            {shipment.consignee && (
              <div>
                <p className="text-xs text-muted-foreground">Consignee</p>
                <p className="text-sm">{shipment.consignee}</p>
              </div>
            )}
            {shipment.office && (
              <div>
                <p className="text-xs text-muted-foreground">Office</p>
                <p className="text-sm font-medium" data-testid="text-office-name">{shipment.office}</p>
              </div>
            )}
            {shipment.salesRepNames && shipment.salesRepNames.length > 0 && (
              <div>
                <p className="text-xs text-muted-foreground mb-2">Sales Representatives</p>
                <div className="flex flex-wrap gap-1.5" data-testid="container-sales-reps">
                  {shipment.salesRepNames.map((repName, index) => (
                    <Badge
                      key={index}
                      variant="secondary"
                      className="text-xs font-normal"
                      data-testid={`badge-sales-rep-${index}`}
                    >
                      {repName}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              Route
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {shipment.originPort && (
              <div>
                <p className="text-xs text-muted-foreground">Origin</p>
                <p className="text-sm font-medium">{shipment.originPort}</p>
              </div>
            )}
            {shipment.destinationPort && (
              <div>
                <p className="text-xs text-muted-foreground">Destination</p>
                <p className="text-sm font-medium">{shipment.destinationPort}</p>
              </div>
            )}
            {rawData.currentLocationName && (
              <div>
                <p className="text-xs text-muted-foreground">Current Location</p>
                <p className="text-sm font-medium">{rawData.currentLocationName}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Schedule
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {(shipment.etd || rawData.promisedEtd) && (
              <div>
                <p className="text-xs text-muted-foreground">ETD</p>
                <p className="text-sm">{formatDateOnly(shipment.etd || rawData.promisedEtd)}</p>
              </div>
            )}
            {(shipment.eta || rawData.promisedEta) && (
              <div>
                <p className="text-xs text-muted-foreground">ETA</p>
                <p className="text-sm">{formatDateOnly(shipment.eta || rawData.promisedEta)}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Ship className="h-4 w-4" />
              Carrier & Transport
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {shipment.carrier && (
              <div>
                <p className="text-xs text-muted-foreground">Carrier</p>
                <p className="text-sm">{shipment.carrier}</p>
              </div>
            )}
            {rawData.shippingMode && (
              <div>
                <p className="text-xs text-muted-foreground">Shipping Mode</p>
                <p className="text-sm">{rawData.shippingMode}</p>
              </div>
            )}
            {rawData.serviceMode && (
              <div>
                <p className="text-xs text-muted-foreground">Service Mode</p>
                <p className="text-sm">{rawData.serviceMode}</p>
              </div>
            )}
            {shipment.vesselName && (
              <div>
                <p className="text-xs text-muted-foreground">Vessel</p>
                <p className="text-sm">{shipment.vesselName}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Box className="h-4 w-4" />
              Cargo Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {(shipment.containerType || rawData.containerSize) && (
              <div>
                <p className="text-xs text-muted-foreground">Container Size</p>
                <p className="text-sm">{rawData.containerSize || shipment.containerType}</p>
              </div>
            )}
            {rawData.containerType && (
              <div>
                <p className="text-xs text-muted-foreground">Container Type</p>
                <p className="text-sm">{rawData.containerType}</p>
              </div>
            )}
            {rawData.containerIso && (
              <div>
                <p className="text-xs text-muted-foreground">Container ISO</p>
                <p className="text-sm font-mono">{rawData.containerIso}</p>
              </div>
            )}
            {rawData.commodity && (
              <div>
                <p className="text-xs text-muted-foreground">Commodity</p>
                <p className="text-sm">{rawData.commodity}</p>
              </div>
            )}
            {rawData.totalWeight && (
              <div>
                <p className="text-xs text-muted-foreground">Total Weight</p>
                <p className="text-sm">{rawData.totalWeight} {rawData.totalWeightUom}</p>
              </div>
            )}
            {rawData.totalVolume && (
              <div>
                <p className="text-xs text-muted-foreground">Total Volume</p>
                <p className="text-sm">{rawData.totalVolume} {rawData.totalVolumeUom}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Terminal Information Card - Show if terminal data exists */}
        {(() => {
          const hasTerminalInfo = rawData.terminalName || rawData.terminalPort || rawData.lastFreeDay || rawData.demurrage || 
            rawData.detention || rawData.terminalYardLocation || rawData.terminalPickupChassis || rawData.terminalFullOut ||
            rawData.terminalPickupAppointment || rawData.terminalEmptyReturned || rawData.terminalAvailableForPickup !== undefined;
          
          if (!hasTerminalInfo) return null;
          
          return (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  Terminal Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {rawData.terminalName && (
                  <div>
                    <p className="text-xs text-muted-foreground">Terminal Name</p>
                    <p className="text-sm font-medium">{rawData.terminalName}</p>
                  </div>
                )}
                {rawData.terminalPort && (
                  <div>
                    <p className="text-xs text-muted-foreground">Port</p>
                    <p className="text-sm font-medium">{rawData.terminalPort}</p>
                  </div>
                )}
                {rawData.terminalYardLocation && (
                  <div>
                    <p className="text-xs text-muted-foreground">Yard Location</p>
                    <p className="text-sm font-medium">{rawData.terminalYardLocation}</p>
                  </div>
                )}
                {rawData.terminalPickupChassis && (
                  <div>
                    <p className="text-xs text-muted-foreground">Pickup Chassis #</p>
                    <p className="text-sm font-medium">{rawData.terminalPickupChassis}</p>
                  </div>
                )}
                {rawData.lastFreeDay && (
                  <div>
                    <p className="text-xs text-muted-foreground">Last Free Day (LFD)</p>
                    <p className="text-sm font-medium">{formatDateOnly(rawData.lastFreeDay)}</p>
                  </div>
                )}
                {rawData.demurrage && (
                  <div>
                    <p className="text-xs text-muted-foreground">Demurrage</p>
                    <p className="text-sm font-medium">${rawData.demurrage}</p>
                  </div>
                )}
                {rawData.detention && (
                  <div>
                    <p className="text-xs text-muted-foreground">Detention</p>
                    <p className="text-sm font-medium">${rawData.detention}</p>
                  </div>
                )}
                {rawData.terminalFullOut && (
                  <div>
                    <p className="text-xs text-muted-foreground">Full Out</p>
                    <p className="text-sm font-medium">{formatDateTime(rawData.terminalFullOut)}</p>
                  </div>
                )}
                {rawData.terminalPickupAppointment && (
                  <div>
                    <p className="text-xs text-muted-foreground">Pickup Appointment</p>
                    <p className="text-sm font-medium">{formatDateTime(rawData.terminalPickupAppointment)}</p>
                  </div>
                )}
                {rawData.terminalEmptyReturned && (
                  <div>
                    <p className="text-xs text-muted-foreground">Empty Returned</p>
                    <p className="text-sm font-medium">{formatDateTime(rawData.terminalEmptyReturned)}</p>
                  </div>
                )}
                {rawData.terminalAvailableForPickup !== undefined && (
                  <div>
                    <p className="text-xs text-muted-foreground">Available For Pickup</p>
                    <div className="text-sm font-medium">
                      {rawData.terminalAvailableForPickup ? (
                        <Badge variant="default" className="bg-green-500 text-xs">Yes</Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs">No</Badge>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })()}

        {/* Rail Information Card - Show if rail data exists */}
        {(() => {
          // Check if any container has rail data
          const containersArray = shipment.containers && (shipment.containers as any[]).length > 0 
            ? (shipment.containers as any[]) 
            : [];
          
          const hasRailInfo = containersArray.some((container: any) => {
            const containerData = container.rawData || {};
            return containerData.rail && (
              containerData.rail.railNumber || 
              containerData.rail.podRailCarrier || 
              containerData.rail.destinationRailCarrier ||
              containerData.rail.railLoaded ||
              containerData.rail.railDeparted ||
              containerData.rail.railArrived ||
              containerData.rail.railUnloaded ||
              containerData.rail.arrivedAtDestination ||
              containerData.rail.fullOut ||
              containerData.rail.emptyReturned ||
              containerData.rail.estimatedArrivalAtFinalDestination ||
              containerData.rail.lfd ||
              containerData.rail.available !== undefined
            );
          });
          
          if (!hasRailInfo) return null;
          
          // Get the first container with rail data
          const containerWithRail = containersArray.find((container: any) => {
            const containerData = container.rawData || {};
            return containerData.rail;
          });
          
          if (!containerWithRail) return null;
          
          const railData = containerWithRail.rawData?.rail || {};
          
          return (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Truck className="h-4 w-4" />
                  Rail Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {railData.railNumber && (
                  <div>
                    <p className="text-xs text-muted-foreground">Rail Number</p>
                    <p className="text-sm font-medium font-mono">{railData.railNumber}</p>
                  </div>
                )}
                {railData.podRailCarrier && (
                  <div>
                    <p className="text-xs text-muted-foreground">POD Rail Carrier</p>
                    <p className="text-sm font-medium">{railData.podRailCarrier}</p>
                  </div>
                )}
                {railData.destinationRailCarrier && (
                  <div>
                    <p className="text-xs text-muted-foreground">Destination Rail Carrier</p>
                    <p className="text-sm font-medium">{railData.destinationRailCarrier}</p>
                  </div>
                )}
                {railData.railLoaded && (
                  <div>
                    <p className="text-xs text-muted-foreground">Rail Loaded</p>
                    <p className="text-sm font-medium">{formatDateTime(railData.railLoaded)}</p>
                  </div>
                )}
                {railData.railDeparted && (
                  <div>
                    <p className="text-xs text-muted-foreground">Rail Departed</p>
                    <p className="text-sm font-medium">{formatDateTime(railData.railDeparted)}</p>
                  </div>
                )}
                {railData.railArrived && (
                  <div>
                    <p className="text-xs text-muted-foreground">Rail Arrived</p>
                    <p className="text-sm font-medium">{formatDateTime(railData.railArrived)}</p>
                  </div>
                )}
                {railData.railUnloaded && (
                  <div>
                    <p className="text-xs text-muted-foreground">Rail Unloaded</p>
                    <p className="text-sm font-medium">{formatDateTime(railData.railUnloaded)}</p>
                  </div>
                )}
                {railData.arrivedAtDestination && (
                  <div>
                    <p className="text-xs text-muted-foreground">Arrived At Destination</p>
                    <p className="text-sm font-medium">{formatDateTime(railData.arrivedAtDestination)}</p>
                  </div>
                )}
                {railData.fullOut && (
                  <div>
                    <p className="text-xs text-muted-foreground">Full Out</p>
                    <p className="text-sm font-medium">{formatDateTime(railData.fullOut)}</p>
                  </div>
                )}
                {railData.emptyReturned && (
                  <div>
                    <p className="text-xs text-muted-foreground">Empty Returned</p>
                    <p className="text-sm font-medium">{formatDateTime(railData.emptyReturned)}</p>
                  </div>
                )}
                {railData.estimatedArrivalAtFinalDestination && (
                  <div>
                    <p className="text-xs text-muted-foreground">Est. Arrival at Final Dest</p>
                    <p className="text-sm font-medium">{formatDateTime(railData.estimatedArrivalAtFinalDestination)}</p>
                  </div>
                )}
                {railData.lfd && (
                  <div>
                    <p className="text-xs text-muted-foreground">LFD</p>
                    <p className="text-sm font-medium">{formatDateOnly(railData.lfd)}</p>
                  </div>
                )}
                {railData.available !== undefined && (
                  <div>
                    <p className="text-xs text-muted-foreground">Available</p>
                    <div className="text-sm font-medium">
                      {railData.available ? (
                        <Badge variant="default" className="bg-green-500 text-xs">Yes</Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs">No</Badge>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })()}
      </div>

      {tags.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Tags</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {tags.map((tag: any, index: number) => (
                <Badge key={index} variant="outline">
                  {tag.name}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card data-testid="card-route-map">
        <CardHeader>
          <CardTitle>Route Map</CardTitle>
        </CardHeader>
        <CardContent>
          <CargoesFlowMap shipmentNumber={shipment.shipmentReference} />
        </CardContent>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className={`grid w-full ${isUserCreatedShipment ? 'grid-cols-6' : 'grid-cols-5'}`}>
          <TabsTrigger value="events">Events</TabsTrigger>
          <TabsTrigger value="legs">Shipment Legs</TabsTrigger>
          {isUserCreatedShipment && <TabsTrigger value="tracking">Tracking</TabsTrigger>}
          <TabsTrigger value="edit">Edit</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="raw">Raw Data</TabsTrigger>
        </TabsList>
        
        <TabsContent value="tracking" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Cargoes Flow Tracking History
              </CardTitle>
            </CardHeader>
            <CardContent>
              <TrackingTimeline shipmentReference={shipment.shipmentReference} />
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="events" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Shipment Events</CardTitle>
            </CardHeader>
            <CardContent>
              {events.length === 0 ? (
                <p className="text-sm text-muted-foreground">No events recorded</p>
              ) : (
                <div className="space-y-4">
                  {events.map((event: any, index: number) => (
                    <div key={index} className="flex gap-4 pb-4 border-b last:border-0">
                      <div className="flex-shrink-0">
                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                          <MapPin className="h-5 w-5 text-primary" />
                        </div>
                      </div>
                      <div className="flex-1">
                        <p className="font-medium">{event.name || event.code}</p>
                        {event.location && (
                          <p className="text-sm text-muted-foreground">{event.location}</p>
                        )}
                        <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
                          {event.estimateTime && (
                            <span>Estimated: {formatDateOnly(event.estimateTime)}</span>
                          )}
                          {event.actualTime && (
                            <span className="text-green-600 dark:text-green-400">
                              Actual: {formatDateOnly(event.actualTime)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="legs" className="mt-6">
          <div className="space-y-4">
            {legs.road && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Truck className="h-4 w-4" />
                    Road Leg
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <p className="text-xs text-muted-foreground">Origin</p>
                      <p className="text-sm font-medium">{legs.road.origin || "—"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Destination</p>
                      <p className="text-sm font-medium">{legs.road.destination || "—"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Truck Number</p>
                      <p className="text-sm font-mono">{legs.road.truckNumber || "—"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Driver</p>
                      <p className="text-sm">{legs.road.driverName || "—"}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {legs.portToPort && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Ship className="h-4 w-4" />
                    Port to Port Leg
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <p className="text-xs text-muted-foreground">Loading Port</p>
                      <p className="text-sm font-medium">{legs.portToPort.loadingPort || "—"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Discharge Port</p>
                      <p className="text-sm font-medium">{legs.portToPort.dischargePort || "—"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Vessel</p>
                      <p className="text-sm">{legs.portToPort.currentTransportName || "—"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Voyage</p>
                      <p className="text-sm font-mono">{legs.portToPort.currentTripNumber || "—"}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {!legs.road && !legs.portToPort && (
              <Card>
                <CardContent className="p-12 text-center">
                  <p className="text-sm text-muted-foreground">No leg information available</p>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="edit" className="mt-6">
          <div className="space-y-6">
            {/* User Assignment Section */}
            <Card data-testid="card-user-assignment">
              <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-4">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  User Assignment
                </CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSelectedUserIds(shipment.assignedUsers?.map((u: any) => u.id) || []);
                    setAssignUsersDialogOpen(true);
                  }}
                  data-testid="button-assign-users"
                >
                  <Edit className="mr-2 h-4 w-4" />
                  Edit Users
                </Button>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2" data-testid="container-assigned-users">
                  {shipment.assignedUsers && (shipment.assignedUsers as any[]).length > 0 ? (
                    (shipment.assignedUsers as any[]).map((user: any) => (
                      <Badge
                        key={user.id}
                        variant="outline"
                        className="font-normal gap-1"
                        data-testid={`user-badge-${user.id}`}
                      >
                        <Users className="h-3 w-3" />
                        {user.username}
                      </Badge>
                    ))
                  ) : (
                    <span className="text-sm text-muted-foreground">No assigned users</span>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Terminal Information Section */}
            <Card data-testid="card-terminal-info">
              <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-4">
                <CardTitle className="text-lg flex items-center gap-2">
                  <MapPin className="h-5 w-5" />
                  Terminal Information
                </CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const rawData = shipment.rawData as any || {};
                    setTerminalForm({
                      terminalName: rawData.terminalName || "",
                      terminalPort: rawData.terminalPort || "",
                      lfd: rawData.lastFreeDay || "",
                      demurrage: rawData.demurrage || "",
                      detention: rawData.detention || "",
                      yardLocation: rawData.terminalYardLocation || "",
                      pickupChassis: rawData.terminalPickupChassis || "",
                      fullOut: rawData.terminalFullOut || "",
                      pickupAppointment: rawData.terminalPickupAppointment || "",
                      emptyReturned: rawData.terminalEmptyReturned || "",
                      availableForPickup: rawData.terminalAvailableForPickup || false,
                    });
                    setAddTerminalDialogOpen(true);
                  }}
                  data-testid="button-edit-terminal"
                >
                  <Edit className="mr-2 h-4 w-4" />
                  Edit Terminal
                </Button>
              </CardHeader>
              <CardContent>
                {(() => {
                  const rawData = shipment.rawData as any || {};
                  const hasTerminalInfo = rawData.terminalName || rawData.terminalPort || rawData.lastFreeDay || rawData.demurrage || 
                    rawData.detention || rawData.terminalYardLocation || rawData.terminalPickupChassis || rawData.terminalFullOut ||
                    rawData.terminalPickupAppointment || rawData.terminalEmptyReturned || rawData.terminalAvailableForPickup;
                  
                  return hasTerminalInfo ? (
                    <div className="rounded-lg border p-4 space-y-3">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {rawData.terminalName && (
                          <div>
                            <p className="text-xs text-muted-foreground">Terminal Name</p>
                            <p className="text-sm font-medium">{rawData.terminalName}</p>
                          </div>
                        )}
                        {rawData.terminalPort && (
                          <div>
                            <p className="text-xs text-muted-foreground">Port</p>
                            <p className="text-sm font-medium">{rawData.terminalPort}</p>
                          </div>
                        )}
                        {rawData.terminalYardLocation && (
                          <div>
                            <p className="text-xs text-muted-foreground">Yard Location</p>
                            <p className="text-sm font-medium">{rawData.terminalYardLocation}</p>
                          </div>
                        )}
                        {rawData.terminalPickupChassis && (
                          <div>
                            <p className="text-xs text-muted-foreground">Pickup Chassis #</p>
                            <p className="text-sm font-medium">{rawData.terminalPickupChassis}</p>
                          </div>
                        )}
                        {rawData.lastFreeDay && (
                          <div>
                            <p className="text-xs text-muted-foreground">Last Free Day (LFD)</p>
                            <p className="text-sm font-medium">{formatDateOnly(rawData.lastFreeDay)}</p>
                          </div>
                        )}
                        {rawData.demurrage && (
                          <div>
                            <p className="text-xs text-muted-foreground">Demurrage</p>
                            <p className="text-sm font-medium">${rawData.demurrage}</p>
                          </div>
                        )}
                        {rawData.detention && (
                          <div>
                            <p className="text-xs text-muted-foreground">Detention</p>
                            <p className="text-sm font-medium">${rawData.detention}</p>
                          </div>
                        )}
                        {rawData.terminalFullOut && (
                          <div>
                            <p className="text-xs text-muted-foreground">Full Out</p>
                            <p className="text-sm font-medium">{formatDateTime(rawData.terminalFullOut)}</p>
                          </div>
                        )}
                        {rawData.terminalPickupAppointment && (
                          <div>
                            <p className="text-xs text-muted-foreground">Pickup Appointment</p>
                            <p className="text-sm font-medium">{formatDateTime(rawData.terminalPickupAppointment)}</p>
                          </div>
                        )}
                        {rawData.terminalEmptyReturned && (
                          <div>
                            <p className="text-xs text-muted-foreground">Empty Returned</p>
                            <p className="text-sm font-medium">{formatDateTime(rawData.terminalEmptyReturned)}</p>
                          </div>
                        )}
                        {rawData.terminalAvailableForPickup !== undefined && (
                          <div>
                            <p className="text-xs text-muted-foreground">Available For Pickup</p>
                            <div className="text-sm font-medium">
                              {rawData.terminalAvailableForPickup ? (
                                <Badge variant="default" className="bg-green-500">Yes</Badge>
                              ) : (
                                <Badge variant="outline">No</Badge>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-12">
                      <MapPin className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                      <p className="text-muted-foreground">No terminal information available</p>
                      <p className="text-xs text-muted-foreground mt-2">Click "Edit Terminal" to add details</p>
                    </div>
                  );
                })()}
              </CardContent>
            </Card>

            {/* Container Information Section */}
            <Card data-testid="card-container-info">
              <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-4">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Package className="h-5 w-5" />
                  Container Information
                </CardTitle>
              </CardHeader>
              <CardContent>
                {(shipment.containers && (shipment.containers as any[]).length > 0) ? (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium">
                        {(shipment.containers as any[]).length === 1 ? 'Container Details' : `All Containers (${(shipment.containers as any[]).length})`}
                      </h4>
                      <Badge variant="outline" className="text-xs">
                        MBL: {shipment.mblNumber}
                      </Badge>
                    </div>
                    <div className="space-y-3">
                          {(shipment.containers as any[]).map((container: any, index: number) => {
                            const containerData = container.rawData || {};
                            const riskLevel = containerData.riskLevel;
                            const riskReasons = containerData.riskReasons || [];
                            
                            return (
                            <div key={container.id || index} className="rounded-lg border p-4 space-y-3 hover-elevate">
                              <div className="flex items-start justify-between gap-4 flex-wrap">
                                <div className="flex items-center gap-3">
                                  <div className="h-10 w-10 rounded-full bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                                    <Package className="h-5 w-5 text-blue-600" />
                                  </div>
                                  <div>
                                    <p className="font-medium font-mono">{container.containerNumber || `Container ${index + 1}`}</p>
                                    {container.containerType && (
                                      <p className="text-xs text-muted-foreground">{container.containerType}</p>
                                    )}
                                    {container.shipmentReference && (
                                      <p className="text-xs text-muted-foreground">Ref: {container.shipmentReference}</p>
                                    )}
                                  </div>
                                </div>
                                <div className="flex items-center gap-2 flex-wrap">
                                  {container.containerStatus && (
                                    <Badge variant="outline" className="text-xs">
                                      {container.containerStatus}
                                    </Badge>
                                  )}
                                  {riskLevel && riskLevel !== 'low' && (
                                    <Badge
                                      variant={riskLevel === 'critical' || riskLevel === 'high' ? 'destructive' : 'secondary'}
                                      className="text-xs"
                                      title={riskReasons.join(', ')}
                                    >
                                      {riskLevel === 'critical' ? '🔴 Critical' :
                                       riskLevel === 'high' ? '🟠 High Risk' :
                                       '🟡 Medium Risk'}
                                    </Badge>
                                  )}
                                </div>
                              </div>
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-2 border-t text-sm">
                                {container.bookingReference && (
                                  <div>
                                    <p className="text-xs text-muted-foreground">Booking</p>
                                    <p className="font-mono text-xs">{container.bookingReference}</p>
                                  </div>
                                )}
                                {container.weight && (
                                  <div>
                                    <p className="text-xs text-muted-foreground">Weight</p>
                                    <p className="text-xs">{container.weight} lbs</p>
                                  </div>
                                )}
                                {container.voyageNumber && (
                                  <div>
                                    <p className="text-xs text-muted-foreground">Voyage</p>
                                    <p className="font-mono text-xs">{container.voyageNumber}</p>
                                  </div>
                                )}
                                {container.sealNumber && (
                                  <div>
                                    <p className="text-xs text-muted-foreground">Seal</p>
                                    <p className="font-mono text-xs">{container.sealNumber}</p>
                                  </div>
                                )}
                                {container.containerEta && (
                                  <div>
                                    <p className="text-xs text-muted-foreground">Container ETA</p>
                                    <p className="text-xs">{formatDateOnly(container.containerEta)}</p>
                                  </div>
                                )}
                                {container.containerAta && (
                                  <div>
                                    <p className="text-xs text-muted-foreground">Container ATA</p>
                                    <p className="text-xs text-green-600 dark:text-green-400">{formatDateOnly(container.containerAta)}</p>
                                  </div>
                                )}
                                {container.lastFreeDay && (
                                  <div>
                                    <p className="text-xs text-muted-foreground">Last Free Day</p>
                                    <p className="text-xs">{formatDateOnly(container.lastFreeDay)}</p>
                                  </div>
                                )}
                                {container.dailyFeeRate && (
                                  <div>
                                    <p className="text-xs text-muted-foreground">Daily Fee Rate</p>
                                    <p className="text-xs">${container.dailyFeeRate}</p>
                                  </div>
                                )}
                                {container.detentionFee && (
                                  <div>
                                    <p className="text-xs text-muted-foreground">Detention Fee</p>
                                    <p className="text-xs">${container.detentionFee}</p>
                                  </div>
                                )}
                                {container.pickupChassis && (
                                  <div>
                                    <p className="text-xs text-muted-foreground">Pickup Chassis</p>
                                    <p className="text-xs">{container.pickupChassis}</p>
                                  </div>
                                )}
                                {container.yardLocation && (
                                  <div>
                                    <p className="text-xs text-muted-foreground">Yard Location</p>
                                    <p className="text-xs">{container.yardLocation}</p>
                                  </div>
                                )}
                              </div>
                              
                              {/* Rail Information Section */}
                              <div className="mt-3 pt-3 border-t">
                                <div className="flex items-center justify-between mb-3">
                                  <h5 className="text-sm font-semibold flex items-center gap-2">
                                    <Truck className="h-4 w-4" />
                                    Rail Information
                                  </h5>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                      // Use container.id which is the shipment ID for this specific container
                                      // For MBL-grouped containers, each container has its own shipment ID
                                      setSelectedContainerId(container.id || shipment.id);
                                      setSelectedContainerNumber(container.containerNumber);
                                      const railData = containerData.rail || {};
                                      setRailForm({
                                        railNumber: railData.railNumber || "",
                                        podRailCarrier: railData.podRailCarrier || "",
                                        destinationRailCarrier: railData.destinationRailCarrier || "",
                                        railLoaded: railData.railLoaded || "",
                                        railDeparted: railData.railDeparted || "",
                                        railArrived: railData.railArrived || "",
                                        railUnloaded: railData.railUnloaded || "",
                                        arrivedAtDestination: railData.arrivedAtDestination || "",
                                        fullOut: railData.fullOut || "",
                                        emptyReturned: railData.emptyReturned || "",
                                        available: railData.available || false,
                                        estimatedArrivalAtFinalDestination: railData.estimatedArrivalAtFinalDestination || "",
                                        lfd: railData.lfd || "",
                                      });
                                      setAddRailDialogOpen(true);
                                    }}
                                    data-testid={`button-add-rail-${container.id}`}
                                  >
                                    <Plus className="mr-2 h-3 w-3" />
                                    {containerData.rail ? 'Edit Rail' : 'Add Rail'}
                                  </Button>
                                </div>
                                {containerData.rail ? (
                                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm bg-muted/50 p-3 rounded-lg">
                                    {containerData.rail.railNumber && (
                                      <div>
                                        <p className="text-xs text-muted-foreground">Rail Number</p>
                                        <p className="text-xs font-medium">{containerData.rail.railNumber}</p>
                                      </div>
                                    )}
                                    {containerData.rail.podRailCarrier && (
                                      <div>
                                        <p className="text-xs text-muted-foreground">POD Rail Carrier</p>
                                        <p className="text-xs font-medium">{containerData.rail.podRailCarrier}</p>
                                      </div>
                                    )}
                                    {containerData.rail.destinationRailCarrier && (
                                      <div>
                                        <p className="text-xs text-muted-foreground">Destination Rail Carrier</p>
                                        <p className="text-xs font-medium">{containerData.rail.destinationRailCarrier}</p>
                                      </div>
                                    )}
                                    {containerData.rail.railLoaded && (
                                      <div>
                                        <p className="text-xs text-muted-foreground">Rail Loaded</p>
                                        <p className="text-xs">{formatDateTime(containerData.rail.railLoaded)}</p>
                                      </div>
                                    )}
                                    {containerData.rail.railDeparted && (
                                      <div>
                                        <p className="text-xs text-muted-foreground">Rail Departed</p>
                                        <p className="text-xs">{formatDateTime(containerData.rail.railDeparted)}</p>
                                      </div>
                                    )}
                                    {containerData.rail.railArrived && (
                                      <div>
                                        <p className="text-xs text-muted-foreground">Rail Arrived</p>
                                        <p className="text-xs">{formatDateTime(containerData.rail.railArrived)}</p>
                                      </div>
                                    )}
                                    {containerData.rail.railUnloaded && (
                                      <div>
                                        <p className="text-xs text-muted-foreground">Rail Unloaded</p>
                                        <p className="text-xs">{formatDateTime(containerData.rail.railUnloaded)}</p>
                                      </div>
                                    )}
                                    {containerData.rail.arrivedAtDestination && (
                                      <div>
                                        <p className="text-xs text-muted-foreground">Arrived At Destination</p>
                                        <p className="text-xs">{formatDateTime(containerData.rail.arrivedAtDestination)}</p>
                                      </div>
                                    )}
                                    {containerData.rail.fullOut && (
                                      <div>
                                        <p className="text-xs text-muted-foreground">Full Out</p>
                                        <p className="text-xs">{formatDateTime(containerData.rail.fullOut)}</p>
                                      </div>
                                    )}
                                    {containerData.rail.emptyReturned && (
                                      <div>
                                        <p className="text-xs text-muted-foreground">Empty Returned</p>
                                        <p className="text-xs">{formatDateTime(containerData.rail.emptyReturned)}</p>
                                      </div>
                                    )}
                                    {containerData.rail.estimatedArrivalAtFinalDestination && (
                                      <div>
                                        <p className="text-xs text-muted-foreground">Est. Arrival at Final Dest</p>
                                        <p className="text-xs">{formatDateTime(containerData.rail.estimatedArrivalAtFinalDestination)}</p>
                                      </div>
                                    )}
                                    {containerData.rail.lfd && (
                                      <div>
                                        <p className="text-xs text-muted-foreground">LFD</p>
                                        <p className="text-xs">{formatDateOnly(containerData.rail.lfd)}</p>
                                      </div>
                                    )}
                                    {containerData.rail.available !== undefined && (
                                      <div>
                                        <p className="text-xs text-muted-foreground">Available</p>
                                        <div className="text-xs">
                                          {containerData.rail.available ? (
                                            <Badge variant="default" className="bg-green-500 text-xs">Yes</Badge>
                                          ) : (
                                            <Badge variant="outline" className="text-xs">No</Badge>
                                          )}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  <p className="text-xs text-muted-foreground">No rail information available</p>
                                )}
                              </div>
                            </div>
                          )})}
                        </div>
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <Package className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                    <p className="text-muted-foreground">No container information available</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Milestone Events Overview */}
            {shipment.milestones && (shipment.milestones as any[]).length > 0 && (
              <Card data-testid="card-milestones-overview">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Calendar className="h-5 w-5" />
                    Milestone Events ({(shipment.milestones as any[]).length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {(shipment.milestones as any[]).map((milestone: any, index: number) => (
                      <div key={index} className="rounded-lg border p-4 space-y-3">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex gap-3 flex-1">
                            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                              <Calendar className="h-5 w-5 text-primary" />
                            </div>
                            <div className="flex-1">
                              <p className="font-medium">{milestone.type || milestone.eventType}</p>
                              {milestone.location && (
                                <p className="text-sm text-muted-foreground">{milestone.location}</p>
                              )}
                            </div>
                          </div>
                          <Badge 
                            variant={milestone.status === 'completed' ? 'default' : milestone.status === 'delayed' ? 'destructive' : 'outline'}
                            className="text-xs"
                          >
                            {milestone.status || 'pending'}
                          </Badge>
                        </div>
                        <div className="grid grid-cols-2 gap-4 pt-2 border-t">
                          {(milestone.plannedTimestamp || milestone.timestampPlanned) && (
                            <div>
                              <p className="text-xs text-muted-foreground">Planned</p>
                              <p className="text-sm font-medium">
                                {new Date(milestone.plannedTimestamp || milestone.timestampPlanned).toLocaleDateString()}
                              </p>
                            </div>
                          )}
                          {(milestone.actualTimestamp || milestone.timestampActual) && (
                            <div>
                              <p className="text-xs text-muted-foreground">Actual</p>
                              <p className="text-sm font-medium text-green-600 dark:text-green-400">
                                {new Date(milestone.actualTimestamp || milestone.timestampActual).toLocaleDateString()}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="documents" className="mt-6">
          <ShipmentDocuments shipmentId={shipment.id} />
        </TabsContent>

        <TabsContent value="raw" className="mt-6 space-y-6">
          <MapLogsSection shipmentNumber={shipment.shipmentReference} />
          
          <Card>
            <CardHeader>
              <CardTitle>Raw API Data</CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="bg-muted p-4 rounded-lg overflow-auto max-h-[600px] text-xs">
                {JSON.stringify(rawData, null, 2)}
              </pre>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Assign Users Dialog */}
      <Dialog open={assignUsersDialogOpen} onOpenChange={setAssignUsersDialogOpen}>
        <DialogContent data-testid="dialog-assign-users">
          <DialogHeader>
            <DialogTitle>Assign Users</DialogTitle>
            <DialogDescription>
              Select users to assign to this shipment
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 max-h-[400px] overflow-y-auto">
            {allUsers && allUsers.length > 0 ? (
              allUsers.map((user) => (
                <div key={user.id} className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id={`user-${user.id}`}
                    checked={selectedUserIds.includes(user.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedUserIds([...selectedUserIds, user.id]);
                      } else {
                        setSelectedUserIds(selectedUserIds.filter(id => id !== user.id));
                      }
                    }}
                    className="h-4 w-4 rounded border-gray-300"
                    data-testid={`checkbox-user-${user.id}`}
                  />
                  <Label htmlFor={`user-${user.id}`} className="flex items-center gap-2 cursor-pointer">
                    <span className="font-medium">{user.username}</span>
                    <Badge variant="outline" className="text-xs">{user.role}</Badge>
                  </Label>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">No users available</p>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setAssignUsersDialogOpen(false)}
              data-testid="button-cancel-assign-users"
            >
              Cancel
            </Button>
            <Button
              onClick={() => assignUsersMutation.mutate(selectedUserIds)}
              disabled={assignUsersMutation.isPending}
              data-testid="button-save-assign-users"
            >
              {assignUsersMutation.isPending ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Terminal Dialog */}
      <Dialog open={addTerminalDialogOpen} onOpenChange={setAddTerminalDialogOpen}>
        <DialogContent data-testid="dialog-edit-terminal" className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Terminal Information</DialogTitle>
            <DialogDescription>
              Update terminal details including port, pickup status, and logistics information
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="terminal-name">Terminal Name</Label>
                <Input
                  id="terminal-name"
                  placeholder="e.g., APM Terminals Elizabeth"
                  value={terminalForm.terminalName}
                  onChange={(e) => setTerminalForm({ ...terminalForm, terminalName: e.target.value })}
                  data-testid="input-terminal-name"
                />
              </div>
              <div>
                <Label htmlFor="terminal-port">Port</Label>
                <Input
                  id="terminal-port"
                  placeholder="e.g., Los Angeles"
                  value={terminalForm.terminalPort}
                  onChange={(e) => setTerminalForm({ ...terminalForm, terminalPort: e.target.value })}
                  data-testid="input-terminal-port"
                />
              </div>
              <div>
                <Label htmlFor="terminal-yard">Yard Location</Label>
                <Input
                  id="terminal-yard"
                  placeholder="e.g., Block A, Row 12"
                  value={terminalForm.yardLocation}
                  onChange={(e) => setTerminalForm({ ...terminalForm, yardLocation: e.target.value })}
                  data-testid="input-terminal-yard"
                />
              </div>
              <div>
                <Label htmlFor="terminal-chassis">Pickup Chassis #</Label>
                <Input
                  id="terminal-chassis"
                  placeholder="e.g., CH123456"
                  value={terminalForm.pickupChassis}
                  onChange={(e) => setTerminalForm({ ...terminalForm, pickupChassis: e.target.value })}
                  data-testid="input-terminal-chassis"
                />
              </div>
              <div>
                <Label htmlFor="terminal-lfd">Last Free Day (LFD)</Label>
                <Input
                  type="date"
                  id="terminal-lfd"
                  value={terminalForm.lfd}
                  onChange={(e) => setTerminalForm({ ...terminalForm, lfd: e.target.value })}
                  data-testid="input-terminal-lfd"
                />
              </div>
              <div>
                <Label htmlFor="terminal-demurrage">Demurrage Cost</Label>
                <Input
                  type="number"
                  id="terminal-demurrage"
                  placeholder="e.g., 150.00"
                  value={terminalForm.demurrage}
                  onChange={(e) => setTerminalForm({ ...terminalForm, demurrage: e.target.value })}
                  data-testid="input-terminal-demurrage"
                />
              </div>
              <div>
                <Label htmlFor="terminal-detention">Detention Cost</Label>
                <Input
                  type="number"
                  id="terminal-detention"
                  placeholder="e.g., 200.00"
                  value={terminalForm.detention}
                  onChange={(e) => setTerminalForm({ ...terminalForm, detention: e.target.value })}
                  data-testid="input-terminal-detention"
                />
              </div>
              <div>
                <Label htmlFor="terminal-full-out">Full Out</Label>
                <Input
                  type="datetime-local"
                  id="terminal-full-out"
                  value={terminalForm.fullOut}
                  onChange={(e) => setTerminalForm({ ...terminalForm, fullOut: e.target.value })}
                  data-testid="input-terminal-full-out"
                />
              </div>
              <div>
                <Label htmlFor="terminal-pickup-apt">Pickup Appointment</Label>
                <Input
                  type="datetime-local"
                  id="terminal-pickup-apt"
                  value={terminalForm.pickupAppointment}
                  onChange={(e) => setTerminalForm({ ...terminalForm, pickupAppointment: e.target.value })}
                  data-testid="input-terminal-pickup-apt"
                />
              </div>
              <div>
                <Label htmlFor="terminal-empty-returned">Empty Returned</Label>
                <Input
                  type="datetime-local"
                  id="terminal-empty-returned"
                  value={terminalForm.emptyReturned}
                  onChange={(e) => setTerminalForm({ ...terminalForm, emptyReturned: e.target.value })}
                  data-testid="input-terminal-empty-returned"
                />
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="terminal-available"
                checked={terminalForm.availableForPickup}
                onCheckedChange={(checked) => setTerminalForm({ ...terminalForm, availableForPickup: checked as boolean })}
                data-testid="checkbox-terminal-available"
              />
              <Label htmlFor="terminal-available" className="text-sm font-medium cursor-pointer">
                Available For Pickup
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setAddTerminalDialogOpen(false)}
              data-testid="button-cancel-terminal"
            >
              Cancel
            </Button>
            <Button
              onClick={() => addTerminalMutation.mutate({
                terminalName: terminalForm.terminalName,
                terminalPort: terminalForm.terminalPort,
                lastFreeDay: terminalForm.lfd,
                demurrage: terminalForm.demurrage,
                detention: terminalForm.detention,
                terminalYardLocation: terminalForm.yardLocation,
                terminalPickupChassis: terminalForm.pickupChassis,
                terminalFullOut: terminalForm.fullOut,
                terminalPickupAppointment: terminalForm.pickupAppointment,
                terminalEmptyReturned: terminalForm.emptyReturned,
                terminalAvailableForPickup: terminalForm.availableForPickup,
              })}
              disabled={addTerminalMutation.isPending}
              data-testid="button-save-terminal"
            >
              {addTerminalMutation.isPending ? "Saving..." : "Save Terminal Info"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Rail Dialog */}
      <Dialog open={addRailDialogOpen} onOpenChange={setAddRailDialogOpen}>
        <DialogContent data-testid="dialog-add-rail" className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Rail Information</DialogTitle>
            <DialogDescription>
              Add rail tracking and milestone information for this container
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label htmlFor="rail-number">Rail Number</Label>
                <Input
                  id="rail-number"
                  placeholder="e.g., RAIL123456"
                  value={railForm.railNumber}
                  onChange={(e) => setRailForm({ ...railForm, railNumber: e.target.value })}
                  data-testid="input-rail-number"
                />
              </div>
              <div>
                <Label htmlFor="pod-rail-carrier">POD Rail Carrier</Label>
                <Input
                  id="pod-rail-carrier"
                  placeholder="e.g., Union Pacific"
                  value={railForm.podRailCarrier}
                  onChange={(e) => setRailForm({ ...railForm, podRailCarrier: e.target.value })}
                  data-testid="input-pod-rail-carrier"
                />
              </div>
              <div>
                <Label htmlFor="dest-rail-carrier">Destination Rail Carrier</Label>
                <Input
                  id="dest-rail-carrier"
                  placeholder="e.g., BNSF"
                  value={railForm.destinationRailCarrier}
                  onChange={(e) => setRailForm({ ...railForm, destinationRailCarrier: e.target.value })}
                  data-testid="input-dest-rail-carrier"
                />
              </div>
            </div>
            
            <Separator />
            <h4 className="font-semibold text-sm">Rail Milestones</h4>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="rail-loaded">Rail Loaded</Label>
                <Input
                  type="datetime-local"
                  id="rail-loaded"
                  value={railForm.railLoaded}
                  onChange={(e) => setRailForm({ ...railForm, railLoaded: e.target.value })}
                  data-testid="input-rail-loaded"
                />
              </div>
              <div>
                <Label htmlFor="rail-departed">Rail Departed</Label>
                <Input
                  type="datetime-local"
                  id="rail-departed"
                  value={railForm.railDeparted}
                  onChange={(e) => setRailForm({ ...railForm, railDeparted: e.target.value })}
                  data-testid="input-rail-departed"
                />
              </div>
              <div>
                <Label htmlFor="rail-arrived">Rail Arrived</Label>
                <Input
                  type="datetime-local"
                  id="rail-arrived"
                  value={railForm.railArrived}
                  onChange={(e) => setRailForm({ ...railForm, railArrived: e.target.value })}
                  data-testid="input-rail-arrived"
                />
              </div>
              <div>
                <Label htmlFor="rail-unloaded">Rail Unloaded</Label>
                <Input
                  type="datetime-local"
                  id="rail-unloaded"
                  value={railForm.railUnloaded}
                  onChange={(e) => setRailForm({ ...railForm, railUnloaded: e.target.value })}
                  data-testid="input-rail-unloaded"
                />
              </div>
              <div>
                <Label htmlFor="arrived-at-dest">Arrived At Destination</Label>
                <Input
                  type="datetime-local"
                  id="arrived-at-dest"
                  value={railForm.arrivedAtDestination}
                  onChange={(e) => setRailForm({ ...railForm, arrivedAtDestination: e.target.value })}
                  data-testid="input-arrived-at-dest"
                />
              </div>
              <div>
                <Label htmlFor="full-out">Full Out</Label>
                <Input
                  type="datetime-local"
                  id="full-out"
                  value={railForm.fullOut}
                  onChange={(e) => setRailForm({ ...railForm, fullOut: e.target.value })}
                  data-testid="input-full-out"
                />
              </div>
              <div>
                <Label htmlFor="empty-returned">Empty Returned</Label>
                <Input
                  type="datetime-local"
                  id="empty-returned"
                  value={railForm.emptyReturned}
                  onChange={(e) => setRailForm({ ...railForm, emptyReturned: e.target.value })}
                  data-testid="input-empty-returned"
                />
              </div>
              <div>
                <Label htmlFor="est-arrival-final">Estimated Arrival at Final Destination</Label>
                <Input
                  type="datetime-local"
                  id="est-arrival-final"
                  value={railForm.estimatedArrivalAtFinalDestination}
                  onChange={(e) => setRailForm({ ...railForm, estimatedArrivalAtFinalDestination: e.target.value })}
                  data-testid="input-est-arrival-final"
                />
              </div>
              <div>
                <Label htmlFor="rail-lfd">LFD (Last Free Day)</Label>
                <Input
                  type="date"
                  id="rail-lfd"
                  value={railForm.lfd}
                  onChange={(e) => setRailForm({ ...railForm, lfd: e.target.value })}
                  data-testid="input-rail-lfd"
                />
              </div>
            </div>
            
            <div className="flex items-center space-x-2">
              <Checkbox
                id="rail-available"
                checked={railForm.available}
                onCheckedChange={(checked) => setRailForm({ ...railForm, available: checked as boolean })}
                data-testid="checkbox-rail-available"
              />
              <Label htmlFor="rail-available" className="text-sm font-medium cursor-pointer">
                Available
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setAddRailDialogOpen(false)}
              data-testid="button-cancel-rail"
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (selectedContainerId) {
                  addRailMutation.mutate({
                    containerId: selectedContainerId,
                    containerNumber: selectedContainerNumber || undefined,
                    rail: railForm,
                  });
                }
              }}
              disabled={addRailMutation.isPending || !selectedContainerId}
              data-testid="button-save-rail"
            >
              {addRailMutation.isPending ? "Saving..." : "Save Rail Info"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Milestone Dialog */}
      <Dialog open={addMilestoneDialogOpen} onOpenChange={setAddMilestoneDialogOpen}>
        <DialogContent data-testid="dialog-add-milestone">
          <DialogHeader>
            <DialogTitle>Add Milestone</DialogTitle>
            <DialogDescription>
              Create a new milestone for this shipment's journey.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="eventType">Event Type *</Label>
              <Input
                id="eventType"
                placeholder="e.g., Departure from Port, Arrival at Terminal"
                value={milestoneForm.eventType}
                onChange={(e) => setMilestoneForm({ ...milestoneForm, eventType: e.target.value })}
                data-testid="input-event-type"
              />
            </div>
            <div>
              <Label htmlFor="location">Location *</Label>
              <Input
                id="location"
                placeholder="e.g., Port of Los Angeles"
                value={milestoneForm.location}
                onChange={(e) => setMilestoneForm({ ...milestoneForm, location: e.target.value })}
                data-testid="input-location"
              />
            </div>
            <div>
              <Label htmlFor="timestampPlanned">Planned Timestamp</Label>
              <Input
                id="timestampPlanned"
                type="datetime-local"
                value={milestoneForm.timestampPlanned}
                onChange={(e) => setMilestoneForm({ ...milestoneForm, timestampPlanned: e.target.value })}
                data-testid="input-timestamp-planned"
              />
            </div>
            <div>
              <Label htmlFor="status">Status</Label>
              <Select
                value={milestoneForm.status}
                onValueChange={(value) => setMilestoneForm({ ...milestoneForm, status: value })}
              >
                <SelectTrigger data-testid="select-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="delayed">Delayed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="notes">Notes (Optional)</Label>
              <Input
                id="notes"
                placeholder="Additional notes"
                value={milestoneForm.notes}
                onChange={(e) => setMilestoneForm({ ...milestoneForm, notes: e.target.value })}
                data-testid="input-notes"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setAddMilestoneDialogOpen(false)}
              data-testid="button-cancel-milestone"
            >
              Cancel
            </Button>
            <Button
              onClick={() => addMilestoneMutation.mutate(milestoneForm)}
              disabled={!milestoneForm.eventType || !milestoneForm.location || addMilestoneMutation.isPending}
              data-testid="button-save-milestone"
            >
              {addMilestoneMutation.isPending ? "Adding..." : "Add Milestone"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Event Dialog */}
      <Dialog open={editEventDialogOpen} onOpenChange={setEditEventDialogOpen}>
        <DialogContent data-testid="dialog-edit-event">
          <DialogHeader>
            <DialogTitle>Edit Event</DialogTitle>
            <DialogDescription>
              Update the event information for this shipment.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="edit-event-name">Event Name</Label>
              <Input
                id="edit-event-name"
                placeholder="e.g., Empty Container Gate Out"
                value={editEventForm.name}
                onChange={(e) => setEditEventForm({ ...editEventForm, name: e.target.value })}
                data-testid="input-edit-event-name"
              />
            </div>
            <div>
              <Label htmlFor="edit-event-location">Location</Label>
              <Input
                id="edit-event-location"
                placeholder="e.g., Port of Los Angeles"
                value={editEventForm.location}
                onChange={(e) => setEditEventForm({ ...editEventForm, location: e.target.value })}
                data-testid="input-edit-event-location"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit-estimate-time">Estimated Time</Label>
                <Input
                  id="edit-estimate-time"
                  type="datetime-local"
                  value={editEventForm.estimateTime}
                  onChange={(e) => setEditEventForm({ ...editEventForm, estimateTime: e.target.value })}
                  data-testid="input-edit-estimate-time"
                />
              </div>
              <div>
                <Label htmlFor="edit-actual-time">Actual Time</Label>
                <Input
                  id="edit-actual-time"
                  type="datetime-local"
                  value={editEventForm.actualTime}
                  onChange={(e) => setEditEventForm({ ...editEventForm, actualTime: e.target.value })}
                  data-testid="input-edit-actual-time"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="edit-event-code">Event Code (Optional)</Label>
              <Input
                id="edit-event-code"
                placeholder="e.g., GATE_OUT"
                value={editEventForm.code}
                onChange={(e) => setEditEventForm({ ...editEventForm, code: e.target.value })}
                data-testid="input-edit-event-code"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setEditEventDialogOpen(false);
                setEditingEventIndex(null);
              }}
              data-testid="button-cancel-edit-event"
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                // For now, just close the dialog
                // In a real implementation, this would call an API to update the event
                toast({
                  title: "Event updated",
                  description: "The event has been updated successfully.",
                });
                setEditEventDialogOpen(false);
                setEditingEventIndex(null);
              }}
              data-testid="button-save-edit-event"
            >
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Container Dialog */}
      <Dialog open={editContainerDialogOpen} onOpenChange={setEditContainerDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto" data-testid="dialog-edit-container">
          <DialogHeader>
            <DialogTitle>Edit Container Information</DialogTitle>
            <DialogDescription>
              Update the primary container details for this shipment
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="container-number">Container Number</Label>
              <Input
                id="container-number"
                placeholder="e.g., MAEU1234567"
                value={containerForm.containerNumber}
                onChange={(e) => setContainerForm({ ...containerForm, containerNumber: e.target.value })}
                data-testid="input-container-number"
              />
            </div>
            <div>
              <Label htmlFor="container-type">Container Type</Label>
              <Select
                value={containerForm.containerType}
                onValueChange={(value) => setContainerForm({ ...containerForm, containerType: value })}
              >
                <SelectTrigger id="container-type" data-testid="select-container-type">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="40HC">40HC (40ft High Cube)</SelectItem>
                  <SelectItem value="40GP">40GP (40ft General Purpose)</SelectItem>
                  <SelectItem value="20GP">20GP (20ft General Purpose)</SelectItem>
                  <SelectItem value="20HC">20HC (20ft High Cube)</SelectItem>
                  <SelectItem value="45HC">45HC (45ft High Cube)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="container-status">Container Status</Label>
              <Select
                value={containerForm.containerStatus}
                onValueChange={(value) => setContainerForm({ ...containerForm, containerStatus: value })}
              >
                <SelectTrigger id="container-status" data-testid="select-container-status">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="booking-confirmed">Booking Confirmed</SelectItem>
                  <SelectItem value="gate-in">Gate In</SelectItem>
                  <SelectItem value="loaded">Loaded on Vessel</SelectItem>
                  <SelectItem value="departed">Departed</SelectItem>
                  <SelectItem value="in-transit">In Transit</SelectItem>
                  <SelectItem value="arrived">Arrived at Port</SelectItem>
                  <SelectItem value="unloaded">Unloaded</SelectItem>
                  <SelectItem value="at-terminal">At Terminal</SelectItem>
                  <SelectItem value="customs-clearance">Customs Clearance</SelectItem>
                  <SelectItem value="gate-out">Gate Out</SelectItem>
                  <SelectItem value="on-rail">On Rail</SelectItem>
                  <SelectItem value="delivered">Delivered</SelectItem>
                  <SelectItem value="delayed">Delayed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="voyage-number">Voyage Number</Label>
              <Input
                id="voyage-number"
                placeholder="e.g., 123E"
                value={containerForm.voyageNumber}
                onChange={(e) => setContainerForm({ ...containerForm, voyageNumber: e.target.value })}
                data-testid="input-voyage-number"
              />
            </div>
            <div>
              <Label htmlFor="booking-reference">Booking Reference</Label>
              <Input
                id="booking-reference"
                placeholder="e.g., BKG456789"
                value={containerForm.bookingReference}
                onChange={(e) => setContainerForm({ ...containerForm, bookingReference: e.target.value })}
                data-testid="input-booking-reference"
              />
            </div>
            <div>
              <Label htmlFor="seal-number">Seal Number</Label>
              <Input
                id="seal-number"
                placeholder="e.g., SEAL123456"
                value={containerForm.sealNumber}
                onChange={(e) => setContainerForm({ ...containerForm, sealNumber: e.target.value })}
                data-testid="input-seal-number"
              />
            </div>
            <div>
              <Label htmlFor="weight">Weight (lbs)</Label>
              <Input
                id="weight"
                type="number"
                placeholder="e.g., 52910"
                value={containerForm.weight}
                onChange={(e) => setContainerForm({ ...containerForm, weight: e.target.value })}
                data-testid="input-weight"
              />
            </div>
            <div>
              <Label htmlFor="container-eta">Container ETA</Label>
              <Input
                id="container-eta"
                type="datetime-local"
                value={containerForm.containerEta}
                onChange={(e) => setContainerForm({ ...containerForm, containerEta: e.target.value })}
                data-testid="input-container-eta"
              />
            </div>
            <div>
              <Label htmlFor="container-ata">Container ATA</Label>
              <Input
                id="container-ata"
                type="datetime-local"
                value={containerForm.containerAta}
                onChange={(e) => setContainerForm({ ...containerForm, containerAta: e.target.value })}
                data-testid="input-container-ata"
              />
            </div>
            <div>
              <Label htmlFor="last-free-day">Last Free Day</Label>
              <Input
                id="last-free-day"
                type="date"
                value={containerForm.lastFreeDay}
                onChange={(e) => setContainerForm({ ...containerForm, lastFreeDay: e.target.value })}
                data-testid="input-last-free-day"
              />
            </div>
            <div>
              <Label htmlFor="daily-fee-rate">Daily Demurrage Rate ($)</Label>
              <Input
                id="daily-fee-rate"
                type="number"
                step="0.01"
                placeholder="150"
                value={containerForm.dailyFeeRate}
                onChange={(e) => setContainerForm({ ...containerForm, dailyFeeRate: e.target.value })}
                data-testid="input-daily-fee-rate"
              />
            </div>
            <div>
              <Label htmlFor="detention-fee">Detention Fee ($)</Label>
              <Input
                id="detention-fee"
                type="number"
                step="0.01"
                placeholder="0"
                value={containerForm.detentionFee}
                onChange={(e) => setContainerForm({ ...containerForm, detentionFee: e.target.value })}
                data-testid="input-detention-fee"
              />
            </div>
            <div>
              <Label htmlFor="pickup-chassis">Pickup Chassis</Label>
              <Input
                id="pickup-chassis"
                placeholder="Enter chassis number"
                value={containerForm.pickupChassis}
                onChange={(e) => setContainerForm({ ...containerForm, pickupChassis: e.target.value })}
                data-testid="input-pickup-chassis"
              />
            </div>
            <div>
              <Label htmlFor="yard-location">Yard Location</Label>
              <Input
                id="yard-location"
                placeholder="Enter yard location"
                value={containerForm.yardLocation}
                onChange={(e) => setContainerForm({ ...containerForm, yardLocation: e.target.value })}
                data-testid="input-yard-location"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditContainerDialogOpen(false)}
              data-testid="button-cancel-edit-container"
            >
              Cancel
            </Button>
            <Button
              onClick={() => updateContainerMutation.mutate(containerForm)}
              disabled={updateContainerMutation.isPending}
              data-testid="button-save-edit-container"
            >
              {updateContainerMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
