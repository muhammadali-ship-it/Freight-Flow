import { Request, Response } from "express";
import { storage } from "../storage";
import { sendShipmentToCargoesFlow, trackCargoesFlowPost, sendUpdateToCargoesFlow, trackCargoesFlowUpdate } from "../services/cargoes-flow";

export async function handleTmsWebhook(req: Request, res: Response) {
  try {
    console.log('='.repeat(80));
    console.log('[TAI TMS Webhook] 🔔 WEBHOOK RECEIVED!');
    console.log('[TAI TMS Webhook] Timestamp:', new Date().toISOString());
    console.log('[TAI TMS Webhook] Headers:', JSON.stringify(req.headers, null, 2));
    console.log('[TAI TMS Webhook] Body:', JSON.stringify(req.body, null, 2));
    console.log('='.repeat(80));

    // Validate webhook secret
    const tmsSecret = process.env.TMS_WEBHOOK_SECRET;
    const receivedSignature = req.headers['x-tms-signature'] || req.headers['x-tms-key'];
    
    if (tmsSecret && receivedSignature !== tmsSecret) {
      console.error('[TAI TMS Webhook] ❌ Invalid signature');
      return res.status(401).json({ error: "Unauthorized" });
    }

    const payload = req.body;
    
    // Extract TAI-specific fields
    const shipmentId = payload.shipmentId?.toString() || 'UNKNOWN';
    const status = payload.status?.toLowerCase() || 'unknown';
    const shipmentType = payload.shipmentType || 'UNKNOWN'; // Drayage, Truckload, LTL, etc.
    
    // Extract container number from reference numbers array
    const containerRef = payload.shipmentReferenceNumbers?.find(
      (ref: any) => ref.referenceType === "Container Number"
    );
    const containerNumber = containerRef?.value || null;
    
    // Determine if this is a CREATE or UPDATE operation by checking if shipment exists
    const existingShipment = await storage.getShipmentByReference(shipmentId);
    const operation = existingShipment ? 'UPDATE' : 'CREATE';

    // Log the webhook
    const webhookLog = await storage.createWebhookLog({
      eventType: shipmentType, // Store the shipment type (Drayage, Truckload, LTL)
      operation, // Store the CRUD operation (CREATE/UPDATE)
      shipmentId,
      containerNumber,
      status,
      rawPayload: payload,
      processedAt: null,
      errorMessage: null,
    });

    console.log('[TAI TMS Webhook] ✅ Webhook logged, ID:', webhookLog.id);

    // Process the webhook
    try {
      await processTaiShipmentUpdate(payload, webhookLog.id);

      // Mark webhook as processed
      await storage.updateWebhookLogProcessed(webhookLog.id, new Date());
      
      console.log('[TAI TMS Webhook] ✅ Processing complete');
      res.json({ success: true, webhookId: webhookLog.id });
    } catch (processingError: any) {
      console.error('[TAI TMS Webhook] ❌ Processing error:', processingError);
      await storage.updateWebhookLogError(webhookLog.id, processingError.message);
      res.status(500).json({ error: "Processing failed", webhookId: webhookLog.id });
    }
  } catch (error) {
    console.error('[TAI TMS Webhook] ❌ Error receiving webhook:', error);
    res.status(500).json({ error: "Failed to process webhook" });
  }
}

async function processTaiShipmentUpdate(payload: any, webhookId: string) {
  // Extract reference numbers
  const referenceNumbers = payload.shipmentReferenceNumbers || [];
  
  const containerRef = referenceNumbers.find((ref: any) => ref.referenceType === "Container Number");
  const mawbRef = referenceNumbers.find((ref: any) => ref.referenceType === "MAWB Number");
  const shipmentIdRef = referenceNumbers.find((ref: any) => ref.referenceType === "Shipment Id");
  const shipperRef = referenceNumbers.find((ref: any) => ref.referenceType === "Shipper Reference Number");
  
  const containerNumber = containerRef?.value;
  const mawbNumber = mawbRef?.value;
  const taiShipmentId = shipmentIdRef?.value || payload.shipmentId?.toString();
  const shipperRefNumber = shipperRef?.value;
  
  // Use shipment ID as primary reference
  const referenceNumber = taiShipmentId || `TAI-${Date.now()}`;
  
  // Extract stops
  const stops = payload.stops || [];
  const firstPickup = stops.find((stop: any) => stop.stopType === "First Pickup");
  const lastDrop = stops.find((stop: any) => stop.stopType === "Last Drop");
  
  // Build location strings from stop data
  const originPort = firstPickup 
    ? [firstPickup.companyName, firstPickup.city, firstPickup.state].filter(Boolean).join(', ')
    : '';
  
  const destinationPort = lastDrop
    ? [lastDrop.companyName, lastDrop.city, lastDrop.state].filter(Boolean).join(', ')
    : '';
  
  // Extract customer info
  const customerName = payload.customer?.name || null;
  const staffName = payload.customer?.staffName || null;
  const officeName = payload.customer?.office || null;
  
  // Extract sales reps from customer.salesRepNames (comma-separated string)
  const salesRepNamesString = payload.customer?.salesRepNames || '';
  const salesRepNames = salesRepNamesString 
    ? salesRepNamesString.split(',').map((name: string) => name.trim()).filter(Boolean)
    : [];
  
  // Extract commodities
  const commodities = payload.commodities || [];
  const commodityDescription = commodities.map((c: any) => c.description).join(', ') || null;
  
  // Extract carrier list
  const carriers = payload.carrierList || [];
  const carrierName = carriers.length > 0 ? carriers[0].name : null;
  
  // Extract shipment type from payload (used for Cargoes Flow logic)
  const shipmentType = payload.shipmentType || '';

  // Build shipment data
  const shipmentData = {
    referenceNumber: referenceNumber,
    bookingNumber: shipperRefNumber || '',
    masterBillOfLading: mawbNumber || '',
    shipper: customerName,
    consignee: lastDrop?.companyName || null,
    originPort: originPort,
    destinationPort: destinationPort,
    etd: firstPickup?.estimatedReadyDateTime || null,
    eta: lastDrop?.estimatedReadyDateTime || null,
    atd: firstPickup?.actualDepartureDateTime || null,
    ata: lastDrop?.actualArrivalDateTime || null,
    status: payload.status?.toLowerCase() || 'active',
    carrier: carrierName,
    vesselName: null,
    voyageNumber: null,
    officeName: officeName,
    salesRepNames: salesRepNames.length > 0 ? salesRepNames : null,
  };

  console.log('[TAI TMS Webhook] Processed shipment data:', {
    referenceNumber: shipmentData.referenceNumber,
    containerNumber,
    mawbNumber,
    customer: customerName,
    origin: originPort,
    destination: destinationPort,
    status: shipmentData.status,
  });

  const existingShipment = await storage.getShipmentByReference(shipmentData.referenceNumber);
  
  if (existingShipment) {
    console.log(`[TAI TMS Webhook] Updating existing shipment: ${shipmentData.referenceNumber}`);
    await storage.updateShipment(existingShipment.id, shipmentData);
    
    // Create milestone for status update
    try {
      await storage.createMilestone({
        shipmentId: existingShipment.id,
        eventType: payload.status || 'STATUS_UPDATE',
        location: destinationPort || null,
        timestampPlanned: null,
        timestampActual: new Date().toISOString(),
        status: 'completed',
      });
    } catch (milestoneError) {
      console.error('[TAI TMS Webhook] Error creating milestone:', milestoneError);
    }

    // Send update to Cargoes Flow if this is a Drayage shipment with MBL
    if (shipmentType.toLowerCase() === 'drayage' && shipmentData.masterBillOfLading && shipmentData.masterBillOfLading.trim() !== '') {
      console.log(`[Cargoes Flow Update] ✅ Drayage UPDATE detected - sending update for ${shipmentData.referenceNumber} (MBL: ${shipmentData.masterBillOfLading})`);
      
      try {
        // Look up the Cargoes Flow shipment reference by MBL number
        // Cargoes Flow uses shipment_reference (e.g., TS-6583V3) as the shipmentNumber, NOT the MBL
        const cargoesFlowShipment = await storage.getCargoesFlowShipmentByMbl(shipmentData.masterBillOfLading);
        
        if (!cargoesFlowShipment) {
          console.log(`[Cargoes Flow Update] ⚠️ Shipment not found in Cargoes Flow by MBL: ${shipmentData.masterBillOfLading} - skipping update`);
          return;
        }
        
        const shipmentNumber = cargoesFlowShipment.shipmentReference;
        console.log(`[Cargoes Flow Update] 📍 Using Cargoes Flow shipment reference: ${shipmentNumber} (MBL: ${shipmentData.masterBillOfLading})`);
        
        // Helper function to convert ISO datetime to simple date (YYYY-MM-DD)
        const toSimpleDate = (isoString: string | null): string | undefined => {
          if (!isoString) return undefined;
          try {
            return isoString.split('T')[0]; // Extract just the date part
          } catch {
            return undefined;
          }
        };
        
        // Build update payload with available fields (using simple date format)
        const updatePayload: any = {};
        
        if (shipmentData.shipper) updatePayload.shipper = shipmentData.shipper;
        if (shipmentData.consignee) updatePayload.consignee = shipmentData.consignee;
        if (shipmentData.etd) updatePayload.promisedEtd = toSimpleDate(shipmentData.etd);
        if (shipmentData.eta) updatePayload.promisedEta = toSimpleDate(shipmentData.eta);
        
        // Send the update to Cargoes Flow
        const result = await sendUpdateToCargoesFlow(shipmentNumber, updatePayload);

        // Track the update
        await trackCargoesFlowUpdate(
          shipmentNumber,
          shipmentData.referenceNumber,
          webhookId,
          updatePayload,
          result,
          taiShipmentId
        );

        if (result.success) {
          console.log(`[Cargoes Flow Update] ✅ Successfully sent update for ${shipmentData.referenceNumber}`);
        } else {
          console.error(`[Cargoes Flow Update] ❌ Failed to send update:`, result.error);
        }
      } catch (updateError) {
        console.error('[Cargoes Flow Update] Error sending update:', updateError);
      }
    }
  } else {
    console.log(`[TAI TMS Webhook] Creating new shipment: ${shipmentData.referenceNumber}`);
    const newShipment = await storage.createShipment(shipmentData);
    
    // Create initial milestones from stops
    if (firstPickup && firstPickup.estimatedReadyDateTime) {
      try {
        await storage.createMilestone({
          shipmentId: newShipment.id,
          eventType: 'PICKUP',
          location: originPort,
          timestampPlanned: firstPickup.estimatedReadyDateTime,
          timestampActual: firstPickup.actualDepartureDateTime || null,
          status: firstPickup.actualDepartureDateTime ? 'completed' : 'pending',
        });
      } catch (milestoneError) {
        console.error('[TAI TMS Webhook] Error creating pickup milestone:', milestoneError);
      }
    }
    
    if (lastDrop) {
      try {
        await storage.createMilestone({
          shipmentId: newShipment.id,
          eventType: 'DELIVERY',
          location: destinationPort,
          timestampPlanned: lastDrop.estimatedReadyDateTime || null,
          timestampActual: lastDrop.actualArrivalDateTime || null,
          status: lastDrop.actualArrivalDateTime ? 'completed' : 'pending',
        });
      } catch (milestoneError) {
        console.error('[TAI TMS Webhook] Error creating delivery milestone:', milestoneError);
      }
    }
  }

  // Send to Cargoes Flow ONLY if shipment type is "Drayage" AND has MBL
  if (shipmentType.toLowerCase() === 'drayage' && shipmentData.masterBillOfLading && shipmentData.masterBillOfLading.trim() !== '') {
    console.log(`[Cargoes Flow] ✅ Drayage shipment with MBL detected - sending ${shipmentData.referenceNumber} to Cargoes Flow (MBL: ${shipmentData.masterBillOfLading})`);
    
    try {
      const result = await sendShipmentToCargoesFlow(
        shipmentData.referenceNumber,
        shipmentData.masterBillOfLading,
        {
          originPort: shipmentData.originPort,
          destinationPort: shipmentData.destinationPort,
          eta: shipmentData.eta,
          etd: shipmentData.etd,
          carrier: shipmentData.carrier,
          status: shipmentData.status,
          bookingNumber: shipmentData.bookingNumber,
          shipper: shipmentData.shipper,
          consignee: shipmentData.consignee,
          office: officeName,
          salesRepNames: salesRepNames,
        }
      );

      // Track the post
      await trackCargoesFlowPost(
        shipmentData.referenceNumber,
        shipmentData.masterBillOfLading,
        webhookId,
        result,
        {
          taiShipmentId: taiShipmentId,
          containerNumber: containerNumber,
          carrier: shipmentData.carrier,
          bookingNumber: shipmentData.bookingNumber,
          office: officeName,
          salesRepNames: salesRepNames,
        }
      );

      if (result.success) {
        console.log(`[Cargoes Flow] ✅ Successfully sent shipment ${shipmentData.referenceNumber} to Cargoes Flow`);
      } else {
        console.error(`[Cargoes Flow] ❌ Failed to send shipment ${shipmentData.referenceNumber}:`, result.error);
      }
    } catch (cargoesFlowError) {
      console.error('[Cargoes Flow] Error sending to Cargoes Flow:', cargoesFlowError);
    }
  } else if (shipmentType.toLowerCase() !== 'drayage') {
    console.log(`[Cargoes Flow] ⏭️ Skipping non-Drayage shipment: ${shipmentData.referenceNumber} (Type: ${shipmentType})`);
  } else if (!shipmentData.masterBillOfLading || shipmentData.masterBillOfLading.trim() === '') {
    console.log(`[Cargoes Flow] ⚠️ Drayage shipment ${shipmentData.referenceNumber} has no MBL - tracking as missing`);
    
    // Track shipment with missing MBL
    try {
      await storage.createMissingMblShipment({
        shipmentReference: shipmentData.referenceNumber,
        webhookId: webhookId,
        containerNumber: containerNumber || null,
        shipper: shipmentData.shipper,
        consignee: shipmentData.consignee,
        originPort: shipmentData.originPort,
        destinationPort: shipmentData.destinationPort,
        carrier: shipmentData.carrier,
        status: shipmentData.status,
      });
      console.log(`[Cargoes Flow] ✅ Tracked missing MBL shipment: ${shipmentData.referenceNumber}`);
    } catch (trackingError) {
      console.error('[Cargoes Flow] Error tracking missing MBL shipment:', trackingError);
    }
  }
}

export async function sendTestWebhook(req: Request, res: Response) {
  try {
    const webhookUrl = `${req.protocol}://${req.get('host')}/api/webhooks/tms`;
    
    // Use real TAI TMS payload format
    const testPayload = {
      shipmentType: "Drayage",
      shipmentId: Date.now(),
      status: "Booked",
      importExport: "Import",
      customer: {
        name: "TEST CUSTOMER LLC",
        staffName: "Test User",
        salesRepNames: "Sales Rep 1, Sales Rep 2",
        officeName: "Test Office"
      },
      shipmentReferenceNumbers: [
        {
          referenceType: "Container Number",
          value: `TEST${Date.now()}`
        },
        {
          referenceType: "MAWB Number",
          value: `MAWB${Date.now()}`
        },
        {
          referenceType: "Shipment Id",
          value: Date.now().toString()
        },
        {
          referenceType: "Carrier Rep",
          value: "Test Carrier"
        }
      ],
      stops: [
        {
          stopType: "First Pickup",
          companyName: "Origin Terminal",
          city: "Los Angeles",
          state: "CA",
          estimatedReadyDateTime: new Date().toISOString()
        },
        {
          stopType: "Last Drop",
          companyName: "Destination Warehouse",
          city: "New York",
          state: "NY",
          estimatedReadyDateTime: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
        }
      ],
      commodities: [
        {
          description: "TEST GOODS",
          weightTotal: 1000,
          piecesTotal: 10
        }
      ]
    };

    console.log('[Test Webhook] Sending TAI TMS test webhook to:', webhookUrl);
    
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-tms-signature': process.env.TMS_WEBHOOK_SECRET || 'test-secret',
      },
      body: JSON.stringify(testPayload),
    });

    const result = await response.json();
    
    console.log('[Test Webhook] Response:', result);
    
    res.json({
      success: true,
      message: 'TAI TMS test webhook sent',
      webhookUrl,
      payload: testPayload,
      response: result,
    });
  } catch (error) {
    console.error('[Test Webhook] Error:', error);
    res.status(500).json({ error: 'Failed to send test webhook' });
  }
}

export async function retryWebhook(webhookId: string, payload: any) {
  console.log(`[Webhook Retry] Processing webhook ${webhookId}...`);
  
  try {
    await processTaiShipmentUpdate(payload, webhookId);
    await storage.updateWebhookLogProcessed(webhookId, new Date());
    console.log(`[Webhook Retry] ✅ Webhook ${webhookId} processed successfully`);
  } catch (error: any) {
    console.error(`[Webhook Retry] ❌ Error processing webhook ${webhookId}:`, error);
    await storage.updateWebhookLogError(webhookId, error.message);
    throw error;
  }
}
