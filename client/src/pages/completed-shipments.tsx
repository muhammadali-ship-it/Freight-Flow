import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { buildApiUrl } from "@/lib/env";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import { Eye, ArrowRight, Search, X, CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
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

export default function CompletedShipments() {
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

    const { data: user } = useQuery<{ id: string; role: string; name: string; email: string }>({
        queryKey: ["/api/user"],
    });

    const { data: carriers = [], isLoading: isLoadingCarriers } = useQuery<string[]>({
        queryKey: ["/api/carriers"],
    });

    const { data: ports = [], isLoading: isLoadingPorts } = useQuery<string[]>({
        queryKey: ["/api/ports"],
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
                completed: true, // Fetch ONLY completed shipments
            },
        ],
        queryFn: async () => {
            const params = new URLSearchParams({
                page: page.toString(),
                pageSize: pageSize.toString(),
                completed: "true", // Fetch ONLY completed shipments
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

    return (
        <div className="space-y-4 sm:space-y-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
                <div>
                    <h1 className="text-xl sm:text-2xl font-bold" data-testid="heading-completed-shipments">
                        Completed Shipments
                    </h1>
                    <p className="text-sm sm:text-base text-muted-foreground">
                        View history of completed shipments (Empty In &gt; 10 days ago)
                    </p>
                </div>
            </div>

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
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                ) : shipments.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={7} className="h-48 text-center">
                                            <div className="flex flex-col items-center justify-center gap-2">
                                                <CheckCircle2 className="h-12 w-12 text-muted-foreground" />
                                                <p className="text-lg font-medium" data-testid="text-no-shipments">
                                                    No completed shipments found
                                                </p>
                                                <p className="text-sm text-muted-foreground">
                                                    Shipments will appear here 10 days after their Empty In event
                                                </p>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    shipments.map((shipment) => (
                                        <TableRow key={shipment.id} data-testid={`row-shipment-${shipment.id}`}>
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
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent >
            </Card >

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
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="flex items-center gap-2">
                                <p className="text-sm text-muted-foreground">
                                    Page {pagination.page} of {pagination.totalPages}
                                </p>
                                <div className="flex gap-2">
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
                                        disabled={page >= pagination.totalPages}
                                        data-testid="button-next-page"
                                    >
                                        Next
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
