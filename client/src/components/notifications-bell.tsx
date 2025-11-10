import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useLocation } from "wouter";
import { Bell, Check, CheckCheck, X, AlertCircle, Package, Ship, Clock, AlertTriangle, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatRelative } from "date-fns";
import type { Notification } from "@shared/schema";

const NotificationIcon = ({ type }: { type: string }) => {
  switch (type) {
    case "STATUS_CHANGE":
      return <Package className="h-4 w-4 text-blue-500" />;
    case "EXCEPTION":
      return <AlertCircle className="h-4 w-4 text-red-500" />;
    case "DEMURRAGE_ALERT":
      return <AlertTriangle className="h-4 w-4 text-orange-500" />;
    case "CUSTOMS_HOLD":
      return <AlertCircle className="h-4 w-4 text-yellow-500" />;
    case "ARRIVAL":
      return <Ship className="h-4 w-4 text-green-500" />;
    case "DELAY":
      return <Clock className="h-4 w-4 text-orange-500" />;
    default:
      return <Bell className="h-4 w-4" />;
  }
};

const getPriorityColor = (priority: string) => {
  switch (priority) {
    case "urgent":
      return "destructive";
    case "high":
      return "warning";
    case "normal":
      return "default";
    case "low":
      return "secondary";
    default:
      return "default";
  }
};

const getRiskBadgeColor = (riskLevel: string) => {
  switch (riskLevel.toLowerCase()) {
    case "critical":
      return "bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20";
    case "high":
      return "bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-500/20";
    case "medium":
      return "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500/20";
    case "low":
      return "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20";
    default:
      return "bg-muted text-muted-foreground border-border";
  }
};

// Helper to extract container number from notification title
const parseNotificationTitle = (title: string): { containerNumber: string; baseTitle: string } | null => {
  // Match patterns like "CONT123 - HIGH Risk" or "CONT123 - Risk Alert"
  const match = title.match(/^([A-Z0-9]+)\s*-\s*(HIGH|MEDIUM|LOW|CRITICAL)?\s*Risk/i);
  if (match) {
    return {
      containerNumber: match[1],
      baseTitle: match[1]
    };
  }
  return null;
};

export function NotificationsBell() {
  const [isOpen, setIsOpen] = useState(false);
  const [, navigate] = useLocation();

  // Fetch unread count
  const { data: countData } = useQuery<{ count: number }>({
    queryKey: ["/api/notifications/unread-count"],
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  // Fetch notifications when dropdown opens
  const { data: notifications, refetch } = useQuery<Notification[]>({
    queryKey: ["/api/notifications"],
    enabled: isOpen,
  });

  // Fetch containers for risk updates (only container IDs from notifications)
  const containerIds = notifications?.filter(n => n.entityType === "CONTAINER" && n.entityId).map(n => n.entityId) || [];
  const { data: containers } = useQuery<any[]>({
    queryKey: ["/api/containers/batch", containerIds],
    queryFn: async () => {
      if (containerIds.length === 0) return [];
      const responses = await Promise.all(
        containerIds.map(id => 
          fetch(`/api/containers/${id}`, { credentials: "include" })
            .then(r => r.ok ? r.json() : null)
            .catch(() => null)
        )
      );
      return responses.filter(Boolean);
    },
    enabled: isOpen && containerIds.length > 0,
  });

  // Mark as read mutation
  const markAsReadMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/notifications/${id}/read`, {
        method: "PATCH",
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to mark as read");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/unread-count"] });
    },
  });

  // Mark all as read mutation
  const markAllAsReadMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/notifications/read-all", {
        method: "PATCH",
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to mark all as read");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/unread-count"] });
    },
  });

  // Delete notification mutation
  const deleteNotificationMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/notifications/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to delete notification");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/unread-count"] });
    },
  });

  const unreadCount = countData?.count || 0;
  const hasUnread = unreadCount > 0;

  useEffect(() => {
    if (isOpen) {
      refetch();
    }
  }, [isOpen, refetch]);

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.isRead) {
      markAsReadMutation.mutate(notification.id);
    }
    
    // Close the dropdown
    setIsOpen(false);
    
    // Navigate to relevant page based on entity type
    if (notification.entityType === "CONTAINER" && notification.entityId) {
      navigate(`/container/${notification.entityId}`);
    } else if (notification.entityType === "SHIPMENT" && notification.entityId) {
      navigate(`/shipments/${notification.entityId}`);
    }
  };

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          data-testid="button-notifications"
        >
          <Bell className="h-5 w-5" />
          {hasUnread && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center text-xs"
            >
              {unreadCount > 9 ? "9+" : unreadCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-96">
        <div className="flex items-center justify-between p-2">
          <DropdownMenuLabel>Notifications</DropdownMenuLabel>
          {hasUnread && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => markAllAsReadMutation.mutate()}
              className="h-auto p-1 text-xs"
            >
              <CheckCheck className="h-3 w-3 mr-1" />
              Mark all read
            </Button>
          )}
        </div>
        <DropdownMenuSeparator />
        <ScrollArea className="h-[400px]">
          {notifications && notifications.length > 0 ? (
            notifications.map((notification) => {
              // Get current container data if this is a container notification
              const container = notification.entityType === "CONTAINER" && notification.entityId
                ? containers?.find(c => c.id === notification.entityId)
                : null;
              
              // Parse the title to extract container number
              const parsed = parseNotificationTitle(notification.title);
              
              // Determine current risk level to display
              const currentRiskLevel = container?.riskLevel;
              const displayTitle = parsed && currentRiskLevel
                ? `${parsed.containerNumber} - Risk Alert`
                : notification.title;
              
              return (
                <DropdownMenuItem
                  key={notification.id}
                  className="flex flex-col items-start p-3 cursor-pointer hover:bg-accent"
                  onClick={() => handleNotificationClick(notification)}
                >
                  <div className="flex items-start justify-between w-full">
                    <div className="flex items-start gap-2 flex-1">
                      <NotificationIcon type={notification.type} />
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className={`font-medium text-sm ${notification.isRead ? "text-muted-foreground" : ""}`}>
                            {displayTitle}
                          </p>
                          {currentRiskLevel && (
                            <Badge className={`text-xs ${getRiskBadgeColor(currentRiskLevel)}`}>
                              {currentRiskLevel.toUpperCase()}
                            </Badge>
                          )}
                          {notification.priority !== "normal" && (
                            <Badge variant={getPriorityColor(notification.priority) as any} className="text-xs">
                              {notification.priority}
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {notification.message}
                        </p>
                        <p className="text-xs text-muted-foreground mt-2">
                          {notification.createdAt ? formatRelative(new Date(notification.createdAt), new Date()) : "Just now"}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 ml-2">
                      {!notification.isRead && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={(e) => {
                            e.stopPropagation();
                            markAsReadMutation.mutate(notification.id);
                          }}
                        >
                          <Check className="h-3 w-3" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteNotificationMutation.mutate(notification.id);
                        }}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </DropdownMenuItem>
              );
            })
          ) : (
            <div className="p-8 text-center text-muted-foreground">
              <Bell className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p className="text-sm">No notifications yet</p>
              <p className="text-xs mt-1">You'll see updates here when containers change status</p>
            </div>
          )}
        </ScrollArea>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}