import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Filter, X, Users, CalendarIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { useQuery } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import type { DateRange } from "react-day-picker";

export interface FilterState {
  status: string;
  carrier: string;
  origin: string;
  users: string[];
  etaFrom?: string;
  etaTo?: string;
}

interface FilterBarProps {
  filters: FilterState;
  onFilterChange: (key: keyof FilterState, value: string | string[]) => void;
  onClearFilters: () => void;
  userRole?: string;
}

interface User {
  id: string;
  username: string;
  email: string;
  role: string;
}

export function FilterBar({ filters, onFilterChange, onClearFilters, userRole }: FilterBarProps) {
  const { data: users } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });

  const { data: carriers = [], isLoading: isLoadingCarriers } = useQuery<string[]>({
    queryKey: ["/api/carriers"],
  });

  const { data: ports = [], isLoading: isLoadingPorts } = useQuery<string[]>({
    queryKey: ["/api/ports"],
  });

  const [localUserSelection, setLocalUserSelection] = useState<string[]>(filters.users || []);

  useEffect(() => {
    setLocalUserSelection(filters.users || []);
  }, [filters.users]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (JSON.stringify(localUserSelection) !== JSON.stringify(filters.users)) {
        onFilterChange("users", localUserSelection);
      }
    }, 800);

    return () => clearTimeout(timer);
  }, [localUserSelection]);

  const handleUserToggle = (userId: string) => {
    const newUsers = localUserSelection.includes(userId)
      ? localUserSelection.filter(id => id !== userId)
      : [...localUserSelection, userId];
    setLocalUserSelection(newUsers);
  };

  const hasActiveFilters = filters.status !== "all" || filters.carrier !== "all" || filters.origin !== "all" || (filters.users && filters.users.length > 0) || !!filters.etaFrom || !!filters.etaTo;

  const nonAdminUsers = users?.filter(user => user.role !== "Admin") || [];

  const [dateRange, setDateRange] = useState<DateRange | undefined>(() => {
    if (filters.etaFrom || filters.etaTo) {
      return {
        from: filters.etaFrom ? new Date(filters.etaFrom) : undefined,
        to: filters.etaTo ? new Date(filters.etaTo) : undefined,
      };
    }
    return undefined;
  });

  useEffect(() => {
    if (filters.etaFrom || filters.etaTo) {
      setDateRange({
        from: filters.etaFrom ? new Date(filters.etaFrom) : undefined,
        to: filters.etaTo ? new Date(filters.etaTo) : undefined,
      });
    } else {
      setDateRange(undefined);
    }
  }, [filters.etaFrom, filters.etaTo]);

  const handleDateRangeSelect = (range: DateRange | undefined) => {
    setDateRange(range);
    
    // Only apply filter when both dates are selected or when clearing
    if (!range) {
      // Clearing the range
      onFilterChange('etaFrom', '');
      onFilterChange('etaTo', '');
    } else if (range.from && range.to) {
      // Both dates selected - apply the filter
      onFilterChange('etaFrom', format(range.from, 'yyyy-MM-dd'));
      onFilterChange('etaTo', format(range.to, 'yyyy-MM-dd'));
    }
    // If only 'from' is selected, just update local state but don't trigger filter yet
  };

  return (
    <div className="flex flex-wrap items-center gap-2 sm:gap-3">
      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
        <Filter className="h-4 w-4" />
        <span className="hidden sm:inline">Filters:</span>
      </div>
      
      <Select value={filters.status} onValueChange={(value) => onFilterChange("status", value)}>
        <SelectTrigger className="w-[140px] sm:w-[160px]" data-testid="select-filter-status">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Statuses</SelectItem>
          <SelectItem value="in-transit">In Transit</SelectItem>
          <SelectItem value="at-port">At Port</SelectItem>
          <SelectItem value="delivered">Delivered</SelectItem>
          <SelectItem value="delayed">Delayed</SelectItem>
        </SelectContent>
      </Select>

      <Select value={filters.carrier} onValueChange={(value) => onFilterChange("carrier", value)}>
        <SelectTrigger className="w-[140px] sm:w-[160px]" data-testid="select-filter-carrier">
          <SelectValue placeholder="Carrier" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Carriers</SelectItem>
          {isLoadingCarriers ? (
            <SelectItem value="loading" disabled>Loading...</SelectItem>
          ) : carriers.length === 0 ? (
            <SelectItem value="empty" disabled>No carriers found</SelectItem>
          ) : (
            carriers.map((carrier) => (
              <SelectItem key={carrier} value={carrier}>
                {carrier}
              </SelectItem>
            ))
          )}
        </SelectContent>
      </Select>

      <Select value={filters.origin} onValueChange={(value) => onFilterChange("origin", value)}>
        <SelectTrigger className="w-[140px] sm:w-[160px]" data-testid="select-filter-origin">
          <SelectValue placeholder="Origin" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Origins</SelectItem>
          {isLoadingPorts ? (
            <SelectItem value="loading" disabled>Loading...</SelectItem>
          ) : ports.length === 0 ? (
            <SelectItem value="empty" disabled>No ports found</SelectItem>
          ) : (
            ports.map((port) => (
              <SelectItem key={port} value={port}>
                {port}
              </SelectItem>
            ))
          )}
        </SelectContent>
      </Select>

      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              "w-[240px] sm:w-[280px] justify-start text-left font-normal",
              !dateRange && "text-muted-foreground"
            )}
            data-testid="button-filter-eta-range"
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {dateRange?.from ? (
              dateRange.to ? (
                <>
                  {format(dateRange.from, 'MM/dd/yy')} to {format(dateRange.to, 'MM/dd/yy')}
                </>
              ) : (
                format(dateRange.from, 'MM/dd/yy')
              )
            ) : (
              "ETA Date Range"
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="range"
            selected={dateRange}
            onSelect={handleDateRangeSelect}
            numberOfMonths={1}
            initialFocus
          />
        </PopoverContent>
      </Popover>

      {userRole === "Admin" && (
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="w-[140px] sm:w-[160px] justify-start" data-testid="button-filter-users">
              <Users className="mr-2 h-4 w-4" />
              {localUserSelection.length > 0 
                ? `${localUserSelection.length} User${localUserSelection.length > 1 ? 's' : ''}`
                : "All Users"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[200px] p-3" align="start">
            <div className="space-y-3">
              <h4 className="font-medium text-sm">Filter by Users (AND)</h4>
              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {nonAdminUsers.length > 0 ? (
                  nonAdminUsers.map((user) => (
                    <div key={user.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`user-${user.id}`}
                        checked={localUserSelection.includes(user.id)}
                        onCheckedChange={() => handleUserToggle(user.id)}
                        data-testid={`checkbox-user-${user.id}`}
                      />
                      <Label
                        htmlFor={`user-${user.id}`}
                        className="text-sm font-normal cursor-pointer flex-1"
                      >
                        {user.username}
                      </Label>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">No users available</p>
                )}
              </div>
              {localUserSelection.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full"
                  onClick={() => setLocalUserSelection([])}
                  data-testid="button-clear-user-filter"
                >
                  Clear Selection
                </Button>
              )}
            </div>
          </PopoverContent>
        </Popover>
      )}

      {hasActiveFilters && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onClearFilters}
          data-testid="button-clear-filters"
        >
          <X className="mr-1 h-4 w-4" />
          Clear Filters
        </Button>
      )}

      {hasActiveFilters && (
        <div className="flex gap-2">
          {filters.status !== "all" && (
            <Badge variant="secondary" className="gap-1">
              Status: {filters.status}
              <button
                onClick={() => onFilterChange("status", "all")}
                className="ml-1 hover:bg-background/20 rounded-full"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
        </div>
      )}
    </div>
  );
}
