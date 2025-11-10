import { AlertTriangle, Clock, DollarSign } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { differenceInDays, parseISO, format } from "date-fns";

interface DemurrageAlertProps {
  lastFreeDay: string;
  containerNumber: string;
  estimatedFees?: number;
  className?: string;
}

export function DemurrageAlert({ lastFreeDay, containerNumber, estimatedFees, className }: DemurrageAlertProps) {
  const daysUntilLFD = differenceInDays(parseISO(lastFreeDay), new Date());
  const daysOverdue = Math.abs(daysUntilLFD);
  const isPastLFD = daysUntilLFD < 0;
  
  const getAlertVariant = () => {
    if (daysUntilLFD < 0) return "critical";
    if (daysUntilLFD <= 1) return "urgent";
    if (daysUntilLFD <= 3) return "warning";
    return "info";
  };

  const variant = getAlertVariant();
  const variantConfig = {
    critical: {
      bg: "bg-status-delayed/10 border-status-delayed",
      icon: AlertTriangle,
      text: "text-status-delayed",
      message: `OVERDUE: ${daysOverdue} ${daysOverdue === 1 ? 'day' : 'days'} past LFD (${format(parseISO(lastFreeDay), 'MMM d')})`,
    },
    urgent: {
      bg: "bg-status-delayed/10 border-status-delayed",
      icon: AlertTriangle,
      text: "text-status-delayed",
      message: daysUntilLFD === 0 ? "Last Free Day is TODAY" : `Last Free Day is TOMORROW`,
    },
    warning: {
      bg: "bg-status-at-port/10 border-status-at-port",
      icon: Clock,
      text: "text-status-at-port-foreground",
      message: `Last Free Day in ${daysUntilLFD} days (${format(parseISO(lastFreeDay), 'MMM d')})`,
    },
    info: {
      bg: "bg-muted/50 border-border",
      icon: Clock,
      text: "text-muted-foreground",
      message: `Last Free Day: ${format(parseISO(lastFreeDay), 'MMM d, yyyy')}`,
    },
  };

  const config = variantConfig[variant];
  const Icon = config.icon;

  return (
    <Alert className={`${config.bg} ${className}`} data-testid={`alert-demurrage-${containerNumber}`}>
      <Icon className={`h-4 w-4 ${config.text}`} />
      <AlertDescription className="flex items-center justify-between gap-2 flex-wrap">
        <span className={`text-sm font-medium ${config.text}`}>
          {config.message}
        </span>
        <div className="flex items-center gap-2">
          {isPastLFD && (
            <Badge variant="destructive" className="gap-1" data-testid={`badge-demurrage-accruing-${containerNumber}`}>
              Demurrage Accruing
            </Badge>
          )}
          {estimatedFees !== undefined && estimatedFees > 0 && (
            <Badge variant="outline" className="gap-1" data-testid={`badge-demurrage-fee-${containerNumber}`}>
              <DollarSign className="h-3 w-3" />
              ${estimatedFees.toFixed(2)}
            </Badge>
          )}
        </div>
      </AlertDescription>
    </Alert>
  );
}
