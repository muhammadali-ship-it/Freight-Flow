import { Badge } from "@/components/ui/badge";
import { AlertTriangle, AlertCircle, Info } from "lucide-react";

export type RiskLevel = "critical" | "high" | "medium" | "low";

interface RiskPriorityIndicatorProps {
  level: RiskLevel;
  reason?: string;
  className?: string;
}

const riskConfig = {
  critical: {
    label: "Critical Risk",
    icon: AlertTriangle,
    className: "bg-destructive text-destructive-foreground",
  },
  high: {
    label: "High Risk",
    icon: AlertTriangle,
    className: "bg-status-delayed text-status-delayed-foreground",
  },
  medium: {
    label: "Medium Risk",
    icon: AlertCircle,
    className: "bg-status-at-port text-status-at-port-foreground",
  },
  low: {
    label: "Low Risk",
    icon: Info,
    className: "bg-muted text-muted-foreground",
  },
};

export function RiskPriorityIndicator({ level, reason, className }: RiskPriorityIndicatorProps) {
  if (!level || !riskConfig[level]) {
    return null;
  }
  
  const config = riskConfig[level];
  const Icon = config.icon;

  return (
    <div className="flex items-center gap-2">
      <Badge className={`${config.className} ${className}`} data-testid={`badge-risk-${level}`}>
        <Icon className="mr-1 h-3 w-3" />
        {config.label}
      </Badge>
      {reason && (
        <span className="text-xs text-muted-foreground">{reason}</span>
      )}
    </div>
  );
}
