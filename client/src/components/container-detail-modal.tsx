import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ContainerTimeline, TimelineEvent } from "./container-timeline";
import { StatusBadge, ContainerStatus } from "./status-badge";
import { Button } from "@/components/ui/button";
import { Download, Package, Ship, FileText, AlertCircle, MapPin, Train } from "lucide-react";
import { VesselPositionCard } from "./vessel-position-card";
import { ExceptionAlert, ExceptionType } from "./exception-alert";
import { RailTrackingSection } from "./rail-tracking-section";
import { TerminalStatusBadge, TerminalStatus } from "./terminal-status-badge";
import { DemurrageAlert } from "./demurrage-alert";

function convertLbsToKg(weightStr: string): string {
  const lbsMatch = weightStr.match(/([0-9,]+)\s*lbs?/i);
  if (lbsMatch) {
    const lbsValue = parseFloat(lbsMatch[1].replace(/,/g, ''));
    const kgValue = lbsValue * 0.453592;
    return `${kgValue.toLocaleString('en-US', { maximumFractionDigits: 0 })} kg`;
  }
  return weightStr;
}

interface VesselPosition {
  latitude: number;
  longitude: number;
  speed: number;
  course: number;
  timestamp: string;
}

interface Exception {
  type: ExceptionType;
  title: string;
  description: string;
  timestamp: string;
}

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

interface ContainerDetails {
  containerNumber: string;
  status: ContainerStatus;
  origin: string;
  destination: string;
  carrier: string;
  vesselName: string;
  bookingNumber: string;
  masterBillOfLading: string;
  weight: string;
  volume: string;
  timeline: TimelineEvent[];
  vesselPosition?: VesselPosition;
  estimatedArrival: string;
  exceptions?: Exception[];
  railSegments?: RailSegment[];
  terminalStatus?: TerminalStatus;
  lastFreeDay?: string;
  demurrageFee?: number;
}

interface ContainerDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  container: ContainerDetails | null;
}

export function ContainerDetailModal({
  open,
  onOpenChange,
  container,
}: ContainerDetailModalProps) {
  if (!container) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="modal-container-details">
        <DialogHeader>
          <div className="flex flex-col sm:flex-row items-start justify-between gap-3 sm:gap-4">
            <div className="flex-1">
              <DialogTitle className="font-mono text-lg sm:text-xl" data-testid="text-modal-container-number">
                {container.containerNumber}
              </DialogTitle>
              <DialogDescription className="text-xs sm:text-sm text-muted-foreground mt-1">
                {container.origin} → {container.destination}
              </DialogDescription>
            </div>
            <StatusBadge status={container.status} />
          </div>
        </DialogHeader>

        <Tabs defaultValue="overview" className="mt-4">
          <TabsList className="grid w-full grid-cols-5 gap-0.5 sm:gap-1">
            <TabsTrigger value="overview" data-testid="tab-overview" className="text-xs sm:text-sm px-1 sm:px-3" aria-label="Overview">
              <Package className="h-3 w-3 sm:mr-1 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">Overview</span>
            </TabsTrigger>
            <TabsTrigger value="timeline" data-testid="tab-timeline" className="text-xs sm:text-sm px-1 sm:px-3" aria-label="Timeline">
              <Ship className="h-3 w-3 sm:mr-1 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">Timeline</span>
            </TabsTrigger>
            <TabsTrigger value="vessel" data-testid="tab-vessel" className="text-xs sm:text-sm px-1 sm:px-3" aria-label="Vessel">
              <MapPin className="h-3 w-3 sm:mr-1 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">Vessel</span>
            </TabsTrigger>
            <TabsTrigger value="rail" data-testid="tab-rail" className="text-xs sm:text-sm px-1 sm:px-3" aria-label="Rail">
              <Train className="h-3 w-3 sm:mr-1 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">Rail</span>
            </TabsTrigger>
            <TabsTrigger value="documents" data-testid="tab-documents" className="text-xs sm:text-sm px-1 sm:px-3" aria-label="Documents">
              <FileText className="h-3 w-3 sm:mr-1 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">Docs</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            {container.terminalStatus && (
              <div className="flex items-center gap-2">
                <TerminalStatusBadge status={container.terminalStatus} />
              </div>
            )}
            {container.lastFreeDay && (
              <DemurrageAlert
                lastFreeDay={container.lastFreeDay}
                containerNumber={container.containerNumber}
                estimatedFees={container.demurrageFee}
              />
            )}
            {container.exceptions && container.exceptions.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-semibold flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" />
                  Active Exceptions
                </h4>
                {container.exceptions.map((exception, index) => (
                  <ExceptionAlert key={index} {...exception} />
                ))}
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-muted-foreground">Carrier</p>
                <p className="font-medium mt-1">{container.carrier}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Vessel</p>
                <p className="font-medium mt-1">{container.vesselName}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Booking Number</p>
                <p className="font-medium font-mono mt-1">{container.bookingNumber}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Master Bill of Lading</p>
                <p className="font-medium font-mono mt-1">{container.masterBillOfLading}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Weight</p>
                <p className="font-medium mt-1">{convertLbsToKg(container.weight)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Volume</p>
                <p className="font-medium mt-1">{container.volume}</p>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="timeline">
            <ContainerTimeline events={container.timeline} />
          </TabsContent>

          <TabsContent value="vessel" className="space-y-4">
            {container.vesselPosition ? (
              <VesselPositionCard
                vesselName={container.vesselName}
                position={container.vesselPosition}
                estimatedArrival={container.estimatedArrival}
              />
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">
                No vessel position data available
              </p>
            )}
          </TabsContent>

          <TabsContent value="rail" className="space-y-4">
            {container.railSegments && container.railSegments.length > 0 ? (
              <RailTrackingSection segments={container.railSegments} />
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">
                No rail tracking data available
              </p>
            )}
          </TabsContent>

          <TabsContent value="documents" className="space-y-3">
            {["Master Bill of Lading", "Packing List", "Commercial Invoice", "Customs Declaration"].map(
              (doc) => (
                <div
                  key={doc}
                  className="flex items-center justify-between p-3 rounded-md border hover-elevate"
                  data-testid={`document-${doc.toLowerCase().replace(/\s+/g, '-')}`}
                >
                  <div className="flex items-center gap-3">
                    <FileText className="h-5 w-5 text-muted-foreground" />
                    <span className="text-sm font-medium">{doc}</span>
                  </div>
                  <Button variant="ghost" size="sm" data-testid={`button-download-${doc.toLowerCase().replace(/\s+/g, '-')}`}>
                    <Download className="h-4 w-4" />
                  </Button>
                </div>
              )
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
