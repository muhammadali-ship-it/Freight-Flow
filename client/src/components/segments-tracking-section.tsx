import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Truck, Ship, Train, MapPin, Clock, Calendar, ArrowRight, Edit, Package } from "lucide-react";
import { useState } from "react";

interface Segment {
  origin: string;
  destination: string;
  originPortCode?: string | null;
  destinationPortCode?: string | null;
  originTerminalName?: string | null;
  originTerminalCode?: string | null;
  destinationTerminalName?: string | null;
  destinationTerminalCode?: string | null;
  tripNumber?: string | null;
  transportName?: string | null;
  etd?: string | null;
  atd?: string | null;
  eta?: string | null;
  ata?: string | null;
  transportMode: "TRUCK" | "VESSEL" | "RAIL";
  containerNumber?: string | null;
  // Additional fields for manual input
  railNumber?: string | null;
  podRailCarrier?: string | null;
  destinationRailCarrier?: string | null;
  lastFreeDay?: string | null;
  emptyReturned?: string | null;
  fullOut?: string | null;
}

interface SegmentsTrackingSectionProps {
  segments: Segment[];
  containerNumbers?: string[]; // Array of container numbers for this shipment
  onUpdateSegment?: (segmentIndex: number, updates: Partial<Segment>) => void;
}

const getTransportIcon = (mode: string) => {
  switch (mode) {
    case "TRUCK":
      return <Truck className="h-4 w-4" />;
    case "VESSEL":
      return <Ship className="h-4 w-4" />;
    case "RAIL":
      return <Train className="h-4 w-4" />;
    default:
      return <MapPin className="h-4 w-4" />;
  }
};

const getTransportColor = (mode: string) => {
  switch (mode) {
    case "TRUCK":
      return "bg-orange-500";
    case "VESSEL":
      return "bg-blue-500";
    case "RAIL":
      return "bg-green-500";
    default:
      return "bg-gray-500";
  }
};

const getTransportBadgeVariant = (mode: string) => {
  switch (mode) {
    case "TRUCK":
      return "default";
    case "VESSEL":
      return "secondary";
    case "RAIL":
      return "default"; // Make rail more prominent
    default:
      return "outline";
  }
};

const formatDateTime = (dateString?: string | null) => {
  if (!dateString) return null;
  try {
    return new Date(dateString).toLocaleString();
  } catch {
    return dateString;
  }
};

// Segment Edit Dialog Component
function SegmentEditDialog({ 
  segment, 
  segmentIndex, 
  containerNumbers = [],
  onSave 
}: { 
  segment: Segment; 
  segmentIndex: number; 
  containerNumbers: string[];
  onSave: (updates: Partial<Segment>) => void;
}) {
  const [formData, setFormData] = useState({
    railNumber: segment.railNumber || '',
    podRailCarrier: segment.podRailCarrier || '',
    destinationRailCarrier: segment.destinationRailCarrier || '',
    lastFreeDay: segment.lastFreeDay || '',
    emptyReturned: segment.emptyReturned || '',
    fullOut: segment.fullOut || '',
  });

  const handleSave = () => {
    onSave(formData);
  };

  return (
    <DialogContent className="max-w-2xl">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <Edit className="h-5 w-5" />
          Edit {segment.transportMode} Segment: {segment.origin} → {segment.destination}
        </DialogTitle>
      </DialogHeader>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
        {/* Container Number - Display only (automatic from API) */}
        {segment.containerNumber && (
          <div className="md:col-span-2 p-3 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-2">
              <Package className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Container: {segment.containerNumber}</span>
              <Badge variant="outline" className="text-xs">Automatic</Badge>
            </div>
          </div>
        )}

        {/* Rail-specific fields */}
        {segment.transportMode === 'RAIL' && (
          <>
            <div className="space-y-2">
              <Label htmlFor="railNumber">Rail Number</Label>
              <Input
                id="railNumber"
                value={formData.railNumber}
                onChange={(e) => setFormData(prev => ({ ...prev, railNumber: e.target.value }))}
                placeholder="Enter rail number"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="podRailCarrier">POD Rail Carrier</Label>
              <Input
                id="podRailCarrier"
                value={formData.podRailCarrier}
                onChange={(e) => setFormData(prev => ({ ...prev, podRailCarrier: e.target.value }))}
                placeholder="Enter POD rail carrier"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="destinationRailCarrier">Destination Rail Carrier</Label>
              <Input
                id="destinationRailCarrier"
                value={formData.destinationRailCarrier}
                onChange={(e) => setFormData(prev => ({ ...prev, destinationRailCarrier: e.target.value }))}
                placeholder="Enter destination rail carrier"
              />
            </div>
          </>
        )}

        {/* Common fields for all transport modes */}
        <div className="space-y-2">
          <Label htmlFor="lastFreeDay">Last Free Day (LFD)</Label>
          <Input
            id="lastFreeDay"
            type="date"
            value={formData.lastFreeDay}
            onChange={(e) => setFormData(prev => ({ ...prev, lastFreeDay: e.target.value }))}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="emptyReturned">Empty Returned</Label>
          <Input
            id="emptyReturned"
            type="datetime-local"
            value={formData.emptyReturned}
            onChange={(e) => setFormData(prev => ({ ...prev, emptyReturned: e.target.value }))}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="fullOut">Full Out</Label>
          <Input
            id="fullOut"
            type="datetime-local"
            value={formData.fullOut}
            onChange={(e) => setFormData(prev => ({ ...prev, fullOut: e.target.value }))}
          />
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={() => {}}>Cancel</Button>
        <Button onClick={handleSave}>Save Changes</Button>
      </div>
    </DialogContent>
  );
}

export function SegmentsTrackingSection({ 
  segments, 
  containerNumbers = [], 
  onUpdateSegment 
}: SegmentsTrackingSectionProps) {
  if (!segments || segments.length === 0) return null;

  // Debug: Log segments to console in development
  if (process.env.NODE_ENV === 'development') {
    console.log('Segments to display:', segments);
    console.log('Rail segments found:', segments.filter(s => s.transportMode === 'RAIL'));
  }

  return (
    <Card data-testid="card-segments-tracking">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-medium flex items-center gap-2">
          <MapPin className="h-5 w-5" />
          Transport Segments ({segments.length})
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Automatic tracking data from CargoesFlow API
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {segments.map((segment, index) => (
          <div key={index} className="relative" data-testid={`segment-${index}`}>
            {/* Transport Mode Header */}
            <div className="flex items-center justify-between gap-3 mb-4">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-full ${getTransportColor(segment.transportMode)} text-white flex-shrink-0`}>
                  {getTransportIcon(segment.transportMode)}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge 
                      variant={getTransportBadgeVariant(segment.transportMode)} 
                      className={`text-xs font-mono ${segment.transportMode === 'RAIL' ? 'bg-green-100 text-green-800 border-green-300' : ''}`}
                    >
                      {segment.transportMode}
                    </Badge>
                    {segment.transportName && (
                      <span className="text-sm font-semibold">{segment.transportName}</span>
                    )}
                    {segment.tripNumber && (
                      <Badge variant="outline" className="text-xs font-mono">
                        Trip: {segment.tripNumber}
                      </Badge>
                    )}
                    {segment.transportMode === 'RAIL' && !segment.transportName && (
                      <span className="text-sm text-muted-foreground italic">Rail Transport</span>
                    )}
                  </div>
                  
                  {/* Container Number Display */}
                  {segment.containerNumber && (
                    <div className="flex items-center gap-1 mt-1">
                      <Package className="h-3 w-3 text-muted-foreground" />
                      <span className="text-xs font-mono text-muted-foreground">
                        Container: {segment.containerNumber}
                      </span>
                    </div>
                  )}
                </div>
              </div>
              
              {/* Edit Button - Only show for RAIL and TRUCK segments */}
              {onUpdateSegment && (segment.transportMode === 'RAIL' || segment.transportMode === 'TRUCK') && (
                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm" className="flex-shrink-0">
                      <Edit className="h-4 w-4 mr-1" />
                      Edit
                    </Button>
                  </DialogTrigger>
                  <SegmentEditDialog
                    segment={segment}
                    segmentIndex={index}
                    containerNumbers={containerNumbers}
                    onSave={(updates) => onUpdateSegment(index, updates)}
                  />
                </Dialog>
              )}
            </div>
            
            {/* Route Information */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-4">
              {/* Origin */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-green-500 flex-shrink-0"></div>
                  <h4 className="font-medium text-sm">Origin</h4>
                </div>
                <div className="ml-5 space-y-1">
                  <p className="font-semibold">{segment.origin}</p>
                  {segment.originPortCode && (
                    <p className="text-xs text-muted-foreground">
                      Port Code: <span className="font-mono">{segment.originPortCode}</span>
                    </p>
                  )}
                  {segment.originTerminalName && (
                    <p className="text-xs text-muted-foreground">
                      Terminal: {segment.originTerminalName}
                    </p>
                  )}
                  {segment.originTerminalCode && (
                    <p className="text-xs text-muted-foreground">
                      Terminal Code: <span className="font-mono">{segment.originTerminalCode}</span>
                    </p>
                  )}
                </div>
              </div>
              
              {/* Destination */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-blue-500 flex-shrink-0"></div>
                  <h4 className="font-medium text-sm">Destination</h4>
                </div>
                <div className="ml-5 space-y-1">
                  <p className="font-semibold">{segment.destination}</p>
                  {segment.destinationPortCode && (
                    <p className="text-xs text-muted-foreground">
                      Port Code: <span className="font-mono">{segment.destinationPortCode}</span>
                    </p>
                  )}
                  {segment.destinationTerminalName && (
                    <p className="text-xs text-muted-foreground">
                      Terminal: {segment.destinationTerminalName}
                    </p>
                  )}
                  {segment.destinationTerminalCode && (
                    <p className="text-xs text-muted-foreground">
                      Terminal Code: <span className="font-mono">{segment.destinationTerminalCode}</span>
                    </p>
                  )}
                </div>
              </div>
            </div>
            
            {/* Timing Information */}
            {(segment.etd || segment.atd || segment.eta || segment.ata) && (
              <div className="bg-muted/30 rounded-lg p-4 mb-4">
                <h5 className="text-sm font-medium mb-3 flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Timing Information
                </h5>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {segment.etd && (
                    <div className="text-center">
                      <p className="text-xs text-muted-foreground flex items-center justify-center gap-1 mb-1">
                        <Calendar className="h-3 w-3" />
                        ETD
                      </p>
                      <p className="text-xs font-mono bg-background px-2 py-1 rounded">
                        {formatDateTime(segment.etd)}
                      </p>
                    </div>
                  )}
                  
                  {segment.atd && (
                    <div className="text-center">
                      <p className="text-xs text-muted-foreground flex items-center justify-center gap-1 mb-1">
                        <Clock className="h-3 w-3" />
                        ATD
                      </p>
                      <p className="text-xs font-mono bg-green-50 text-green-700 px-2 py-1 rounded">
                        {formatDateTime(segment.atd)}
                      </p>
                    </div>
                  )}
                  
                  {segment.eta && (
                    <div className="text-center">
                      <p className="text-xs text-muted-foreground flex items-center justify-center gap-1 mb-1">
                        <Calendar className="h-3 w-3" />
                        ETA
                      </p>
                      <p className="text-xs font-mono bg-background px-2 py-1 rounded">
                        {formatDateTime(segment.eta)}
                      </p>
                    </div>
                  )}
                  
                  {segment.ata && (
                    <div className="text-center">
                      <p className="text-xs text-muted-foreground flex items-center justify-center gap-1 mb-1">
                        <Clock className="h-3 w-3" />
                        ATA
                      </p>
                      <p className="text-xs font-mono bg-blue-50 text-blue-700 px-2 py-1 rounded">
                        {formatDateTime(segment.ata)}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Additional Information (Manual Input Fields) */}
            {(segment.railNumber || segment.podRailCarrier || segment.destinationRailCarrier || 
              segment.lastFreeDay || segment.emptyReturned || segment.fullOut) && (
              <div className="bg-blue-50/50 rounded-lg p-4">
                <h5 className="text-sm font-medium mb-3 flex items-center gap-2">
                  <Edit className="h-4 w-4" />
                  Additional Information
                </h5>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {segment.railNumber && (
                    <div>
                      <p className="text-xs text-muted-foreground">Rail Number</p>
                      <p className="text-sm font-mono">{segment.railNumber}</p>
                    </div>
                  )}
                  {segment.podRailCarrier && (
                    <div>
                      <p className="text-xs text-muted-foreground">POD Rail Carrier</p>
                      <p className="text-sm">{segment.podRailCarrier}</p>
                    </div>
                  )}
                  {segment.destinationRailCarrier && (
                    <div>
                      <p className="text-xs text-muted-foreground">Destination Rail Carrier</p>
                      <p className="text-sm">{segment.destinationRailCarrier}</p>
                    </div>
                  )}
                  {segment.lastFreeDay && (
                    <div>
                      <p className="text-xs text-muted-foreground">Last Free Day</p>
                      <p className="text-sm font-mono">{formatDateTime(segment.lastFreeDay)}</p>
                    </div>
                  )}
                  {segment.emptyReturned && (
                    <div>
                      <p className="text-xs text-muted-foreground">Empty Returned</p>
                      <p className="text-sm font-mono">{formatDateTime(segment.emptyReturned)}</p>
                    </div>
                  )}
                  {segment.fullOut && (
                    <div>
                      <p className="text-xs text-muted-foreground">Full Out</p>
                      <p className="text-sm font-mono">{formatDateTime(segment.fullOut)}</p>
                    </div>
                  )}
                </div>
              </div>
            )}
            
            {/* Connection Arrow */}
            {index < segments.length - 1 && (
              <div className="flex justify-center py-4">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <div className="w-8 h-px bg-border"></div>
                  <ArrowRight className="h-4 w-4" />
                  <div className="w-8 h-px bg-border"></div>
                </div>
              </div>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
