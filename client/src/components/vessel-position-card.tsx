import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Ship, MapPin, Navigation } from "lucide-react";

interface VesselPosition {
  latitude: number | string;
  longitude: number | string;
  speed: number | string;
  course: number | string;
  timestamp: string;
}

interface VesselPositionCardProps {
  vesselName: string;
  position: VesselPosition;
  estimatedArrival: string;
}

export function VesselPositionCard({ vesselName, position, estimatedArrival }: VesselPositionCardProps) {
  const lat = typeof position.latitude === 'string' ? parseFloat(position.latitude) : position.latitude;
  const lon = typeof position.longitude === 'string' ? parseFloat(position.longitude) : position.longitude;
  const speed = typeof position.speed === 'string' ? position.speed : position.speed.toString();
  const course = typeof position.course === 'string' ? position.course : position.course.toString();

  return (
    <Card data-testid="card-vessel-position">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Ship className="h-4 w-4" />
          Vessel Position
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <p className="text-sm font-semibold">{vesselName}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Last updated: {position.timestamp}</p>
        </div>
        
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div>
            <div className="flex items-center gap-1 text-muted-foreground">
              <MapPin className="h-3 w-3" />
              <span>Position</span>
            </div>
            <p className="font-mono font-medium mt-0.5">
              {lat.toFixed(4)}°, {lon.toFixed(4)}°
            </p>
          </div>
          
          <div>
            <div className="flex items-center gap-1 text-muted-foreground">
              <Navigation className="h-3 w-3" />
              <span>Speed/Course</span>
            </div>
            <p className="font-medium mt-0.5">
              {speed} kn / {course}°
            </p>
          </div>
        </div>

        <div className="pt-2 border-t">
          <p className="text-xs text-muted-foreground">Estimated Arrival</p>
          <p className="text-sm font-semibold mt-0.5">{estimatedArrival}</p>
        </div>
      </CardContent>
    </Card>
  );
}
