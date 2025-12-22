import { storage } from "../storage.js";
import { CargoesFlowRiskAssessmentService } from "./cargoes-flow-risk-assessment.js";

const CARGOES_FLOW_API_URL = "https://connect.cargoes.com/flow/api/public_tracking/v1/shipments";
const CARGOES_FLOW_API_KEY = "dL6SngaHRXZfvzGA716lioRD7ZsRC9hs";
const CARGOES_FLOW_ORG_TOKEN = "V904eqatVp49P7FZuwEtoFg72TJDyFnb";

const POLL_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

interface CargoesFlowShipmentData {
  shipmentNumber?: string | number;
  referenceNumber?: string;
  blNumber?: string; // Bill of Lading (can be MBL)
  mblNumber?: string;
  containerNumber?: string;
  bookingNumber?: string;
  shipper?: string;
  consignee?: string;
  originPort?: string;
  destinationPort?: string;
  etd?: string;
  eta?: string;
  promisedEtd?: string;
  promisedEta?: string;
  status?: string;
  subStatus1?: string;
  subStatus2?: string;
  carrier?: string;
  carrierScac?: string;
  vesselName?: string;
  voyageNumber?: string;
  containerType?: string;
  containerSize?: string;
  currentLocationName?: string;
  currentLocation?: string;
  destinationOceanPort?: string;
  originOceanPort?: string;
  shippingMode?: string; // LTL, FCL, etc.
  serviceMode?: string; // MILK RUN, PORT_TO_PORT, etc.
  totalWeight?: number;
  totalWeightUom?: string;
  totalVolume?: number;
  totalVolumeUom?: string;
  commodity?: string;
  shipmentEvents?: any[];
  shipmentLegs?: any;
  shipmentTags?: any[];
  [key: string]: any;
}

// API returns an array directly, not an object with shipments property
type CargoesFlowApiResponse = CargoesFlowShipmentData[];

let pollingInterval: NodeJS.Timeout | null = null;
let isPolling = false; // Prevent concurrent polls
let lastPollStartTime: number = 0;
const POLL_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes timeout for stuck polls

async function fetchShipmentsFromCargoesFlow(): Promise<CargoesFlowShipmentData[] | null> {
  try {
    let allShipments: CargoesFlowShipmentData[] = [];
    const seenShipmentIds = new Set<string>();
    let page = 1;
    let hasMorePages = true;
    const limit = 100; // Request 100 per page
    const MAX_PAGES = 20; // Safety limit: max 2,000 shipments (20 pages × 100)

    while (hasMorePages && page <= MAX_PAGES) {
      const timestamp = Date.now();
      const url = `${CARGOES_FLOW_API_URL}?shipmentType=INTERMODAL_SHIPMENT&status=ACTIVE&_page=${page}&_limit=${limit}&_t=${timestamp}`;

      console.log(`[Cargoes Flow Poller] Fetching page ${page}: ${url}`);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000); // 60s timeout per page

      let response;
      try {
        response = await fetch(url, {
          method: 'GET',
          headers: {
            'X-DPW-ApiKey': CARGOES_FLOW_API_KEY,
            'X-DPW-Org-Token': CARGOES_FLOW_ORG_TOKEN,
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache',
          },
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
      } catch (error: any) {
        clearTimeout(timeoutId);
        if (error.name === 'AbortError') {
          throw new Error(`Request timed out for page ${page}`);
        }
        throw error;
      }

      console.log(`[Cargoes Flow Poller] Response status: ${response.status}`);

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[Cargoes Flow Poller] API error on page ${page} (${response.status}):`, errorText);
        break;
      }

      const data: CargoesFlowApiResponse = await response.json();

      console.log(`[Cargoes Flow Poller] Received ${Array.isArray(data) ? data.length : 'non-array'} shipments on page ${page}`);

      if (!Array.isArray(data) || data.length === 0) {
        console.log(`[Cargoes Flow Poller] No more data on page ${page}, stopping pagination`);
        hasMorePages = false;
        break;
      }

      // Filter out duplicates
      let newShipments = 0;
      for (const shipment of data) {
        const shipmentId = String(shipment.shipmentNumber || shipment.referenceNumber || '');
        if (shipmentId && !seenShipmentIds.has(shipmentId)) {
          seenShipmentIds.add(shipmentId);
          allShipments.push(shipment);
          newShipments++;
        }
      }

      // If we got fewer shipments than the limit, we've reached the last page
      if (data.length < limit) {
        hasMorePages = false;
      } else {
        page++;
      }
    }

    if (page > MAX_PAGES) {
      console.warn(`[Cargoes Flow Poller] ⚠️ Reached safety limit of ${MAX_PAGES} pages`);
    }

    console.log(`[Cargoes Flow Poller] ✅ Fetched ${allShipments.length} shipments (${page} pages)`);
    return allShipments;
  } catch (error: any) {
    console.error('[Cargoes Flow Poller] Error:', error.message);
    return null; // Return null to indicate failure, distinguishing from empty result
  }
}

export async function fetchCompletedShipment(shipmentReference: string): Promise<CargoesFlowShipmentData | null> {
  try {
    const timestamp = Date.now();

    // Strategy 1: Search with status=COMPLETED
    let url = `${CARGOES_FLOW_API_URL}?shipmentType=INTERMODAL_SHIPMENT&status=COMPLETED&search=${encodeURIComponent(shipmentReference)}&_t=${timestamp}`;
    console.log(`[Cargoes Flow Poller] 🔍 Strategy 1: Fetching with status=COMPLETED: ${shipmentReference}`);

    let response = await fetch(url, {
      method: 'GET',
      headers: {
        'X-DPW-ApiKey': CARGOES_FLOW_API_KEY,
        'X-DPW-Org-Token': CARGOES_FLOW_ORG_TOKEN,
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
      },
    });

    if (response.ok) {
      const data: CargoesFlowApiResponse = await response.json();
      if (Array.isArray(data) && data.length > 0) {
        console.log(`[Cargoes Flow Poller] ✅ Found via status=COMPLETED: ${shipmentReference}, status: ${data[0]?.status}`);
        const match = data.find(s =>
          String(s.shipmentNumber).trim().toUpperCase() === shipmentReference.trim().toUpperCase() ||
          String(s.referenceNumber).trim().toUpperCase() === shipmentReference.trim().toUpperCase()
        );
        const result = match;
        if (result) {
          (result as any).originalReference = shipmentReference; // Attach original search term
        }
        return result || null;
      }
    }

    // Strategy 2: Search without status filter (get any status)
    url = `${CARGOES_FLOW_API_URL}?shipmentType=INTERMODAL_SHIPMENT&search=${encodeURIComponent(shipmentReference)}&_t=${timestamp}`;
    console.log(`[Cargoes Flow Poller] 🔍 Strategy 2: Fetching without status filter: ${shipmentReference}`);

    response = await fetch(url, {
      method: 'GET',
      headers: {
        'X-DPW-ApiKey': CARGOES_FLOW_API_KEY,
        'X-DPW-Org-Token': CARGOES_FLOW_ORG_TOKEN,
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
      },
    });

    if (response.ok) {
      const data: CargoesFlowApiResponse = await response.json();
      if (Array.isArray(data) && data.length > 0) {
        console.log(`[Cargoes Flow Poller] ✅ Found without status filter: ${shipmentReference}, status: ${data[0]?.status}`);
        const match = data.find(s =>
          String(s.shipmentNumber).trim().toUpperCase() === shipmentReference.trim().toUpperCase() ||
          String(s.referenceNumber).trim().toUpperCase() === shipmentReference.trim().toUpperCase()
        );
        const result = match;
        if (result) {
          (result as any).originalReference = shipmentReference; // Attach original search term
        }
        return result || null;
      }
    }

    console.log(`[Cargoes Flow Poller] ⚠️ No shipment found for ${shipmentReference} (tried both strategies)`);
    return null;
  } catch (error: any) {
    console.error(`[Cargoes Flow Poller] Error fetching completed shipment ${shipmentReference}:`, error.message);
    return null;
  }
}

async function processAndStoreShipmentsWithStats(shipments: CargoesFlowShipmentData[]) {
  let newCount = 0;
  let updatedCount = 0;
  let errorCount = 0;
  let skippedCount = 0;

  console.log(`[Cargoes Flow Poller] 🔄 Processing ${shipments.length} shipments...`);

  for (let i = 0; i < shipments.length; i++) {
    const shipment = shipments[i];
    try {
      if (i < 3) { // Log first 3 shipments for debugging
        console.log(`[Cargoes Flow Poller] Processing shipment ${i + 1}:`, {
          shipmentNumber: shipment.shipmentNumber,
          referenceNumber: shipment.referenceNumber,
          mblNumber: shipment.mblNumber,
          containerNumber: shipment.containerNumber
        });
      }
      // Use originalReference (search term) if available to ensure we match the record we looked for
      let shipmentRef = String(shipment.shipmentNumber || shipment.referenceNumber || '');
      if ((shipment as any).originalReference) {
        shipmentRef = (shipment as any).originalReference;
      }

      if (!shipmentRef) {
        console.warn('[Cargoes Flow Poller] Skipping shipment without shipmentNumber or referenceNumber:', shipment);
        skippedCount++;
        continue;
      }

      // Extract carrier name from carrierScac if carrier is null
      const carrierName = shipment.carrier || shipment.carrierScac || null;

      // Handle different shipment types (INTERMODAL vs AIR/ROAD)
      const mblNumber = shipment.mblNumber || shipment.blNumber || null;
      const originPort = shipment.originOceanPort || shipment.originPort || extractOriginFromLegs(shipment.shipmentLegs);
      const destinationPort = shipment.destinationOceanPort || shipment.destinationPort || extractDestinationFromLegs(shipment.shipmentLegs);
      const etd = shipment.etd || shipment.promisedEtd || extractEtdFromLegs(shipment.shipmentLegs);
      const eta = shipment.eta || shipment.promisedEta || extractEtaFromLegs(shipment.shipmentLegs);
      const atd = extractAtdFromEvents(shipment.shipmentEvents, originPort);
      const ata = extractAtaFromEvents(shipment.shipmentEvents, destinationPort);

      // Look up TAI shipment ID, office, and salesRepNames by container number first, then by MBL
      let taiShipmentId: string | null = null;
      let office: string | null = null;
      let salesRepNames: string[] | null = null;
      let containerTmsReference: string | null = null;

      // First try to find by container number (more specific)
      if (shipment.containerNumber) {
        const containerPost = await storage.getCargoesFlowPostByContainer(shipment.containerNumber);
        if (containerPost) {
          containerTmsReference = containerPost.taiShipmentId;
          taiShipmentId = containerPost.taiShipmentId;
          office = containerPost.office;
          salesRepNames = containerPost.salesRepNames;

          if (i < 3) {
            console.log(`[Cargoes Flow Poller] Found TMS reference for container ${shipment.containerNumber}: ${containerTmsReference}`);
          }
        }
      }

      // If not found by container, fallback to MBL lookup
      if (!taiShipmentId && mblNumber) {
        const cargoesFlowPost = await storage.getCargoesFlowPostByMbl(mblNumber);
        if (cargoesFlowPost) {
          taiShipmentId = cargoesFlowPost.taiShipmentId;
          office = cargoesFlowPost.office;
          salesRepNames = cargoesFlowPost.salesRepNames;
        }
      }

      // Fallback: Check manual shipments for Office if not found
      if (!office && mblNumber) {
        const manualShipment = await storage.getShipmentByMbl(mblNumber);
        if (manualShipment && manualShipment.officeName) {
          office = manualShipment.officeName;
        }
      }

      // Fallback: Check customer object in shipment data
      if (!office && (shipment as any).customer) {
        const customer = (shipment as any).customer;
        if (customer.office) office = customer.office;
        else if (customer.officeName) office = customer.officeName;
      }

      // Try multiple lookup strategies to find the correct existing shipment
      let existing = await storage.getCargoesFlowShipmentByReference(shipmentRef);
      if (!existing && shipment.containerNumber) {
        existing = await storage.getCargoesFlowShipmentByContainer(shipment.containerNumber);
      }

      if (i < 3) {
        console.log(`[Cargoes Flow Poller] Shipment ${shipmentRef}: existing=${!!existing ? 'YES' : 'NO'}, container=${shipment.containerNumber}`);
      }

      // Collect data from members of same MBL group for merging
      let allMblShipments: any[] = [];
      if (mblNumber) {
        allMblShipments = await storage.getAllCargoesFlowShipmentsByMbl(mblNumber);
      }

      // Merge rawData: preserve manually added fields (terminal, rail) from existing, update with new API data
      let mergedRawData: any = { ...shipment };

      if (mblNumber && allMblShipments.length > 0) {
        // Collect terminal and rail data from ALL shipments with same MBL
        for (const mblShipment of allMblShipments) {
          if (mblShipment.rawData) {
            const mblRawData = mblShipment.rawData as any;
            if (mblRawData.terminalName) mergedRawData.terminalName = mblRawData.terminalName;
            if (mblRawData.terminalPort) mergedRawData.terminalPort = mblRawData.terminalPort;
            if (mblRawData.terminalYardLocation) mergedRawData.terminalYardLocation = mblRawData.terminalYardLocation;
            if (mblRawData.terminalPickupChassis) mergedRawData.terminalPickupChassis = mblRawData.terminalPickupChassis;
            if (mblRawData.terminalFullOut) mergedRawData.terminalFullOut = mblRawData.terminalFullOut;
            if (mblRawData.terminalOnRail) mergedRawData.terminalOnRail = mblRawData.terminalOnRail;
            if (mblRawData.terminalPickupAppointment) mergedRawData.terminalPickupAppointment = mblRawData.terminalPickupAppointment;
            if (mblRawData.terminalEmptyReturned) mergedRawData.terminalEmptyReturned = mblRawData.terminalEmptyReturned;
            if (mblRawData.terminalAvailableForPickup !== undefined) mergedRawData.terminalAvailableForPickup = mblRawData.terminalAvailableForPickup;
            if (mblRawData.demurrage) mergedRawData.demurrage = mblRawData.demurrage;
            if (mblRawData.detention) mergedRawData.detention = mblRawData.detention;
            if (mblRawData.lastFreeDay) mergedRawData.lastFreeDay = mblRawData.lastFreeDay;
            if (mblRawData.terminalLastFreeDay) mergedRawData.terminalLastFreeDay = mblRawData.terminalLastFreeDay;
            if (mblRawData.terminalDemurrage) mergedRawData.terminalDemurrage = mblRawData.terminalDemurrage;
          }
        }

        // Aggregate containers from all related records
        const allExistingContainers: any[] = [];
        for (const mblShipment of allMblShipments) {
          if (mblShipment.rawData?.containers && Array.isArray(mblShipment.rawData.containers)) {
            allExistingContainers.push(...mblShipment.rawData.containers);
          }
        }

        if (allExistingContainers.length > 0) {
          const containersMap = new Map<string, any>();
          allExistingContainers.forEach((c: any) => {
            if (c.containerNumber) {
              const normalizedNum = String(c.containerNumber).trim().toUpperCase();
              const existingMapping = containersMap.get(normalizedNum);
              if (existingMapping) {
                containersMap.set(normalizedNum, {
                  ...existingMapping,
                  ...c,
                  rawData: c.rawData || existingMapping.rawData,
                });
              } else {
                containersMap.set(normalizedNum, c);
              }
            }
          });

          const apiContainerNumber = shipment.containerNumber;
          const apiContainers = shipment.containers || (apiContainerNumber ? [{ containerNumber: apiContainerNumber }] : []);
          const mergedContainers: any[] = [];

          containersMap.forEach((container) => {
            mergedContainers.push(container);
          });

          apiContainers.forEach((apiContainer: any) => {
            const apiNormalizedNum = apiContainer.containerNumber ? String(apiContainer.containerNumber).trim().toUpperCase() : '';
            if (!apiNormalizedNum) return;

            const existingIndex = mergedContainers.findIndex((c: any) =>
              (c.containerNumber ? String(c.containerNumber).trim().toUpperCase() : '') === apiNormalizedNum
            );

            if (existingIndex >= 0) {
              const existingRawData = mergedContainers[existingIndex].rawData;
              mergedContainers[existingIndex] = {
                ...mergedContainers[existingIndex],
                ...apiContainer,
                rawData: existingRawData || mergedContainers[existingIndex].rawData || apiContainer.rawData,
              };
            } else {
              mergedContainers.push(apiContainer);
            }
          });

          for (const container of mergedContainers) {
            if (container.containerNumber && !container.tmsReference) {
              const containerPost = await storage.getCargoesFlowPostByContainer(container.containerNumber);
              if (containerPost && containerPost.taiShipmentId) {
                container.tmsReference = containerPost.taiShipmentId;
              }
            }
          }
          mergedRawData.containers = mergedContainers;
        } else if (shipment.containerNumber) {
          mergedRawData.containers = [{
            containerNumber: shipment.containerNumber,
            tmsReference: containerTmsReference
          }];
        }
      } else if (existing && existing.rawData) {
        const existingRawData = existing.rawData as any;
        if (existingRawData.terminalName) mergedRawData.terminalName = existingRawData.terminalName;
        if (existingRawData.terminalPort) mergedRawData.terminalPort = existingRawData.terminalPort;
        if (existingRawData.terminalAvailableForPickup !== undefined) mergedRawData.terminalAvailableForPickup = existingRawData.terminalAvailableForPickup;

        if (existingRawData.containers && Array.isArray(existingRawData.containers)) {
          const containersMap = new Map<string, any>();
          existingRawData.containers.forEach((c: any) => {
            if (c.containerNumber) {
              const normalizedNum = String(c.containerNumber).trim().toUpperCase();
              if (!containersMap.has(normalizedNum)) containersMap.set(normalizedNum, c);
            }
          });

          const apiContainerNumber = shipment.containerNumber;
          const apiNormalizedNum = apiContainerNumber ? String(apiContainerNumber).trim().toUpperCase() : null;

          mergedRawData.containers = Array.from(containersMap.values()).map((c: any) => {
            const cNormalizedNum = String(c.containerNumber || '').trim().toUpperCase();
            if (apiNormalizedNum && cNormalizedNum === apiNormalizedNum && containerTmsReference) {
              return { ...c, tmsReference: containerTmsReference };
            }
            return c;
          });

          if (apiNormalizedNum && !containersMap.has(apiNormalizedNum)) {
            mergedRawData.containers.push({
              containerNumber: apiContainerNumber,
              tmsReference: containerTmsReference
            });
          }
        } else if (shipment.containerNumber) {
          mergedRawData.containers = [{
            containerNumber: shipment.containerNumber,
            tmsReference: containerTmsReference
          }];
        }
      }

      if (existing) {
        let newStatus = shipment.status || null;
        if (existing.status === 'COMPLETED' && newStatus && newStatus !== 'COMPLETED') {
          console.log(`[Cargoes Flow Poller] 🛡️ Preventing revert of COMPLETED shipment ${shipmentRef} to ${newStatus}`);
          newStatus = 'COMPLETED';
        }

        const updateData = {
          shipmentReference: shipmentRef,
          taiShipmentId,
          mblNumber,
          containerNumber: shipment.containerNumber || null,
          bookingNumber: shipment.bookingNumber || null,
          shipper: shipment.shipper || null,
          consignee: shipment.consignee || null,
          originPort,
          destinationPort,
          etd,
          eta,
          atd,
          ata,
          status: newStatus,
          carrier: carrierName,
          vesselName: shipment.vesselName || null,
          voyageNumber: shipment.voyageNumber || null,
          containerType: shipment.containerSize || shipment.containerType || null,
          office: office || existing.office,
          salesRepNames: salesRepNames || existing.salesRepNames,
          rawData: mergedRawData,
          lastFetchedAt: new Date(),
        };

        await storage.updateCargoesFlowShipment(existing.id, updateData);

        // Sync other MBL shipments for data consistency
        if (mblNumber && allMblShipments.length > 1) {
          for (const mblShipment of allMblShipments) {
            if (mblShipment.id !== existing.id) {
              const otherMblRawData = (mblShipment.rawData as any) || {};
              const otherMblMergedRawData = {
                ...otherMblRawData,
                terminalName: mergedRawData.terminalName || otherMblRawData.terminalName,
                terminalPort: mergedRawData.terminalPort || otherMblRawData.terminalPort,
                terminalAvailableForPickup: mergedRawData.terminalAvailableForPickup !== undefined ? mergedRawData.terminalAvailableForPickup : otherMblRawData.terminalAvailableForPickup,
                containers: mergedRawData.containers || otherMblRawData.containers,
              };

              await storage.updateCargoesFlowShipment(mblShipment.id, {
                status: shipment.status || null,
                rawData: otherMblMergedRawData,
                lastFetchedAt: new Date(),
              });
            }
          }
        }

        // Sync linked containers by reference
        if (shipmentRef) {
          const allRefShipments = await storage.getAllCargoesFlowShipmentsByReference(shipmentRef);
          if (allRefShipments && allRefShipments.length > 0) {
            for (const refShipment of allRefShipments) {
              if (refShipment.id !== existing.id) {
                await storage.updateCargoesFlowShipment(refShipment.id, {
                  status: shipment.status || null,
                  lastFetchedAt: new Date()
                });
              }
            }
          }
        }
        updatedCount++;
      } else {
        // Create new
        await storage.upsertCargoesFlowShipment({
          shipmentReference: shipmentRef,
          taiShipmentId,
          mblNumber,
          containerNumber: shipment.containerNumber || null,
          bookingNumber: shipment.bookingNumber || null,
          shipper: shipment.shipper || null,
          consignee: shipment.consignee || null,
          originPort,
          destinationPort,
          etd,
          eta,
          atd,
          ata,
          status: shipment.status || null,
          carrier: carrierName,
          vesselName: shipment.vesselName || null,
          voyageNumber: shipment.voyageNumber || null,
          containerType: shipment.containerSize || shipment.containerType || null,
          office,
          salesRepNames,
          rawData: mergedRawData,
        });
        newCount++;
      }

      // Vessel info extraction
      try {
        const vesselInfo = extractLastVesselForDestination(shipment, destinationPort);
        if (vesselInfo) {
          await storage.upsertVessel({
            name: vesselInfo.vesselName,
            tripNumber: vesselInfo.tripNumber,
            destination: destinationPort,
            eta: vesselInfo.eta,
            atd: vesselInfo.atd,
          });
        }
      } catch (vesselError: any) {
        // Error extracting vessel is non-fatal
      }
    } catch (error: any) {
      console.error(`[Cargoes Flow Poller] ❌ Error processing shipment:`, error.message);
      errorCount++;
    }
  }

  console.log(`[Cargoes Flow Poller] 📈 Final stats: ${newCount} new, ${updatedCount} updated, ${errorCount} errors, ${skippedCount} skipped`);
  return { newCount, updatedCount, errorCount };
}

async function pollShipments() {
  if (isPolling) return null;
  isPolling = true;
  lastPollStartTime = Date.now();
  const startTime = lastPollStartTime;
  let syncLog;

  try {
    const shipments = await fetchShipmentsFromCargoesFlow();
    if (shipments === null) throw new Error('Failed to fetch shipments');

    let newCount = 0;
    let updatedCount = 0;

    if (shipments.length > 0) {
      const stats = await processAndStoreShipmentsWithStats(shipments);
      newCount = stats.newCount;
      updatedCount = stats.updatedCount;
    }

    const syncDuration = Date.now() - startTime;
    syncLog = await storage.createCargoesFlowSyncLog({
      status: 'success',
      shipmentsProcessed: shipments.length,
      shipmentsCreated: newCount,
      shipmentsUpdated: updatedCount,
      syncDurationMs: syncDuration,
      metadata: { totalFetched: shipments.length, timestamp: new Date().toISOString() },
    });

    try {
      const riskService = new CargoesFlowRiskAssessmentService(storage);
      await riskService.assessAllShipments();
    } catch (e) { }
  } catch (error: any) {
    console.error('[Cargoes Flow Poller] Poll failed:', error.message);
    const syncDuration = Date.now() - startTime;
    syncLog = await storage.createCargoesFlowSyncLog({
      status: 'error',
      shipmentsProcessed: 0,
      shipmentsCreated: 0,
      shipmentsUpdated: 0,
      errorMessage: error.message,
      syncDurationMs: syncDuration,
      metadata: { error: error.message, timestamp: new Date().toISOString() },
    });
  } finally {
    isPolling = false;
  }
  return syncLog;
}

export function startPolling() {
  if (pollingInterval) clearInterval(pollingInterval);
  pollShipments();
  pollingInterval = setInterval(pollShipments, POLL_INTERVAL_MS);
}

export function stopPolling() {
  if (pollingInterval) {
    clearInterval(pollingInterval);
    pollingInterval = null;
  }
}

function extractLastVesselForDestination(shipment: any, destination: string | null): { vesselName: string; tripNumber: string | null; eta: string | null; atd: string | null } | null {
  if (!shipment.shipmentLegs?.portToPort?.segments || !destination) return null;
  const segments = shipment.shipmentLegs.portToPort.segments;
  for (let i = segments.length - 1; i >= 0; i--) {
    const segment = segments[i];
    if (segment.transportMode === 'VESSEL' && segment.transportName) {
      const segmentDest = segment.destination || segment.destinationPortCode;
      if (segmentDest && segmentDest.toLowerCase().includes(destination.toLowerCase())) {
        return { vesselName: segment.transportName, tripNumber: segment.tripNumber || null, eta: segment.eta || null, atd: segment.atd || null };
      }
    }
  }
  return null;
}

function extractAtdFromEvents(shipmentEvents: any[], originPort: string | null): string | null {
  if (!shipmentEvents || !Array.isArray(shipmentEvents)) return null;
  for (const event of shipmentEvents) {
    if ((event.code === 'vesselDeparture' || event.code === 'vesselDepartureWithContainer') && event.actualTime) {
      if (originPort && event.location) {
        if (event.location.toLowerCase().includes(originPort.toLowerCase()) || originPort.toLowerCase().includes(event.location.toLowerCase()) || event.locationRole === 'originPort') return event.actualTime;
      } else return event.actualTime;
    }
  }
  return null;
}

function extractAtaFromEvents(shipmentEvents: any[], destinationPort: string | null): string | null {
  if (!shipmentEvents || !Array.isArray(shipmentEvents)) return null;
  for (const event of shipmentEvents) {
    if ((event.code === 'vesselArrival' || event.code === 'vesselArrivalWithContainer' || event.code === 'dischargeFromVessel') && event.actualTime) {
      if (destinationPort && event.location) {
        if (event.location.toLowerCase().includes(destinationPort.toLowerCase()) || destinationPort.toLowerCase().includes(event.location.toLowerCase()) || event.locationRole === 'destinationPort') return event.actualTime;
      }
    }
  }
  return null;
}

function extractOriginFromLegs(shipmentLegs: any): string | null {
  if (!shipmentLegs) return null;
  if (shipmentLegs.portToPort?.firstPort) return shipmentLegs.portToPort.firstPort;
  if (shipmentLegs.portToPort?.loadingPort) return shipmentLegs.portToPort.loadingPort;
  if (shipmentLegs.road?.origin) return shipmentLegs.road.origin;
  return null;
}

function extractDestinationFromLegs(shipmentLegs: any): string | null {
  if (!shipmentLegs) return null;
  if (shipmentLegs.portToPort?.lastPort) return shipmentLegs.portToPort.lastPort;
  if (shipmentLegs.portToPort?.dischargePort) return shipmentLegs.portToPort.dischargePort;
  if (shipmentLegs.road?.destination) return shipmentLegs.road.destination;
  return null;
}

function extractEtdFromLegs(shipmentLegs: any): string | null {
  if (!shipmentLegs) return null;
  if (shipmentLegs.portToPort?.firstPortEtd) return shipmentLegs.portToPort.firstPortEtd;
  if (shipmentLegs.portToPort?.firstPortAtd) return shipmentLegs.portToPort.firstPortAtd;
  if (shipmentLegs.road?.etd) return shipmentLegs.road.etd;
  return null;
}

function extractEtaFromLegs(shipmentLegs: any): string | null {
  if (!shipmentLegs) return null;
  if (shipmentLegs.portToPort?.lastPortEta) return shipmentLegs.portToPort.lastPortEta;
  if (shipmentLegs.portToPort?.lastPortAta) return shipmentLegs.portToPort.lastPortAta;
  if (shipmentLegs.road?.eta) return shipmentLegs.road.eta;
  return null;
}

export async function triggerManualPoll() {
  if (isPolling && (Date.now() - lastPollStartTime > POLL_TIMEOUT_MS)) isPolling = false;
  return await pollShipments();
}

export function resetPollingState() {
  isPolling = false;
}

export async function syncCompletedShipments() {
  console.log('[Cargoes Flow Poller] 🔍 Starting completed shipments sync...');
  const startTime = Date.now();

  try {
    const fetchTimeout = new Promise<null>((_, reject) => {
      setTimeout(() => reject(new Error('Fetch active shipments timeout after 2 minutes')), 120000);
    });

    const activeShipments = await Promise.race([
      fetchShipmentsFromCargoesFlow(),
      fetchTimeout
    ]);

    if (activeShipments === null) throw new Error('Failed to fetch active shipments list');

    const activeShipmentRefs = activeShipments
      .map(s => String(s.shipmentNumber || s.referenceNumber || ''))
      .filter(id => id !== '');

    const missingShipments = await storage.findMissingShipmentsFromList(activeShipmentRefs);
    if (missingShipments.length === 0) return await storage.createCargoesFlowSyncLog({ status: 'success', shipmentsProcessed: 0, shipmentsCreated: 0, shipmentsUpdated: 0, syncDurationMs: Date.now() - startTime, metadata: { type: 'completed_sync', message: 'No completed shipments found', timestamp: new Date().toISOString() } });

    const uniqueMissingMap = new Map<string, typeof missingShipments[0]>();
    for (const missing of missingShipments) {
      if (missing.shipmentReference && !uniqueMissingMap.has(missing.shipmentReference)) uniqueMissingMap.set(missing.shipmentReference, missing);
    }
    const uniqueMissingShipments = Array.from(uniqueMissingMap.values());

    for (let i = uniqueMissingShipments.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [uniqueMissingShipments[i], uniqueMissingShipments[j]] = [uniqueMissingShipments[j], uniqueMissingShipments[i]];
    }

    const MAX_SHIPMENTS = 50;
    const shipmentsToProcess = uniqueMissingShipments.slice(0, MAX_SHIPMENTS);
    const BATCH_SIZE = 10;
    const completedShipments: CargoesFlowShipmentData[] = [];
    let fetchErrors = 0;

    for (let i = 0; i < shipmentsToProcess.length; i += BATCH_SIZE) {
      const batch = shipmentsToProcess.slice(i, i + BATCH_SIZE);
      const batchPromises = batch.map(async (missing) => {
        try {
          return await fetchCompletedShipment(missing.shipmentReference);
        } catch (error: any) {
          return null;
        }
      });

      const batchResults = await Promise.all(batchPromises);
      for (const result of batchResults) {
        if (result) completedShipments.push(result);
        else fetchErrors++;
      }
    }

    let newCount = 0;
    let updatedCount = 0;

    if (completedShipments.length > 0) {
      const stats = await processAndStoreShipmentsWithStats(completedShipments);
      newCount = stats.newCount;
      updatedCount = stats.updatedCount;
    }

    return await storage.createCargoesFlowSyncLog({
      status: 'success',
      shipmentsProcessed: completedShipments.length,
      shipmentsCreated: newCount,
      shipmentsUpdated: updatedCount,
      syncDurationMs: Date.now() - startTime,
      metadata: { type: 'completed_sync', totalMissing: missingShipments.length, verified: completedShipments.length, fetchErrors, timestamp: new Date().toISOString() },
    });
  } catch (error: any) {
    console.error('[Cargoes Flow Poller] ❌ Completed shipments sync failed:', error.message);
    return await storage.createCargoesFlowSyncLog({
      status: 'error',
      shipmentsProcessed: 0,
      shipmentsCreated: 0,
      shipmentsUpdated: 0,
      errorMessage: error.message || 'Unknown error',
      syncDurationMs: Date.now() - startTime,
      metadata: { type: 'completed_sync', error: error.message || 'Unknown error', timestamp: new Date().toISOString() },
    });
  }
}
