import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, Clock, AlertCircle } from "lucide-react";

export type TerminalStatus = "available" | "not-available" | "pending" | "hold" | "customs-hold";

interface TerminalStatusBadgeProps {
  status: TerminalStatus;
  className?: string;
}

const statusConfig = {
  available: {
    label: "Available for Pickup",
    icon: CheckCircle2,
    className: "bg-status-delivered text-status-delivered-foreground",
  },
  "not-available": {
    label: "Not Available",
    icon: XCircle,
    className: "bg-muted text-muted-foreground",
  },
  pending: {
    label: "Pending Release",
    icon: Clock,
    className: "bg-status-at-port text-status-at-port-foreground",
  },
  hold: {
    label: "Customs Hold",
    icon: AlertCircle,
    className: "bg-status-delayed text-status-delayed-foreground",
  },
  "customs-hold": {
    label: "Customs Hold",
    icon: AlertCircle,
    className: "bg-status-delayed text-status-delayed-foreground",
  },
};

export function TerminalStatusBadge({ status, className }: TerminalStatusBadgeProps) {
  const config = statusConfig[status];
  
  if (!config) {
    console.warn(`Unknown terminal status: ${status}`);
    return null;
  }
  
  const Icon = config.icon;

  return (
    <Badge className={`${config.className} ${className}`} data-testid={`badge-terminal-${status}`}>
      <Icon className="mr-1 h-3 w-3" />
      {config.label}
    </Badge>
  );
}
