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

async function fetchShipmentsFromCargoesFlow(): Promise<CargoesFlowShipmentData[]> {
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
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'X-DPW-ApiKey': CARGOES_FLOW_API_KEY,
          'X-DPW-Org-Token': CARGOES_FLOW_ORG_TOKEN,
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache',
        },
      });

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
    return [];
  }
}

async function processAndStoreShipmentsWithStats(shipments: CargoesFlowShipmentData[]) {
  let newCount = 0;
  let updatedCount = 0;
  let errorCount = 0;

  for (const shipment of shipments) {
    try {
      // Use shipmentNumber as the primary reference (convert to string if number)
      const shipmentRef = String(shipment.shipmentNumber || shipment.referenceNumber || '');
      
      if (!shipmentRef) {
        console.warn('[Cargoes Flow Poller] Skipping shipment without shipmentNumber or referenceNumber:', shipment);
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
      const currentLocation = shipment.currentLocationName || shipment.currentLocation || null;

      // Look up TAI shipment ID, office, and salesRepNames by MBL number from cargoes_flow_posts
      let taiShipmentId: string | null = null;
      let office: string | null = null;
      let salesRepNames: string[] | null = null;
      
      if (mblNumber) {
        const cargoesFlowPost = await storage.getCargoesFlowPostByMbl(mblNumber);
        if (cargoesFlowPost) {
          taiShipmentId = cargoesFlowPost.taiShipmentId;
          office = cargoesFlowPost.office;
          salesRepNames = cargoesFlowPost.salesRepNames;
        }
      }

      // Get existing shipment to preserve manually added data (rail, terminal info)
      // Try multiple lookup strategies to find the correct shipment
      let existing = await storage.getCargoesFlowShipmentByReference(shipmentRef);
      
      // If not found by reference, try by container number
      if (!existing && shipment.containerNumber) {
        existing = await storage.getCargoesFlowShipmentByContainer(shipment.containerNumber);
      }
      
      // Debug: Log first few shipments to see what's happening
      if (newCount + updatedCount < 5) {
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
          
          mergedRawData.containers = mergedContainers;
        } else if (shipment.containerNumber) {
          // No existing containers array, but we have a containerNumber from API
          mergedRawData.containers = [{ containerNumber: shipment.containerNumber }];
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
        
        // Preserve manually added containers array with rail data
        if (existingRawData.containers && Array.isArray(existingRawData.containers)) {
          mergedRawData.containers = existingRawData.containers;
        } else if (shipment.containerNumber) {
          mergedRawData.containers = [{ containerNumber: shipment.containerNumber }];
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
          status: shipment.status || null,
          carrier: carrierName,
          vesselName: shipment.vesselName || null,
          voyageNumber: shipment.voyageNumber || null,
          containerType: shipment.containerSize || shipment.containerType || null,
          office,
          salesRepNames,
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
                rawData: otherMblMergedRawData,
              });
            }
          }
        }
        
        updatedCount++;
      } else {
        // Create new shipment
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
    } catch (error: any) {
      console.error(`[Cargoes Flow Poller] Error processing shipment ${shipment.shipmentNumber || shipment.referenceNumber}:`, error.message);
      errorCount++;
    }
  }

  console.log(`[Cargoes Flow Poller] 📈 Final stats: ${newCount} new, ${updatedCount} updated, ${errorCount} errors`);
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
  const startTime = Date.now();
  let syncLog;
  
  try {
    console.log('[Cargoes Flow Poller] 🚀 Starting sync...');
    const shipments = await fetchShipmentsFromCargoesFlow();
    
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
  const syncLog = await pollShipments();
  return syncLog;
}

// Debug function to reset polling state
export function resetPollingState() {
  console.log('[Cargoes Flow Poller] 🔄 Manually resetting isPolling to false');
  isPolling = false;
}
