import { useQuery } from "@tanstack/react-query";
import { useRoute, Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Edit, Ship, Train, AlertCircle, Clock, MapPin } from "lucide-react";
import { StatusBadge } from "@/components/status-badge";
import { TerminalStatusBadge } from "@/components/terminal-status-badge";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";

export default function ContainerDetail() {
  const [, params] = useRoute("/container/:id");
  const containerId = params?.id;

  const { data: container, isLoading } = useQuery<any>({
    queryKey: ["/api/containers", containerId],
    enabled: !!containerId,
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 bg-muted animate-pulse rounded" />
        <div className="h-96 bg-muted animate-pulse rounded" />
      </div>
    );
  }

  if (!container) {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-semibold mb-2">Container not found</h2>
        <p className="text-muted-foreground mb-4">The container you're looking for doesn't exist.</p>
        <Link href="/">
          <Button data-testid="button-back-home">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Dashboard
          </Button>
        </Link>
      </div>
    );
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      return dateString;
    }
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const convertLbsToKg = (weightStr: string): string => {
    const lbsMatch = weightStr.match(/([0-9,]+)\s*lbs?/i);
    if (lbsMatch) {
      const lbsValue = parseFloat(lbsMatch[1].replace(/,/g, ''));
      const kgValue = lbsValue * 0.453592;
      return `${kgValue.toLocaleString('en-US', { maximumFractionDigits: 0 })} kg`;
    }
    return weightStr;
  };

  return (
    <div className="space-y-4 sm:space-y-6" data-testid="container-detail-page">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3 sm:gap-4">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => window.history.back()}
            data-testid="button-back"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold font-mono" data-testid="text-container-number">
              {container.containerNumber}
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground">
              {container.origin} → {container.destination}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={container.status} />
          {container.riskLevel && (
            <Badge
              variant={container.riskLevel === "high" ? "destructive" : "secondary"}
              data-testid={`badge-risk-${container.riskLevel}`}
            >
              {container.riskLevel.toUpperCase()} RISK
            </Badge>
          )}
        </div>
      </div>

      {/* Main Info Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
        {/* Shipment Details */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Shipment Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {container.shipmentId && (
              <div>
                <p className="text-xs text-muted-foreground">Parent Shipment</p>
                <Link href={`/shipments/${container.shipmentId}`}>
                  <span className="text-sm font-semibold text-primary hover:underline cursor-pointer" data-testid="link-parent-shipment">
                    View Shipment Details →
                  </span>
                </Link>
              </div>
            )}
            <div>
              <p className="text-xs text-muted-foreground">Carrier</p>
              <p className="font-semibold" data-testid="text-carrier">{container.carrier}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Vessel</p>
              <p className="font-semibold font-mono" data-testid="text-vessel">{container.vesselName}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">ETA</p>
              <p className="font-semibold" data-testid="text-eta">{formatDate(container.eta)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Progress</p>
              <p className="font-semibold" data-testid="text-progress">{container.progress}%</p>
            </div>
          </CardContent>
        </Card>

        {/* Documentation */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Documentation</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <p className="text-xs text-muted-foreground">Booking Number</p>
              <p className="font-semibold font-mono" data-testid="text-booking">{container.bookingNumber}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Master Bill of Lading</p>
              <p className="font-semibold font-mono" data-testid="text-bol">{container.masterBillOfLading}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Reference</p>
              <p className="font-semibold font-mono" data-testid="text-reference">{container.reference || "N/A"}</p>
            </div>
          </CardContent>
        </Card>

        {/* Cargo Info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Cargo Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <p className="text-xs text-muted-foreground">Weight</p>
              <p className="font-semibold" data-testid="text-weight">{convertLbsToKg(container.weight)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Volume</p>
              <p className="font-semibold" data-testid="text-volume">{container.volume}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Hold Types - Show prominently if any holds exist */}
      {container.holdTypes && container.holdTypes.length > 0 && (
        <Card className="border-orange-500 dark:border-orange-400">
          <CardHeader className="bg-orange-500/10 dark:bg-orange-400/10">
            <CardTitle className="text-lg flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-orange-600 dark:text-orange-400" />
              Container Holds
            </CardTitle>
            <CardDescription>
              The following restrictions are currently applied to this container
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="flex flex-wrap gap-2">
              {container.holdTypes.map((hold: string, index: number) => (
                <Badge 
                  key={index}
                  variant="destructive"
                  className="text-sm"
                  data-testid={`badge-hold-${hold.toLowerCase().replace(' ', '-')}`}
                >
                  <AlertCircle className="mr-1 h-3 w-3" />
                  {hold}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Terminal Status & Demurrage */}
      {(container.podTerminal || container.terminalStatus || container.lastFreeDay) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Terminal & Demurrage</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {container.podTerminal && (
                <div>
                  <p className="text-xs text-muted-foreground mb-2">POD Terminal</p>
                  <p className="font-semibold" data-testid="text-pod-terminal">{container.podTerminal}</p>
                </div>
              )}
              {container.terminalStatus && (
                <div>
                  <p className="text-xs text-muted-foreground mb-2">Terminal Status</p>
                  <TerminalStatusBadge status={container.terminalStatus} />
                </div>
              )}
              {container.lastFreeDay && (
                <div>
                  <p className="text-xs text-muted-foreground mb-2">Last Free Day</p>
                  <p className="font-semibold" data-testid="text-lfd">{formatDate(container.lastFreeDay)}</p>
                </div>
              )}
              {container.demurrageFee && (
                <div>
                  <p className="text-xs text-muted-foreground mb-2">Demurrage Fee</p>
                  <p className="font-semibold text-red-600" data-testid="text-demurrage">
                    ${parseFloat(container.demurrageFee).toFixed(2)}
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Exceptions */}
      {container.exceptions && container.exceptions.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-red-600" />
              <CardTitle className="text-lg">Active Exceptions</CardTitle>
              <Badge variant="destructive">{container.exceptions.length}</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {container.exceptions.map((exception: any) => (
                <div key={exception.id} className="flex items-start gap-3 p-3 border rounded-md" data-testid={`exception-${exception.id}`}>
                  <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-semibold">{exception.title}</p>
                    <p className="text-sm text-muted-foreground">{exception.description}</p>
                    <p className="text-xs text-muted-foreground mt-1">{formatDate(exception.timestamp)}</p>
                  </div>
                  <Badge variant="outline">{exception.type}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Vessel Position */}
      {container.vesselPosition && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Ship className="h-5 w-5" />
              <CardTitle className="text-lg">Vessel Position</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 xs:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4" data-testid="vessel-position">
              <div>
                <p className="text-xs text-muted-foreground">Latitude</p>
                <p className="font-semibold font-mono">{parseFloat(container.vesselPosition.latitude).toFixed(4)}°</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Longitude</p>
                <p className="font-semibold font-mono">{parseFloat(container.vesselPosition.longitude).toFixed(4)}°</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Speed</p>
                <p className="font-semibold">{parseFloat(container.vesselPosition.speed).toFixed(1)} knots</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Last Updated</p>
                <p className="font-semibold">{formatDate(container.vesselPosition.timestamp)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Rail Segments */}
      {container.railSegments && container.railSegments.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Train className="h-5 w-5" />
              <CardTitle className="text-lg">Rail Segments</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {container.railSegments.map((segment: any) => (
                <div key={segment.id} className="p-3 border rounded-md" data-testid={`rail-segment-${segment.id}`}>
                  <div className="flex items-center justify-between mb-2">
                    <p className="font-semibold">{segment.carrier}</p>
                    <Badge variant={segment.status === "completed" ? "default" : "secondary"}>
                      {segment.status}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-1 xs:grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                    <div>
                      <p className="text-xs text-muted-foreground">Origin</p>
                      <p className="font-semibold">{segment.origin}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Destination</p>
                      <p className="font-semibold">{segment.destination}</p>
                    </div>
                    {segment.trainNumber && (
                      <div>
                        <p className="text-xs text-muted-foreground">Train #</p>
                        <p className="font-semibold font-mono">{segment.trainNumber}</p>
                      </div>
                    )}
                    {segment.estimatedArrival && (
                      <div>
                        <p className="text-xs text-muted-foreground">ETA</p>
                        <p className="font-semibold">{formatDate(segment.estimatedArrival)}</p>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Timeline */}
      {container.timeline && container.timeline.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              <CardTitle className="text-lg">Journey Timeline</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {container.timeline.map((event: any, idx: number) => (
                <div key={event.id} className="flex gap-4" data-testid={`timeline-event-${idx}`}>
                  <div className="flex flex-col items-center">
                    <div className={`h-3 w-3 rounded-full ${event.completed ? "bg-green-600" : event.isCurrent ? "bg-blue-600" : "bg-muted"}`} />
                    {idx < container.timeline.length - 1 && (
                      <div className={`w-0.5 flex-1 mt-1 ${event.completed ? "bg-green-600" : "bg-muted"}`} style={{ minHeight: "2rem" }} />
                    )}
                  </div>
                  <div className="flex-1 pb-4">
                    <p className="font-semibold">{event.title}</p>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                      <MapPin className="h-3 w-3" />
                      <span>{event.location}</span>
                      <span>•</span>
                      <span>{formatDate(event.timestamp)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
