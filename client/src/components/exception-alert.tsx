import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle, XCircle, AlertCircle, Clock } from "lucide-react";

export type ExceptionType = "customs-hold" | "port-congestion" | "weather-delay" | "documentation-issue" | "other";

interface ExceptionAlertProps {
  type: ExceptionType;
  title: string;
  description: string;
  timestamp: string;
  className?: string;
}

const exceptionConfig = {
  "customs-hold": {
    icon: XCircle,
    className: "border-status-delayed bg-status-delayed/10",
    iconClass: "text-status-delayed",
  },
  "port-congestion": {
    icon: AlertCircle,
    className: "border-status-at-port bg-status-at-port/10",
    iconClass: "text-status-at-port-foreground",
  },
  "weather-delay": {
    icon: AlertTriangle,
    className: "border-status-at-port bg-status-at-port/10",
    iconClass: "text-status-at-port-foreground",
  },
  "documentation-issue": {
    icon: AlertCircle,
    className: "border-status-delayed bg-status-delayed/10",
    iconClass: "text-status-delayed",
  },
  other: {
    icon: Clock,
    className: "border-border bg-muted/50",
    iconClass: "text-muted-foreground",
  },
};

export function ExceptionAlert({ type, title, description, timestamp, className }: ExceptionAlertProps) {
  const config = exceptionConfig[type];
  const Icon = config.icon;

  return (
    <Alert className={`${config.className} ${className}`} data-testid={`alert-exception-${type}`}>
      <Icon className={`h-4 w-4 ${config.iconClass}`} />
      <AlertTitle className="text-sm font-semibold">{title}</AlertTitle>
      <AlertDescription className="text-sm mt-1">
        {description}
        <p className="text-xs text-muted-foreground mt-1">{timestamp}</p>
      </AlertDescription>
    </Alert>
  );
}
