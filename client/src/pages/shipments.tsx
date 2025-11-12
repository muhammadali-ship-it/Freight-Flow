import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { buildApiUrl } from "@/lib/env";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import { Plus, Eye, Pencil, Trash2, Ship, ArrowRight, Search, X, RefreshCw, Clock, CheckCircle2, XCircle, FileText } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";

interface Shipment {
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
  lastFetchedAt?: string;
  createdAt?: string;
  updatedAt?: string;
  source?: 'user' | 'webhook' | 'api';
  isUserCreated?: boolean;
  referenceNumber?: string;
  masterBillOfLading?: string;
  rawData?: {
    riskLevel?: 'low' | 'medium' | 'high' | 'critical';
    riskScore?: number;
    riskReasons?: string[];
  };
  // Grouped container data
  containers?: Array<{
    containerNumber: string;
    shipmentReference: string;
    id: string;
  }>;
  containerCount?: number;
  allContainerNumbers?: string[];
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

const formatDateOnly = (dateString: string | undefined | null): string => {
  if (!dateString) return "—";
  // Extract just the date portion (YYYY-MM-DD) from datetime strings
  const match = dateString.match(/(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : dateString;
};

export default function Shipments() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [carrierFilter, setCarrierFilter] = useState("all");
  const [originPortFilter, setOriginPortFilter] = useState("all");
  const [destinationPortFilter, setDestinationPortFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined);
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [deleteShipmentId, setDeleteShipmentId] = useState<string | null>(null);

  const { data: user } = useQuery<{ id: string; role: string; name: string; email: string }>({
    queryKey: ["/api/user"],
  });

  const { data: carriers = [], isLoading: isLoadingCarriers } = useQuery<string[]>({
    queryKey: ["/api/carriers"],
  });

  const { data: ports = [], isLoading: isLoadingPorts } = useQuery<string[]>({
    queryKey: ["/api/ports"],
  });

  const { data: syncStatus } = useQuery<{
    id: string;
    status: string;
    shipmentsProcessed: number;
    shipmentsCreated: number;
    shipmentsUpdated: number;
    errorMessage?: string;
    syncDurationMs: number;
    createdAt: string;
  } | null>({
    queryKey: ["/api/cargoes-flow/sync-status"],
    refetchInterval: 60000, // Refetch every minute
  });

  const triggerSyncMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/cargoes-flow/trigger-sync");
      const data = await response.json();
      return data;
    },
    onSuccess: async (data) => {
      console.log("[Sync] Response data:", data);
      const syncLog = data?.syncLog;
      console.log("[Sync] Sync log:", syncLog);
      
      if (syncLog) {
        // Ensure createdAt is a string if it's a Date object
        // Use the createdAt from the sync log (when sync completed) or current time
        let createdAtValue = syncLog.createdAt 
          ? (typeof syncLog.createdAt === 'string' 
              ? syncLog.createdAt 
              : syncLog.createdAt instanceof Date 
                ? syncLog.createdAt.toISOString() 
                : new Date(syncLog.createdAt).toISOString())
          : new Date().toISOString();
        
        // If the createdAt is more than 10 seconds old, use current time instead
        // This handles cases where the sync log was created before the sync actually completed
        const createdAtTime = new Date(createdAtValue).getTime();
        const now = Date.now();
        const ageInSeconds = (now - createdAtTime) / 1000;
        
        if (ageInSeconds > 10) {
          console.log(`[Sync] createdAt is ${ageInSeconds.toFixed(1)}s old, using current time instead`);
          createdAtValue = new Date().toISOString();
        }
        
        const normalizedSyncLog = {
          ...syncLog,
          createdAt: createdAtValue,
        };
        
        console.log("[Sync] Normalized sync log:", normalizedSyncLog);
        console.log("[Sync] Setting query data with createdAt:", normalizedSyncLog.createdAt);
        console.log("[Sync] Current time:", new Date().toISOString());
        console.log("[Sync] Time difference (ms):", new Date().getTime() - new Date(createdAtValue).getTime());
        
        // Update the query cache directly with the new sync log
        // Create a completely new object to ensure React Query detects the change
        const newSyncLog = { ...normalizedSyncLog };
        queryClient.setQueryData(["/api/cargoes-flow/sync-status"], newSyncLog);
        
        // Also update using setQueryData with a function to ensure it's seen as changed
        queryClient.setQueryData(["/api/cargoes-flow/sync-status"], (old: any) => {
          // Return new object to force React Query to see it as changed
          return { ...newSyncLog };
        });
        
        // Verify the data was set correctly
        const cachedData = queryClient.getQueryData(["/api/cargoes-flow/sync-status"]);
        console.log("[Sync] Cached data after setQueryData:", cachedData);
        console.log("[Sync] Cached createdAt:", (cachedData as any)?.createdAt);
        
        toast({
          title: "Sync completed",
          description: `Processed ${syncLog.shipmentsProcessed || 0} shipments (${syncLog.shipmentsCreated || 0} new, ${syncLog.shipmentsUpdated || 0} updated)`,
        });
      } else {
        // If no syncLog in response, wait a bit then refetch to get latest status
        // This gives the database time to write the sync log
        setTimeout(async () => {
          await queryClient.refetchQueries({ queryKey: ["/api/cargoes-flow/sync-status"] });
        }, 1000);
        toast({
          title: "Sync triggered",
          description: "Fetching latest shipments from Cargoes Flow API...",
        });
      }
      // Refetch shipments to update the list with latest data
      queryClient.invalidateQueries({ queryKey: ["/api/shipments"] });
    },
    onError: (error: any) => {
      console.error("[Sync] Error:", error);
      toast({
        title: "Sync failed",
        description: error.message || "Failed to trigger sync",
        variant: "destructive",
      });
    },
  });

  const { data: shipmentsData, isLoading } = useQuery<ShipmentsResponse>({
    queryKey: [
      "/api/shipments",
      {
        page,
        pageSize,
        search: searchQuery,
        status: statusFilter,
        carrier: carrierFilter,
        originPort: originPortFilter,
        destinationPort: destinationPortFilter,
        dateFrom: dateFrom ? format(dateFrom, "yyyy-MM-dd") : undefined,
        dateTo: dateTo ? format(dateTo, "yyyy-MM-dd") : undefined,
        userId: user?.id,
        userRole: user?.role,
      },
    ],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: page.toString(),
        pageSize: pageSize.toString(),
      });

      if (searchQuery) params.append("search", searchQuery);
      if (statusFilter && statusFilter !== "all") params.append("status", statusFilter);
      if (carrierFilter && carrierFilter !== "all") params.append("carrier", carrierFilter);
      if (originPortFilter && originPortFilter !== "all") params.append("originPort", originPortFilter);
      if (destinationPortFilter && destinationPortFilter !== "all") params.append("destinationPort", destinationPortFilter);
      if (dateFrom) params.append("dateFrom", format(dateFrom, "yyyy-MM-dd"));
      if (dateTo) params.append("dateTo", format(dateTo, "yyyy-MM-dd"));
      
      if (user?.id) params.append("userId", user.id);
      if (user?.role) params.append("userRole", user.role);

      const response = await fetch(`${buildApiUrl("/api/shipments")}?${params}`, {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch shipments");
      return response.json();
    },
    enabled: !!user,
  });

  useEffect(() => {
    setPage(1);
  }, [searchQuery, statusFilter, carrierFilter, originPortFilter, destinationPortFilter, dateFrom, dateTo]);

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/shipments/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/shipments"] });
      toast({ title: "Shipment deleted successfully" });
      setDeleteShipmentId(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to delete shipment",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleClearFilters = () => {
    setSearchQuery("");
    setStatusFilter("all");
    setCarrierFilter("all");
    setOriginPortFilter("all");
    setDestinationPortFilter("all");
    setDateFrom(undefined);
    setDateTo(undefined);
  };

  const hasActiveFilters =
    searchQuery ||
    (statusFilter && statusFilter !== "all") ||
    (carrierFilter && carrierFilter !== "all") ||
    (originPortFilter && originPortFilter !== "all") ||
    (destinationPortFilter && destinationPortFilter !== "all") ||
    dateFrom ||
    dateTo;

  const getStatusBadgeVariant = (status: string) => {
    switch (status.toLowerCase()) {
      case "planned":
        return "secondary";
      case "in-transit":
        return "default";
      case "arrived":
        return "success";
      case "delayed":
        return "destructive";
      case "cancelled":
        return "outline";
      default:
        return "outline";
    }
  };

  const getStatusLabel = (status: string) => {
    return status
      .split("-")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  };

  const shipments = shipmentsData?.data || [];
  const pagination = shipmentsData?.pagination;

  const formatRelativeTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins} min ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold" data-testid="heading-shipments">
            Shipments
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground">
            Manage and track all shipments
          </p>
        </div>
        <Link href="/shipments/new">
          <Button data-testid="button-add-shipment">
            <Plus className="mr-2 h-4 w-4" />
            Add Shipment
          </Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div>
              <CardTitle className="text-lg">Cargoes Flow Sync Status</CardTitle>
              <CardDescription>
                Data is automatically synced every 5 minutes
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Link href="/cargoes-flow/sync-logs">
                <Button variant="outline" data-testid="button-view-sync-logs">
                  <FileText className="mr-2 h-4 w-4" />
                  View Logs
                </Button>
              </Link>
              <Button
                onClick={() => triggerSyncMutation.mutate()}
                disabled={triggerSyncMutation.isPending}
                data-testid="button-trigger-sync"
              >
                <RefreshCw className={`mr-2 h-4 w-4 ${triggerSyncMutation.isPending ? 'animate-spin' : ''}`} />
                {triggerSyncMutation.isPending ? 'Syncing...' : 'Sync Now'}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {syncStatus ? (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="flex items-center gap-3">
                {syncStatus.status === 'success' ? (
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                ) : (
                  <XCircle className="h-5 w-5 text-destructive" />
                )}
                <div>
                  <p className="text-sm font-medium">Status</p>
                  <p className="text-xs text-muted-foreground capitalize">{syncStatus.status}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Clock className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Last Sync</p>
                  <p className="text-xs text-muted-foreground">{formatRelativeTime(syncStatus.createdAt)}</p>
                </div>
              </div>
              <div>
                <p className="text-sm font-medium">Processed</p>
                <p className="text-2xl font-bold">{syncStatus.shipmentsProcessed}</p>
                <p className="text-xs text-muted-foreground">
                  {syncStatus.shipmentsCreated} new, {syncStatus.shipmentsUpdated} updated
                </p>
              </div>
              <div>
                <p className="text-sm font-medium">Duration</p>
                <p className="text-2xl font-bold">{(syncStatus.syncDurationMs / 1000).toFixed(2)}s</p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No sync history available yet</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Search & Filter</CardTitle>
          <CardDescription>
            Search by reference #, booking #, or BOL
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search shipments..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
              data-testid="input-search-shipments"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
            <div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger data-testid="select-status-filter">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Select value={carrierFilter} onValueChange={setCarrierFilter}>
                <SelectTrigger data-testid="select-carrier-filter">
                  <SelectValue placeholder="Carrier" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Carriers</SelectItem>
                  {isLoadingCarriers ? (
                    <SelectItem value="loading" disabled>Loading...</SelectItem>
                  ) : carriers.length === 0 ? (
                    <SelectItem value="empty" disabled>No carriers found</SelectItem>
                  ) : (
                    [...carriers].sort().map((carrier) => (
                      <SelectItem key={carrier} value={carrier}>
                        {carrier}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Select value={originPortFilter} onValueChange={setOriginPortFilter}>
                <SelectTrigger data-testid="select-origin-port-filter">
                  <SelectValue placeholder="Origin Port" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Origin Ports</SelectItem>
                  {isLoadingPorts ? (
                    <SelectItem value="loading" disabled>Loading...</SelectItem>
                  ) : ports.length === 0 ? (
                    <SelectItem value="empty" disabled>No ports found</SelectItem>
                  ) : (
                    [...ports].sort().map((port) => (
                      <SelectItem key={port} value={port}>
                        {port}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Select value={destinationPortFilter} onValueChange={setDestinationPortFilter}>
                <SelectTrigger data-testid="select-destination-port-filter">
                  <SelectValue placeholder="Destination Port" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Destination Ports</SelectItem>
                  {isLoadingPorts ? (
                    <SelectItem value="loading" disabled>Loading...</SelectItem>
                  ) : ports.length === 0 ? (
                    <SelectItem value="empty" disabled>No ports found</SelectItem>
                  ) : (
                    [...ports].sort().map((port) => (
                      <SelectItem key={port} value={port}>
                        {port}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="flex-1 justify-start text-left font-normal"
                    data-testid="button-date-from"
                  >
                    {dateFrom ? format(dateFrom, "MMM d") : "ETD From"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={dateFrom}
                    onSelect={setDateFrom}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>

              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="flex-1 justify-start text-left font-normal"
                    data-testid="button-date-to"
                  >
                    {dateTo ? format(dateTo, "MMM d") : "ETD To"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={dateTo}
                    onSelect={setDateTo}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {hasActiveFilters && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {pagination?.total || 0} shipment{pagination?.total !== 1 ? "s" : ""} found
              </p>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClearFilters}
                data-testid="button-clear-filters"
              >
                <X className="mr-2 h-4 w-4" />
                Clear Filters
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead data-testid="table-head-reference">Reference #</TableHead>
                  <TableHead data-testid="table-head-booking-mbl">Booking # / MBL</TableHead>
                  <TableHead data-testid="table-head-route">Route</TableHead>
                  <TableHead data-testid="table-head-carrier">Carrier / Vessel</TableHead>
                  <TableHead data-testid="table-head-dates">ETD / ETA</TableHead>
                  <TableHead data-testid="table-head-status">Status</TableHead>
                  <TableHead data-testid="table-head-containers">Containers</TableHead>
                  <TableHead className="text-right" data-testid="table-head-actions">
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: pageSize }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell>
                        <Skeleton className="h-4 w-24" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-32" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-40" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-28" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-32" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-5 w-20" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-8" />
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-2">
                          <Skeleton className="h-8 w-8" />
                          <Skeleton className="h-8 w-8" />
                          <Skeleton className="h-8 w-8" />
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : shipments.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="h-48 text-center">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <Ship className="h-12 w-12 text-muted-foreground" />
                        <p className="text-lg font-medium" data-testid="text-no-shipments">
                          No shipments found
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {hasActiveFilters
                            ? "Try adjusting your filters or search query"
                            : "Get started by adding your first shipment"}
                        </p>
                        {!hasActiveFilters && (
                          <Link href="/shipments/new">
                            <Button className="mt-2" data-testid="button-add-first-shipment">
                              <Plus className="mr-2 h-4 w-4" />
                              Add Shipment
                            </Button>
                          </Link>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  shipments.map((shipment) => (
                    <TableRow key={shipment.id} data-testid={`row-shipment-${shipment.id}`}>
                      <TableCell>
                        <Link href={`/shipments/${shipment.id}`}>
                          <button
                            className="text-primary hover:underline font-mono text-sm"
                            data-testid={`link-shipment-${shipment.id}`}
                          >
                            {shipment.taiShipmentId || shipment.shipmentReference}
                          </button>
                        </Link>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <p className="text-sm font-medium" data-testid={`text-booking-${shipment.id}`}>
                            {shipment.bookingNumber || "—"}
                          </p>
                          <p className="text-xs text-muted-foreground" data-testid={`text-bol-${shipment.id}`}>
                            {shipment.mblNumber || "—"}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 min-w-[200px]">
                          <span className="text-sm" data-testid={`text-origin-${shipment.id}`}>
                            {shipment.originPort}
                          </span>
                          <ArrowRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                          <span className="text-sm" data-testid={`text-destination-${shipment.id}`}>
                            {shipment.destinationPort}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1 min-w-[120px]">
                          <p className="text-sm" data-testid={`text-carrier-${shipment.id}`}>
                            {shipment.carrier || "—"}
                          </p>
                          <p className="text-xs text-muted-foreground" data-testid={`text-vessel-${shipment.id}`}>
                            {shipment.vesselName || "—"}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1 min-w-[100px]">
                          <p className="text-sm" data-testid={`text-etd-${shipment.id}`}>
                            ETD: {formatDateOnly(shipment.etd)}
                          </p>
                          <p className="text-sm" data-testid={`text-eta-${shipment.id}`}>
                            ETA: {formatDateOnly(shipment.eta)}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge
                            variant={getStatusBadgeVariant(shipment.status || "") as any}
                            data-testid={`badge-status-${shipment.id}`}
                          >
                            {getStatusLabel(shipment.status || "unknown")}
                          </Badge>
                          {shipment.rawData?.riskLevel && shipment.rawData.riskLevel !== 'low' && (
                            <Badge
                              variant={
                                shipment.rawData.riskLevel === 'critical' ? 'destructive' :
                                shipment.rawData.riskLevel === 'high' ? 'destructive' :
                                'secondary'
                              }
                              className="text-xs"
                              data-testid={`badge-risk-${shipment.id}`}
                              title={shipment.rawData.riskReasons?.join(', ')}
                            >
                              {shipment.rawData.riskLevel === 'critical' ? '🔴 Critical' :
                               shipment.rawData.riskLevel === 'high' ? '🟠 High Risk' :
                               '🟡 Medium Risk'}
                            </Badge>
                          )}
                          {shipment.isUserCreated && (
                            <Badge
                              variant="secondary"
                              className="text-xs"
                              data-testid={`badge-user-created-${shipment.id}`}
                            >
                              User Created
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell data-testid={`text-containers-${shipment.id}`}>
                        <div className="space-y-1">
                          {shipment.containerCount && shipment.containerCount > 1 ? (
                            <>
                              <Badge variant="outline" className="text-xs" data-testid={`badge-container-count-${shipment.id}`}>
                                {shipment.containerCount} Containers
                              </Badge>
                              <div className="text-xs text-muted-foreground max-w-[200px]">
                                {shipment.allContainerNumbers?.slice(0, 2).join(', ')}
                                {shipment.allContainerNumbers && shipment.allContainerNumbers.length > 2 && ` +${shipment.allContainerNumbers.length - 2} more`}
                              </div>
                            </>
                          ) : (
                            <span className="text-sm font-mono">{shipment.containerNumber || shipment.allContainerNumbers?.[0] || "—"}</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          <Link href={`/shipments/${shipment.id}`}>
                            <Button
                              variant="ghost"
                              size="icon"
                              data-testid={`button-view-${shipment.id}`}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          </Link>
                          <Link href={`/shipments/${shipment.id}?tab=edit`}>
                            <Button
                              variant="ghost"
                              size="icon"
                              data-testid={`button-edit-${shipment.id}`}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                          </Link>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDeleteShipmentId(shipment.id)}
                            data-testid={`button-delete-${shipment.id}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {pagination && pagination.totalPages > 1 && (
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <p className="text-sm text-muted-foreground">Rows per page:</p>
                <Select
                  value={pageSize.toString()}
                  onValueChange={(value) => {
                    setPageSize(parseInt(value));
                    setPage(1);
                  }}
                >
                  <SelectTrigger className="w-20" data-testid="select-page-size">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">10</SelectItem>
                    <SelectItem value="25">25</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                    <SelectItem value="100">100</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-2">
                <p className="text-sm text-muted-foreground">
                  Page {pagination.page} of {pagination.totalPages} ({pagination.total} total)
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(page - 1)}
                  disabled={page === 1}
                  data-testid="button-prev-page"
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(page + 1)}
                  disabled={page === pagination.totalPages}
                  data-testid="button-next-page"
                >
                  Next
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <AlertDialog open={!!deleteShipmentId} onOpenChange={() => setDeleteShipmentId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle data-testid="dialog-title-delete">Delete Shipment</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this shipment? This action cannot be undone and will
              also remove all associated containers and milestones.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteShipmentId && deleteMutation.mutate(deleteShipmentId)}
              data-testid="button-confirm-delete"
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
