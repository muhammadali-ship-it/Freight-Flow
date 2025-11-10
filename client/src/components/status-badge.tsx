import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Truck, AlertTriangle, Anchor, Clock } from "lucide-react";

export type ContainerStatus = "delivered" | "in-transit" | "delayed" | "at-port" | "processing";

interface StatusBadgeProps {
  status: ContainerStatus;
  className?: string;
}

const statusConfig = {
  delivered: {
    label: "Delivered",
    icon: CheckCircle2,
    className: "bg-status-delivered text-status-delivered-foreground",
  },
  "in-transit": {
    label: "In Transit",
    icon: Truck,
    className: "bg-status-in-transit text-status-in-transit-foreground",
  },
  delayed: {
    label: "Delayed",
    icon: AlertTriangle,
    className: "bg-status-delayed text-status-delayed-foreground",
  },
  "at-port": {
    label: "At Port",
    icon: Anchor,
    className: "bg-status-at-port text-status-at-port-foreground",
  },
  processing: {
    label: "Processing",
    icon: Clock,
    className: "bg-muted text-muted-foreground",
  },
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  // Normalize status: lowercase and replace spaces with hyphens
  const normalizedStatus = status.toLowerCase().replace(/\s+/g, '-') as ContainerStatus;
  
  // Get config or fallback to a default
  const config = statusConfig[normalizedStatus] || {
    label: status,
    icon: Clock,
    className: "bg-muted text-muted-foreground",
  };
  
  const Icon = config.icon;

  return (
    <Badge className={`${config.className} ${className}`} data-testid={`badge-status-${normalizedStatus}`}>
      <Icon className="mr-1 h-3 w-3" />
      {config.label}
    </Badge>
  );
}
