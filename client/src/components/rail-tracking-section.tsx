import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Train, MapPin, Clock } from "lucide-react";
import { Progress } from "@/components/ui/progress";

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

interface RailTrackingSectionProps {
  segments: RailSegment[];
}

export function RailTrackingSection({ segments }: RailTrackingSectionProps) {
  if (segments.length === 0) return null;

  return (
    <Card data-testid="card-rail-tracking">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Train className="h-4 w-4" />
          Intermodal Rail Tracking
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {segments.map((segment, index) => (
          <div key={index} className="space-y-2" data-testid={`rail-segment-${index}`}>
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <p className="text-sm font-semibold">{segment.carrier}</p>
                  {segment.trainNumber && (
                    <span className="text-xs font-mono text-muted-foreground">
                      {segment.trainNumber}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <MapPin className="h-3 w-3" />
                  <span>{segment.origin} → {segment.destination}</span>
                </div>
              </div>
              
              <div className="text-right text-xs">
                {segment.status === "completed" && segment.arrivalTime && (
                  <div className="text-status-delivered">
                    <Clock className="inline h-3 w-3 mr-1" />
                    Arrived {segment.arrivalTime}
                  </div>
                )}
                {segment.status === "in-transit" && segment.estimatedArrival && (
                  <div className="text-status-in-transit-foreground">
                    <Clock className="inline h-3 w-3 mr-1" />
                    ETA {segment.estimatedArrival}
                  </div>
                )}
                {segment.status === "pending" && (
                  <div className="text-muted-foreground">Pending</div>
                )}
              </div>
            </div>
            
            {segment.status !== "pending" && (
              <Progress 
                value={segment.status === "completed" ? 100 : 50} 
                className="h-1"
              />
            )}
            
            {index < segments.length - 1 && (
              <div className="border-b pt-2" />
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
