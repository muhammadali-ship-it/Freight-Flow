import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage, db } from "./storage.js";
import { sql } from "drizzle-orm";
import { insertContainerSchema, insertExceptionSchema, insertVesselPositionSchema, insertRailSegmentSchema, insertTimelineEventSchema, insertSavedViewSchema, insertIntegrationConfigSchema, insertUserSchema, insertShipmentSchema, insertMilestoneSchema, insertCustomEntrySchema, cargoesFlowCarriers, cargoesFlowCarrierSyncLogs, type Milestone, type User, type Shipment } from "shared/schema.js";
import { integrationOrchestrator } from "./integrations/integration-orchestrator.js";
import { riskScheduler } from "./services/risk-scheduler.js";
import { startPolling as startCargoesFlowPolling } from "./services/cargoes-flow-poller.js";
import { setupAuth, hashPassword } from "./auth.js";
import { sendShipmentToCargoesFlow, trackCargoesFlowPost } from "./services/cargoes-flow.js";

function calculateShipmentStatus(milestones: Milestone[]): string {
  if (!milestones || milestones.length === 0) {
    return "planned";
  }

  const completedMilestones = milestones
    .filter(m => m.status === "completed" && m.timestampActual)
    .sort((a, b) => {
      const timeA = new Date(a.timestampActual!).getTime();
      const timeB = new Date(b.timestampActual!).getTime();
      return timeB - timeA;
    });

  if (completedMilestones.length === 0) {
    return "planned";
  }

  const latestMilestone = completedMilestones[0];
  const eventType = latestMilestone.eventType.toUpperCase();

  if (eventType.includes("ARRIVED") || eventType.includes("DELIVERY") || eventType.includes("DISCHARGE")) {
    return "arrived";
  } else if (eventType.includes("DEPARTED") || eventType.includes("LOADING") || eventType.includes("LOADED")) {
    return "in-transit";
  } else if (eventType.includes("GATE")) {
    return "at-terminal";
  }

  return "in-transit";
}

function detectDelays(milestones: Milestone[]): Milestone[] {
  return milestones.map(milestone => {
    if (milestone.timestampActual && milestone.timestampPlanned) {
      const actualTime = new Date(milestone.timestampActual).getTime();
      const plannedTime = new Date(milestone.timestampPlanned).getTime();
      
      if (actualTime > plannedTime) {
        return { ...milestone, status: "delayed" };
      }
    }
    return milestone;
  });
}

export async function registerRoutes(app: Express): Promise<Server> {
  setupAuth(app);
  
  app.post("/api/shipments", async (req, res) => {
    try {
      const validatedData = insertShipmentSchema.parse(req.body);
      const shipment = await storage.createShipment(validatedData);
      
      // If shipment has MBL, post it to Cargoes Flow API
      if (shipment.masterBillOfLading) {
        console.log(`[Create Shipment] Posting user-created shipment to Cargoes Flow: ${shipment.referenceNumber}`);
        
        const result = await sendShipmentToCargoesFlow(
          shipment.referenceNumber,
          shipment.masterBillOfLading,
          shipment
        );
        
        // Track the post in cargoes_flow_posts table
        await trackCargoesFlowPost(
          shipment.referenceNumber,
          shipment.masterBillOfLading,
          null, // No webhook ID for user-created shipments
          result,
          {
            taiShipmentId: shipment.referenceNumber, // For user-created, use the reference number as TAI ID
            containerNumber: null, // User shipments may not have container at creation
            carrier: shipment.carrier || null,
            bookingNumber: shipment.bookingNumber || null,
          }
        );
        
        // Also insert into cargoesFlowShipments so it appears in active shipments immediately
        // This will be updated with full data when polled from Cargoes Flow API
        await storage.upsertCargoesFlowShipment({
          shipmentReference: shipment.referenceNumber || `USER-${shipment.id}`,
          taiShipmentId: shipment.referenceNumber,
          mblNumber: shipment.masterBillOfLading,
          containerNumber: null,
          bookingNumber: shipment.bookingNumber || null,
          shipper: shipment.shipper || null,
          consignee: shipment.consignee || null,
          originPort: shipment.originPort || null,
          destinationPort: shipment.destinationPort || null,
          etd: shipment.etd || null,
          eta: shipment.eta || null,
          status: 'ACTIVE',
          carrier: shipment.carrier || null,
          vesselName: shipment.vesselName || null,
          voyageNumber: null,
          containerType: null,
          office: null,
          salesRepNames: null,
          rawData: { userCreated: true, ...shipment },
        });
        
        console.log(`[Create Shipment] ${result.success ? '✅' : '❌'} Cargoes Flow post result: ${result.success ? 'success' : result.error}`);
        console.log(`[Create Shipment] ✅ Shipment added to active shipments tab`);
      }
      
      res.status(201).json(shipment);
    } catch (error) {
      console.error("Error creating shipment:", error);
      res.status(400).json({ error: "Failed to create shipment" });
    }
  });

  // Get shipments created via webhooks only
  app.get("/api/shipments/webhook", async (req, res) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const pageSize = parseInt(req.query.pageSize as string) || 50;
      const offset = (page - 1) * pageSize;

      // Use efficient SQL query to get webhook shipments with join
      // This gets distinct shipment_ids from webhook_logs and joins with shipments table
      const webhookShipmentsQuery = sql`
        SELECT DISTINCT s.*
        FROM shipments s
        INNER JOIN webhook_logs w ON (
          s.reference_number = w.shipment_id::text
        )
        ORDER BY s.created_at DESC
        LIMIT ${pageSize} OFFSET ${offset}
      `;
      
      const countQuery = sql`
        SELECT COUNT(DISTINCT s.id) as total
        FROM shipments s
        INNER JOIN webhook_logs w ON (
          s.reference_number = w.shipment_id::text
        )
      `;

      const [shipmentResults, countResults] = await Promise.all([
        db.execute(webhookShipmentsQuery),
        db.execute(countQuery)
      ]);

      const data = shipmentResults.rows as Shipment[];
      const total = Number(countResults.rows[0]?.total || 0);

      res.json({
        data,
        pagination: {
          page,
          pageSize,
          total,
          totalPages: Math.ceil(total / pageSize),
        },
      });
    } catch (error) {
      console.error("Error fetching webhook shipments:", error);
      res.status(500).json({ error: "Failed to fetch webhook shipments" });
    }
  });

  app.get("/api/shipments", async (req, res) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const pageSize = parseInt(req.query.pageSize as string) || 50;
      
      const filters = {
        search: req.query.search as string,
        status: req.query.status as string,
        carrier: req.query.carrier as string,
        originPort: req.query.originPort as string,
        destinationPort: req.query.destinationPort as string,
        dateRange: req.query.dateFrom && req.query.dateTo
          ? { start: req.query.dateFrom as string, end: req.query.dateTo as string }
          : undefined,
      };

      // Get current user and apply filters based on role
      const user = req.user as User | undefined;
      let userFilter: { userName?: string; userOffice?: string; userRole?: string } = {};

      if (user) {
        if (user.role === 'User') {
          // User role: filter by name matching salesRepNames array
          userFilter.userName = user.name;
          userFilter.userRole = 'User';
        } else if (user.role === 'Manager') {
          // Manager role: filter by office matching officeName
          userFilter.userOffice = user.office;
          userFilter.userRole = 'Manager';
        }
        // Admin users: no filtering (userFilter remains empty)
      }

      // Fetch GROUPED Cargoes Flow API shipments (1 shipment per MBL with all containers)
      const cargoesFlowResult = await storage.getGroupedCargoesFlowShipments(
        { page, pageSize }, 
        {
          ...filters,
          ...userFilter,
        }
      );
      
      // Map grouped shipments to frontend format
      const mappedShipments = cargoesFlowResult.data.map(ship => ({
        id: ship.id,
        referenceNumber: ship.shipmentReference,
        taiShipmentId: ship.taiShipmentId,
        shipmentReference: ship.shipmentReference,
        bookingNumber: ship.bookingNumber,
        mblNumber: ship.mblNumber,
        masterBillOfLading: ship.mblNumber,
        shipper: ship.shipper,
        consignee: ship.consignee,
        originPort: ship.originPort,
        destinationPort: ship.destinationPort,
        etd: ship.etd,
        eta: ship.eta,
        status: ship.status,
        carrier: ship.carrier,
        vesselName: ship.vesselName,
        voyageNumber: ship.voyageNumber,
        containerType: ship.containerType,
        rawData: {
          ...ship.rawData,
          riskLevel: ship.highestRiskLevel,
          riskReasons: ship.aggregatedRiskReasons,
        },
        // Container grouping data
        containers: ship.containers,
        containerCount: ship.containerCount,
        allContainerNumbers: ship.allContainerNumbers,
        source: 'api',
        isUserCreated: false,
      }));
      
      res.json({
        data: mappedShipments,
        pagination: cargoesFlowResult.pagination,
      });
    } catch (error) {
      console.error("Error fetching shipments:", error);
      res.status(500).json({ error: "Failed to fetch shipments" });
    }
  });

  app.get("/api/shipments/:id", async (req, res) => {
    try {
      // First, try to fetch from user shipments (prioritize user-created data)
      let shipment = await storage.getShipmentById(req.params.id);
      
      if (shipment) {
        // This is a user-created shipment, fetch related data
        const [milestones, containers] = await Promise.all([
          storage.getMilestones(req.params.id),
          storage.getContainers(req.params.id),
        ]);
        
        return res.json({
          ...shipment,
          source: 'user',
          isUserCreated: true,
          milestones,
          containers,
        });
      }
      
      // If not found in user shipments, fetch from Cargoes Flow
      const cargoesFlowShipment = await storage.getCargoesFlowShipmentById(req.params.id);
      if (!cargoesFlowShipment) {
        return res.status(404).json({ error: "Shipment not found" });
      }
      
      // Fetch ALL containers for this MBL (grouped shipments)
      let allContainers: any[] = [];
      if (cargoesFlowShipment.mblNumber) {
        const allShipmentsForMbl = await storage.getAllCargoesFlowShipmentsByMbl(cargoesFlowShipment.mblNumber);
        console.log(`[Shipment Detail] MBL ${cargoesFlowShipment.mblNumber} has ${allShipmentsForMbl.length} containers`);
        allContainers = allShipmentsForMbl.map(ship => {
          const shipRawData = ship.rawData as any || {};
          // Extract container-specific rawData from rawData.containers array if it exists
          const containersArray = shipRawData.containers || [];
          const containerData = containersArray.find((c: any) => c.containerNumber === ship.containerNumber) || containersArray[0] || {};
          const containerRawData = containerData.rawData || {};
          
          // Log if rail data is found (only log key fields to reduce noise)
          if (containerRawData.rail) {
            const railInfo = containerRawData.rail;
            console.log(`[GET Shipment] Rail data found for ${ship.containerNumber}: railNumber=${railInfo.railNumber || 'N/A'}, available=${railInfo.available !== undefined ? railInfo.available : 'N/A'}`);
          }
          
          return {
            id: ship.id,
            containerNumber: ship.containerNumber,
            shipmentReference: ship.shipmentReference,
            containerType: ship.containerType,
            bookingReference: ship.bookingNumber,
            voyageNumber: ship.voyageNumber,
            weight: shipRawData.weight || containerData.weight,
            sealNumber: shipRawData.sealNumber || containerData.sealNumber,
            containerEta: ship.eta,
            containerAta: shipRawData.ata || containerData.containerAta,
            lastFreeDay: shipRawData.lastFreeDay || containerData.lastFreeDay,
            dailyFeeRate: shipRawData.dailyFeeRate || containerData.dailyFeeRate,
            detentionFee: shipRawData.detentionFee || containerData.detentionFee,
            pickupChassis: shipRawData.pickupChassis || containerData.pickupChassis,
            yardLocation: shipRawData.yardLocation || containerData.yardLocation,
            containerStatus: shipRawData.containerStatus || containerData.containerStatus || ship.status,
            rawData: {
              ...shipRawData,
              ...containerRawData, // Include container-specific rawData (including rail)
            },
          };
        });
      }
      
      // Extract milestones from rawData if they exist
      const rawData = cargoesFlowShipment.rawData as any || {};
      const milestones = rawData.milestones || [];
      
      // If no containers from MBL grouping, use containers from rawData.containers
      if (allContainers.length === 0 && rawData.containers && Array.isArray(rawData.containers)) {
        allContainers = rawData.containers.map((container: any, index: number) => ({
          id: cargoesFlowShipment.id,
          containerNumber: container.containerNumber || cargoesFlowShipment.containerNumber,
          shipmentReference: cargoesFlowShipment.shipmentReference,
          containerType: container.containerType || cargoesFlowShipment.containerType,
          bookingReference: container.bookingReference || cargoesFlowShipment.bookingNumber,
          voyageNumber: container.voyageNumber || cargoesFlowShipment.voyageNumber,
          weight: container.weight,
          sealNumber: container.sealNumber,
          containerEta: container.containerEta || cargoesFlowShipment.eta,
          containerAta: container.containerAta,
          lastFreeDay: container.lastFreeDay,
          dailyFeeRate: container.dailyFeeRate,
          detentionFee: container.detentionFee,
          pickupChassis: container.pickupChassis,
          yardLocation: container.yardLocation,
          containerStatus: container.containerStatus || cargoesFlowShipment.status,
          rawData: container.rawData || {},
        }));
      }
      
      res.json({
        ...cargoesFlowShipment,
        containers: allContainers,
        milestones,
        source: 'api',
        isUserCreated: false,
      });
    } catch (error) {
      console.error("Error fetching shipment:", error);
      res.status(500).json({ error: "Failed to fetch shipment" });
    }
  });

  app.patch("/api/shipments/:id", async (req, res) => {
    try {
      const shipmentId = req.params.id;
      const {
        containerNumber,
        containerType,
        containerStatus,
        voyageNumber,
        bookingReference,
        sealNumber,
        weight,
        containerEta,
        containerAta,
        lastFreeDay,
        dailyFeeRate,
        detentionFee,
        pickupChassis,
        yardLocation,
        // Terminal info fields
        terminalName,
        terminalPort,
        terminalYardLocation,
        terminalPickupChassis,
        terminalFullOut,
        terminalPickupAppointment,
        terminalEmptyReturned,
        terminalAvailableForPickup,
        demurrage,
        detention,
        ...otherFields
      } = req.body;

      // First check if it's a Cargoes Flow shipment
      const cargoesFlowShipment = await storage.getCargoesFlowShipmentById(shipmentId);
      
      if (cargoesFlowShipment) {
        // Update Cargoes Flow shipment table
        await storage.updateCargoesFlowShipment(shipmentId, {
          containerNumber,
          containerType,
          voyageNumber,
          bookingNumber: bookingReference,
        });
        
        // Update or create containers array in rawData
        const existingContainers = cargoesFlowShipment.rawData?.containers || [];
        let updatedContainers;
        
        if (existingContainers.length > 0) {
          // Update existing first container
          updatedContainers = [...existingContainers];
          updatedContainers[0] = {
            ...updatedContainers[0],
            containerNumber: containerNumber !== undefined ? containerNumber : updatedContainers[0].containerNumber,
            containerType: containerType !== undefined ? containerType : updatedContainers[0].containerType,
            containerStatus: containerStatus !== undefined ? containerStatus : updatedContainers[0].containerStatus,
            voyageNumber: voyageNumber !== undefined ? voyageNumber : updatedContainers[0].voyageNumber,
            bookingReference: bookingReference !== undefined ? bookingReference : updatedContainers[0].bookingReference,
            sealNumber: sealNumber !== undefined ? sealNumber : updatedContainers[0].sealNumber,
            weight: weight !== undefined ? weight : updatedContainers[0].weight,
            containerEta: containerEta !== undefined ? containerEta : updatedContainers[0].containerEta,
            containerAta: containerAta !== undefined ? containerAta : updatedContainers[0].containerAta,
            lastFreeDay: lastFreeDay !== undefined ? lastFreeDay : updatedContainers[0].lastFreeDay,
            dailyFeeRate: dailyFeeRate !== undefined ? dailyFeeRate : updatedContainers[0].dailyFeeRate,
            detentionFee: detentionFee !== undefined ? detentionFee : updatedContainers[0].detentionFee,
            pickupChassis: pickupChassis !== undefined ? pickupChassis : updatedContainers[0].pickupChassis,
            yardLocation: yardLocation !== undefined ? yardLocation : updatedContainers[0].yardLocation,
          };
        } else {
          // Create new container from shipment data
          updatedContainers = [{
            containerNumber: containerNumber || cargoesFlowShipment.containerNumber || "",
            containerType: containerType || cargoesFlowShipment.containerType || "",
            containerStatus: containerStatus || "",
            voyageNumber: voyageNumber || cargoesFlowShipment.voyageNumber || "",
            bookingReference: bookingReference || cargoesFlowShipment.bookingNumber || "",
            sealNumber: sealNumber || "",
            weight: weight || "",
            containerEta: containerEta || "",
            containerAta: containerAta || "",
            lastFreeDay: lastFreeDay || "",
            dailyFeeRate: dailyFeeRate || "",
            detentionFee: detentionFee || "",
            pickupChassis: pickupChassis || "",
            yardLocation: yardLocation || "",
          }];
        }
        
        // Update terminal info in rawData
        const updatedRawData: any = {
          ...cargoesFlowShipment.rawData,
          containers: updatedContainers,
        };
        
        // Helper function to set value only if it's not an empty string
        const setValueIfProvided = (key: string, value: any) => {
          if (value !== undefined && value !== null && value !== '') {
            updatedRawData[key] = value;
          } else if (value === '') {
            // Remove the field if empty string is provided
            delete updatedRawData[key];
          }
        };
        
        // Update terminal fields if provided
        setValueIfProvided('terminalName', terminalName);
        setValueIfProvided('terminalPort', terminalPort);
        setValueIfProvided('terminalYardLocation', terminalYardLocation);
        setValueIfProvided('terminalPickupChassis', terminalPickupChassis);
        setValueIfProvided('terminalFullOut', terminalFullOut);
        setValueIfProvided('terminalPickupAppointment', terminalPickupAppointment);
        setValueIfProvided('terminalEmptyReturned', terminalEmptyReturned);
        setValueIfProvided('lastFreeDay', lastFreeDay);
        setValueIfProvided('demurrage', demurrage);
        setValueIfProvided('detention', detention);
        
        // Handle boolean separately
        if (terminalAvailableForPickup !== undefined) {
          updatedRawData.terminalAvailableForPickup = terminalAvailableForPickup;
        }
        
        try {
          await storage.updateCargoesFlowShipment(shipmentId, {
            rawData: updatedRawData,
          });
          
          const updated = await storage.getCargoesFlowShipmentById(shipmentId);
          if (!updated) {
            return res.status(404).json({ error: "Shipment not found after update" });
          }
          
          const containers = updated?.rawData?.containers || [];
          const milestones = updated?.rawData?.milestones || [];
          return res.json({
            ...updated,
            containers,
            milestones,
            source: 'api',
            isUserCreated: false,
          });
        } catch (dbError: any) {
          console.error("Database error updating terminal info:", dbError);
          // Return a more specific error message
          if (dbError.message?.includes('Connection terminated') || dbError.message?.includes('ECONNRESET')) {
            return res.status(503).json({ 
              error: "Database connection error. Please try again in a moment.",
              details: "The database connection was interrupted. This may be temporary."
            });
          }
          throw dbError; // Re-throw to be caught by outer try-catch
        }
      }
      
      // Otherwise, update user-created shipment
      const shipment = await storage.updateShipment(shipmentId, {
        containerNumber,
        containerType,
        voyageNumber,
        bookingNumber: bookingReference,
        ...otherFields,
      });
      
      if (!shipment) {
        return res.status(404).json({ error: "Shipment not found" });
      }
      
      // Update the first container if it exists
      const containers = await storage.getContainers(shipmentId);
      if (containers && containers.length > 0) {
        const updateData: any = {};
        if (containerNumber) updateData.containerNumber = containerNumber;
        if (containerType) updateData.containerType = containerType;
        if (containerStatus) updateData.status = containerStatus;
        if (weight) updateData.weight = weight;
        if (containerEta) updateData.estimatedArrival = containerEta;
        if (lastFreeDay) updateData.lastFreeDay = lastFreeDay;
        if (dailyFeeRate) updateData.dailyFeeRate = dailyFeeRate;
        if (detentionFee) updateData.detentionFee = detentionFee;
        if (pickupChassis) updateData.pickupChassis = pickupChassis;
        if (yardLocation) updateData.yardLocation = yardLocation;
        
        await storage.updateContainer(containers[0].id, updateData);
      }
      
      res.json(shipment);
    } catch (error) {
      console.error("Error updating shipment:", error);
      res.status(400).json({ error: "Failed to update shipment" });
    }
  });

  app.delete("/api/shipments/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteShipment(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Shipment not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting shipment:", error);
      res.status(500).json({ error: "Failed to delete shipment" });
    }
  });

  app.get("/api/shipments/:shipmentId/users", async (req, res) => {
    try {
      const shipmentId = req.params.shipmentId;
      
      // Check if it's a Cargoes Flow shipment
      const cargoesFlowShipment = await storage.getCargoesFlowShipmentById(shipmentId);
      
      if (cargoesFlowShipment) {
        const shipmentUsers = await storage.getCargoesFlowShipmentUsers(shipmentId);
        res.json(shipmentUsers);
      } else {
        const shipmentUsers = await storage.getShipmentUsers(shipmentId);
        res.json(shipmentUsers);
      }
    } catch (error) {
      console.error("Error getting shipment users:", error);
      res.status(500).json({ error: "Failed to get shipment users" });
    }
  });

  app.post("/api/shipments/:shipmentId/users", async (req, res) => {
    try {
      const { userIds } = req.body;
      const shipmentId = req.params.shipmentId;
      
      // Check if it's a Cargoes Flow shipment
      const cargoesFlowShipment = await storage.getCargoesFlowShipmentById(shipmentId);
      
      if (cargoesFlowShipment) {
        await storage.setCargoesFlowShipmentUsers(shipmentId, userIds);
      } else {
        await storage.setShipmentUsers(shipmentId, userIds);
      }
      
      res.status(200).json({ success: true });
    } catch (error) {
      console.error("Error setting shipment users:", error);
      res.status(500).json({ error: "Failed to set shipment users" });
    }
  });

  app.post("/api/shipments/:shipmentId/milestones", async (req, res) => {
    try {
      const validatedData = insertMilestoneSchema.parse({
        ...req.body,
        shipmentId: req.params.shipmentId,
      });
      const milestone = await storage.createMilestone(validatedData);

      const allMilestones = await storage.getMilestones(req.params.shipmentId);
      const milestonesWithDelays = detectDelays(allMilestones);
      const newStatus = calculateShipmentStatus(milestonesWithDelays);
      await storage.updateShipment(req.params.shipmentId, { status: newStatus });

      res.status(201).json(milestone);
    } catch (error) {
      console.error("Error creating milestone:", error);
      res.status(400).json({ error: "Failed to create milestone" });
    }
  });

  app.patch("/api/milestones/:id", async (req, res) => {
    try {
      const milestone = await storage.updateMilestone(req.params.id, req.body);
      if (!milestone) {
        return res.status(404).json({ error: "Milestone not found" });
      }

      const allMilestones = await storage.getMilestones(milestone.shipmentId);
      const milestonesWithDelays = detectDelays(allMilestones);
      const newStatus = calculateShipmentStatus(milestonesWithDelays);
      await storage.updateShipment(milestone.shipmentId, { status: newStatus });

      res.json(milestone);
    } catch (error) {
      console.error("Error updating milestone:", error);
      res.status(400).json({ error: "Failed to update milestone" });
    }
  });

  app.delete("/api/milestones/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteMilestone(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Milestone not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting milestone:", error);
      res.status(500).json({ error: "Failed to delete milestone" });
    }
  });

  app.post("/api/shipments/:id/status", async (req, res) => {
    try {
      const shipment = await storage.getShipmentById(req.params.id);
      if (!shipment) {
        return res.status(404).json({ error: "Shipment not found" });
      }

      const milestones = await storage.getMilestones(req.params.id);
      const milestonesWithDelays = detectDelays(milestones);
      
      for (const milestone of milestonesWithDelays) {
        if (milestone.status === "delayed") {
          await storage.updateMilestone(milestone.id, { status: "delayed" });
        }
      }

      const newStatus = req.body.status || calculateShipmentStatus(milestonesWithDelays);
      const updatedShipment = await storage.updateShipment(req.params.id, { status: newStatus });

      const delayedMilestones = milestonesWithDelays.filter(m => m.status === "delayed");

      res.json({
        shipment: updatedShipment,
        milestones: milestonesWithDelays,
        delays: delayedMilestones.length,
        delayedMilestones,
      });
    } catch (error) {
      console.error("Error updating shipment status:", error);
      res.status(500).json({ error: "Failed to update shipment status" });
    }
  });

  app.get("/api/containers", async (req, res) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const pageSize = parseInt(req.query.pageSize as string) || 20;
      const search = req.query.search as string || "";
      const sortFieldsParam = req.query.sortFields as string;

      // Parse sort fields from query string
      let sortFields: Array<{ field: string; direction: "asc" | "desc" }> = [];
      if (sortFieldsParam) {
        try {
          sortFields = JSON.parse(sortFieldsParam);
        } catch (e) {
          console.error("Error parsing sortFields:", e);
        }
      }

      // Parse filters from query string
      const filters = {
        status: req.query.status as string,
        carrier: req.query.carrier as string,
        origin: req.query.origin as string,
        etaFrom: req.query.etaFrom as string,
        etaTo: req.query.etaTo as string,
      };

      // Parse user filter
      let filterUsers: string[] = [];
      if (req.query.filterUsers) {
        try {
          filterUsers = JSON.parse(req.query.filterUsers as string);
        } catch (e) {
          console.error("Error parsing filterUsers:", e);
        }
      }

      // Get current user from session and apply role-based filtering
      const user = req.user as User | undefined;
      let userName: string | undefined;
      let userOffice: string | undefined;
      let userRole: string | undefined;

      if (user) {
        userRole = user.role;
        if (user.role === 'User') {
          // User role: filter by name matching salesRepNames
          userName = user.name;
        } else if (user.role === 'Manager') {
          // Manager role: filter by office matching officeName
          userOffice = user.office;
        }
        // Admin role: no filtering
      }

      const result = await storage.getPaginatedContainers(
        { page, pageSize, sortFields },
        filters,
        search,
        userName,
        userOffice,
        userRole,
        filterUsers
      );
      
      res.json(result);
    } catch (error) {
      console.error("Error fetching containers:", error);
      res.status(500).json({ error: "Failed to fetch containers" });
    }
  });

  app.get("/api/containers/:id", async (req, res) => {
    try {
      const container = await storage.getContainerById(req.params.id);
      if (!container) {
        return res.status(404).json({ error: "Container not found" });
      }

      const [exceptions, vesselPosition, railSegments, timelineEvents] = await Promise.all([
        storage.getExceptionsByContainerId(container.id),
        storage.getVesselPositionByContainerId(container.id),
        storage.getRailSegmentsByContainerId(container.id),
        storage.getTimelineEventsByContainerId(container.id),
      ]);

      res.json({
        ...container,
        exceptions,
        vesselPosition: vesselPosition || null,
        railSegments,
        timeline: timelineEvents,
      });
    } catch (error) {
      console.error("Error fetching container:", error);
      res.status(500).json({ error: "Failed to fetch container" });
    }
  });

  app.get("/api/containers/search", async (req, res) => {
    try {
      const query = req.query.q as string;
      if (!query) {
        return res.status(400).json({ error: "Search query is required" });
      }
      
      const containers = await storage.searchContainers(query);
      res.json(containers);
    } catch (error) {
      console.error("Error searching containers:", error);
      res.status(500).json({ error: "Failed to search containers" });
    }
  });

  app.post("/api/containers/manual-update", async (req, res) => {
    try {
      const updateData = req.body;
      
      // First check if container exists
      let container = await storage.getContainerByNumber(updateData.containerNumber);
      
      if (!container) {
        // Create new container if it doesn't exist
        container = await storage.createContainer({
          containerNumber: updateData.containerNumber,
          shipmentId: updateData.shipmentId || "",
          status: updateData.currentStatus,
          origin: updateData.origin || "TBD",
          destination: updateData.destination || "TBD",
          carrier: updateData.carrier || "",
          eta: updateData.eta || "",
          estimatedArrival: updateData.eta || "",
          lastFreeDay: updateData.lastFreeDay || null,
          vesselName: updateData.vesselName || "",
          masterBillOfLading: "",
          bookingNumber: "",
          containerType: "40HC",
          weight: "0",
          volume: "0",
          progress: 0,
          riskLevel: "medium",
        });
      } else {
        // Update existing container
        container = await storage.updateContainer(container.id, {
          status: updateData.currentStatus,
          carrier: updateData.carrier || container.carrier,
          vesselName: updateData.vesselName || container.vesselName,
          eta: updateData.eta || container.eta,
          estimatedArrival: updateData.eta || container.estimatedArrival,
          lastFreeDay: updateData.lastFreeDay || container.lastFreeDay,
        });
      }

      // Create timeline event
      if (container) {
        await storage.createTimelineEvent({
          containerId: container.id,
          title: updateData.eventType || `Status: ${updateData.currentStatus}`,
          location: updateData.currentLocation || "Unknown",
          timestamp: updateData.eventTimestamp || new Date().toISOString(),
          completed: true,
        });
      }

      // Log the update in audit trail
      await storage.createAuditLog({
        userId: updateData.updatedBy || null,
        action: container ? "UPDATE" : "CREATE",
        entityType: "CONTAINER_UPDATE",
        entityId: container?.id || null,
        details: {
          containerNumber: updateData.containerNumber,
          currentStatus: updateData.currentStatus,
          currentLocation: updateData.currentLocation,
          eventType: updateData.eventType,
          eventTimestamp: updateData.eventTimestamp,
          updatedBy: updateData.updatedBy,
          updatedByName: updateData.updatedByName,
          notes: updateData.notes,
        },
        ipAddress: req.ip,
      });

      // Create notification for status change
      if (container) {
        // Get all users to notify (in a real system, this would be filtered by assignment)
        const users = await storage.getAllUsers();
        
        // Determine notification type and priority based on status
        let notificationType = "STATUS_CHANGE";
        let priority = "normal";
        
        if (updateData.currentStatus === "delayed") {
          notificationType = "DELAY";
          priority = "high";
        } else if (updateData.currentStatus === "customs-clearance") {
          notificationType = "CUSTOMS_HOLD";
          priority = "high";
        } else if (updateData.currentStatus === "delivered") {
          notificationType = "ARRIVAL";
          priority = "normal";
        }
        
        // Create notifications for all users
        for (const user of users) {
          await storage.createNotification({
            userId: user.id,
            type: notificationType,
            priority: priority,
            title: `Container ${updateData.containerNumber} ${updateData.currentStatus}`,
            message: `Container is now ${updateData.currentStatus} at ${updateData.currentLocation}`,
            entityType: "CONTAINER",
            entityId: container.id,
            metadata: {
              containerNumber: updateData.containerNumber,
              oldStatus: container.status,
              newStatus: updateData.currentStatus,
              location: updateData.currentLocation,
              updatedBy: updateData.updatedByName,
            },
            isRead: false,
          });
        }
      }

      res.json(container);
    } catch (error) {
      console.error("Error updating container:", error);
      res.status(500).json({ error: "Failed to update container" });
    }
  });

  app.post("/api/containers", async (req, res) => {
    try {
      const validatedData = insertContainerSchema.parse(req.body.container);
      const container = await storage.createContainer(validatedData);

      // Create notification for new container
      const users = await storage.getAllUsers();
      for (const user of users) {
        await storage.createNotification({
          userId: user.id,
          type: "STATUS_CHANGE",
          priority: "normal",
          title: `New container ${validatedData.containerNumber}`,
          message: `Container ${validatedData.containerNumber} has been added to the system`,
          entityType: "CONTAINER",
          entityId: container.id,
          metadata: {
            containerNumber: validatedData.containerNumber,
            status: validatedData.status,
            origin: validatedData.origin,
            destination: validatedData.destination,
          },
          isRead: false,
        });
      }

      if (req.body.exceptions && Array.isArray(req.body.exceptions)) {
        await Promise.all(
          req.body.exceptions.map((exception: any) =>
            storage.createException({
              ...exception,
              containerId: container.id,
            })
          )
        );
      }

      if (req.body.vesselPosition) {
        await storage.createVesselPosition({
          ...req.body.vesselPosition,
          containerId: container.id,
        });
      }

      if (req.body.railSegments && Array.isArray(req.body.railSegments)) {
        await Promise.all(
          req.body.railSegments.map((segment: any) =>
            storage.createRailSegment({
              ...segment,
              containerId: container.id,
            })
          )
        );
      }

      if (req.body.timeline && Array.isArray(req.body.timeline)) {
        await Promise.all(
          req.body.timeline.map((event: any) =>
            storage.createTimelineEvent({
              ...event,
              containerId: container.id,
            })
          )
        );
      }

      res.status(201).json(container);
    } catch (error) {
      console.error("Error creating container:", error);
      res.status(400).json({ error: "Failed to create container" });
    }
  });

  app.patch("/api/containers/:id", async (req, res) => {
    try {
      const containerId = req.params.id;
      const containerNumber = req.body.containerNumber;
      const railData = req.body.rawData?.rail;
      
      // First, try to find this as a Cargoes Flow shipment (containers are stored in rawData.containers)
      let cargoesFlowShipment = await storage.getCargoesFlowShipmentById(containerId);
      
      // If not found by ID and we have containerNumber, try to find by container number
      if (!cargoesFlowShipment && containerNumber) {
        cargoesFlowShipment = await storage.getCargoesFlowShipmentByContainer(containerNumber);
        // Try searching in rawData.containers array if still not found
        if (!cargoesFlowShipment) {
          cargoesFlowShipment = await storage.getCargoesFlowShipmentByContainerInRawData(containerNumber);
        }
      }
      
      // Handle rail info update in rawData for Cargoes Flow shipments
      if (railData) {
        let targetContainerNumber = containerNumber;
        
        // If we don't have a shipment yet, try to find it by container number to get the MBL
        if (!cargoesFlowShipment && targetContainerNumber) {
          const tempShipment = await storage.getCargoesFlowShipmentByContainer(targetContainerNumber);
          if (tempShipment) {
            cargoesFlowShipment = tempShipment;
            console.log(`[Rail Update] Found shipment by container lookup, MBL: ${tempShipment.mblNumber}`);
          }
        }
        
        // If still no shipment, try searching through MBL shipments
        if (!cargoesFlowShipment && targetContainerNumber) {
          // We need to find the MBL first - try searching all shipments
          // This is expensive but necessary as a last resort
          console.log(`[Rail Update] Attempting broad search for container ${targetContainerNumber}...`);
          // For now, return error - we'd need a different approach to search all shipments
          return res.status(404).json({ 
            error: "Shipment not found",
            details: `Could not find a Cargoes Flow shipment with ID ${containerId} or container number ${containerNumber}. Please ensure the container exists in the system.`
          });
        }
        
        if (!cargoesFlowShipment) {
          console.log(`[Rail Update] No Cargoes Flow shipment found for rail update`);
          return res.status(404).json({ 
            error: "Shipment not found",
            details: `Could not find a Cargoes Flow shipment with ID ${containerId} or container number ${containerNumber}`
          });
        }
        
        const existingContainers = cargoesFlowShipment.rawData?.containers || [];
        let containerIndex = -1;
        
        // Try to find container by matching containerNumber if available
        if (targetContainerNumber) {
          containerIndex = existingContainers.findIndex((c: any) => 
            c.containerNumber === targetContainerNumber
          );
        }
        
        // If not found in current shipment and we have an MBL, search across all shipments with same MBL
        if (containerIndex < 0 && cargoesFlowShipment.mblNumber && targetContainerNumber) {
          const mblToSearch = cargoesFlowShipment.mblNumber;
          const allShipmentsForMbl = await storage.getAllCargoesFlowShipmentsByMbl(mblToSearch);
          
          // Find the shipment that contains this container
          for (const shipment of allShipmentsForMbl) {
            if (shipment.containerNumber === targetContainerNumber) {
              // This shipment IS the container - update it directly
              cargoesFlowShipment = shipment;
              const shipmentContainers = shipment.rawData?.containers || [];
              
              // Check if container exists in this shipment's containers array
              const foundIndex = shipmentContainers.findIndex((c: any) => 
                c.containerNumber === targetContainerNumber
              );
              
              if (foundIndex >= 0) {
                // Update container in the array
                const updatedContainers = [...shipmentContainers];
                updatedContainers[foundIndex] = {
                  ...updatedContainers[foundIndex],
                  rawData: {
                    ...(updatedContainers[foundIndex].rawData || {}),
                    rail: railData,
                  },
                };

                await storage.updateCargoesFlowShipment(shipment.id, {
                  rawData: {
                    ...shipment.rawData,
                    containers: updatedContainers,
                  },
                });

                console.log(`[Rail Update] ✅ Saved rail data to container ${targetContainerNumber} in shipment ${shipment.id}`);

                return res.json({
                  id: shipment.id,
                  containerNumber: targetContainerNumber,
                  rawData: {
                    ...(updatedContainers[foundIndex].rawData || {}),
                    rail: railData,
                  },
                });
              } else {
                // Container not in array, but shipment's containerNumber matches
                // Create container entry in rawData.containers if it doesn't exist
                const updatedContainers = shipmentContainers.length > 0 ? [...shipmentContainers] : [{
                  containerNumber: targetContainerNumber,
                  containerType: shipment.containerType,
                  rawData: {},
                }];
                
                const containerToUpdate = updatedContainers.find((c: any) => 
                  c.containerNumber === targetContainerNumber
                ) || updatedContainers[0];
                
                const containerIndexToUpdate = updatedContainers.findIndex((c: any) => 
                  c.containerNumber === targetContainerNumber
                );
                
                if (containerIndexToUpdate >= 0) {
                  updatedContainers[containerIndexToUpdate] = {
                    ...containerToUpdate,
                    rawData: {
                      ...(containerToUpdate.rawData || {}),
                      rail: railData,
                    },
                  };
                } else {
                  updatedContainers[0] = {
                    ...containerToUpdate,
                    rawData: {
                      ...(containerToUpdate.rawData || {}),
                      rail: railData,
                    },
                  };
                }

                await storage.updateCargoesFlowShipment(shipment.id, {
                  rawData: {
                    ...shipment.rawData,
                    containers: updatedContainers,
                  },
                });

                console.log(`[Rail Update] ✅ Created container entry with rail data for ${targetContainerNumber} in shipment ${shipment.id}`);

                return res.json({
                  id: shipment.id,
                  containerNumber: targetContainerNumber,
                  rawData: {
                    ...(updatedContainers[containerIndexToUpdate >= 0 ? containerIndexToUpdate : 0].rawData || {}),
                    rail: railData,
                  },
                });
              }
            } else {
              // Check if this shipment's containers array has the container
              const shipmentContainers = shipment.rawData?.containers || [];
              const foundIndex = shipmentContainers.findIndex((c: any) => 
                c.containerNumber === targetContainerNumber
              );
              
              if (foundIndex >= 0) {
                // Found it in this shipment
                const updatedContainers = [...shipmentContainers];
                updatedContainers[foundIndex] = {
                  ...updatedContainers[foundIndex],
                  rawData: {
                    ...(updatedContainers[foundIndex].rawData || {}),
                    rail: railData,
                  },
                };

                await storage.updateCargoesFlowShipment(shipment.id, {
                  rawData: {
                    ...shipment.rawData,
                    containers: updatedContainers,
                  },
                });

                return res.json({
                  id: shipment.id,
                  containerNumber: targetContainerNumber,
                  rawData: {
                    ...(updatedContainers[foundIndex].rawData || {}),
                    rail: railData,
                  },
                });
              }
            }
          }
        }
        
        // If found in current shipment's containers array
        if (containerIndex >= 0) {
          const updatedContainers = [...existingContainers];
          updatedContainers[containerIndex] = {
            ...updatedContainers[containerIndex],
            rawData: {
              ...(updatedContainers[containerIndex].rawData || {}),
              rail: railData,
            },
          };

          // Use the found shipment's ID, not the one from the URL
          const shipmentIdToUpdate = cargoesFlowShipment.id;
          await storage.updateCargoesFlowShipment(shipmentIdToUpdate, {
            rawData: {
              ...cargoesFlowShipment.rawData,
              containers: updatedContainers,
            },
          });

          return res.json({
            id: shipmentIdToUpdate,
            containerNumber: targetContainerNumber || existingContainers[containerIndex]?.containerNumber,
            rawData: {
              ...(existingContainers[containerIndex]?.rawData || {}),
              rail: railData,
            },
          });
        }
        
        // If container not found and we have containerNumber, create it in the current shipment
        if (targetContainerNumber && cargoesFlowShipment) {
          const updatedContainers = existingContainers.length > 0 ? [...existingContainers] : [];
          
          // Check if container already exists
          const existingIndex = updatedContainers.findIndex((c: any) => 
            c.containerNumber === targetContainerNumber
          );
          
          if (existingIndex >= 0) {
            // Update existing
            updatedContainers[existingIndex] = {
              ...updatedContainers[existingIndex],
              rawData: {
                ...(updatedContainers[existingIndex].rawData || {}),
                rail: railData,
              },
            };
          } else {
            // Create new container entry
            updatedContainers.push({
              containerNumber: targetContainerNumber,
              containerType: cargoesFlowShipment.containerType,
              rawData: {
                rail: railData,
              },
            });
          }

          // Use the found shipment's ID, not the one from the URL
          const shipmentIdToUpdate = cargoesFlowShipment.id;
          await storage.updateCargoesFlowShipment(shipmentIdToUpdate, {
            rawData: {
              ...cargoesFlowShipment.rawData,
              containers: updatedContainers,
            },
          });

          const finalContainer = updatedContainers.find((c: any) => 
            c.containerNumber === targetContainerNumber
          ) || updatedContainers[updatedContainers.length - 1];

          return res.json({
            id: shipmentIdToUpdate,
            containerNumber: targetContainerNumber,
            rawData: finalContainer.rawData || { rail: railData },
          });
        }
        
        // If we still haven't found it and no containerNumber provided, return error
        if (!targetContainerNumber) {
          return res.status(400).json({ 
            error: "Container number is required to update rail information for Cargoes Flow shipments" 
          });
        }
      }

      // Standard container update (for non-Cargoes Flow containers)
      const container = await storage.getContainerById(containerId);
      if (!container) {
        return res.status(404).json({ 
          error: "Container not found",
          details: `Could not find a container or shipment with ID ${containerId}. If this is a Cargoes Flow shipment, ensure the container number ${containerNumber} is correct.`
        });
      }

      const updatedContainer = await storage.updateContainer(containerId, req.body);
      if (!updatedContainer) {
        return res.status(404).json({ error: "Container not found" });
      }
      res.json(updatedContainer);
    } catch (error) {
      console.error(`[Rail Update] ERROR:`, error);
      res.status(400).json({ error: "Failed to update container" });
    }
  });

  app.delete("/api/containers/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteContainer(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Container not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting container:", error);
      res.status(500).json({ error: "Failed to delete container" });
    }
  });

  // Rail Segments Routes
  app.post("/api/rail-segments", async (req, res) => {
    try {
      const validatedData = insertRailSegmentSchema.parse(req.body);
      const railSegment = await storage.createRailSegment(validatedData);
      res.status(201).json(railSegment);
    } catch (error) {
      console.error("Error creating rail segment:", error);
      res.status(400).json({ error: "Failed to create rail segment" });
    }
  });

  app.get("/api/exceptions", async (req, res) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
      const exceptions = await storage.getAllExceptions(limit);
      res.json(exceptions);
    } catch (error) {
      console.error("Error fetching exceptions:", error);
      res.status(500).json({ error: "Failed to fetch exceptions" });
    }
  });

  app.get("/api/saved-views", async (req, res) => {
    try {
      const views = await storage.getAllSavedViews();
      res.json(views);
    } catch (error) {
      console.error("Error fetching saved views:", error);
      res.status(500).json({ error: "Failed to fetch saved views" });
    }
  });

  app.get("/api/saved-views/:id", async (req, res) => {
    try {
      const view = await storage.getSavedViewById(req.params.id);
      if (!view) {
        return res.status(404).json({ error: "Saved view not found" });
      }
      res.json(view);
    } catch (error) {
      console.error("Error fetching saved view:", error);
      res.status(500).json({ error: "Failed to fetch saved view" });
    }
  });

  app.post("/api/saved-views", async (req, res) => {
    try {
      const parsed = insertSavedViewSchema.parse(req.body);
      const view = await storage.createSavedView(parsed);
      res.status(201).json(view);
    } catch (error) {
      console.error("Error creating saved view:", error);
      res.status(400).json({ error: "Failed to create saved view" });
    }
  });

  app.patch("/api/saved-views/:id", async (req, res) => {
    try {
      const parsed = insertSavedViewSchema.partial().parse(req.body);
      const view = await storage.updateSavedView(req.params.id, parsed);
      if (!view) {
        return res.status(404).json({ error: "Saved view not found" });
      }
      res.json(view);
    } catch (error) {
      console.error("Error updating saved view:", error);
      res.status(400).json({ error: "Failed to update saved view" });
    }
  });

  app.delete("/api/saved-views/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteSavedView(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Saved view not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting saved view:", error);
      res.status(500).json({ error: "Failed to delete saved view" });
    }
  });

  app.get("/api/custom-entries/:type", async (req, res) => {
    try {
      const { type } = req.params;
      if (!['carrier', 'port', 'terminal'].includes(type)) {
        return res.status(400).json({ error: "Invalid type. Must be 'carrier', 'port', or 'terminal'" });
      }
      const entries = await storage.getCustomEntriesByType(type);
      res.json(entries);
    } catch (error) {
      console.error(`Error fetching custom ${req.params.type} entries:`, error);
      res.status(500).json({ error: `Failed to fetch custom ${req.params.type} entries` });
    }
  });

  app.post("/api/custom-entries", async (req, res) => {
    try {
      const user = req.user as User | undefined;
      if (!user) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const parsed = insertCustomEntrySchema.parse({
        ...req.body,
        createdBy: user.id,
      });
      
      const entry = await storage.createCustomEntry(parsed);
      res.status(201).json(entry);
    } catch (error) {
      console.error("Error creating custom entry:", error);
      res.status(400).json({ error: "Failed to create custom entry" });
    }
  });

  app.get("/api/integrations", async (req, res) => {
    try {
      const integrations = await storage.getAllIntegrationConfigs();
      res.json(integrations);
    } catch (error) {
      console.error("Error fetching integrations:", error);
      res.status(500).json({ error: "Failed to fetch integrations" });
    }
  });

  app.get("/api/integrations/:id", async (req, res) => {
    try {
      const integration = await storage.getIntegrationConfigById(req.params.id);
      if (!integration) {
        return res.status(404).json({ error: "Integration not found" });
      }
      res.json(integration);
    } catch (error) {
      console.error("Error fetching integration:", error);
      res.status(500).json({ error: "Failed to fetch integration" });
    }
  });

  app.post("/api/integrations", async (req, res) => {
    try {
      const parsed = insertIntegrationConfigSchema.parse(req.body);
      const integration = await storage.createIntegrationConfig(parsed);
      
      if (integration.isActive) {
        integrationOrchestrator.startIntegration(integration);
      }
      
      res.status(201).json(integration);
    } catch (error) {
      console.error("Error creating integration:", error);
      res.status(400).json({ error: "Failed to create integration" });
    }
  });

  app.patch("/api/integrations/:id", async (req, res) => {
    try {
      const parsed = insertIntegrationConfigSchema.partial().parse(req.body);
      const integration = await storage.updateIntegrationConfig(req.params.id, parsed);
      
      if (!integration) {
        return res.status(404).json({ error: "Integration not found" });
      }

      if (integration.isActive) {
        integrationOrchestrator.startIntegration(integration);
      } else {
        integrationOrchestrator.stopIntegration(integration.id);
      }
      
      res.json(integration);
    } catch (error) {
      console.error("Error updating integration:", error);
      res.status(400).json({ error: "Failed to update integration" });
    }
  });

  app.delete("/api/integrations/:id", async (req, res) => {
    try {
      integrationOrchestrator.stopIntegration(req.params.id);
      
      const deleted = await storage.deleteIntegrationConfig(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Integration not found" });
      }
      
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting integration:", error);
      res.status(500).json({ error: "Failed to delete integration" });
    }
  });

  app.post("/api/integrations/:id/sync", async (req, res) => {
    try {
      await integrationOrchestrator.syncIntegration(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error syncing integration:", error);
      res.status(500).json({ error: "Failed to sync integration" });
    }
  });

  app.get("/api/integrations/:id/logs", async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      const logs = await storage.getIntegrationSyncLogsByIntegrationId(req.params.id, limit);
      res.json(logs);
    } catch (error) {
      console.error("Error fetching integration logs:", error);
      res.status(500).json({ error: "Failed to fetch integration logs" });
    }
  });

  // ===== TMS WEBHOOK ROUTES =====
  const { handleTmsWebhook, sendTestWebhook } = await import("./webhooks/tms-webhook");

  app.post("/api/webhooks/tms", handleTmsWebhook);
  
  app.post("/api/test/webhook", sendTestWebhook);

  app.get("/api/webhooks/tms/logs", async (req, res) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const pageSize = parseInt(req.query.pageSize as string) || 50;
      const operation = req.query.operation as string;
      const excludeOperation = req.query.excludeOperation as string;
      const search = req.query.search as string;

      const result = await storage.getWebhookLogs(
        { page, pageSize },
        { operation, excludeOperation, search }
      );

      res.json(result);
    } catch (error) {
      console.error("Error fetching webhook logs:", error);
      res.status(500).json({ error: "Failed to fetch webhook logs" });
    }
  });

  app.get("/api/webhooks/tms/logs/:id", async (req, res) => {
    try {
      const log = await storage.getWebhookLogById(req.params.id);
      if (!log) {
        return res.status(404).json({ error: "Webhook log not found" });
      }
      res.json(log);
    } catch (error) {
      console.error("Error fetching webhook log:", error);
      res.status(500).json({ error: "Failed to fetch webhook log" });
    }
  });

  app.post("/api/webhooks/tms/retry/:id", async (req, res) => {
    try {
      const log = await storage.getWebhookLogById(req.params.id);
      if (!log) {
        return res.status(404).json({ error: "Webhook log not found" });
      }

      console.log(`[Webhook Retry] Retrying webhook ${log.id}...`);
      
      const { retryWebhook } = await import("./webhooks/tms-webhook");
      await retryWebhook(log.id, log.rawPayload);
      
      console.log(`[Webhook Retry] ✅ Successfully retried webhook ${log.id}`);
      res.json({ success: true, message: "Webhook reprocessed successfully" });
    } catch (error: any) {
      console.error("Error retrying webhook:", error);
      res.status(500).json({ error: error.message || "Failed to retry webhook" });
    }
  });

  app.delete("/api/webhooks/tms/logs/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteWebhookLog(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Webhook log not found" });
      }
      res.json({ success: true, message: "Webhook log deleted successfully" });
    } catch (error) {
      console.error("Error deleting webhook log:", error);
      res.status(500).json({ error: "Failed to delete webhook log" });
    }
  });

  app.post("/api/webhooks/tms/logs/bulk-delete", async (req, res) => {
    try {
      const { shipmentIds } = req.body;
      if (!Array.isArray(shipmentIds) || shipmentIds.length === 0) {
        return res.status(400).json({ error: "shipmentIds array is required" });
      }
      const deletedCount = await storage.deleteWebhookLogsByShipmentIds(shipmentIds);
      res.json({ success: true, deletedCount, message: `Deleted ${deletedCount} webhook logs` });
    } catch (error) {
      console.error("Error bulk deleting webhook logs:", error);
      res.status(500).json({ error: "Failed to bulk delete webhook logs" });
    }
  });

  app.delete("/api/webhooks/tms/logs/all", async (req, res) => {
    try {
      const deletedCount = await storage.deleteAllWebhookLogs();
      res.json({ success: true, deletedCount, message: `Deleted all ${deletedCount} webhook logs` });
    } catch (error) {
      console.error("Error deleting all webhook logs:", error);
      res.status(500).json({ error: "Failed to delete all webhook logs" });
    }
  });

  app.post("/api/webhooks/shipnexus", async (req, res) => {
    try {
      console.log('='.repeat(80));
      console.log('[ShipNexus Webhook] 🔔 WEBHOOK RECEIVED!');
      console.log('[ShipNexus Webhook] Timestamp:', new Date().toISOString());
      console.log('[ShipNexus Webhook] Headers:', JSON.stringify(req.headers, null, 2));
      console.log('[ShipNexus Webhook] Body:', JSON.stringify(req.body, null, 2));
      console.log('='.repeat(80));
      
      const payload = req.body;
      
      const webhook = await storage.createShipNexusWebhook({
        payload,
        shipmentReference: payload.shipmentReference || payload.containerNumber || payload.referenceNumber || null,
        eventType: payload.eventType || payload.type || null,
        status: "received",
        processedAt: null,
      });

      console.log('[ShipNexus Webhook] ✅ Webhook saved to database, ID:', webhook.id);
      console.log('[ShipNexus Webhook] Starting shipment import from ShipNexus API...');
      
      const shipnexusApiUrl = process.env.SHIPNEXUS_API_URL;
      if (shipnexusApiUrl) {
        try {
          console.log('[ShipNexus Import] Fetching latest shipments from ShipNexus API...');
          
          const shipnexusUrl = new URL('/api/shipments', shipnexusApiUrl);
          shipnexusUrl.searchParams.append('page', '1');
          shipnexusUrl.searchParams.append('limit', '100');
          
          const response = await fetch(shipnexusUrl.toString());
          
          if (response.ok) {
            const result = await response.json();
            const shipments = result.data || [];
            
            console.log(`[ShipNexus Import] Fetched ${shipments.length} shipments, importing...`);
            
            let importedCount = 0;
            let updatedCount = 0;
            
            for (const shipment of shipments) {
              try {
                const transformedShipment = {
                  referenceNumber: shipment.containerNumber || `IMPORT-${shipment.id}`,
                  bookingNumber: shipment.shipmentId || '',
                  masterBillOfLading: shipment.mblNumber || '',
                  shipper: shipment.shipper || null,
                  consignee: shipment.consignee || null,
                  originPort: '',
                  destinationPort: '',
                  etd: shipment.shippingDate ? new Date(shipment.shippingDate).toISOString().split('T')[0] : null,
                  eta: null,
                  status: shipment.status || 'active',
                  carrier: null,
                  vesselName: null,
                };
                
                const existingShipment = await storage.getShipmentByReference(transformedShipment.referenceNumber);
                
                if (existingShipment) {
                  await storage.updateShipment(existingShipment.id, transformedShipment);
                  updatedCount++;
                } else {
                  await storage.createShipment(transformedShipment);
                  importedCount++;
                }
              } catch (error) {
                console.error(`[ShipNexus Import] Error importing shipment:`, error);
              }
            }
            
            console.log(`[ShipNexus Import] Complete - Imported: ${importedCount}, Updated: ${updatedCount}`);
          } else {
            console.error(`[ShipNexus Import] API returned ${response.status}`);
          }
        } catch (importError) {
          console.error('[ShipNexus Import] Error importing shipments:', importError);
        }
      } else {
        console.log('[ShipNexus Import] SHIPNEXUS_API_URL not configured, skipping import');
      }

      const mblNumber = payload.mblNumber || payload.masterBillOfLading;
      
      if (mblNumber) {
        console.log(`[Cargoes Flow] Posting shipment to Cargoes Flow: ${mblNumber}`);
        
        const cargoesFlowApiKey = process.env.CARGOES_FLOW_API_KEY;
        
        if (!cargoesFlowApiKey) {
          console.error('[Cargoes Flow] API key not configured');
        } else {
          const cargoesPost = await storage.createCargoesFlowPost({
            shipmentReference: payload.shipmentReference || payload.containerNumber || mblNumber,
            mblNumber,
            webhookId: webhook.id,
            status: "pending",
            responseData: null,
            errorMessage: null,
          });

          try {
            const cargoesResponse = await fetch(
              'https://connect.cargoes.com/flow/api/public_tracking/v1/createShipments',
              {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'x-api-key': cargoesFlowApiKey,
                },
                body: JSON.stringify({
                  mblNumber,
                  uploadType: 'FORM_BY_MBL_NUMBER',
                }),
              }
            );

            const cargoesData = await cargoesResponse.json();

            if (cargoesResponse.ok) {
              await storage.updateCargoesFlowPostStatus(
                cargoesPost.id,
                'success',
                cargoesData,
                undefined
              );
              console.log(`[Cargoes Flow] Successfully posted: ${mblNumber}`);
            } else {
              await storage.updateCargoesFlowPostStatus(
                cargoesPost.id,
                'failed',
                cargoesData,
                cargoesData.message || 'Unknown error'
              );
              console.error(`[Cargoes Flow] Failed to post: ${mblNumber}`, cargoesData);
            }
          } catch (cargoesError: any) {
            await storage.updateCargoesFlowPostStatus(
              cargoesPost.id,
              'failed',
              undefined,
              cargoesError.message || 'Network error'
            );
            console.error(`[Cargoes Flow] Error posting to Cargoes Flow:`, cargoesError);
          }
        }
      } else {
        console.log('[Cargoes Flow] No MBL number found in webhook payload, skipping Cargoes Flow post');
      }

      res.status(200).json({ 
        success: true, 
        webhookId: webhook.id,
        message: "Webhook received successfully" 
      });
    } catch (error) {
      console.error("Error receiving ShipNexus webhook:", error);
      res.status(500).json({ error: "Failed to process webhook" });
    }
  });

  app.get("/api/webhooks/shipnexus", async (req, res) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const pageSize = parseInt(req.query.pageSize as string) || 50;
      const eventType = req.query.eventType as string;
      const status = req.query.status as string;
      const searchQuery = req.query.search as string;

      const result = await storage.getShipNexusWebhooks(
        { page, pageSize },
        { eventType, status, searchQuery }
      );

      res.json(result);
    } catch (error) {
      console.error("Error fetching ShipNexus webhooks:", error);
      res.status(500).json({ error: "Failed to fetch webhooks" });
    }
  });

  app.get("/api/webhooks/shipnexus/:id", async (req, res) => {
    try {
      const webhook = await storage.getShipNexusWebhookById(req.params.id);
      if (!webhook) {
        return res.status(404).json({ error: "Webhook not found" });
      }
      res.json(webhook);
    } catch (error) {
      console.error("Error fetching ShipNexus webhook:", error);
      res.status(500).json({ error: "Failed to fetch webhook" });
    }
  });

  app.patch("/api/webhooks/shipnexus/:id/status", async (req, res) => {
    try {
      const { status } = req.body;
      const webhook = await storage.updateShipNexusWebhookStatus(
        req.params.id,
        status,
        status === "processed" ? new Date() : undefined
      );
      if (!webhook) {
        return res.status(404).json({ error: "Webhook not found" });
      }
      res.json(webhook);
    } catch (error) {
      console.error("Error updating webhook status:", error);
      res.status(500).json({ error: "Failed to update webhook status" });
    }
  });

  app.get("/api/webhooks/shipnexus/monitor/health", async (req, res) => {
    try {
      const now = new Date();
      const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
      const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      const recentWebhooks = await storage.getShipNexusWebhooks(
        { page: 1, pageSize: 100 },
        {}
      );

      const webhooksArray = recentWebhooks.data || [];
      
      const lastWebhook = webhooksArray[0];
      const lastWebhookTime = lastWebhook ? new Date(lastWebhook.createdAt).toISOString() : null;
      
      const webhooksLast5Min = webhooksArray.filter((w: any) => 
        new Date(w.createdAt) > fiveMinutesAgo
      ).length;
      
      const webhooksLastHour = webhooksArray.filter((w: any) => 
        new Date(w.createdAt) > oneHourAgo
      ).length;
      
      const webhooksLast24Hours = webhooksArray.filter((w: any) => 
        new Date(w.createdAt) > twentyFourHoursAgo
      ).length;

      const failedWebhooks = webhooksArray.filter((w: any) => 
        w.status === 'failed'
      ).length;

      const cargoesFlowPosts = await storage.getCargoesFlowPosts(
        { page: 1, pageSize: 100 }
      );
      
      const failedPosts = cargoesFlowPosts.data.filter((p: any) => 
        p.status === 'failed'
      ).length;

      let status: 'healthy' | 'warning' | 'critical' | 'no-data' = 'no-data';
      let message = '';

      if (!lastWebhook) {
        status = 'no-data';
        message = 'No webhooks received yet';
      } else if (webhooksLast5Min > 0) {
        status = 'healthy';
        message = `Receiving webhooks actively (${webhooksLast5Min} in last 5 min)`;
      } else if (webhooksLastHour > 0) {
        status = 'warning';
        const lastTime = lastWebhookTime ? new Date(lastWebhookTime).getTime() : now.getTime();
        message = `No recent activity (last webhook ${Math.round((now.getTime() - lastTime) / 60000)} min ago)`;
      } else {
        status = 'critical';
        message = `No webhook activity in over 1 hour`;
      }

      const config = {
        webhookUrl: `${req.protocol}://${req.get('host')}/api/webhooks/shipnexus`,
        shipnexusApiConfigured: !!process.env.SHIPNEXUS_API_URL,
        cargoesFlowApiConfigured: !!process.env.CARGOES_FLOW_API_KEY,
      };

      res.json({
        status,
        message,
        lastWebhookTime,
        stats: {
          last5Minutes: webhooksLast5Min,
          lastHour: webhooksLastHour,
          last24Hours: webhooksLast24Hours,
          totalReceived: recentWebhooks.pagination?.total || 0,
          failedWebhooks,
          failedCargoesFlowPosts: failedPosts,
        },
        configuration: config,
        timestamp: now,
      });
    } catch (error) {
      console.error("Error checking webhook health:", error);
      res.status(500).json({ error: "Failed to check webhook health" });
    }
  });

  app.post("/api/webhooks/shipnexus/monitor/test", async (req, res) => {
    try {
      const testPayload = {
        testId: `TEST-${Date.now()}`,
        type: 'TEST_WEBHOOK',
        eventType: 'MANUAL_TEST',
        containerNumber: `TEST-CNT-${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
        mblNumber: `TEST-MBL-${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
        shipmentReference: `TEST-REF-${Date.now()}`,
        timestamp: new Date().toISOString(),
        source: 'Manual Test',
        description: 'Manual webhook test from monitoring dashboard',
      };

      const testWebhook = await storage.createShipNexusWebhook({
        payload: testPayload,
        shipmentReference: testPayload.shipmentReference,
        eventType: testPayload.eventType,
        status: "received",
        processedAt: null,
      });

      if (testPayload.mblNumber && process.env.CARGOES_FLOW_API_KEY) {
        const cargoesPost = await storage.createCargoesFlowPost({
          shipmentReference: testPayload.shipmentReference,
          mblNumber: testPayload.mblNumber,
          webhookId: testWebhook.id,
          status: "pending",
          responseData: null,
          errorMessage: null,
        });

        try {
          const cargoesResponse = await fetch(
            'https://connect.cargoes.com/flow/api/public_tracking/v1/createShipments',
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'x-api-key': process.env.CARGOES_FLOW_API_KEY,
              },
              body: JSON.stringify({
                mblNumber: testPayload.mblNumber,
                uploadType: 'FORM_BY_MBL_NUMBER',
              }),
            }
          );

          const cargoesData = await cargoesResponse.json();

          if (cargoesResponse.ok) {
            await storage.updateCargoesFlowPostStatus(
              cargoesPost.id,
              'success',
              cargoesData,
              undefined
            );
          } else {
            await storage.updateCargoesFlowPostStatus(
              cargoesPost.id,
              'failed',
              cargoesData,
              cargoesData.message || 'Test webhook failed'
            );
          }

          res.json({
            success: true,
            message: "Test webhook sent successfully",
            webhookId: testWebhook.id,
            cargoesFlowPostId: cargoesPost.id,
            cargoesFlowResult: cargoesResponse.ok ? 'success' : 'failed',
          });
        } catch (error: any) {
          await storage.updateCargoesFlowPostStatus(
            cargoesPost.id,
            'failed',
            undefined,
            error.message || 'Network error'
          );
          
          res.json({
            success: true,
            message: "Test webhook saved but Cargoes Flow posting failed",
            webhookId: testWebhook.id,
            cargoesFlowPostId: cargoesPost.id,
            cargoesFlowError: error.message,
          });
        }
      } else {
        res.json({
          success: true,
          message: "Test webhook created (Cargoes Flow skipped - no API key)",
          webhookId: testWebhook.id,
        });
      }
    } catch (error) {
      console.error("Error sending test webhook:", error);
      res.status(500).json({ error: "Failed to send test webhook" });
    }
  });

  app.get("/api/webhooks/shipnexus/monitor/stats", async (req, res) => {
    try {
      const daysBack = parseInt(req.query.days as string) || 7;
      const now = new Date();
      const startDate = new Date(now.getTime() - daysBack * 24 * 60 * 60 * 1000);

      const webhooks = await storage.getShipNexusWebhooks(
        { page: 1, pageSize: 10000 },
        {}
      );

      const dailyStats: Record<string, { received: number; failed: number; processed: number }> = {};
      
      for (let i = 0; i < daysBack; i++) {
        const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
        const dateKey = date.toISOString().split('T')[0];
        dailyStats[dateKey] = { received: 0, failed: 0, processed: 0 };
      }

      webhooks.data.forEach((webhook: any) => {
        const webhookDate = new Date(webhook.createdAt);
        if (webhookDate >= startDate) {
          const dateKey = webhookDate.toISOString().split('T')[0];
          if (dailyStats[dateKey]) {
            dailyStats[dateKey].received++;
            if (webhook.status === 'failed') dailyStats[dateKey].failed++;
            if (webhook.status === 'processed') dailyStats[dateKey].processed++;
          }
        }
      });

      const hourlyStats: Record<string, number> = {};
      const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      
      for (let i = 0; i < 24; i++) {
        const hour = new Date(now.getTime() - i * 60 * 60 * 1000);
        const hourKey = `${hour.getHours()}:00`;
        hourlyStats[hourKey] = 0;
      }

      webhooks.data.forEach((webhook: any) => {
        const webhookDate = new Date(webhook.createdAt);
        if (webhookDate >= last24Hours) {
          const hourKey = `${webhookDate.getHours()}:00`;
          hourlyStats[hourKey] = (hourlyStats[hourKey] || 0) + 1;
        }
      });

      res.json({
        dailyStats,
        hourlyStats,
        summary: {
          totalWebhooks: webhooks.pagination?.total || 0,
          averagePerDay: Math.round((webhooks.pagination?.total || 0) / daysBack),
          peakHour: Object.entries(hourlyStats).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A',
        },
      });
    } catch (error) {
      console.error("Error fetching webhook stats:", error);
      res.status(500).json({ error: "Failed to fetch webhook stats" });
    }
  });

  app.get("/api/shipnexus/polling-status", async (req, res) => {
    try {
      const { getPollingStatus } = await import("./polling-scheduler");
      const status = getPollingStatus();
      res.json(status);
    } catch (error) {
      console.error("Error getting polling status:", error);
      res.status(500).json({ error: "Failed to get polling status" });
    }
  });

  app.post("/api/shipnexus/sync-now", async (req, res) => {
    try {
      console.log('[Manual Sync] 🔄 Starting manual sync from ShipNexus...');
      
      const shipnexusApiUrl = process.env.SHIPNEXUS_API_URL;
      
      if (!shipnexusApiUrl) {
        return res.status(500).json({ error: "SHIPNEXUS_API_URL not configured" });
      }

      let allShipments: any[] = [];
      let currentPage = 1;
      let totalPages = 1;
      const pageSize = 100;

      while (currentPage <= totalPages) {
        const shipnexusUrl = new URL('/api/shipments', shipnexusApiUrl);
        shipnexusUrl.searchParams.append('page', currentPage.toString());
        shipnexusUrl.searchParams.append('limit', pageSize.toString());
        
        console.log(`[Manual Sync] Fetching page ${currentPage}/${totalPages}...`);
        const response = await fetch(shipnexusUrl.toString());
        
        if (!response.ok) {
          throw new Error(`ShipNexus API returned ${response.status}`);
        }
        
        const result = await response.json();
        allShipments = allShipments.concat(result.data);
        totalPages = result.pagination.totalPages;
        
        console.log(`[Manual Sync] Fetched page ${currentPage}/${totalPages} (${result.data.length} shipments)`);
        currentPage++;
      }

      console.log(`[Manual Sync] Total shipments fetched: ${allShipments.length}`);

      let importedCount = 0;
      let updatedCount = 0;
      let errorCount = 0;

      for (const shipment of allShipments) {
        try {
          const transformedShipment = {
            referenceNumber: shipment.containerNumber || `IMPORT-${shipment.id}`,
            bookingNumber: shipment.shipmentId || '',
            masterBillOfLading: shipment.mblNumber || '',
            shipper: shipment.shipper || null,
            consignee: shipment.consignee || null,
            originPort: '',
            destinationPort: '',
            etd: shipment.shippingDate ? new Date(shipment.shippingDate).toISOString().split('T')[0] : null,
            eta: null,
            status: shipment.status || 'active',
            carrier: null,
            vesselName: null,
          };
          
          const existingShipment = await storage.getShipmentByReference(transformedShipment.referenceNumber);
          
          if (existingShipment) {
            await storage.updateShipment(existingShipment.id, transformedShipment);
            updatedCount++;
          } else {
            await storage.createShipment(transformedShipment);
            importedCount++;
          }
        } catch (error) {
          errorCount++;
          console.error(`[Manual Sync] Error importing shipment ${shipment.containerNumber}:`, error);
        }
      }

      console.log(`[Manual Sync] ✅ Complete - Imported: ${importedCount}, Updated: ${updatedCount}, Errors: ${errorCount}`);

      res.json({
        success: true,
        imported: importedCount,
        updated: updatedCount,
        errors: errorCount,
        total: allShipments.length
      });
    } catch (error) {
      console.error("[Manual Sync] ❌ Error syncing from ShipNexus:", error);
      res.status(500).json({ error: "Failed to sync from ShipNexus" });
    }
  });

  app.get("/api/shipnexus/all-shipments", async (req, res) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const pageSize = parseInt(req.query.pageSize as string) || 50;
      const shipnexusApiUrl = process.env.SHIPNEXUS_API_URL;

      if (!shipnexusApiUrl) {
        return res.status(500).json({ error: "SHIPNEXUS_API_URL not configured" });
      }

      const allWebhooks = await storage.getShipNexusWebhooks(
        { page: 1, pageSize: 10000 },
        {}
      );
      
      const webhookReferences = new Set(
        allWebhooks.data.map((webhook: any) => webhook.shipmentReference)
      );
      
      const shipnexusUrl = new URL('/api/shipments', shipnexusApiUrl);
      shipnexusUrl.searchParams.append('page', page.toString());
      shipnexusUrl.searchParams.append('limit', pageSize.toString());
      
      const response = await fetch(shipnexusUrl.toString());
      
      if (!response.ok) {
        throw new Error(`ShipNexus API returned ${response.status}`);
      }
      
      const shipmentsResult = await response.json();
      
      const shipmentsWithWebhookStatus = shipmentsResult.data.map((shipment: any) => ({
        ...shipment,
        receivedViaWebhook: webhookReferences.has(shipment.containerNumber)
      }));
      
      res.json({
        ...shipmentsResult,
        data: shipmentsWithWebhookStatus
      });
    } catch (error) {
      console.error("Error fetching ShipNexus shipments:", error);
      res.status(500).json({ error: "Failed to fetch shipments from ShipNexus" });
    }
  });

  app.post("/api/shipnexus/import-shipments", async (req, res) => {
    try {
      const shipnexusApiUrl = process.env.SHIPNEXUS_API_URL;

      if (!shipnexusApiUrl) {
        return res.status(500).json({ error: "SHIPNEXUS_API_URL not configured" });
      }

      let allShipments: any[] = [];
      let currentPage = 1;
      let totalPages = 1;
      const pageSize = 100;

      console.log('[ShipNexus Import] Starting import from ShipNexus...');

      while (currentPage <= totalPages) {
        const shipnexusUrl = new URL('/api/shipments', shipnexusApiUrl);
        shipnexusUrl.searchParams.append('page', currentPage.toString());
        shipnexusUrl.searchParams.append('limit', pageSize.toString());
        
        const response = await fetch(shipnexusUrl.toString());
        
        if (!response.ok) {
          throw new Error(`ShipNexus API returned ${response.status}`);
        }
        
        const result = await response.json();
        allShipments = allShipments.concat(result.data);
        totalPages = result.pagination.totalPages;
        
        console.log(`[ShipNexus Import] Fetched page ${currentPage}/${totalPages} (${result.data.length} shipments)`);
        currentPage++;
      }

      console.log(`[ShipNexus Import] Total shipments fetched: ${allShipments.length}`);

      const transformedShipments = allShipments.map((shipment: any) => ({
        referenceNumber: shipment.containerNumber || `IMPORT-${shipment.id}`,
        bookingNumber: shipment.shipmentId || '',
        masterBillOfLading: shipment.mblNumber || '',
        shipper: shipment.shipper || null,
        consignee: shipment.consignee || null,
        originPort: '',
        destinationPort: '',
        etd: shipment.shippingDate ? new Date(shipment.shippingDate).toISOString().split('T')[0] : null,
        eta: null,
        status: shipment.status || 'active',
        carrier: null,
        vesselName: null,
      }));

      let importedCount = 0;
      let errorCount = 0;

      for (const shipment of transformedShipments) {
        try {
          await storage.createShipment(shipment);
          importedCount++;
        } catch (error) {
          errorCount++;
          console.error(`[ShipNexus Import] Error importing shipment ${shipment.referenceNumber}:`, error);
        }
      }

      console.log(`[ShipNexus Import] Complete - Imported: ${importedCount}, Errors: ${errorCount}`);

      res.json({
        success: true,
        imported: importedCount,
        errors: errorCount,
        total: allShipments.length
      });
    } catch (error) {
      console.error("Error importing ShipNexus shipments:", error);
      res.status(500).json({ error: "Failed to import shipments from ShipNexus" });
    }
  });

  app.get("/api/cargoes-flow/posts", async (req, res) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const pageSize = parseInt(req.query.pageSize as string) || 50;
      const search = req.query.search as string;

      const result = await storage.getCargoesFlowPosts({ page, pageSize }, { search });
      res.json(result);
    } catch (error) {
      console.error("Error fetching Cargoes Flow posts:", error);
      res.status(500).json({ error: "Failed to fetch Cargoes Flow posts" });
    }
  });

  app.get("/api/cargoes-flow/posts/by-reference/:reference", async (req, res) => {
    try {
      const post = await storage.getCargoesFlowPostByReference(req.params.reference);
      if (!post) {
        return res.status(404).json({ error: "Post not found" });
      }
      res.json(post);
    } catch (error) {
      console.error("Error fetching Cargoes Flow post by reference:", error);
      res.status(500).json({ error: "Failed to fetch post" });
    }
  });

  app.post("/api/cargoes-flow/retry/:id", async (req, res) => {
    try {
      const post = await storage.getCargoesFlowPostById(req.params.id);
      
      if (!post) {
        return res.status(404).json({ error: "Post not found" });
      }

      const cargoesFlowApiKey = process.env.CARGOES_FLOW_API_KEY;
      
      if (!cargoesFlowApiKey) {
        return res.status(500).json({ error: "CARGOES_FLOW_API_KEY not configured" });
      }

      console.log(`[Cargoes Flow] Retrying post for: ${post.mblNumber}`);

      try {
        const cargoesResponse = await fetch(
          'https://connect.cargoes.com/flow/api/public_tracking/v1/createShipments',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-DPW-ApiKey': 'dL6SngaHRXZfvzGA716lioRD7ZsRC9hs',
              'X-DPW-Org-Token': 'V904eqatVp49P7FZuwEtoFg72TJDyFnb',
            },
            body: JSON.stringify({
              formData: [
                {
                  mblNumber: post.mblNumber,
                }
              ],
              uploadType: 'FORM_BY_MBL_NUMBER',
            }),
          }
        );

        const cargoesData = await cargoesResponse.json();

        if (cargoesResponse.ok) {
          await storage.updateCargoesFlowPostStatus(
            post.id,
            'success',
            cargoesData,
            undefined
          );
          console.log(`[Cargoes Flow] Retry successful: ${post.mblNumber}`);
          res.json({ success: true, message: 'Retry successful' });
        } else {
          await storage.updateCargoesFlowPostStatus(
            post.id,
            'failed',
            cargoesData,
            cargoesData.message || 'Unknown error'
          );
          console.error(`[Cargoes Flow] Retry failed: ${post.mblNumber}`, cargoesData);
          res.status(400).json({ error: cargoesData.message || 'Failed to post to Cargoes Flow' });
        }
      } catch (cargoesError: any) {
        await storage.updateCargoesFlowPostStatus(
          post.id,
          'failed',
          undefined,
          cargoesError.message || 'Network error'
        );
        console.error(`[Cargoes Flow] Retry error:`, cargoesError);
        res.status(500).json({ error: cargoesError.message || 'Network error' });
      }
    } catch (error) {
      console.error("Error retrying Cargoes Flow post:", error);
      res.status(500).json({ error: "Failed to retry post" });
    }
  });

  // Missing MBL Shipments routes
  app.get("/api/cargoes-flow/missing-mbl", async (req, res) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const pageSize = parseInt(req.query.pageSize as string) || 50;
      const search = req.query.search as string;

      const result = await storage.getMissingMblShipments({ page, pageSize }, { search });
      res.json(result);
    } catch (error) {
      console.error("Error fetching missing MBL shipments:", error);
      res.status(500).json({ error: "Failed to fetch missing MBL shipments" });
    }
  });

  app.delete("/api/cargoes-flow/missing-mbl/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteMissingMblShipment(req.params.id);
      
      if (!deleted) {
        return res.status(404).json({ error: "Shipment not found" });
      }

      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting missing MBL shipment:", error);
      res.status(500).json({ error: "Failed to delete shipment" });
    }
  });

  // Cargoes Flow Sync Logs routes
  app.get("/api/cargoes-flow/sync-logs", async (req, res) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const pageSize = parseInt(req.query.pageSize as string) || 25;

      const result = await storage.getCargoesFlowSyncLogs({ page, pageSize });
      res.json(result);
    } catch (error) {
      console.error("Error fetching Cargoes Flow sync logs:", error);
      res.status(500).json({ error: "Failed to fetch sync logs" });
    }
  });

  app.get("/api/cargoes-flow/sync-status", async (req, res) => {
    try {
      const latestLog = await storage.getLatestCargoesFlowSyncLog();
      res.json(latestLog || null);
    } catch (error) {
      console.error("Error fetching latest sync status:", error);
      res.status(500).json({ error: "Failed to fetch sync status" });
    }
  });

  app.post("/api/cargoes-flow/trigger-sync", async (req, res) => {
    try {
      const { triggerManualPoll } = await import("./services/cargoes-flow-poller");
      console.log("[API] Manual sync triggered");
      
      const syncLog = await triggerManualPoll();
      
      if (!syncLog) {
        // Sync is already running, return the latest sync log instead
        const latestLog = await storage.getLatestCargoesFlowSyncLog();
        if (latestLog) {
          // Ensure createdAt is serialized as ISO string
          const serializedLog = {
            ...latestLog,
            createdAt: latestLog.createdAt instanceof Date 
              ? latestLog.createdAt.toISOString() 
              : latestLog.createdAt,
          };
          return res.json({ 
            success: true, 
            message: "Sync is already running. Showing last completed sync.",
            syncLog: serializedLog 
          });
        }
        return res.json({ 
          success: true, 
          message: "Sync is already running. No previous sync log found.",
          syncLog: null 
        });
      }
      
      // Ensure createdAt is serialized as ISO string
      const serializedSyncLog = {
        ...syncLog,
        createdAt: syncLog.createdAt instanceof Date 
          ? syncLog.createdAt.toISOString() 
          : syncLog.createdAt,
      };
      
      console.log("[API] Returning sync log:", {
        id: serializedSyncLog.id,
        status: serializedSyncLog.status,
        shipmentsProcessed: serializedSyncLog.shipmentsProcessed,
        shipmentsCreated: serializedSyncLog.shipmentsCreated,
        shipmentsUpdated: serializedSyncLog.shipmentsUpdated,
        createdAt: serializedSyncLog.createdAt,
      });
      
      res.json({ 
        success: true, 
        message: "Sync completed successfully",
        syncLog: serializedSyncLog 
      });
    } catch (error: any) {
      console.error("Error triggering manual sync:", error);
      res.status(500).json({ error: error.message || "Failed to trigger sync" });
    }
  });

  // Cargoes Flow Update Logs routes
  app.get("/api/cargoes-flow/update-logs", async (req, res) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const pageSize = parseInt(req.query.pageSize as string) || 25;
      const search = req.query.search as string;

      const result = await storage.getCargoesFlowUpdateLogs(
        { page, pageSize },
        { search }
      );

      res.json(result);
    } catch (error: any) {
      console.error("Error fetching Cargoes Flow update logs:", error);
      res.status(500).json({ error: error.message || "Failed to fetch update logs" });
    }
  });

  app.get("/api/cargoes-flow/update-logs/:id", async (req, res) => {
    try {
      const log = await storage.getCargoesFlowUpdateLogById(req.params.id);
      
      if (!log) {
        return res.status(404).json({ error: "Update log not found" });
      }

      res.json(log);
    } catch (error: any) {
      console.error("Error fetching update log:", error);
      res.status(500).json({ error: error.message || "Failed to fetch update log" });
    }
  });

  app.get("/api/cargoes-flow/map-logs/:shipmentNumber", async (req, res) => {
    try {
      const shipmentNumber = req.params.shipmentNumber;
      const limit = parseInt(req.query.limit as string) || 50;

      const logs = await storage.getCargoesFlowMapLogsByShipmentNumber(shipmentNumber, limit);
      res.json(logs);
    } catch (error: any) {
      console.error("Error fetching map logs:", error);
      res.status(500).json({ error: error.message || "Failed to fetch map logs" });
    }
  });

  app.get("/api/cargoes-flow/map-routes/:shipmentNumber", async (req, res) => {
    const shipmentNumber = req.params.shipmentNumber;
    const startTime = Date.now();
    
    try {
      const CARGOES_FLOW_API_KEY = "dL6SngaHRXZfvzGA716lioRD7ZsRC9hs";
      const CARGOES_FLOW_ORG_TOKEN = "V904eqatVp49P7FZuwEtoFg72TJDyFnb";
      const MAP_API_URL = "https://connect.cargoes.com/flow/api/public_tracking/v1/mapRoutes";

      console.log(`[Cargoes Flow Map] Fetching map routes for shipment: ${shipmentNumber}`);

      const url = `${MAP_API_URL}?shipmentNumber=${encodeURIComponent(shipmentNumber)}`;
      const response = await fetch(url, {
        method: "GET",
        headers: {
          "X-DPW-ApiKey": CARGOES_FLOW_API_KEY,
          "X-DPW-Org-Token": CARGOES_FLOW_ORG_TOKEN,
        },
      });

      const requestDurationMs = Date.now() - startTime;
      const statusCode = response.status;

      if (!response.ok) {
        console.error(`[Cargoes Flow Map] API returned status ${response.status}`);
        
        await storage.createCargoesFlowMapLog({
          shipmentNumber,
          shipmentReference: null,
          requestUrl: url,
          status: "error",
          statusCode,
          responseData: null,
          errorMessage: `API returned status ${response.status}: ${response.statusText}`,
          requestDurationMs,
        });

        return res.status(response.status).json({ 
          error: `Failed to fetch map routes: ${response.statusText}` 
        });
      }

      const mapData = await response.json();
      console.log(`[Cargoes Flow Map] Successfully fetched map routes for ${shipmentNumber}`);
      
      await storage.createCargoesFlowMapLog({
        shipmentNumber,
        shipmentReference: mapData.shipmentReference || null,
        requestUrl: url,
        status: "success",
        statusCode,
        responseData: mapData,
        errorMessage: null,
        requestDurationMs,
      });

      res.json(mapData);
    } catch (error: any) {
      console.error("[Cargoes Flow Map] Error fetching map routes:", error);
      
      const requestDurationMs = Date.now() - startTime;
      await storage.createCargoesFlowMapLog({
        shipmentNumber,
        shipmentReference: null,
        requestUrl: `https://connect.cargoes.com/flow/api/public_tracking/v1/mapRoutes?shipmentNumber=${encodeURIComponent(shipmentNumber)}`,
        status: "error",
        statusCode: null,
        responseData: null,
        errorMessage: error.message || "Failed to fetch map routes",
        requestDurationMs,
      });

      res.status(500).json({ error: error.message || "Failed to fetch map routes" });
    }
  });

  // Cargoes Flow Carriers - Get all carriers
  app.get("/api/cargoes-flow/carriers", async (req, res) => {
    try {
      const carriers = await db.select().from(cargoesFlowCarriers).orderBy(cargoesFlowCarriers.carrierName);
      res.json(carriers);
    } catch (error: any) {
      console.error("Error fetching carriers:", error);
      res.status(500).json({ error: error.message || "Failed to fetch carriers" });
    }
  });

  // Trigger manual carrier sync
  app.post("/api/cargoes-flow/carriers/sync", async (req, res) => {
    try {
      const { syncCarriersFromCargoesFlow } = await import("./services/cargoes-flow-carrier-sync");
      const result = await syncCarriersFromCargoesFlow();
      res.json(result);
    } catch (error: any) {
      console.error("Error syncing carriers:", error);
      res.status(500).json({ error: error.message || "Failed to sync carriers" });
    }
  });

  // Get carrier sync logs
  app.get("/api/cargoes-flow/carriers/sync-logs", async (req, res) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const pageSize = parseInt(req.query.pageSize as string) || 50;
      const offset = (page - 1) * pageSize;

      const logs = await db.select()
        .from(cargoesFlowCarrierSyncLogs)
        .orderBy(sql`${cargoesFlowCarrierSyncLogs.createdAt} DESC`)
        .limit(pageSize)
        .offset(offset);

      const countResult = await db.select({ count: sql<number>`count(*)` })
        .from(cargoesFlowCarrierSyncLogs);
      const total = Number(countResult[0]?.count || 0);

      res.json({
        logs,
        pagination: {
          page,
          pageSize,
          total,
          totalPages: Math.ceil(total / pageSize),
        },
      });
    } catch (error: any) {
      console.error("Error fetching carrier sync logs:", error);
      res.status(500).json({ error: error.message || "Failed to fetch carrier sync logs" });
    }
  });

  // Get distinct carriers from Cargoes Flow shipments (for filter dropdowns)
  app.get("/api/carriers", async (req, res) => {
    try {
      const carriers = await storage.getDistinctCarriers();
      res.json(carriers);
    } catch (error: any) {
      console.error("Error fetching distinct carriers:", error);
      res.status(500).json({ error: error.message || "Failed to fetch carriers" });
    }
  });

  // Get distinct ports from Cargoes Flow shipments (for filter dropdowns)
  app.get("/api/ports", async (req, res) => {
    try {
      const ports = await storage.getDistinctPorts();
      res.json(ports);
    } catch (error: any) {
      console.error("Error fetching distinct ports:", error);
      res.status(500).json({ error: error.message || "Failed to fetch ports" });
    }
  });

  app.post("/api/cargoes-flow/batch-process", async (req, res) => {
    try {
      console.log("[Cargoes Flow Batch] Starting batch processing of webhook logs...");
      
      const webhookLogs = await storage.getAllWebhookLogs();
      console.log(`[Cargoes Flow Batch] Found ${webhookLogs.length} webhook logs to process`);

      let posted = 0;
      let missingMbl = 0;
      let errors = 0;

      for (const log of webhookLogs) {
        try {
          const payload = log.rawPayload as any;
          
          const mblRef = payload.shipmentReferenceNumbers?.find(
            (ref: any) => ref.referenceType === "MAWB Number"
          );
          const mblNumber = mblRef?.value;

          if (mblNumber && mblNumber.trim()) {
            const existingPost = await storage.getCargoesFlowPostByReference(log.shipmentId || '');
            
            if (!existingPost) {
              const containerRef = payload.shipmentReferenceNumbers?.find(
                (ref: any) => ref.referenceType === "Container Number"
              );
              const oceanLineRef = payload.shipmentReferenceNumbers?.find(
                (ref: any) => ref.referenceType === "Steamship Line"
              );
              const bookingRef = payload.shipmentReferenceNumbers?.find(
                (ref: any) => ref.referenceType === "Shipper Reference Number"
              );

              // Extract office and salesRepNames from webhook payload
              const office = payload.customer?.office || null;
              const salesRepNamesString = payload.customer?.salesRepNames || '';
              const salesRepNames = salesRepNamesString 
                ? salesRepNamesString.split(',').map((name: string) => name.trim()).filter(Boolean)
                : null;

              const postRecord = await storage.createCargoesFlowPost({
                shipmentReference: log.shipmentId || '',
                mblNumber: mblNumber,
                containerNumber: containerRef?.value || null,
                carrier: oceanLineRef?.value || null,
                bookingNumber: bookingRef?.value || null,
                office: office,
                salesRepNames: salesRepNames,
                status: 'pending',
              });

              try {
                const cargoesResponse = await fetch(
                  'https://connect.cargoes.com/flow/api/public_tracking/v1/createShipments',
                  {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      'X-DPW-ApiKey': 'dL6SngaHRXZfvzGA716lioRD7ZsRC9hs',
                      'X-DPW-Org-Token': 'V904eqatVp49P7FZuwEtoFg72TJDyFnb',
                    },
                    body: JSON.stringify({
                      formData: [
                        {
                          mblNumber: mblNumber
                        }
                      ],
                      uploadType: 'FORM_BY_MBL_NUMBER'
                    }),
                  }
                );

                console.log(`[Cargoes Flow Batch] Payload for ${mblNumber}:`, JSON.stringify({
                  formData: [{ mblNumber: mblNumber }],
                  uploadType: 'FORM_BY_MBL_NUMBER'
                }));

                  const cargoesData = await cargoesResponse.json();

                  if (cargoesResponse.ok) {
                    await storage.updateCargoesFlowPostStatus(
                      postRecord.id,
                      'success',
                      cargoesData,
                      undefined
                    );
                    posted++;
                    console.log(`[Cargoes Flow Batch] Posted: ${mblNumber}`);
                  } else {
                    await storage.updateCargoesFlowPostStatus(
                      postRecord.id,
                      'failed',
                      cargoesData,
                      cargoesData.message || 'Unknown error'
                    );
                    errors++;
                    console.error(`[Cargoes Flow Batch] Failed: ${mblNumber}`, cargoesData);
                  }
                } catch (cargoesError: any) {
                  await storage.updateCargoesFlowPostStatus(
                    postRecord.id,
                    'failed',
                    undefined,
                    cargoesError.message || 'Network error'
                  );
                  errors++;
                  console.error(`[Cargoes Flow Batch] Error posting ${mblNumber}:`, cargoesError);
                }
            }
          } else {
            const existingMissing = await storage.getMissingMblShipmentByReference(log.shipmentId || '');
            
            if (!existingMissing) {
              const containerRef = payload.shipmentReferenceNumbers?.find(
                (ref: any) => ref.referenceType === "Container Number"
              );
              const oceanLineRef = payload.shipmentReferenceNumbers?.find(
                (ref: any) => ref.referenceType === "Steamship Line"
              );
              
              const firstPickup = payload.stops?.find((stop: any) => stop.stopType === "First Pickup");
              const lastDrop = payload.stops?.find((stop: any) => stop.stopType === "Last Drop");

              await storage.createMissingMblShipment({
                shipmentReference: log.shipmentId || '',
                containerNumber: containerRef?.value || null,
                carrier: oceanLineRef?.value || null,
                originPort: firstPickup ? `${firstPickup.city}, ${firstPickup.state}` : null,
                destinationPort: lastDrop ? `${lastDrop.city}, ${lastDrop.state}` : null,
                shipper: payload.customer?.name || null,
                consignee: lastDrop?.companyName || null,
              });
              missingMbl++;
              console.log(`[Cargoes Flow Batch] Missing MBL: ${log.shipmentId}`);
            }
          }
        } catch (error) {
          errors++;
          console.error(`[Cargoes Flow Batch] Error processing log ${log.id}:`, error);
        }
      }

      console.log(`[Cargoes Flow Batch] Complete - Posted: ${posted}, Missing MBL: ${missingMbl}, Errors: ${errors}`);

      res.json({
        success: true,
        posted,
        missingMbl,
        errors,
        total: webhookLogs.length
      });
    } catch (error) {
      console.error("Error in batch processing:", error);
      res.status(500).json({ error: "Failed to batch process webhooks" });
    }
  });

  app.post("/api/webhooks/:integrationId", async (req, res) => {
    try {
      const signature = req.headers["x-signature"] as string;
      const result = await integrationOrchestrator.processWebhook(
        req.params.integrationId,
        req.body,
        signature
      );
      res.json(result);
    } catch (error) {
      console.error("Error processing webhook:", error);
      res.status(400).json({ error: "Failed to process webhook" });
    }
  });

  // Notification routes
  app.get("/api/notifications", async (req, res) => {
    if (!req.user) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    
    try {
      const notifications = await storage.getNotifications(req.user.id);
      res.json(notifications);
    } catch (error) {
      console.error("Error fetching notifications:", error);
      res.status(500).json({ error: "Failed to fetch notifications" });
    }
  });

  app.get("/api/notifications/unread", async (req, res) => {
    if (!req.user) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    
    try {
      const notifications = await storage.getUnreadNotifications(req.user.id);
      res.json(notifications);
    } catch (error) {
      console.error("Error fetching unread notifications:", error);
      res.status(500).json({ error: "Failed to fetch unread notifications" });
    }
  });

  app.get("/api/notifications/unread-count", async (req, res) => {
    if (!req.user) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    
    try {
      const count = await storage.getUnreadNotificationCount(req.user.id);
      res.json({ count });
    } catch (error) {
      console.error("Error fetching unread count:", error);
      res.status(500).json({ error: "Failed to fetch unread count" });
    }
  });

  app.patch("/api/notifications/:id/read", async (req, res) => {
    if (!req.user) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    
    try {
      const notification = await storage.markNotificationAsRead(req.params.id, req.user.id);
      if (!notification) {
        return res.status(404).json({ error: "Notification not found" });
      }
      res.json(notification);
    } catch (error) {
      console.error("Error marking notification as read:", error);
      res.status(500).json({ error: "Failed to mark notification as read" });
    }
  });

  app.patch("/api/notifications/read-all", async (req, res) => {
    if (!req.user) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    
    try {
      await storage.markAllNotificationsAsRead(req.user.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error marking all notifications as read:", error);
      res.status(500).json({ error: "Failed to mark all notifications as read" });
    }
  });

  app.delete("/api/notifications/:id", async (req, res) => {
    if (!req.user) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    
    try {
      const deleted = await storage.deleteNotification(req.params.id, req.user.id);
      if (!deleted) {
        return res.status(404).json({ error: "Notification not found" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting notification:", error);
      res.status(500).json({ error: "Failed to delete notification" });
    }
  });

  // Organization routes
  app.get("/api/organizations", async (req, res) => {
    try {
      const type = req.query.type as string | undefined;
      const organizations = await storage.getAllOrganizations(type);
      res.json(organizations);
    } catch (error) {
      console.error("Error fetching organizations:", error);
      res.status(500).json({ error: "Failed to fetch organizations" });
    }
  });

  app.get("/api/organizations/:id", async (req, res) => {
    try {
      const organization = await storage.getOrganizationById(req.params.id);
      if (!organization) {
        return res.status(404).json({ error: "Organization not found" });
      }
      res.json(organization);
    } catch (error) {
      console.error("Error fetching organization:", error);
      res.status(500).json({ error: "Failed to fetch organization" });
    }
  });

  app.post("/api/organizations", async (req, res) => {
    try {
      const organization = await storage.createOrganization(req.body);
      res.status(201).json(organization);
    } catch (error) {
      console.error("Error creating organization:", error);
      res.status(500).json({ error: "Failed to create organization" });
    }
  });

  app.patch("/api/organizations/:id", async (req, res) => {
    try {
      const organization = await storage.updateOrganization(req.params.id, req.body);
      if (!organization) {
        return res.status(404).json({ error: "Organization not found" });
      }
      res.json(organization);
    } catch (error) {
      console.error("Error updating organization:", error);
      res.status(500).json({ error: "Failed to update organization" });
    }
  });

  app.delete("/api/organizations/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteOrganization(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Organization not found" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting organization:", error);
      res.status(500).json({ error: "Failed to delete organization" });
    }
  });

  // User management routes
  app.get("/api/users", async (req, res) => {
    try {
      const users = await storage.getAllUsers();
      const sanitizedUsers = users.map(({ password, ...user }) => user);
      res.json(sanitizedUsers);
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ error: "Failed to fetch users" });
    }
  });

  app.get("/api/users/:id", async (req, res) => {
    try {
      const user = await storage.getUser(req.params.id);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      const { password, ...sanitizedUser } = user;
      res.json(sanitizedUser);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ error: "Failed to fetch user" });
    }
  });

  app.post("/api/users", async (req, res) => {
    try {
      const { password, ...userData } = req.body;
      
      const existingUser = await storage.getUserByEmail(userData.email);
      if (existingUser) {
        return res.status(400).json({ error: "Email already exists" });
      }

      const hashedPassword = password ? await hashPassword(password) : null;
      const user = await storage.createUser({
        ...userData,
        password: hashedPassword,
      });

      await storage.createAuditLog({
        userId: req.body.actorId || null,
        action: "CREATE",
        entityType: "User",
        entityId: user.id,
        details: { email: user.email, name: user.name, role: user.role },
        ipAddress: req.ip,
      });

      const { password: _, ...sanitizedUser } = user;
      res.status(201).json(sanitizedUser);
    } catch (error) {
      console.error("Error creating user:", error);
      res.status(500).json({ error: "Failed to create user" });
    }
  });

  app.patch("/api/users/:id", async (req, res) => {
    try {
      console.log("[Update User] ID:", req.params.id);
      console.log("[Update User] Request body:", JSON.stringify(req.body, null, 2));
      
      const { password, ...updateData } = req.body;
      
      if (password) {
        console.log("[Update User] Hashing password...");
        updateData.password = await hashPassword(password);
      }

      console.log("[Update User] Update data (after password hash):", JSON.stringify(updateData, null, 2));

      const user = await storage.updateUser(req.params.id, updateData);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      console.log("[Update User] Updated user:", { id: user.id, username: user.username, name: user.name });

      await storage.createAuditLog({
        userId: req.body.actorId || null,
        action: "UPDATE",
        entityType: "User",
        entityId: user.id,
        details: { changes: updateData },
        ipAddress: req.ip,
      });

      const { password: _, ...sanitizedUser } = user;
      res.json(sanitizedUser);
    } catch (error) {
      console.error("Error updating user:", error);
      res.status(500).json({ error: "Failed to update user" });
    }
  });

  app.delete("/api/users/:id", async (req, res) => {
    try {
      const user = await storage.getUser(req.params.id);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      // Delete all notifications for this user first to avoid foreign key constraint error
      await storage.deleteAllUserNotifications(req.params.id);

      const success = await storage.deleteUser(req.params.id);
      if (!success) {
        return res.status(500).json({ error: "Failed to delete user" });
      }

      await storage.createAuditLog({
        userId: req.body.actorId || null,
        action: "DELETE",
        entityType: "User",
        entityId: req.params.id,
        details: { email: user.email, name: user.name },
        ipAddress: req.ip,
      });

      res.status(204).send();
    } catch (error) {
      console.error("Error deleting user:", error);
      res.status(500).json({ error: "Failed to delete user" });
    }
  });

  app.post("/api/users/bulk-import", async (req, res) => {
    try {
      const { users: usersData, deleteExisting } = req.body;

      if (!Array.isArray(usersData) || usersData.length === 0) {
        return res.status(400).json({ error: "Invalid user data" });
      }

      let deletedCount = 0;

      // Delete all existing users if requested
      if (deleteExisting) {
        const existingUsers = await storage.getAllUsers();
        for (const user of existingUsers) {
          // Delete notifications first
          await storage.deleteAllUserNotifications(user.id);
          await storage.deleteUser(user.id);
          deletedCount++;
        }
      }

      // Create new users
      const createdUsers = [];
      const errors = [];

      for (const userData of usersData) {
        try {
          // Use Name as username (merged field)
          const username = userData.name || userData.email.split('@')[0];
          
          // Default password is "password123" - users should change it on first login
          const hashedPassword = await hashPassword("password123");
          
          const user = await storage.createUser({
            username: username,
            email: userData.email,
            name: userData.name,
            password: hashedPassword,
            role: userData.role.toLowerCase() as "admin" | "manager" | "user",
            office: userData.office,
          });

          await storage.createAuditLog({
            userId: req.body.actorId || null,
            action: "CREATE",
            entityType: "User",
            entityId: user.id,
            details: { email: user.email, name: user.name, role: user.role, source: "bulk_import" },
            ipAddress: req.ip,
          });

          const { password: _, ...sanitizedUser } = user;
          createdUsers.push(sanitizedUser);
        } catch (error: any) {
          errors.push({
            email: userData.email,
            error: error.message || "Failed to create user",
          });
        }
      }

      res.json({
        success: true,
        deletedCount,
        createdCount: createdUsers.length,
        failedCount: errors.length,
        users: createdUsers,
        errors,
      });
    } catch (error) {
      console.error("Error bulk importing users:", error);
      res.status(500).json({ error: "Failed to bulk import users" });
    }
  });

  app.get("/api/audit-logs", async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 100;
      const entityType = req.query.entityType as string;
      
      let logs;
      if (entityType) {
        logs = await storage.getAuditLogsByEntityType(entityType, limit);
      } else {
        logs = await storage.getAuditLogs(limit);
      }
      
      res.json(logs);
    } catch (error) {
      console.error("Error fetching audit logs:", error);
      res.status(500).json({ error: "Failed to fetch audit logs" });
    }
  });

  app.get("/api/cost-analytics", async (req, res) => {
    try {
      const analytics = await storage.getCostAnalytics();
      res.json(analytics);
    } catch (error) {
      console.error("Error fetching cost analytics:", error);
      res.status(500).json({ error: "Failed to fetch cost analytics" });
    }
  });

  // ===== SHIPMENT DOCUMENTS ROUTES =====
  app.post("/api/shipments/:shipmentId/documents", async (req, res) => {
    try {
      const { shipmentId } = req.params;
      const { documentType, fileName, fileSize, mimeType, fileData, description } = req.body;

      if (!fileName || !documentType) {
        return res.status(400).json({ error: "fileName and documentType are required" });
      }

      const document = await storage.createShipmentDocument({
        shipmentId,
        documentType,
        fileName,
        fileSize: fileSize || null,
        mimeType: mimeType || null,
        fileUrl: null,
        fileData: fileData || null,
        description: description || null,
        uploadedBy: (req as any).user?.id || null,
      });

      res.status(201).json(document);
    } catch (error: any) {
      console.error("Error uploading document:", error);
      res.status(500).json({ error: error.message || "Failed to upload document" });
    }
  });

  app.get("/api/shipments/:shipmentId/documents", async (req, res) => {
    try {
      const { shipmentId } = req.params;
      const documents = await storage.getShipmentDocuments(shipmentId);
      res.json(documents);
    } catch (error: any) {
      console.error("Error fetching documents:", error);
      res.status(500).json({ error: error.message || "Failed to fetch documents" });
    }
  });

  app.get("/api/documents/:id", async (req, res) => {
    try {
      const document = await storage.getShipmentDocumentById(req.params.id);
      if (!document) {
        return res.status(404).json({ error: "Document not found" });
      }
      res.json(document);
    } catch (error: any) {
      console.error("Error fetching document:", error);
      res.status(500).json({ error: error.message || "Failed to fetch document" });
    }
  });

  app.delete("/api/documents/:id", async (req, res) => {
    try {
      const success = await storage.deleteShipmentDocument(req.params.id);
      if (!success) {
        return res.status(404).json({ error: "Document not found" });
      }
      res.status(204).send();
    } catch (error: any) {
      console.error("Error deleting document:", error);
      res.status(500).json({ error: error.message || "Failed to delete document" });
    }
  });

  // ===== CARGOES FLOW DOCUMENT UPLOAD ROUTES =====
  app.post("/api/cargoes-flow/upload-documents", async (req, res) => {
    try {
      const { shipmentNumber, files } = req.body;

      if (!shipmentNumber || !files || !Array.isArray(files) || files.length === 0) {
        return res.status(400).json({ error: "shipmentNumber and files array are required" });
      }

      const batchId = `BATCH-${Date.now()}`;

      const uploadLog = await storage.createCargoesFlowDocumentUploadLog({
        batchId,
        totalFiles: files.length,
        successfulUploads: 0,
        failedUploads: 0,
        apiRequest: JSON.stringify({ shipmentNumber, fileCount: files.length }),
      });

      const { uploadDocumentsToCargoesFlow } = await import("./services/cargoes-flow");
      const result = await uploadDocumentsToCargoesFlow(shipmentNumber, files);

      let successCount = 0;
      let failCount = 0;

      for (let i = 0; i < result.results.length; i++) {
        const uploadResult = result.results[i];
        const fileInfo = files[i];

        const uploadStatus = uploadResult.success ? "success" : "failed";
        if (uploadResult.success) {
          successCount++;
        } else {
          failCount++;
        }

        await storage.createCargoesFlowDocumentUpload({
          shipmentNumber,
          fileName: uploadResult.fileName,
          fileExtension: uploadResult.documentExtension || fileInfo.fileExtension,
          fileSize: fileInfo.fileSize,
          organizationId: uploadResult.organizationId || null,
          organizationName: uploadResult.organizationName || null,
          uploadStatus,
          errorMessage: uploadResult.error || null,
          cargoesFlowCreatedAt: uploadResult.createdAt ? new Date(uploadResult.createdAt) : null,
        });
      }

      await storage.updateCargoesFlowDocumentUploadLogStatus(
        uploadLog.id,
        successCount,
        failCount,
        new Date(),
        JSON.stringify(result.apiResponse),
        result.error || null
      );

      res.json({
        success: result.success,
        batchId,
        totalFiles: files.length,
        successfulUploads: successCount,
        failedUploads: failCount,
        results: result.results,
      });
    } catch (error: any) {
      console.error("Error uploading documents to Cargoes Flow:", error);
      res.status(500).json({ error: error.message || "Failed to upload documents" });
    }
  });

  app.get("/api/cargoes-flow/document-uploads", async (req, res) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const pageSize = parseInt(req.query.pageSize as string) || 50;
      const shipmentNumber = req.query.shipmentNumber as string;
      const uploadStatus = req.query.uploadStatus as string;

      const results = await storage.getCargoesFlowDocumentUploads(
        { page, pageSize },
        { shipmentNumber, uploadStatus }
      );

      res.json(results);
    } catch (error: any) {
      console.error("Error fetching document uploads:", error);
      res.status(500).json({ error: error.message || "Failed to fetch document uploads" });
    }
  });

  app.get("/api/cargoes-flow/document-upload-logs", async (req, res) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const pageSize = parseInt(req.query.pageSize as string) || 50;

      const results = await storage.getCargoesFlowDocumentUploadLogs({ page, pageSize });

      res.json(results);
    } catch (error: any) {
      console.error("Error fetching document upload logs:", error);
      res.status(500).json({ error: error.message || "Failed to fetch document upload logs" });
    }
  });

  // Test endpoint to send shipment to Cargoes Flow
  app.post("/api/cargoes-flow/test", async (req, res) => {
    try {
      const { mblNumber } = req.body;
      
      if (!mblNumber) {
        return res.status(400).json({ error: "mblNumber is required" });
      }

      const { sendShipmentToCargoesFlow } = await import("./services/cargoes-flow");
      
      const result = await sendShipmentToCargoesFlow(
        `TEST-${Date.now()}`,
        mblNumber,
        {}
      );

      if (result.success) {
        res.json({ success: true, response: result.response });
      } else {
        res.status(500).json({ success: false, error: result.error, response: result.response });
      }
    } catch (error: any) {
      console.error("Error testing Cargoes Flow:", error);
      res.status(500).json({ error: error.message });
    }
  });

  integrationOrchestrator.startAllActiveIntegrations();
  riskScheduler.start();
  startCargoesFlowPolling();

  const httpServer = createServer(app);

  return httpServer;
}
