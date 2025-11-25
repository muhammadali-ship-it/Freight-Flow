import { storage } from "./storage.js";

// Helper function to extract vessel information for the last segment matching destination
function extractLastVesselForDestination(shipment: any, destination: string | null): { vesselName: string; tripNumber: string | null; eta: string | null; atd: string | null } | null {
    if (!shipment.rawData?.shipmentLegs?.portToPort?.segments || !destination) {
        return null;
    }

    const segments = shipment.rawData.shipmentLegs.portToPort.segments;

    // Find the last vessel segment that goes to the destination
    for (let i = segments.length - 1; i >= 0; i--) {
        const segment = segments[i];
        if (segment.transportMode === 'VESSEL' &&
            segment.destinationPortCode &&
            segment.transportName) {
            // Check if this segment's destination matches the shipment destination
            const segmentDest = segment.destination || segment.destinationPortCode;
            if (segmentDest && segmentDest.toLowerCase().includes(destination.toLowerCase())) {
                return {
                    vesselName: segment.transportName,
                    tripNumber: segment.tripNumber || null,
                    eta: segment.eta || null,
                    atd: segment.atd || null,
                };
            }
        }
    }

    return null;
}

async function backfillVessels() {
    console.log('[Vessel Backfill] Starting backfill of vessels from existing shipments...');

    try {
        // Get all shipments (paginated to avoid memory issues)
        let page = 1;
        let hasMore = true;
        let totalProcessed = 0;
        let vesselsCreated = 0;

        while (hasMore) {
            console.log(`[Vessel Backfill] Processing page ${page}...`);

            const result = await storage.getCargoesFlowShipments({ page, pageSize: 100 });
            const shipments = result.data;

            if (shipments.length === 0) {
                hasMore = false;
                break;
            }

            for (const shipment of shipments) {
                try {
                    const destinationPort = shipment.destinationPort;
                    const vesselInfo = extractLastVesselForDestination(shipment, destinationPort);

                    if (vesselInfo) {
                        await storage.upsertVessel({
                            name: vesselInfo.vesselName,
                            tripNumber: vesselInfo.tripNumber,
                            destination: destinationPort,
                            eta: vesselInfo.eta,
                            atd: vesselInfo.atd,
                        });
                        vesselsCreated++;
                        console.log(`[Vessel Backfill] ✓ Upserted vessel: ${vesselInfo.vesselName}`);
                    }

                    totalProcessed++;
                } catch (error: any) {
                    console.error(`[Vessel Backfill] Error processing shipment ${shipment.id}:`, error.message);
                }
            }

            // Check if there are more pages
            if (page >= result.pagination.totalPages) {
                hasMore = false;
            } else {
                page++;
            }
        }

        console.log(`[Vessel Backfill] ✅ Backfill complete!`);
        console.log(`[Vessel Backfill] Total shipments processed: ${totalProcessed}`);
        console.log(`[Vessel Backfill] Vessels created/updated: ${vesselsCreated}`);

        process.exit(0);
    } catch (error: any) {
        console.error('[Vessel Backfill] ❌ Backfill failed:', error.message);
        process.exit(1);
    }
}

// Run the backfill
backfillVessels();
