import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute, Link, useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Edit, Trash2, Plus, Package, MapPin, ArrowRight, Calendar, User, FileText, Ship, CheckCircle2, Clock, AlertCircle, Circle, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { StatusBadge } from "@/components/status-badge";
import { ShipmentMap } from "@/components/shipment-map";

interface Container {
  id: string;
  containerNumber: string;
  containerType: string;
  status: string;
  origin: string;
  destination: string;
  eta: string;
  riskLevel?: string;
}

interface Milestone {
  id: string;
  eventType: string;
  location: string;
  timestampPlanned?: string;
  timestampActual?: string;
  status: string;
  notes?: string;
}

interface User {
  id: string;
  username: string;
  role: string;
}

interface Shipment {
  id: string;
  referenceNumber: string;
  bookingNumber: string;
  masterBillOfLading: string;
  shipper: string;
  consignee: string;
  originPort: string;
  destinationPort: string;
  etd?: string;
  eta?: string;
  atd?: string;
  ata?: string;
  status: string;
  carrier: string;
  scacCode?: string;
  vesselName: string;
  voyageNumber?: string;
  assignedUsers?: User[];
  containers?: Container[];
  milestones?: Milestone[];
  officeName?: string;
  salesRepNames?: string[];
}

const getStatusColor = (status: string): string => {
  const statusLower = status.toLowerCase();
  if (statusLower.includes("delivered") || statusLower.includes("arrived") || statusLower === "completed") {
    return "bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20";
  }
  if (statusLower.includes("transit")) {
    return "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20";
  }
  if (statusLower.includes("delayed")) {
    return "bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20";
  }
  if (statusLower.includes("terminal") || statusLower.includes("port")) {
    return "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500/20";
  }
  return "bg-muted text-muted-foreground border-border";
};

const getMilestoneIcon = (eventType: string) => {
  const type = eventType.toLowerCase();
  if (type.includes("depart") || type.includes("load")) {
    return Ship;
  }
  if (type.includes("arrive") || type.includes("discharge")) {
    return MapPin;
  }
  if (type.includes("gate")) {
    return Package;
  }
  if (type.includes("delivery")) {
    return CheckCircle2;
  }
  return Circle;
};

const getMilestoneColor = (status: string) => {
  if (status === "completed") return "text-green-600 dark:text-green-400";
  if (status === "delayed") return "text-red-600 dark:text-red-400";
  return "text-muted-foreground";
};

const getMilestoneBgColor = (status: string) => {
  if (status === "completed") return "bg-green-500";
  if (status === "delayed") return "bg-red-500";
  return "bg-muted";
};

export default function ShipmentDetail() {
  const [, navigate] = useLocation();
  const [, params] = useRoute("/shipments/:id");
  const shipmentId = params?.id;
  const { toast } = useToast();

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [addMilestoneDialogOpen, setAddMilestoneDialogOpen] = useState(false);
  const [editMilestoneId, setEditMilestoneId] = useState<string | null>(null);
  const [milestoneForm, setMilestoneForm] = useState({
    eventType: "",
    location: "",
    timestampPlanned: "",
    timestampActual: "",
    status: "pending",
    notes: "",
  });
  const [assignUsersDialogOpen, setAssignUsersDialogOpen] = useState(false);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [addRailDialogOpen, setAddRailDialogOpen] = useState(false);
  const [railForm, setRailForm] = useState({
    containerId: "",
    carrier: "",
    origin: "",
    destination: "",
    departureTime: "",
    arrivalTime: "",
    estimatedArrival: "",
    status: "scheduled",
    trainNumber: "",
  });

  const { data: shipment, isLoading } = useQuery<Shipment>({
    queryKey: ["/api/shipments", shipmentId],
    enabled: !!shipmentId,
  });

  const { data: allUsers } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", `/api/shipments/${shipmentId}`);
    },
    onSuccess: () => {
      toast({
        title: "Shipment deleted",
        description: "The shipment has been successfully deleted.",
      });
      navigate("/shipments");
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete shipment. Please try again.",
        variant: "destructive",
      });
    },
  });

  const addMilestoneMutation = useMutation({
    mutationFn: async (data: any) => {
      await apiRequest("POST", `/api/shipments/${shipmentId}/milestones`, data);
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

  const updateMilestoneMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      await apiRequest("PATCH", `/api/milestones/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/shipments", shipmentId] });
      toast({
        title: "Milestone updated",
        description: "The milestone has been successfully updated.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update milestone. Please try again.",
        variant: "destructive",
      });
    },
  });

  const assignUsersMutation = useMutation({
    mutationFn: async (userIds: string[]) => {
      await apiRequest("POST", `/api/shipments/${shipmentId}/users`, { userIds });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/shipments", shipmentId] });
      toast({
        title: "Users assigned",
        description: "The users have been successfully assigned to this shipment.",
      });
      setAssignUsersDialogOpen(false);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to assign users. Please try again.",
        variant: "destructive",
      });
    },
  });

  const addRailSegmentMutation = useMutation({
    mutationFn: async (data: any) => {
      await apiRequest("POST", "/api/rail-segments", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/shipments", shipmentId] });
      toast({
        title: "Rail routing added",
        description: "The rail segment has been successfully added.",
      });
      setAddRailDialogOpen(false);
      setRailForm({
        containerId: "",
        carrier: "",
        origin: "",
        destination: "",
        departureTime: "",
        arrivalTime: "",
        estimatedArrival: "",
        status: "scheduled",
        trainNumber: "",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to add rail segment. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleDelete = () => {
    deleteMutation.mutate();
  };

  const handleAddMilestone = () => {
    addMilestoneMutation.mutate(milestoneForm);
  };

  const handleMarkCompleted = (milestone: Milestone) => {
    const now = new Date().toISOString();
    updateMilestoneMutation.mutate({
      id: milestone.id,
      data: {
        status: "completed",
        timestampActual: milestone.timestampActual || now,
      },
    });
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return "Not available";
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      return "Not available";
    }
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatDateShort = (dateString?: string) => {
    if (!dateString) return "Not available";
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      return "Not available";
    }
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-4 sm:space-y-6" data-testid="shipment-detail-loading">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-96" />
        <Skeleton className="h-64" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (!shipment) {
    return (
      <div className="text-center py-12" data-testid="shipment-not-found">
        <h2 className="text-2xl font-semibold mb-2">Shipment not found</h2>
        <p className="text-muted-foreground mb-4">The shipment you're looking for doesn't exist.</p>
        <Link href="/shipments">
          <Button data-testid="button-back-shipments">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Shipments
          </Button>
        </Link>
      </div>
    );
  }

  const containers = shipment.containers || [];
  const milestones = shipment.milestones || [];

  return (
    <div className="space-y-4 sm:space-y-6" data-testid="shipment-detail-page">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3 sm:gap-4">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => window.history.back()}
            data-testid="button-back"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold" data-testid="text-reference-number">
              {shipment.referenceNumber}
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground">
              Shipment
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge className={getStatusColor(shipment.status)} data-testid="badge-status">
            {shipment.status.toUpperCase().replace(/-/g, " ")}
          </Badge>
        </div>
      </div>

      {/* Reference Numbers and Tags Section */}
      <Card data-testid="card-overview">
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Shipment Number */}
            <div>
              <p className="text-xs text-muted-foreground mb-1">Shipment</p>
              <p className="text-2xl font-bold" data-testid="text-shipment-number">
                {shipment.bookingNumber}
              </p>
            </div>

            {/* Master Bill of Lading */}
            <div>
              <p className="text-xs text-muted-foreground mb-2">Master Bill of Lading</p>
              <p className="text-sm font-mono" data-testid="text-reference-nums">
                {shipment.masterBillOfLading}
              </p>
            </div>

            {/* Assigned Users */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-muted-foreground">Assigned Users</p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSelectedUserIds(shipment.assignedUsers?.map(u => u.id) || []);
                    setAssignUsersDialogOpen(true);
                  }}
                  className="h-6 text-xs"
                  data-testid="button-assign-users"
                >
                  <Edit className="h-3 w-3 mr-1" />
                  Edit
                </Button>
              </div>
              <div className="flex flex-wrap gap-2" data-testid="container-assigned-users">
                {shipment.assignedUsers && shipment.assignedUsers.length > 0 ? (
                  shipment.assignedUsers.map((user) => (
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
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Steamship Line & Route Timeline */}
      <Card data-testid="card-route-timeline">
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            {/* Steamship Line */}
            <div>
              <p className="text-xs text-muted-foreground mb-1">Steamship Line</p>
              <p className="text-lg font-bold" data-testid="text-steamship-line">
                {shipment.carrier}
              </p>
              {shipment.scacCode && (
                <p className="text-xs text-muted-foreground mt-1">
                  SCAC: <span className="font-mono font-semibold" data-testid="text-scac-code">{shipment.scacCode}</span>
                </p>
              )}
            </div>

            {/* Rail Carrier */}
            <div>
              <p className="text-xs text-muted-foreground mb-1">Rail Carrier</p>
              <p className="text-lg" data-testid="text-rail-carrier">-</p>
            </div>
          </div>

          {/* Visual Timeline */}
          <div className="relative">
            <div className="flex items-start justify-between gap-4">
              {/* POL */}
              <div className="flex-shrink-0">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0">
                    <div className="w-6 h-6 rounded-full bg-emerald-600 flex items-center justify-center relative z-10">
                      <div className="w-3 h-3 rounded-full bg-white"></div>
                    </div>
                  </div>
                  <div>
                    <p className="text-sm font-semibold" data-testid="text-pol">
                      {shipment.originPort}
                    </p>
                    {shipment.etd && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {formatDateShort(shipment.etd)}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Connection Line */}
              <div className="flex-1 flex items-center pt-3">
                <div className="flex-1 h-0.5 bg-border"></div>
                <Ship className="mx-2 h-4 w-4 text-muted-foreground" />
                <div className="flex-1 h-0.5 bg-border border-dashed"></div>
              </div>

              {/* POD */}
              <div className="flex-shrink-0">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0">
                    <div className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center relative z-10">
                      <div className="w-3 h-3 rounded-full bg-white"></div>
                    </div>
                  </div>
                  <div>
                    <p className="text-sm font-semibold" data-testid="text-pod">
                      {shipment.destinationPort}
                    </p>
                    {shipment.eta && (
                      <p className="text-xs text-muted-foreground mt-1">
                        ETA ~ {formatDateShort(shipment.eta)}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Vessel Info */}
            {shipment.vesselName && (
              <div className="mt-4 p-3 bg-muted/30 rounded-md">
                <div className="flex items-center gap-2 text-sm">
                  <Ship className="h-4 w-4 text-muted-foreground" />
                  <span className="font-semibold" data-testid="text-vessel-info">
                    {shipment.vesselName}
                  </span>
                  {shipment.voyageNumber && (
                    <>
                      <span className="text-muted-foreground">/</span>
                      <span className="font-mono" data-testid="text-voyage">
                        {shipment.voyageNumber}
                      </span>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Shipment Route Map */}
      {(() => {
        const rawData = (shipment as any).rawData;
        const portToPort = rawData?.shipmentLegs?.portToPort;
        
        if (portToPort?.loadingPortCoordinates && portToPort?.dischargePortCoordinates) {
          return (
            <Card data-testid="card-route-map">
              <CardHeader>
                <CardTitle className="text-lg">Route Map</CardTitle>
              </CardHeader>
              <CardContent>
                <ShipmentMap
                  originPort={shipment.originPort}
                  originCoordinates={{
                    latitude: portToPort.loadingPortCoordinates.latitude,
                    longitude: portToPort.loadingPortCoordinates.longitude
                  }}
                  destinationPort={shipment.destinationPort}
                  destinationCoordinates={{
                    latitude: portToPort.dischargePortCoordinates.latitude,
                    longitude: portToPort.dischargePortCoordinates.longitude
                  }}
                  vesselPosition={portToPort.latestLocation ? {
                    latitude: portToPort.latestLocation.latitude,
                    longitude: portToPort.latestLocation.longitude
                  } : undefined}
                  vesselName={portToPort.currentTransportName || shipment.vesselName}
                  segments={portToPort.segments}
                />
              </CardContent>
            </Card>
          );
        }
        return null;
      })()}

      {/* Main Info Card */}
      <Card data-testid="card-shipment-info">
        <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-4">
          <CardTitle className="text-lg">Shipment Information</CardTitle>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDeleteDialogOpen(true)}
              data-testid="button-delete"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Key Info Grid */}
          <div className="grid grid-cols-1 xs:grid-cols-2 md:grid-cols-3 gap-4">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Booking Number</p>
              <p className="font-semibold font-mono" data-testid="text-booking">{shipment.bookingNumber}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Master Bill of Lading</p>
              <p className="font-semibold font-mono" data-testid="text-bol">{shipment.masterBillOfLading}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Carrier</p>
              <p className="font-semibold" data-testid="text-carrier">{shipment.carrier}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Vessel Name</p>
              <p className="font-semibold" data-testid="text-vessel">{shipment.vesselName}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Shipper</p>
              <p className="font-semibold" data-testid="text-shipper">{shipment.shipper || "N/A"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Consignee</p>
              <p className="font-semibold" data-testid="text-consignee">{shipment.consignee || "N/A"}</p>
            </div>
            {shipment.officeName && (
              <div>
                <p className="text-xs text-muted-foreground mb-1">Office</p>
                <p className="font-semibold" data-testid="text-office-name">{shipment.officeName}</p>
              </div>
            )}
            {shipment.salesRepNames && shipment.salesRepNames.length > 0 && (
              <div className="col-span-1 xs:col-span-2 md:col-span-3">
                <p className="text-xs text-muted-foreground mb-2">Sales Representatives</p>
                <div className="flex flex-wrap gap-2" data-testid="container-sales-reps">
                  {shipment.salesRepNames.map((repName, index) => (
                    <Badge
                      key={index}
                      variant="secondary"
                      className="font-normal gap-1"
                      data-testid={`badge-sales-rep-${index}`}
                    >
                      <User className="h-3 w-3" />
                      {repName}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>

          <Separator />

          {/* Dates Row */}
          <div>
            <p className="text-sm font-semibold mb-3">Dates</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-xs text-muted-foreground mb-1">ETD</p>
                <p className="font-semibold text-sm" data-testid="text-etd">{formatDateShort(shipment.etd)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">ETA</p>
                <p className="font-semibold text-sm" data-testid="text-eta">{formatDateShort(shipment.eta)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">ATD</p>
                <p className="font-semibold text-sm" data-testid="text-atd">{formatDateShort(shipment.atd)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">ATA</p>
                <p className="font-semibold text-sm" data-testid="text-ata">{formatDateShort(shipment.ata)}</p>
              </div>
            </div>
          </div>

          <Separator />

          {/* Ports Row */}
          <div>
            <p className="text-sm font-semibold mb-3">Ports</p>
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <span className="font-semibold" data-testid="text-origin-port">{shipment.originPort}</span>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <span className="font-semibold" data-testid="text-destination-port">{shipment.destinationPort}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Containers Section */}
      <Card data-testid="card-containers">
        <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-4">
          <CardTitle className="text-lg">Containers ({containers.length})</CardTitle>
          <Link href={`/add?shipmentId=${shipmentId}`}>
            <Button variant="outline" size="sm" data-testid="button-add-container">
              <Plus className="mr-2 h-4 w-4" />
              Add Container
            </Button>
          </Link>
        </CardHeader>
        <CardContent>
          {containers.length === 0 ? (
            <div className="text-center py-12" data-testid="empty-containers">
              <Package className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">No containers assigned to this shipment</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Container #</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Origin</TableHead>
                    <TableHead>Destination</TableHead>
                    <TableHead>ETA</TableHead>
                    <TableHead>Risk Level</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {containers.map((container) => (
                    <TableRow key={container.id} data-testid={`row-container-${container.id}`}>
                      <TableCell>
                        <Link href={`/container/${container.id}`}>
                          <span
                            className="font-mono font-semibold hover:underline cursor-pointer text-primary"
                            data-testid={`link-container-${container.id}`}
                          >
                            {container.containerNumber}
                          </span>
                        </Link>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="font-mono" data-testid={`text-type-${container.id}`}>
                          {container.containerType}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={container.status as any} />
                      </TableCell>
                      <TableCell data-testid={`text-origin-${container.id}`}>{container.origin}</TableCell>
                      <TableCell data-testid={`text-destination-${container.id}`}>{container.destination}</TableCell>
                      <TableCell data-testid={`text-eta-${container.id}`}>{formatDateShort(container.eta)}</TableCell>
                      <TableCell>
                        {container.riskLevel ? (
                          <Badge
                            variant={
                              container.riskLevel === "high" || container.riskLevel === "critical" 
                                ? "destructive" 
                                : container.riskLevel === "medium"
                                ? "default"
                                : "secondary"
                            }
                            className={
                              container.riskLevel === "medium"
                                ? "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500/20"
                                : ""
                            }
                            data-testid={`badge-risk-${container.id}`}
                          >
                            {container.riskLevel.toUpperCase()}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Milestones Timeline Section */}
      <Card data-testid="card-timeline">
        <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-4">
          <CardTitle className="text-lg">Shipment Timeline</CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAddMilestoneDialogOpen(true)}
            data-testid="button-add-milestone"
          >
            <Plus className="mr-2 h-4 w-4" />
            Add Milestone
          </Button>
        </CardHeader>
        <CardContent>
          {milestones.length === 0 ? (
            <div className="text-center py-12" data-testid="empty-milestones">
              <Clock className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">No milestones defined for this shipment</p>
            </div>
          ) : (
            <div className="space-y-6">
              {milestones.map((milestone, index) => {
                const Icon = getMilestoneIcon(milestone.eventType);
                const isLast = index === milestones.length - 1;

                return (
                  <div key={milestone.id} className="relative" data-testid={`milestone-${milestone.id}`}>
                    {!isLast && (
                      <div
                        className={`absolute left-4 top-10 w-0.5 h-full ${
                          milestone.status === "completed" ? "bg-green-500" : "bg-muted"
                        }`}
                      />
                    )}
                    <div className="flex gap-4">
                      <div className="relative flex-shrink-0">
                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center ${getMilestoneBgColor(
                            milestone.status
                          )}`}
                        >
                          <Icon className="h-4 w-4 text-white" />
                        </div>
                      </div>
                      <div className="flex-1 pb-8">
                        <div className="flex items-start justify-between gap-2 flex-wrap">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <h4 className="font-semibold" data-testid={`text-event-${milestone.id}`}>
                                {milestone.eventType}
                              </h4>
                              <Badge
                                variant="outline"
                                className={getStatusColor(milestone.status)}
                                data-testid={`badge-status-${milestone.id}`}
                              >
                                {milestone.status}
                              </Badge>
                            </div>
                            {milestone.location && (
                              <p className="text-sm text-muted-foreground flex items-center gap-1 mb-2">
                                <MapPin className="h-3 w-3" />
                                <span data-testid={`text-location-${milestone.id}`}>{milestone.location}</span>
                              </p>
                            )}
                            <div className="grid grid-cols-1 xs:grid-cols-2 gap-2 text-sm">
                              <div>
                                <span className="text-muted-foreground">Planned: </span>
                                <span className="font-medium" data-testid={`text-planned-${milestone.id}`}>
                                  {formatDate(milestone.timestampPlanned)}
                                </span>
                              </div>
                              <div>
                                <span className="text-muted-foreground">Actual: </span>
                                <span className="font-medium" data-testid={`text-actual-${milestone.id}`}>
                                  {formatDate(milestone.timestampActual)}
                                </span>
                              </div>
                            </div>
                            {milestone.notes && (
                              <p className="text-sm text-muted-foreground mt-2" data-testid={`text-notes-${milestone.id}`}>
                                {milestone.notes}
                              </p>
                            )}
                          </div>
                          {milestone.status !== "completed" && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleMarkCompleted(milestone)}
                              disabled={updateMilestoneMutation.isPending}
                              data-testid={`button-complete-${milestone.id}`}
                            >
                              <CheckCircle2 className="mr-2 h-4 w-4" />
                              Mark Completed
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Rail Routing Section */}
      <Card data-testid="card-rail-routing">
        <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-4">
          <CardTitle className="text-lg flex items-center gap-2">
            <Package className="h-5 w-5" />
            Rail Routing
          </CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAddRailDialogOpen(true)}
            disabled={!containers || containers.length === 0}
            data-testid="button-add-rail"
          >
            <Plus className="mr-2 h-4 w-4" />
            Add Rail Segment
          </Button>
        </CardHeader>
        <CardContent>
          {!containers || containers.length === 0 ? (
            <div className="text-center py-12">
              <Package className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">No containers available for rail routing</p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Add rail routing information for containers in this shipment.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent data-testid="dialog-delete-confirm">
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the shipment "{shipment.referenceNumber}" and all associated data.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete"
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
              <Label htmlFor="eventType">Event Type</Label>
              <Input
                id="eventType"
                placeholder="e.g., Departure from Port, Arrival at Terminal"
                value={milestoneForm.eventType}
                onChange={(e) => setMilestoneForm({ ...milestoneForm, eventType: e.target.value })}
                data-testid="input-event-type"
              />
            </div>
            <div>
              <Label htmlFor="location">Location</Label>
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
              onClick={handleAddMilestone}
              disabled={!milestoneForm.eventType || !milestoneForm.location || addMilestoneMutation.isPending}
              data-testid="button-save-milestone"
            >
              {addMilestoneMutation.isPending ? "Adding..." : "Add Milestone"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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

      {/* Add Rail Segment Dialog */}
      <Dialog open={addRailDialogOpen} onOpenChange={setAddRailDialogOpen}>
        <DialogContent data-testid="dialog-add-rail" className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Add Rail Segment</DialogTitle>
            <DialogDescription>
              Add rail routing information for a container in this shipment
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="rail-container">Container *</Label>
              <Select
                value={railForm.containerId}
                onValueChange={(value) => setRailForm({ ...railForm, containerId: value })}
              >
                <SelectTrigger data-testid="select-rail-container">
                  <SelectValue placeholder="Select container" />
                </SelectTrigger>
                <SelectContent>
                  {containers && containers.map((container) => (
                    <SelectItem key={container.id} value={container.id}>
                      {container.containerNumber} ({container.containerType})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="rail-carrier">Rail Carrier *</Label>
                <Input
                  id="rail-carrier"
                  placeholder="e.g., BNSF, Union Pacific"
                  value={railForm.carrier}
                  onChange={(e) => setRailForm({ ...railForm, carrier: e.target.value })}
                  data-testid="input-rail-carrier"
                />
              </div>
              <div>
                <Label htmlFor="train-number">Train Number</Label>
                <Input
                  id="train-number"
                  placeholder="e.g., TRAIN123"
                  value={railForm.trainNumber}
                  onChange={(e) => setRailForm({ ...railForm, trainNumber: e.target.value })}
                  data-testid="input-train-number"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="rail-origin">Origin Ramp *</Label>
                <Input
                  id="rail-origin"
                  placeholder="e.g., Chicago Rail Yard"
                  value={railForm.origin}
                  onChange={(e) => setRailForm({ ...railForm, origin: e.target.value })}
                  data-testid="input-rail-origin"
                />
              </div>
              <div>
                <Label htmlFor="rail-destination">Destination Ramp *</Label>
                <Input
                  id="rail-destination"
                  placeholder="e.g., Los Angeles Rail Yard"
                  value={railForm.destination}
                  onChange={(e) => setRailForm({ ...railForm, destination: e.target.value })}
                  data-testid="input-rail-destination"
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label htmlFor="rail-departure">Departure Time</Label>
                <Input
                  type="datetime-local"
                  id="rail-departure"
                  value={railForm.departureTime}
                  onChange={(e) => setRailForm({ ...railForm, departureTime: e.target.value })}
                  data-testid="input-rail-departure"
                />
              </div>
              <div>
                <Label htmlFor="rail-estimated">Estimated Arrival</Label>
                <Input
                  type="datetime-local"
                  id="rail-estimated"
                  value={railForm.estimatedArrival}
                  onChange={(e) => setRailForm({ ...railForm, estimatedArrival: e.target.value })}
                  data-testid="input-rail-estimated"
                />
              </div>
              <div>
                <Label htmlFor="rail-actual">Actual Arrival</Label>
                <Input
                  type="datetime-local"
                  id="rail-actual"
                  value={railForm.arrivalTime}
                  onChange={(e) => setRailForm({ ...railForm, arrivalTime: e.target.value })}
                  data-testid="input-rail-actual"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="rail-status">Status</Label>
              <Select
                value={railForm.status}
                onValueChange={(value) => setRailForm({ ...railForm, status: value })}
              >
                <SelectTrigger data-testid="select-rail-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="scheduled">Scheduled</SelectItem>
                  <SelectItem value="in-transit">In Transit</SelectItem>
                  <SelectItem value="arrived">Arrived</SelectItem>
                  <SelectItem value="delayed">Delayed</SelectItem>
                </SelectContent>
              </Select>
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
              onClick={() => addRailSegmentMutation.mutate(railForm)}
              disabled={!railForm.containerId || !railForm.carrier || !railForm.origin || !railForm.destination || addRailSegmentMutation.isPending}
              data-testid="button-save-rail"
            >
              {addRailSegmentMutation.isPending ? "Adding..." : "Add Rail Segment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
