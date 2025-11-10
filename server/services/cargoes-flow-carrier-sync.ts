/**
 * Cargoes Flow Carrier Synchronization Service
 * Fetches carrier list from Cargoes Flow API and stores in database
 */

import { db } from '../storage.js';
import { cargoesFlowCarriers, cargoesFlowCarrierSyncLogs } from '../../shared/schema.js';
import { eq } from 'drizzle-orm';

const CARGOES_FLOW_API_URL = 'https://connect.cargoes.com/flow/api/public_tracking/v1';
const CARGOES_FLOW_API_KEY = process.env.CARGOES_FLOW_API_KEY || "dL6SngaHRXZfvzGA716lioRD7ZsRC9hs";
const CARGOES_FLOW_ORG_TOKEN = process.env.CARGOES_FLOW_ORG_TOKEN || "V904eqatVp49P7FZuwEtoFg72TJDyFnb";

interface CargoesFlowCarrierResponse {
  carrierName: string;
  supportsTrackByMbl: boolean;
  supportsTrackByBookingNumber: boolean;
  requiresMbl: boolean;
  shipmentType: string;
  carrierScac?: string;
}

export async function syncCarriersFromCargoesFlow(): Promise<{
  success: boolean;
  carriersProcessed: number;
  carriersCreated: number;
  carriersUpdated: number;
  error?: string;
}> {
  const startTime = Date.now();
  
  let carriersProcessed = 0;
  let carriersCreated = 0;
  let carriersUpdated = 0;
  let errorMessage: string | undefined;
  let apiRequest: string | undefined;
  let apiResponse: string | undefined;
  
  try {
    console.log('🔄 Starting Cargoes Flow carrier sync...');
    
    if (!CARGOES_FLOW_API_KEY || !CARGOES_FLOW_ORG_TOKEN) {
      throw new Error('CARGOES_FLOW_API_KEY or CARGOES_FLOW_ORG_TOKEN is not configured');
    }
    
    // Fetch carriers from Cargoes Flow API
    const url = `${CARGOES_FLOW_API_URL}/carrierList`;
    apiRequest = `GET ${url}`;
    
    console.log(`📡 Fetching carriers from: ${url}`);
    console.log(`📡 Using API Key: ${CARGOES_FLOW_API_KEY.substring(0, 10)}...`);
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'X-DPW-ApiKey': CARGOES_FLOW_API_KEY,
        'X-DPW-Org-Token': CARGOES_FLOW_ORG_TOKEN,
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) {
      throw new Error(`API request failed: ${response.status} ${response.statusText}`);
    }
    
    const carriers: CargoesFlowCarrierResponse[] = await response.json();
    apiResponse = JSON.stringify(carriers, null, 2);
    
    console.log(`📦 Received ${carriers.length} carriers from API`);
    
    // Process each carrier
    for (const carrier of carriers) {
      carriersProcessed++;
      
      // Check if carrier already exists (by carrierScac or carrierName)
      const existingCarrier = carrier.carrierScac
        ? await db.query.cargoesFlowCarriers.findFirst({
            where: eq(cargoesFlowCarriers.carrierScac, carrier.carrierScac),
          })
        : await db.query.cargoesFlowCarriers.findFirst({
            where: eq(cargoesFlowCarriers.carrierName, carrier.carrierName),
          });
      
      if (existingCarrier) {
        // Update existing carrier
        await db.update(cargoesFlowCarriers)
          .set({
            carrierName: carrier.carrierName,
            carrierScac: carrier.carrierScac,
            shipmentType: carrier.shipmentType,
            supportsTrackByMbl: carrier.supportsTrackByMbl,
            supportsTrackByBookingNumber: carrier.supportsTrackByBookingNumber,
            requiresMbl: carrier.requiresMbl,
            lastSyncedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(cargoesFlowCarriers.id, existingCarrier.id));
        
        carriersUpdated++;
        console.log(`✏️  Updated carrier: ${carrier.carrierName}`);
      } else {
        // Insert new carrier
        await db.insert(cargoesFlowCarriers).values({
          carrierName: carrier.carrierName,
          carrierScac: carrier.carrierScac,
          shipmentType: carrier.shipmentType,
          supportsTrackByMbl: carrier.supportsTrackByMbl,
          supportsTrackByBookingNumber: carrier.supportsTrackByBookingNumber,
          requiresMbl: carrier.requiresMbl,
        });
        
        carriersCreated++;
        console.log(`✅ Created carrier: ${carrier.carrierName}`);
      }
    }
    
    const syncDurationMs = Date.now() - startTime;
    
    // Log successful sync
    await db.insert(cargoesFlowCarrierSyncLogs).values({
      status: 'success',
      carriersProcessed,
      carriersCreated,
      carriersUpdated,
      syncDurationMs,
      apiRequest,
      apiResponse,
    });
    
    console.log(`✅ Carrier sync completed in ${syncDurationMs}ms`);
    console.log(`   Processed: ${carriersProcessed}, Created: ${carriersCreated}, Updated: ${carriersUpdated}`);
    
    return {
      success: true,
      carriersProcessed,
      carriersCreated,
      carriersUpdated,
    };
    
  } catch (error) {
    const syncDurationMs = Date.now() - startTime;
    errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    console.error('❌ Carrier sync failed:', errorMessage);
    
    // Log failed sync
    await db.insert(cargoesFlowCarrierSyncLogs).values({
      status: 'error',
      carriersProcessed,
      carriersCreated,
      carriersUpdated,
      errorMessage,
      syncDurationMs,
      apiRequest,
      apiResponse,
    });
    
    return {
      success: false,
      carriersProcessed,
      carriersCreated,
      carriersUpdated,
      error: errorMessage,
    };
  }
}

// Export for manual triggering
export async function manualCarrierSync() {
  return await syncCarriersFromCargoesFlow();
}
