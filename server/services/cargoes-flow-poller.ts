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

async function fetchCompletedShipment(shipmentReference: string): Promise<CargoesFlowShipmentData | null> {
  try {
    const timestamp = Date.now();
    
    // Try multiple strategies to find the completed shipment
    
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
          String(s.shipmentNumber) === shipmentReference ||
          String(s.referenceNumber) === shipmentReference
        );
        return match || data[0];
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
          String(s.shipmentNumber) === shipmentReference ||
          String(s.referenceNumber) === shipmentReference
        );
        return match || data[0];
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
      // Use shipmentNumber as the primary reference (convert to string if number)
      const shipmentRef = String(shipment.shipmentNumber || shipment.referenceNumber || '');

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
      const currentLocation = shipment.currentLocationName || shipment.currentLocation || null;

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

          // Debug log for first few containers
          if (i < 3) {
            console.log(`[Cargoes Flow Poller] Found TMS reference for container ${shipment.containerNumber}: ${containerTmsReference}`);
          }
        } else if (i < 3) {
          console.log(`[Cargoes Flow Poller] No TMS reference found for container ${shipment.containerNumber}`);
        }
      }

      // If not found by container, fallback to MBL lookup
      if (!taiShipmentId && mblNumber) {
        const cargoesFlowPost = await storage.getCargoesFlowPostByMbl(mblNumber);
        if (cargoesFlowPost) {
          taiShipmentId = cargoesFlowPost.taiShipmentId;
          office = cargoesFlowPost.office;
          salesRepNames = cargoesFlowPost.salesRepNames;

          if (i < 3) {
            console.log(`[Cargoes Flow Poller] Using MBL lookup for ${mblNumber}, found TAI ID: ${taiShipmentId}`);
          }
        }
      }

      // Fallback: Check manual shipments for Office if not found
      if (!office && mblNumber) {
        const manualShipment = await storage.getShipmentByMbl(mblNumber);
        if (manualShipment && manualShipment.officeName) {
          office = manualShipment.officeName;
          if (i < 3) {
            console.log(`[Cargoes Flow Poller] Found Office from Manual Shipment MBL ${mblNumber}: ${office}`);
          }
        }
      }

      // Fallback: Check customer object in shipment data
      if (!office && (shipment as any).customer) {
        const customer = (shipment as any).customer;
        if (customer.office) office = customer.office;
        else if (customer.officeName) office = customer.officeName;
      }

      // Get existing shipment to preserve manually added data (rail, terminal info)
      // Try multiple lookup strategies to find the correct shipment
      let existing = await storage.getCargoesFlowShipmentByReference(shipmentRef);

      // If not found by reference, try by container number
      if (!existing && shipment.containerNumber) {
        existing = await storage.getCargoesFlowShipmentByContainer(shipment.containerNumber);
      }


      // Debug: Log first few shipments to see what's happening
      if (i < 3) {
        console.log(`[Cargoes Flow Poller] Shipment ${shipmentRef}: existing=${!!existing ? 'YES' : 'NO'}, container=${shipment.containerNumber}`);
      }


      // For MBL-grouped shipments, collect ALL shipments with same MBL to merge their data
      let allMblShipments: any[] = [];
      if (mblNumber) {
        allMblShipments = await storage.getAllCargoesFlowShipmentsByMbl(mblNumber);
        // If we haven't found existing yet, use one from MBL group
        if (!existing) {
          // Prefer shipment with same container number, otherwise use first one
          if (shipment.containerNumber) {
            existing = allMblShipments.find(s => s.containerNumber === shipment.containerNumber) || allMblShipments[0];
          } else {
            existing = allMblShipments[0];
          }
        }

        // Debug: Log if we found MBL shipments with manual data
        if (allMblShipments.length > 0) {
          const hasTerminalData = allMblShipments.some(s => {
            const rd = (s.rawData as any) || {};
            return rd.terminalName || rd.terminalPort || rd.terminalFullOut;
          });
          const hasRailData = allMblShipments.some(s => {
            const rd = (s.rawData as any) || {};
            return rd.containers && rd.containers.some((c: any) => c.rawData?.rail);
          });
          if (hasTerminalData || hasRailData) {
            console.log(`[Poller] MBL ${mblNumber}: Found ${allMblShipments.length} shipments, terminal=${hasTerminalData}, rail=${hasRailData}`);
          }
        }
      }

      // Merge rawData: preserve manually added fields (terminal, rail) from existing, update with new API data
      let mergedRawData: any = shipment; // Start with fresh API data

      // Collect terminal and rail data from ALL shipments with same MBL (not just one)
      if (mblNumber && allMblShipments.length > 0) {
        // Merge terminal info from all MBL shipments (terminal info is usually at shipment level)
        // CRITICAL: Always preserve manually added terminal data (prioritize existing over API)
        for (const mblShipment of allMblShipments) {
          if (mblShipment.rawData) {
            const mblRawData = mblShipment.rawData as any;
            // Preserve terminal info from any shipment that has it - ALWAYS keep manual data
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

        // Collect all containers with rail data from ALL MBL shipments
        const allExistingContainers: any[] = [];
        for (const mblShipment of allMblShipments) {
          if (mblShipment.rawData) {
            const mblRawData = mblShipment.rawData as any;
            if (mblRawData.containers && Array.isArray(mblRawData.containers)) {
              allExistingContainers.push(...mblRawData.containers);
            }
          }
        }

        if (allExistingContainers.length > 0) {
          // Create a map of existing containers by containerNumber (deduplicate, keep latest)
          const containersMap = new Map<string, any>();
          allExistingContainers.forEach((c: any) => {
            if (c.containerNumber) {
              // If container already exists, merge rawData (rail) if present
              const existing = containersMap.get(c.containerNumber);
              if (existing) {
                containersMap.set(c.containerNumber, {
                  ...existing,
                  ...c,
                  rawData: c.rawData || existing.rawData, // Prefer rail data from current container
                });
              } else {
                containersMap.set(c.containerNumber, c);
              }
            }
          });

          // API might return containers array or just a single containerNumber
          const apiContainerNumber = shipment.containerNumber;
          const apiContainers = shipment.containers || (apiContainerNumber ? [{ containerNumber: apiContainerNumber }] : []);

          // Merge: preserve existing containers with rail data, update with API data
          const mergedContainers: any[] = [];

          // First, add all existing containers (preserving their rail data)
          containersMap.forEach((container) => {
            mergedContainers.push(container);
          });

          // Then, update with API data if containerNumber matches
          apiContainers.forEach((apiContainer: any) => {
            const existingIndex = mergedContainers.findIndex((c: any) =>
              c.containerNumber === apiContainer.containerNumber
            );

            if (existingIndex >= 0) {
              // Container exists - update with API data but preserve rawData (rail)
              const existingRawData = mergedContainers[existingIndex].rawData;
              mergedContainers[existingIndex] = {
                ...mergedContainers[existingIndex], // Keep existing data including rawData
                ...apiContainer, // Update with API data
                rawData: existingRawData || mergedContainers[existingIndex].rawData || apiContainer.rawData, // Always preserve existing rail data
              };
            } else if (apiContainer.containerNumber) {
              // New container from API - add it
              mergedContainers.push(apiContainer);
            }
          });

          // Look up TMS reference for each container in the merged list
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
          // No existing containers array, but we have a containerNumber from API
          mergedRawData.containers = [{
            containerNumber: shipment.containerNumber,
            tmsReference: containerTmsReference
          }];
        }
      } else if (existing && existing.rawData) {
        // No MBL grouping, just use the single existing shipment's data
        const existingRawData = existing.rawData as any;

        // Preserve manually added terminal info
        if (existingRawData.terminalName) mergedRawData.terminalName = existingRawData.terminalName;
        if (existingRawData.terminalPort) mergedRawData.terminalPort = existingRawData.terminalPort;
        if (existingRawData.terminalYardLocation) mergedRawData.terminalYardLocation = existingRawData.terminalYardLocation;
        if (existingRawData.terminalPickupChassis) mergedRawData.terminalPickupChassis = existingRawData.terminalPickupChassis;
        if (existingRawData.terminalFullOut) mergedRawData.terminalFullOut = existingRawData.terminalFullOut;
        if (existingRawData.terminalOnRail) mergedRawData.terminalOnRail = existingRawData.terminalOnRail;
        if (existingRawData.terminalPickupAppointment) mergedRawData.terminalPickupAppointment = existingRawData.terminalPickupAppointment;
        if (existingRawData.terminalEmptyReturned) mergedRawData.terminalEmptyReturned = existingRawData.terminalEmptyReturned;
        if (existingRawData.terminalAvailableForPickup !== undefined) mergedRawData.terminalAvailableForPickup = existingRawData.terminalAvailableForPickup;
        if (existingRawData.demurrage) mergedRawData.demurrage = existingRawData.demurrage;
        if (existingRawData.detention) mergedRawData.detention = existingRawData.detention;
        if (existingRawData.lastFreeDay) mergedRawData.lastFreeDay = existingRawData.lastFreeDay;
        if (existingRawData.terminalLastFreeDay) mergedRawData.terminalLastFreeDay = existingRawData.terminalLastFreeDay;
        if (existingRawData.terminalDemurrage) mergedRawData.terminalDemurrage = existingRawData.terminalDemurrage;

        // Preserve manually added containers array with rail data, but update TMS reference
        if (existingRawData.containers && Array.isArray(existingRawData.containers)) {
          mergedRawData.containers = existingRawData.containers.map((c: any) => {
            // If this is the current container, update its TMS reference
            if (c.containerNumber === shipment.containerNumber && containerTmsReference) {
              return { ...c, tmsReference: containerTmsReference };
            }
            return c;
          });
        } else if (shipment.containerNumber) {
          mergedRawData.containers = [{
            containerNumber: shipment.containerNumber,
            tmsReference: containerTmsReference
          }];
        }
      }

      // If we found an existing shipment, update it directly to preserve its ID
      // Otherwise, use upsert to create a new one
      if (existing) {
        // Update the existing shipment with merged data
        await storage.updateCargoesFlowShipment(existing.id, {
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
          office: office || existing.office,
          salesRepNames: salesRepNames || existing.salesRepNames,
          rawData: mergedRawData,
          lastFetchedAt: new Date(),
        });

        // For MBL-grouped shipments, also update all other shipments with same MBL
        // to ensure terminal and rail data is consistent across all records
        if (mblNumber && allMblShipments.length > 1) {
          for (const mblShipment of allMblShipments) {
            if (mblShipment.id !== existing.id) {
              // Update terminal info and containers in other MBL shipments
              const otherMblRawData = (mblShipment.rawData as any) || {};
              const otherMblMergedRawData = {
                ...otherMblRawData,
                // Update terminal info from merged data (terminal is shared across MBL)
                terminalName: mergedRawData.terminalName || otherMblRawData.terminalName,
                terminalPort: mergedRawData.terminalPort || otherMblRawData.terminalPort,
                terminalYardLocation: mergedRawData.terminalYardLocation || otherMblRawData.terminalYardLocation,
                terminalPickupChassis: mergedRawData.terminalPickupChassis || otherMblRawData.terminalPickupChassis,
                terminalFullOut: mergedRawData.terminalFullOut || otherMblRawData.terminalFullOut,
                terminalPickupAppointment: mergedRawData.terminalPickupAppointment || otherMblRawData.terminalPickupAppointment,
                terminalEmptyReturned: mergedRawData.terminalEmptyReturned || otherMblRawData.terminalEmptyReturned,
                terminalAvailableForPickup: mergedRawData.terminalAvailableForPickup !== undefined ? mergedRawData.terminalAvailableForPickup : otherMblRawData.terminalAvailableForPickup,
                demurrage: mergedRawData.demurrage || otherMblRawData.demurrage,
                detention: mergedRawData.detention || otherMblRawData.detention,
                lastFreeDay: mergedRawData.lastFreeDay || otherMblRawData.lastFreeDay,
                // Use merged containers array (includes all containers with rail data from all MBL shipments)
                containers: mergedRawData.containers || otherMblRawData.containers,
              };

              await storage.updateCargoesFlowShipment(mblShipment.id, {
                status: shipment.status || null, // Also update status for all MBL shipments
                rawData: otherMblMergedRawData,
                lastFetchedAt: new Date(),
              });
            }
          }
        }

        if (i < 3) {
          console.log(`[Cargoes Flow Poller] ✅ Updated shipment ${shipmentRef}`);
        }
        updatedCount++;
      } else {
        // Create new shipment
        if (i < 3) {
          console.log(`[Cargoes Flow Poller] ➕ Creating new shipment ${shipmentRef}`);
        }
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
        if (i < 3) {
          console.log(`[Cargoes Flow Poller] ✅ Created new shipment ${shipmentRef}`);
        }
        newCount++;
      }

      // Extract and store vessel information
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
          if (i < 3) {
            console.log(`[Cargoes Flow Poller] 🚢 Upserted vessel: ${vesselInfo.vesselName}`);
          }
        }
      } catch (vesselError: any) {
        console.error(`[Cargoes Flow Poller] ⚠️ Error upserting vessel for shipment ${shipmentRef}:`, vesselError.message);
      }
    } catch (error: any) {
      console.error(`[Cargoes Flow Poller] ❌ Error processing shipment ${shipment.shipmentNumber || shipment.referenceNumber}:`, error.message);
      if (i < 3) {
        console.error(`[Cargoes Flow Poller] Error details:`, error);
      }
      errorCount++;
    }
  }

  console.log(`[Cargoes Flow Poller] 📈 Final stats: ${newCount} new, ${updatedCount} updated, ${errorCount} errors, ${skippedCount} skipped`);
  console.log(`[Cargoes Flow Poller] 📊 Total processed: ${newCount + updatedCount} out of ${shipments.length} shipments`);
  return { newCount, updatedCount, errorCount };
}

async function pollShipments() {
  // Prevent concurrent polls
  if (isPolling) {
    console.log('[Cargoes Flow Poller] ⏭️ Skipping - previous poll still running');
    return null;
  }

  console.log('[Cargoes Flow Poller] 🔒 Setting isPolling = true');
  isPolling = true;
  lastPollStartTime = Date.now();
  const startTime = lastPollStartTime;
  let syncLog;

  try {
    console.log('[Cargoes Flow Poller] 🚀 Starting sync...');
    const shipments = await fetchShipmentsFromCargoesFlow();

    // If fetch failed (returned null), abort sync to prevent data corruption
    if (shipments === null) {
      throw new Error('Failed to fetch active shipments from Cargoes Flow');
    }

    console.log(`[Cargoes Flow Poller] 📦 Fetched ${shipments.length} shipments from API`);

    let newCount = 0;
    let updatedCount = 0;

    if (shipments.length > 0) {
      console.log('[Cargoes Flow Poller] 💾 Processing and storing shipments...');
      const stats = await processAndStoreShipmentsWithStats(shipments);
      newCount = stats.newCount;
      updatedCount = stats.updatedCount;
      console.log(`[Cargoes Flow Poller] 📊 Processing complete: ${newCount} new, ${updatedCount} updated`);
    } else {
      console.log('[Cargoes Flow Poller] ⚠️ No shipments received from API');
    }

    // --- Completed shipments check is now in a separate function ---
    // See syncCompletedShipments() function below
    // This keeps the main sync fast and prevents timeouts
    // -------------------------------------

    const syncDuration = Date.now() - startTime;
    syncLog = await storage.createCargoesFlowSyncLog({
      status: 'success',
      shipmentsProcessed: shipments.length,
      shipmentsCreated: newCount,
      shipmentsUpdated: updatedCount,
      syncDurationMs: syncDuration,
      metadata: {
        totalFetched: shipments.length,
        timestamp: new Date().toISOString()
      },
    });

    console.log(`[Cargoes Flow Poller] ✅ Sync: ${newCount} new, ${updatedCount} updated`);

    // Run risk assessment after successful sync
    try {
      const riskService = new CargoesFlowRiskAssessmentService(storage);
      await riskService.assessAllShipments();
    } catch (riskError: any) {
      console.error('[Cargoes Flow Poller] Risk assessment failed:', riskError.message);
      // Don't fail the entire sync if risk assessment fails
    }
  } catch (error: any) {
    console.error('[Cargoes Flow Poller] Poll cycle failed:', error.message);

    const syncDuration = Date.now() - startTime;
    syncLog = await storage.createCargoesFlowSyncLog({
      status: 'error',
      shipmentsProcessed: 0,
      shipmentsCreated: 0,
      shipmentsUpdated: 0,
      errorMessage: error.message,
      syncDurationMs: syncDuration,
      metadata: {
        error: error.message,
        timestamp: new Date().toISOString()
      },
    });
  } finally {
    console.log('[Cargoes Flow Poller] 🔓 Setting isPolling = false');
    isPolling = false; // Release the lock
  }

  console.log('[Cargoes Flow Poller] Poll cycle complete');
  return syncLog;
}

export function startPolling() {
  // Stop any existing interval first (important for HMR in development)
  if (pollingInterval) {
    console.log('[Cargoes Flow Poller] Stopping existing poller before restart');
    clearInterval(pollingInterval);
    pollingInterval = null;
  }

  // Run immediately on startup
  pollShipments();

  // Then poll every 5 minutes
  pollingInterval = setInterval(pollShipments, POLL_INTERVAL_MS);
}

export function stopPolling() {
  if (pollingInterval) {
    clearInterval(pollingInterval);
    pollingInterval = null;
  }
}

// Helper function to extract vessel information for the last segment matching destination
function extractLastVesselForDestination(shipment: any, destination: string | null): { vesselName: string; tripNumber: string | null; eta: string | null; atd: string | null } | null {
  if (!shipment.shipmentLegs?.portToPort?.segments || !destination) {
    return null;
  }

  const segments = shipment.shipmentLegs.portToPort.segments;

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

// Helper functions to extract actual times from shipment events
function extractAtdFromEvents(shipmentEvents: any[], originPort: string | null): string | null {
  if (!shipmentEvents || !Array.isArray(shipmentEvents)) return null;

  // Look for vessel departure events with actual time at origin port
  for (const event of shipmentEvents) {
    if ((event.code === 'vesselDeparture' || event.code === 'vesselDepartureWithContainer') && event.actualTime) {
      // Check if this is at the origin port
      if (originPort && event.location) {
        const isAtOrigin =
          event.location.toLowerCase().includes(originPort.toLowerCase()) ||
          originPort.toLowerCase().includes(event.location.toLowerCase()) ||
          event.locationRole === 'originPort';

        if (isAtOrigin) {
          return event.actualTime;
        }
      } else {
        // If no origin port specified, return first vessel departure actual time
        return event.actualTime;
      }
    }
  }

  return null;
}

function extractAtaFromEvents(shipmentEvents: any[], destinationPort: string | null): string | null {
  if (!shipmentEvents || !Array.isArray(shipmentEvents)) return null;

  // Look for vessel arrival events with actual time at destination port
  for (const event of shipmentEvents) {
    if ((event.code === 'vesselArrival' || event.code === 'vesselArrivalWithContainer' || event.code === 'dischargeFromVessel') && event.actualTime) {
      // Check if this is at the destination port
      if (destinationPort && event.location) {
        const isAtDestination =
          event.location.toLowerCase().includes(destinationPort.toLowerCase()) ||
          destinationPort.toLowerCase().includes(event.location.toLowerCase()) ||
          event.locationRole === 'destinationPort';

        if (isAtDestination) {
          return event.actualTime;
        }
      }
    }
  }

  return null;
}

// Helper functions to extract data from shipmentLegs
function extractOriginFromLegs(shipmentLegs: any): string | null {
  if (!shipmentLegs) return null;

  // Check portToPort legs (INTERMODAL)
  if (shipmentLegs.portToPort?.firstPort) return shipmentLegs.portToPort.firstPort;
  if (shipmentLegs.portToPort?.loadingPort) return shipmentLegs.portToPort.loadingPort;

  // Check road legs (LTL/ROAD)
  if (shipmentLegs.road?.origin) return shipmentLegs.road.origin;

  return null;
}

function extractDestinationFromLegs(shipmentLegs: any): string | null {
  if (!shipmentLegs) return null;

  // Check portToPort legs (INTERMODAL)
  if (shipmentLegs.portToPort?.lastPort) return shipmentLegs.portToPort.lastPort;
  if (shipmentLegs.portToPort?.dischargePort) return shipmentLegs.portToPort.dischargePort;

  // Check road legs (LTL/ROAD)
  if (shipmentLegs.road?.destination) return shipmentLegs.road.destination;

  return null;
}

function extractEtdFromLegs(shipmentLegs: any): string | null {
  if (!shipmentLegs) return null;

  // Check portToPort legs (INTERMODAL)
  if (shipmentLegs.portToPort?.firstPortEtd) return shipmentLegs.portToPort.firstPortEtd;
  if (shipmentLegs.portToPort?.firstPortAtd) return shipmentLegs.portToPort.firstPortAtd;

  // Check road legs (LTL/ROAD)
  if (shipmentLegs.road?.etd) return shipmentLegs.road.etd;
  if (shipmentLegs.road?.atd) return shipmentLegs.road.atd;

  return null;
}

function extractEtaFromLegs(shipmentLegs: any): string | null {
  if (!shipmentLegs) return null;

  // Check portToPort legs (INTERMODAL)
  if (shipmentLegs.portToPort?.lastPortEta) return shipmentLegs.portToPort.lastPortEta;
  if (shipmentLegs.portToPort?.lastPortAta) return shipmentLegs.portToPort.lastPortAta;

  // Check road legs (LTL/ROAD)
  if (shipmentLegs.road?.eta) return shipmentLegs.road.eta;
  if (shipmentLegs.road?.ata) return shipmentLegs.road.ata;

  return null;
}

// Manual trigger for testing
export async function triggerManualPoll() {
  console.log('[Cargoes Flow Poller] Manual poll triggered');
  console.log(`[Cargoes Flow Poller] Current isPolling state: ${isPolling}`);

  // Check for stale lock
  if (isPolling && (Date.now() - lastPollStartTime > POLL_TIMEOUT_MS)) {
    console.log(`[Cargoes Flow Poller] ⚠️ Found stale lock (active for > ${(POLL_TIMEOUT_MS / 60000).toFixed(1)}m). Forcing reset.`);
    isPolling = false;
  }

  const syncLog = await pollShipments();
  return syncLog;
}

// Debug function to reset polling state
export function resetPollingState() {
  console.log('[Cargoes Flow Poller] 🔄 Manually resetting isPolling to false');
  isPolling = false;
}

// Separate function to sync completed shipments
// This runs independently from the main active shipments sync to avoid timeouts
export async function syncCompletedShipments() {
  console.log('[Cargoes Flow Poller] 🔍 Starting completed shipments sync...');
  const startTime = Date.now();

  try {
    // First, fetch all active shipments to know which ones are still active
    console.log('[Cargoes Flow Poller] Step 1: Fetching active shipments from API...');
    
    // Add timeout to prevent hanging
    const fetchTimeout = new Promise<null>((_, reject) => {
      setTimeout(() => reject(new Error('Fetch active shipments timeout after 2 minutes')), 120000);
    });
    
    const activeShipments = await Promise.race([
      fetchShipmentsFromCargoesFlow(),
      fetchTimeout
    ]);

    if (activeShipments === null) {
      throw new Error('Failed to fetch active shipments list');
    }
    
    console.log('[Cargoes Flow Poller] Successfully fetched active shipments from API');

    // Collect IDs of all currently active shipments
    const activeShipmentRefs = activeShipments
      .map(s => String(s.shipmentNumber || s.referenceNumber || ''))
      .filter(id => id !== '');

    console.log(`[Cargoes Flow Poller] Found ${activeShipmentRefs.length} active shipments`);

    // Find shipments in our DB that are NOT in the active list
    console.log('[Cargoes Flow Poller] Step 2: Querying database for missing shipments...');
    const missingShipments = await storage.findMissingShipmentsFromList(activeShipmentRefs);
    console.log(`[Cargoes Flow Poller] Database query completed. Found ${missingShipments.length} potential completed shipments.`);

    if (missingShipments.length === 0) {
      console.log('[Cargoes Flow Poller] ✅ No missing shipments found. All shipments are accounted for.');
      const syncDuration = Date.now() - startTime;
      return await storage.createCargoesFlowSyncLog({
        status: 'success',
        shipmentsProcessed: 0,
        shipmentsCreated: 0,
        shipmentsUpdated: 0,
        syncDurationMs: syncDuration,
        metadata: {
          type: 'completed_sync',
          message: 'No completed shipments found',
          timestamp: new Date().toISOString()
        },
      });
    }

    console.log(`[Cargoes Flow Poller] Found ${missingShipments.length} potential completed shipments. Fetching latest data from API...`);

    const completedShipments: CargoesFlowShipmentData[] = [];
    let fetchErrors = 0;

    // Process in batches with concurrency limit to avoid overwhelming the API
    const BATCH_SIZE = 10; // Process 10 shipments concurrently
    const MAX_SHIPMENTS = 50; // Limit to 50 shipments per sync to prevent timeouts
    
    const shipmentsToProcess = missingShipments.slice(0, MAX_SHIPMENTS);
    console.log(`[Cargoes Flow Poller] Processing ${shipmentsToProcess.length} of ${missingShipments.length} missing shipments (limited to ${MAX_SHIPMENTS} per sync)`);

    // Process in batches
    for (let i = 0; i < shipmentsToProcess.length; i += BATCH_SIZE) {
      const batch = shipmentsToProcess.slice(i, i + BATCH_SIZE);
      console.log(`[Cargoes Flow Poller] Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(shipmentsToProcess.length / BATCH_SIZE)} (${batch.length} shipments)`);
      
      // Fetch all shipments in this batch concurrently
      const batchPromises = batch.map(async (missing) => {
        try {
          const completedData = await fetchCompletedShipment(missing.shipmentReference);
          return completedData;
        } catch (error: any) {
          console.error(`[Cargoes Flow Poller] Error fetching completed shipment ${missing.shipmentReference}:`, error.message);
          return null;
        }
      });

      const batchResults = await Promise.all(batchPromises);
      
      // Add successful results to completedShipments
      for (const result of batchResults) {
        if (result) {
          completedShipments.push(result);
        } else {
          fetchErrors++;
        }
      }
      
      console.log(`[Cargoes Flow Poller] Batch complete. Total verified: ${completedShipments.length}, Not found: ${fetchErrors}`);
    }
    
    if (missingShipments.length > MAX_SHIPMENTS) {
      console.log(`[Cargoes Flow Poller] ⚠️ ${missingShipments.length - MAX_SHIPMENTS} shipments remaining. Run sync again to process more.`);
    }

    let newCount = 0;
    let updatedCount = 0;

    if (completedShipments.length > 0) {
      console.log(`[Cargoes Flow Poller] 💾 Processing ${completedShipments.length} verified completed shipments...`);
      
      // Log all unique status values found
      const statusCounts = completedShipments.reduce((acc, s) => {
        const status = s.status || 'NULL';
        acc[status] = (acc[status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      console.log(`[Cargoes Flow Poller] Status distribution:`, statusCounts);
      console.log(`[Cargoes Flow Poller] Sample shipments:`, completedShipments.slice(0, 5).map(s => ({ 
        ref: s.shipmentNumber, 
        status: s.status,
        statusType: typeof s.status 
      })));
      
      const stats = await processAndStoreShipmentsWithStats(completedShipments);
      newCount = stats.newCount;
      updatedCount = stats.updatedCount;
      console.log(`[Cargoes Flow Poller] 📊 Completed sync results: ${newCount} new, ${updatedCount} updated out of ${completedShipments.length} verified`);
    } else {
      console.log(`[Cargoes Flow Poller] ⚠️ No completed shipments were found in the API.`);
      console.log(`[Cargoes Flow Poller] This could mean:`);
      console.log(`[Cargoes Flow Poller]    - The API doesn't return completed shipments`);
      console.log(`[Cargoes Flow Poller]    - The shipments are no longer in the system`);
      console.log(`[Cargoes Flow Poller]    - There's an API limitation`);
    }

    const syncDuration = Date.now() - startTime;
    const syncLog = await storage.createCargoesFlowSyncLog({
      status: 'success',
      shipmentsProcessed: completedShipments.length,
      shipmentsCreated: newCount,
      shipmentsUpdated: updatedCount,
      syncDurationMs: syncDuration,
      metadata: {
        type: 'completed_sync',
        totalMissing: missingShipments.length,
        verified: completedShipments.length,
        fetchErrors,
        timestamp: new Date().toISOString()
      },
    });

    console.log(`[Cargoes Flow Poller] ✅ Completed sync finished: ${newCount} new, ${updatedCount} updated`);
    return syncLog;

  } catch (error: any) {
    console.error('[Cargoes Flow Poller] ❌ Completed shipments sync failed:', error.message);
    console.error('[Cargoes Flow Poller] Error stack:', error.stack);
    console.error('[Cargoes Flow Poller] Error details:', {
      name: error.name,
      message: error.message,
      code: error.code,
      cause: error.cause
    });
    const syncDuration = Date.now() - startTime;
    
    try {
      return await storage.createCargoesFlowSyncLog({
        status: 'error',
        shipmentsProcessed: 0,
        shipmentsCreated: 0,
        shipmentsUpdated: 0,
        errorMessage: error.message || 'Unknown error',
        syncDurationMs: syncDuration,
        metadata: {
          type: 'completed_sync',
          error: error.message || 'Unknown error',
          errorName: error.name,
          timestamp: new Date().toISOString()
        },
      });
    } catch (logError: any) {
      console.error('[Cargoes Flow Poller] ❌ Failed to create error log:', logError.message);
      // Return a minimal error object if we can't even create the log
      throw error; // Re-throw the original error
    }
  }
}
