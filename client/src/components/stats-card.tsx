import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatsCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  className?: string;
  onClick?: () => void;
  isActive?: boolean;
}

export function StatsCard({ title, value, icon: Icon, trend, className, onClick, isActive }: StatsCardProps) {
  return (
    <Card 
      className={cn(
        className,
        onClick && "cursor-pointer transition-all hover-elevate active-elevate-2",
        isActive && "ring-2 ring-primary"
      )}
      onClick={onClick}
      data-testid={`card-stat-${title.toLowerCase().replace(/\s+/g, '-')}`}
    >
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {title}
        </p>
        <Icon className={cn("h-4 w-4", isActive ? "text-primary" : "text-muted-foreground")} />
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-bold" data-testid={`text-stat-value-${title.toLowerCase().replace(/\s+/g, '-')}`}>
          {value}
        </div>
        {trend && (
          <p className="text-xs text-muted-foreground mt-1">
            <span className={trend.isPositive ? "text-chart-2" : "text-chart-5"}>
              {trend.isPositive ? "+" : ""}{trend.value}%
            </span>{" "}
            from last week
          </p>
        )}
      </CardContent>
    </Card>
  );
}
