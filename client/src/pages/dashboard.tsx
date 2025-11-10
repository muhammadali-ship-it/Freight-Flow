import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Package, TrendingUp, Ship, AlertTriangle, Plus, Download, ArrowUpDown, ArrowUp, ArrowDown, AlertCircle, Clock, CheckCircle, RotateCcw } from "lucide-react";
import { StatsCard } from "@/components/stats-card";
import { SearchBar } from "@/components/search-bar";
import { FilterBar, FilterState } from "@/components/filter-bar";
import { ContainerCard } from "@/components/container-card";
import { ContainerStatus } from "@/components/status-badge";
import { TimelineEvent } from "@/components/container-timeline";
import { RiskLevel } from "@/components/risk-priority-indicator";
import { TerminalStatus } from "@/components/terminal-status-badge";
import { ExceptionType } from "@/components/exception-alert";
import { Button } from "@/components/ui/button";
import { BarChart3 } from "lucide-react";
import { AnalyticsDashboard } from "@/components/analytics-dashboard";
import { SavedViewsMenu } from "@/components/saved-views-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface VesselPosition {
  latitude: string;
  longitude: string;
  speed: string;
  course: string;
  timestamp: string;
}

interface Exception {
  type: ExceptionType;
  title: string;
  description: string;
  timestamp: string;
}

interface RailSegment {
  carrier: string;
  origin: string;
  destination: string;
  departureTime?: string;
  arrivalTime?: string;
  estimatedArrival?: string;
  status: "completed" | "in-transit" | "pending";
  trainNumber?: string;
}

interface Container {
  id: string;
  containerNumber: string;
  status: ContainerStatus;
  origin: string;
  destination: string;
  carrier: string;
  vesselName: string;
  bookingNumber: string;
  masterBillOfLading: string;
  weight: string;
  volume: string;
  eta: string;
  estimatedArrival: string;
  progress: number;
  reference?: string;
  timeline?: TimelineEvent[];
  riskLevel?: RiskLevel;
  riskReason?: string;
  terminalStatus?: TerminalStatus;
  lastFreeDay?: string;
  demurrageFee?: string;
  detentionFee?: string;
  exceptionCost?: string;
  vesselPosition?: VesselPosition;
  exceptions?: Exception[];
  railSegments?: RailSegment[];
}

type QuickFilter = "urgent" | "high-risk" | "exceptions" | "overdue" | null;
type SortField = "eta" | "lastFreeDay" | "riskLevel" | "status" | "containerNumber";
type SortDirection = "asc" | "desc";
type KpiFilter = "total" | "in-transit" | "arriving-today" | "delayed" | "pod-needs-attention" | "pod-awaiting-full-out" | "pod-full-out" | "empty-returned" | null;

export default function Dashboard() {
  const [, navigate] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [filters, setFilters] = useState<FilterState>({
    status: "all",
    carrier: "all",
    origin: "all",
    users: [],
    etaFrom: undefined,
    etaTo: undefined,
  });
  const [quickFilter, setQuickFilter] = useState<QuickFilter>(null);
  const [kpiFilter, setKpiFilter] = useState<KpiFilter>(null);
  const [sortField, setSortField] = useState<SortField>("eta");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const { data: user } = useQuery<{ id: string; role: string; name: string; email: string; office: string }>({
    queryKey: ["/api/user"],
  });

  // Fetch shipments from Cargoes Flow (role-filtered)
  const { data: paginatedData, isLoading } = useQuery<{
    data: any[];
    pagination: { page: number; pageSize: number; total: number; totalPages: number };
  }>({
    queryKey: ["/api/shipments", { page, pageSize, search: searchQuery, filters, userId: user?.id, userRole: user?.role }],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: page.toString(),
        pageSize: pageSize.toString(),
      });
      
      if (searchQuery) params.append("search", searchQuery);
      if (filters.status && filters.status !== "all") params.append("status", filters.status);
      if (filters.carrier && filters.carrier !== "all") params.append("carrier", filters.carrier);
      if (filters.origin && filters.origin !== "all") params.append("originPort", filters.origin);
      if (filters.etaFrom) params.append("dateFrom", filters.etaFrom);
      if (filters.etaTo) params.append("dateTo", filters.etaTo);
      
      if (user?.id) params.append("userId", user.id);
      if (user?.role) params.append("userRole", user.role);

      const response = await fetch(`/api/shipments?${params}`);
      if (!response.ok) throw new Error("Failed to fetch shipments");
      return response.json();
    },
    enabled: !!user,
  });

  // Helper function to derive status from ETA date
  const getDerivedStatus = (eta: string): 'in-transit' | 'arriving-today' | 'delayed' => {
    if (!eta) return 'in-transit';
    
    // Parse ETA date (format: "2025-11-05 12:00:00 AM")
    const etaDate = new Date(eta);
    etaDate.setHours(0, 0, 0, 0);
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (etaDate.getTime() === today.getTime()) {
      return 'arriving-today';
    } else if (etaDate < today) {
      return 'delayed';
    } else {
      return 'in-transit';
    }
  };

  // Helper function to check if container is urgent
  const isUrgent = (container: Container) => {
    if (!container.lastFreeDay) return false;
    const lfd = new Date(container.lastFreeDay);
    lfd.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const daysUntilLFD = Math.ceil((lfd.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return daysUntilLFD >= 0 && daysUntilLFD <= 3;
  };

  const isOverdue = (container: Container) => {
    if (!container.lastFreeDay) return false;
    const lfd = new Date(container.lastFreeDay);
    lfd.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return lfd < today;
  };

  // Map Cargoes Flow shipments to container format for display
  const containers = (paginatedData?.data || []).map((ship: any) => {
    const rawData = ship.rawData || {};
    const terminalData = {
      terminalName: rawData.terminalName,
      terminalPort: rawData.terminalPort,
      terminalAvailableForPickup: rawData.terminalAvailableForPickup,
      terminalFullOut: rawData.terminalFullOut,
      terminalEmptyReturned: rawData.terminalEmptyReturned,
      terminalPickupAppointment: rawData.terminalPickupAppointment,
      lastFreeDay: rawData.lastFreeDay,
      demurrage: rawData.demurrage,
      detention: rawData.detention,
    };
    
    // Extract rail data from containers array
    const containersArray = rawData.containers || [];
    const firstContainer = containersArray[0] || {};
    const railData = firstContainer.rawData?.rail || {};
    
    // Determine terminal status based on terminal data
    let terminalStatus: string | undefined = undefined;
    if (terminalData.terminalFullOut) {
      terminalStatus = 'available';
    } else if (terminalData.terminalAvailableForPickup === false) {
      terminalStatus = 'pending';
    } else if (terminalData.terminalAvailableForPickup === true) {
      terminalStatus = 'available';
    }
    
    // Check if empty returned (from terminal or rail)
    const emptyReturned = !!(terminalData.terminalEmptyReturned || railData.emptyReturned);
    
    return {
      id: ship.id,
      containerNumber: ship.containerNumber || ship.taiShipmentId || 'N/A',
      status: ship.status || 'unknown',
      origin: ship.originPort || 'Unknown',
      destination: ship.destinationPort || 'Unknown',
      carrier: ship.carrier || 'Unknown',
      vesselName: ship.vesselName || 'Unknown',
      bookingNumber: ship.bookingNumber || '',
      masterBillOfLading: ship.mblNumber || '',
      weight: '',
      volume: '',
      eta: ship.eta || '',
      estimatedArrival: ship.eta || '',
      progress: 50,
      reference: ship.taiShipmentId || ship.shipmentReference,
      riskLevel: rawData.riskLevel as RiskLevel,
      riskReason: rawData.riskReasons?.join(', '),
      terminalStatus,
      lastFreeDay: terminalData.lastFreeDay || rawData.lastFreeDay,
      demurrageFee: terminalData.demurrage ? parseFloat(terminalData.demurrage) : undefined,
      detentionFee: terminalData.detention ? parseFloat(terminalData.detention) : undefined,
      exceptionCost: undefined,
      terminalData,
      railData,
      emptyReturned,
    };
  });

  // Calculate stats from shipments data using derived status and terminal/rail data
  const stats = {
    total: paginatedData?.pagination.total || 0,
    inTransit: containers.filter(c => getDerivedStatus(c.eta) === 'in-transit').length,
    arrivingToday: containers.filter(c => getDerivedStatus(c.eta) === 'arriving-today').length,
    delayed: containers.filter(c => getDerivedStatus(c.eta) === 'delayed').length,
    urgent: containers.filter(c => isUrgent(c)).length,
    highRisk: containers.filter(c => c.riskLevel === 'high' || c.riskLevel === 'critical').length,
    hasExceptions: containers.filter(c => (c as any).hasExceptions).length,
    overdue: containers.filter(c => isOverdue(c)).length,
    podNeedsAttention: containers.filter(c => {
      // Containers that need attention: have terminal info but not available for pickup and no full out
      return c.terminalData?.terminalName && 
             c.terminalData?.terminalAvailableForPickup === false && 
             !c.terminalData?.terminalFullOut;
    }).length,
    podAwaitingFullOut: containers.filter(c => {
      // Containers awaiting full out: have terminal info, not available, no full out yet
      return c.terminalData?.terminalName && 
             c.terminalData?.terminalAvailableForPickup === false && 
             !c.terminalData?.terminalFullOut;
    }).length,
    podFullOut: containers.filter(c => {
      // Containers with full out completed
      return !!(c.terminalData?.terminalFullOut || c.railData?.fullOut);
    }).length,
    emptyReturned: containers.filter(c => c.emptyReturned).length,
  };

  const handleViewDetails = (containerId: string) => {
    // Navigate to Cargoes Flow shipment detail page
    navigate(`/shipments/${containerId}`);
  };

  // Reset page to 1 when filters, search, or sort changes
  useEffect(() => {
    setPage(1);
  }, [searchQuery, sortField, sortDirection, filters, quickFilter, kpiFilter]);

  const handleFilterChange = (key: keyof FilterState, value: string | string[]) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const handleClearFilters = () => {
    setFilters({ status: "all", carrier: "all", origin: "all", users: [], etaFrom: undefined, etaTo: undefined });
    setQuickFilter(null);
    setKpiFilter(null);
  };

  const handleKpiFilter = (filter: KpiFilter) => {
    if (kpiFilter === filter) {
      setKpiFilter(null);
    } else {
      setKpiFilter(filter);
      setQuickFilter(null);
    }
  };

  const handleQuickFilter = (filter: QuickFilter) => {
    if (quickFilter === filter) {
      setQuickFilter(null);
    } else {
      setQuickFilter(filter);
    }
  };

  const handleLoadView = (savedFilters: { status: string; carrier: string; origin: string; searchQuery: string; quickFilter: string | null }) => {
    setFilters({
      status: savedFilters.status,
      carrier: savedFilters.carrier,
      origin: savedFilters.origin,
      users: [],
      etaFrom: undefined,
      etaTo: undefined,
    });
    setSearchQuery(savedFilters.searchQuery);
    setQuickFilter(savedFilters.quickFilter as QuickFilter);
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const handleExportCSV = () => {
    const csvHeaders = [
      "Container Number",
      "Status",
      "Origin",
      "Destination",
      "Carrier",
      "Vessel Name",
      "Booking Number",
      "BOL",
      "ETA",
      "Progress",
      "Risk Level",
      "Terminal Status",
      "Last Free Day",
      "Demurrage Fee"
    ];

    const csvRows = filteredContainers.map(container => [
      container.containerNumber,
      container.status,
      container.origin,
      container.destination,
      container.carrier,
      container.vesselName,
      container.bookingNumber,
      container.masterBillOfLading,
      container.eta,
      `${container.progress}%`,
      container.riskLevel || "",
      container.terminalStatus || "",
      container.lastFreeDay || "",
      container.demurrageFee ? `$${container.demurrageFee}` : ""
    ]);

    const csvContent = [
      csvHeaders.join(","),
      ...csvRows.map(row => row.map(cell => `"${cell}"`).join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `containers-export-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Apply quick filters and KPI filters client-side (backend handles carrier, origin, search, sort)
  const filteredContainers = containers.filter((container) => {
    // Quick filter logic
    if (quickFilter) {
      if (quickFilter === "urgent" && !isUrgent(container)) return false;
      if (quickFilter === "high-risk" && container.riskLevel !== "high") return false;
      if (quickFilter === "exceptions" && !(container as any).hasExceptions) return false;
      if (quickFilter === "overdue" && !isOverdue(container)) return false;
    }
    
    // KPI filter logic using derived status
    if (kpiFilter) {
      const derivedStatus = getDerivedStatus(container.eta);
      
      if (kpiFilter === "total") {
        // Show all containers
        return true;
      }
      if (kpiFilter === "in-transit" && derivedStatus !== "in-transit") return false;
      if (kpiFilter === "arriving-today" && derivedStatus !== "arriving-today") return false;
      if (kpiFilter === "delayed" && derivedStatus !== "delayed") return false;
      if (kpiFilter === "pod-needs-attention") {
        const needsAttention = (container as any).terminalData?.terminalName && 
                               (container as any).terminalData?.terminalAvailableForPickup === false && 
                               !(container as any).terminalData?.terminalFullOut;
        if (!needsAttention) return false;
      }
      if (kpiFilter === "pod-awaiting-full-out") {
        const awaitingFullOut = (container as any).terminalData?.terminalName && 
                                (container as any).terminalData?.terminalAvailableForPickup === false && 
                                !(container as any).terminalData?.terminalFullOut;
        if (!awaitingFullOut) return false;
      }
      if (kpiFilter === "pod-full-out") {
        const hasFullOut = !!(container as any).terminalData?.terminalFullOut || 
                          !!(container as any).railData?.fullOut;
        if (!hasFullOut) return false;
      }
      if (kpiFilter === "empty-returned") {
        if (!(container as any).emptyReturned) return false;
      }
    }
    
    return true;
  });

  // Use backend-provided stats (accurate for full filtered dataset, not just current page)
  const urgentCount = containers.filter(c => isUrgent(c)).length;
  const highRiskCount = containers.filter(c => c.riskLevel === 'high' || c.riskLevel === 'critical').length;
  const exceptionsCount = containers.filter(c => (c as any).hasExceptions).length;
  const overdueCount = containers.filter(c => isOverdue(c)).length;

  if (showAnalytics) {
    return (
      <div className="space-y-4 sm:space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl sm:text-2xl font-semibold">Analytics Dashboard</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Performance metrics and operational insights
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() => setShowAnalytics(false)}
            data-testid="button-back-to-containers"
          >
            <Package className="mr-2 h-4 w-4" />
            <span className="hidden sm:inline">Back to Containers</span>
            <span className="sm:hidden">Containers</span>
          </Button>
        </div>
        <AnalyticsDashboard
          onTimeDeliveryRate={91}
          averageTransitDays={18}
          exceptionRate={8}
          totalDemurrageCost={4200}
        />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4 animate-pulse" />
          <p className="text-lg font-medium">Loading containers...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold">Container Tracking</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Monitor and manage all container shipments in real-time
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <SavedViewsMenu
            currentFilters={{
              status: filters.status,
              carrier: filters.carrier,
              origin: filters.origin,
              searchQuery,
              quickFilter,
            }}
            onLoadView={handleLoadView}
          />
          <Button
            onClick={() => navigate("/shipments/new")}
            data-testid="button-add-shipment"
            className="flex-1 sm:flex-none"
          >
            <Plus className="mr-2 h-4 w-4" />
            Add Shipment
          </Button>
          <Button
            variant="outline"
            onClick={() => setShowAnalytics(true)}
            data-testid="button-view-analytics"
            className="flex-1 sm:flex-none"
          >
            <BarChart3 className="mr-2 h-4 w-4" />
            <span className="hidden sm:inline">View Analytics</span>
            <span className="sm:hidden">Analytics</span>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatsCard
          title="Total Containers"
          value={stats.total}
          icon={Package}
          trend={{ value: 12, isPositive: true }}
          onClick={() => handleKpiFilter("total")}
          isActive={kpiFilter === "total"}
        />
        <StatsCard
          title="In Transit"
          value={stats.inTransit}
          icon={TrendingUp}
          trend={{ value: 8, isPositive: true }}
          onClick={() => handleKpiFilter("in-transit")}
          isActive={kpiFilter === "in-transit"}
        />
        <StatsCard
          title="Arriving Today"
          value={stats.arrivingToday}
          icon={Ship}
          onClick={() => handleKpiFilter("arriving-today")}
          isActive={kpiFilter === "arriving-today"}
        />
        <StatsCard
          title="Delayed"
          value={stats.delayed}
          icon={AlertTriangle}
          trend={{ value: -5, isPositive: false }}
          onClick={() => handleKpiFilter("delayed")}
          isActive={kpiFilter === "delayed"}
        />
        <StatsCard
          title="POD needs Attention"
          value={stats.podNeedsAttention}
          icon={AlertCircle}
          onClick={() => handleKpiFilter("pod-needs-attention")}
          isActive={kpiFilter === "pod-needs-attention"}
        />
        <StatsCard
          title="POD awaiting Full Out"
          value={stats.podAwaitingFullOut}
          icon={Clock}
          onClick={() => handleKpiFilter("pod-awaiting-full-out")}
          isActive={kpiFilter === "pod-awaiting-full-out"}
        />
        <StatsCard
          title="POD Full Out"
          value={stats.podFullOut}
          icon={CheckCircle}
          onClick={() => handleKpiFilter("pod-full-out")}
          isActive={kpiFilter === "pod-full-out"}
        />
        <StatsCard
          title="Empty Returned"
          value={stats.emptyReturned}
          icon={RotateCcw}
          onClick={() => handleKpiFilter("empty-returned")}
          isActive={kpiFilter === "empty-returned"}
        />
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <SearchBar value={searchQuery} onChange={setSearchQuery} placeholder="Search by container #, BOL, booking ref, PO..." />
        <Button
          variant="outline"
          onClick={handleExportCSV}
          className="sm:w-auto"
          data-testid="button-export-csv"
        >
          <Download className="mr-2 h-4 w-4" />
          Export CSV ({filteredContainers.length})
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          variant={quickFilter === "urgent" ? "default" : "outline"}
          size="sm"
          onClick={() => handleQuickFilter("urgent")}
          data-testid="button-quick-filter-urgent"
        >
          <AlertTriangle className="mr-2 h-3 w-3" />
          Urgent ({urgentCount})
        </Button>
        <Button
          variant={quickFilter === "high-risk" ? "default" : "outline"}
          size="sm"
          onClick={() => handleQuickFilter("high-risk")}
          data-testid="button-quick-filter-high-risk"
        >
          High Risk ({highRiskCount})
        </Button>
        <Button
          variant={quickFilter === "exceptions" ? "default" : "outline"}
          size="sm"
          onClick={() => handleQuickFilter("exceptions")}
          data-testid="button-quick-filter-exceptions"
        >
          Has Exceptions ({exceptionsCount})
        </Button>
        <Button
          variant={quickFilter === "overdue" ? "default" : "outline"}
          size="sm"
          onClick={() => handleQuickFilter("overdue")}
          data-testid="button-quick-filter-overdue"
        >
          Overdue ({overdueCount})
        </Button>
      </div>

      <FilterBar
        filters={filters}
        onFilterChange={handleFilterChange}
        onClearFilters={handleClearFilters}
        userRole={user?.role}
      />

      <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-3">
        <div className="flex items-center gap-2 flex-1">
          <span className="text-sm text-muted-foreground whitespace-nowrap">Sort by:</span>
          <Select value={sortField} onValueChange={(value) => setSortField(value as SortField)}>
            <SelectTrigger className="w-full sm:w-[180px]" data-testid="select-sort-field">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="eta">ETA</SelectItem>
              <SelectItem value="lastFreeDay">Last Free Day</SelectItem>
              <SelectItem value="riskLevel">Risk Level</SelectItem>
              <SelectItem value="status">Status</SelectItem>
              <SelectItem value="containerNumber">Container #</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setSortDirection(sortDirection === "asc" ? "desc" : "asc")}
            data-testid="button-sort-direction"
          >
            {sortDirection === "asc" ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />}
          </Button>
        </div>
        <span className="text-xs text-muted-foreground sm:ml-auto">
          {filteredContainers.length} containers
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filteredContainers.map((container) => (
          <ContainerCard
            key={container.id}
            {...container}
            demurrageFee={container.demurrageFee ? parseFloat(container.demurrageFee) : undefined}
            detentionFee={container.detentionFee ? parseFloat(container.detentionFee) : undefined}
            exceptionCost={container.exceptionCost ? parseFloat(container.exceptionCost) : undefined}
            onViewDetails={() => handleViewDetails(container.id)}
          />
        ))}
      </div>

      {paginatedData && paginatedData.pagination.totalPages > 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-xs sm:text-sm text-muted-foreground text-center sm:text-left">
            Showing {((page - 1) * pageSize) + 1} to {Math.min(page * pageSize, paginatedData.pagination.total)} of {paginatedData.pagination.total} containers
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page === 1}
              data-testid="button-prev-page"
            >
              <span className="hidden sm:inline">Previous</span>
              <span className="sm:hidden">Prev</span>
            </Button>
            <div className="text-xs sm:text-sm text-muted-foreground whitespace-nowrap">
              Page {page} of {paginatedData.pagination.totalPages}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(Math.min(paginatedData.pagination.totalPages, page + 1))}
              disabled={page === paginatedData.pagination.totalPages}
              data-testid="button-next-page"
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {filteredContainers.length === 0 && !isLoading && (
        <div className="text-center py-12" data-testid="text-no-results">
          <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-lg font-medium">No containers found</p>
          <p className="text-sm text-muted-foreground mt-1">
            {containers.length === 0 
              ? "No containers have been added yet"
              : "Try adjusting your search or filters"}
          </p>
        </div>
      )}
    </div>
  );
}
