import { useQuery } from "@tanstack/react-query";
import { useRoute, useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Ship, Package } from "lucide-react";
import { ContainerCard } from "@/components/container-card";

interface Vessel {
    id: string;
    name: string;
    tripNumber: string | null;
    destination: string | null;
    eta: string | null;
    atd: string | null;
    containerCount: number;
    shipments: any[];
}

export default function VesselDetail() {
    const [, params] = useRoute("/vessel-dashboard/:id");
    const [, navigate] = useLocation();
    const vesselId = params?.id;

    const { data: vessel, isLoading } = useQuery<Vessel>({
        queryKey: [`/api/vessels/${vesselId}`],
        enabled: !!vesselId,
    });

    const handleViewDetails = (shipmentId: string) => {
        navigate(`/shipments/${shipmentId}`);
    };

    const handleBack = () => {
        navigate("/vessel-dashboard");
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-96">
                <div className="text-center">
                    <Ship className="h-12 w-12 mx-auto text-muted-foreground mb-4 animate-pulse" />
                    <p className="text-lg font-medium">Loading vessel details...</p>
                </div>
            </div>
        );
    }

    if (!vessel) {
        return (
            <div className="flex items-center justify-center h-96">
                <div className="text-center">
                    <Ship className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-lg font-medium">Vessel not found</p>
                    <Button onClick={handleBack} className="mt-4">
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Back to Vessel Dashboard
                    </Button>
                </div>
            </div>
        );
    }

    // Map shipments to container format for ContainerCard
    const containers = (vessel.shipments || []).map((shipment: any) => {
        const rawData = shipment.rawData || {};
        const terminalData = {
            terminalName: rawData.terminalName,
            terminalPort: rawData.terminalPort,
            terminalAvailableForPickup: rawData.terminalAvailableForPickup,
            terminalFullOut: rawData.terminalFullOut,
            terminalEmptyReturned: rawData.terminalEmptyReturned,
            terminalPickupAppointment: rawData.terminalPickupAppointment,
            lastFreeDay: rawData.lastFreeDay,
            demurrage: rawData.demurrage,
            detention: rawData.detention,
        };

        const containersArray = rawData.containers || [];
        const firstContainer = containersArray[0] || {};
        const railData = firstContainer.rawData?.rail || {};

        let terminalStatus: string | undefined = undefined;
        if (terminalData.terminalFullOut) {
            terminalStatus = 'available';
        } else if (terminalData.terminalAvailableForPickup === false) {
            terminalStatus = 'pending';
        } else if (terminalData.terminalAvailableForPickup === true) {
            terminalStatus = 'available';
        }

        const emptyReturned = !!(terminalData.terminalEmptyReturned || railData.emptyReturned);

        return {
            id: shipment.id,
            containerNumber: shipment.containerNumber || shipment.shipmentReference || 'N/A',
            status: shipment.status || 'unknown',
            origin: shipment.originPort || 'Unknown',
            destination: shipment.destinationPort || 'Unknown',
            carrier: shipment.carrier || 'Unknown',
            vesselName: vessel.name,
            bookingNumber: shipment.bookingNumber || '',
            masterBillOfLading: shipment.mblNumber || '',
            weight: '',
            volume: '',
            eta: shipment.eta || '',
            estimatedArrival: shipment.eta || '',
            progress: 50,
            reference: shipment.taiShipmentId || shipment.shipmentReference,
            riskLevel: rawData.riskLevel,
            riskReason: rawData.riskReasons?.join(', '),
            terminalStatus,
            lastFreeDay: terminalData.lastFreeDay || rawData.lastFreeDay,
            demurrageFee: terminalData.demurrage ? parseFloat(terminalData.demurrage) : undefined,
            detentionFee: terminalData.detention ? parseFloat(terminalData.detention) : undefined,
            exceptionCost: undefined,
            terminalData,
            railData,
            emptyReturned,
        };
    });

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Button variant="outline" onClick={handleBack}>
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Back
                    </Button>
                    <div>
                        <h1 className="text-3xl font-bold flex items-center gap-2">
                            <Ship className="h-8 w-8" />
                            {vessel.name}
                        </h1>
                        <p className="text-muted-foreground">
                            {vessel.tripNumber && `Trip ${vessel.tripNumber} • `}
                            {vessel.destination || 'Unknown destination'}
                        </p>
                    </div>
                </div>
            </div>

            {/* Vessel Info Card */}
            <Card>
                <CardHeader>
                    <CardTitle>Vessel Information</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div>
                            <p className="text-sm text-muted-foreground">Trip Number</p>
                            <p className="font-medium">{vessel.tripNumber || '-'}</p>
                        </div>
                        <div>
                            <p className="text-sm text-muted-foreground">Destination</p>
                            <p className="font-medium">{vessel.destination || '-'}</p>
                        </div>
                        <div>
                            <p className="text-sm text-muted-foreground">ETA</p>
                            <p className="font-medium">
                                {vessel.eta ? new Date(vessel.eta).toLocaleDateString() : '-'}
                            </p>
                        </div>
                        <div>
                            <p className="text-sm text-muted-foreground">Total Containers</p>
                            <p className="font-medium text-2xl">{vessel.containerCount}</p>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Containers List */}
            <div>
                <div className="flex items-center gap-2 mb-4">
                    <Package className="h-5 w-5" />
                    <h2 className="text-2xl font-semibold">Containers ({containers.length})</h2>
                </div>

                {containers.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                        {containers.map((container) => (
                            <ContainerCard
                                key={container.id}
                                {...container}
                                onViewDetails={() => handleViewDetails(container.id)}
                            />
                        ))}
                    </div>
                ) : (
                    <Card>
                        <CardContent className="text-center py-12">
                            <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                            <p className="text-lg font-medium">No containers found</p>
                            <p className="text-sm text-muted-foreground mt-1">
                                This vessel has no associated containers
                            </p>
                        </CardContent>
                    </Card>
                )}
            </div>
        </div>
    );
}
