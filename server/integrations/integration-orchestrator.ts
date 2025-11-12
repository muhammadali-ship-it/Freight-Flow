import { storage } from "../storage.js";
import { createShippingLineAdapter, type ShippingLineData } from "./shipping-line-adapter.js";
import type { IntegrationConfig } from "shared/schema.js";
import { riskAssessmentService } from "../services/risk-assessment-service.js";

export class IntegrationOrchestrator {
  private pollingIntervals: Map<string, NodeJS.Timeout> = new Map();

  async startAllActiveIntegrations() {
    try {
      const activeConfigs = await storage.getActiveIntegrationConfigs();
      
      for (const config of activeConfigs) {
        this.startIntegration(config);
      }

      console.log(`Started ${activeConfigs.length} active integrations`);
    } catch (error) {
      console.error('[Integration Orchestrator] Failed to start integrations:', error instanceof Error ? error.message : String(error));
      console.log('[Integration Orchestrator] Continuing without integrations - they can be started manually later');
    }
  }

  startIntegration(config: IntegrationConfig) {
    if (this.pollingIntervals.has(config.id)) {
      console.log(`Integration ${config.name} is already running`);
      return;
    }

    const intervalMs = (config.pollingIntervalMinutes || 60) * 60 * 1000;
    
    const interval = setInterval(async () => {
      await this.syncIntegration(config.id);
    }, intervalMs);

    this.pollingIntervals.set(config.id, interval);
    
    this.syncIntegration(config.id);
    
    console.log(`Started integration: ${config.name} (polling every ${config.pollingIntervalMinutes} minutes)`);
  }

  stopIntegration(integrationId: string) {
    const interval = this.pollingIntervals.get(integrationId);
    if (interval) {
      clearInterval(interval);
      this.pollingIntervals.delete(integrationId);
      console.log(`Stopped integration: ${integrationId}`);
    }
  }

  stopAllIntegrations() {
    for (const [id, interval] of Array.from(this.pollingIntervals.entries())) {
      clearInterval(interval);
    }
    this.pollingIntervals.clear();
    console.log("Stopped all integrations");
  }

  async syncIntegration(integrationId: string) {
    const startTime = Date.now();
    let recordsProcessed = 0;
    let recordsUpdated = 0;
    let recordsFailed = 0;
    let errorMessage: string | undefined;

    try {
      const config = await storage.getIntegrationConfigById(integrationId);
      if (!config || !config.isActive) {
        console.log(`Integration ${integrationId} is not active or not found`);
        return;
      }

      console.log(`Syncing integration: ${config.name}`);

      let adapter;
      try {
        adapter = createShippingLineAdapter(config);
      } catch (error) {
        console.log(`Skipping integration ${config.name}: ${error instanceof Error ? error.message : String(error)}`);
        return;
      }

      const since = config.lastSyncAt || undefined;
      const updates = await adapter.fetchBulkUpdates(since);

      recordsProcessed = updates.length;

      for (const update of updates) {
        try {
          const carrierUpdate = await storage.createCarrierUpdate({
            ...adapter.buildCarrierUpdate(update),
            integrationId: config.id,
          });

          await this.processCarrierUpdate(carrierUpdate.id, config.id);
          recordsUpdated++;
        } catch (error) {
          console.error(`Failed to process update for ${update.containerNumber}:`, error);
          recordsFailed++;
        }
      }

      await storage.updateIntegrationConfig(integrationId, {
        lastSyncAt: new Date(),
      });

      console.log(`Sync complete: ${config.name} - ${recordsUpdated} updated, ${recordsFailed} failed`);

    } catch (error) {
      errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`Integration sync error for ${integrationId}:`, error);
    } finally {
      const syncDurationMs = Date.now() - startTime;

      await storage.createIntegrationSyncLog({
        integrationId,
        status: errorMessage ? "error" : "success",
        recordsProcessed,
        recordsUpdated,
        recordsFailed,
        errorMessage,
        syncDurationMs,
        metadata: { timestamp: new Date().toISOString() },
      });
    }
  }

  async processCarrierUpdate(updateId: string, expectedIntegrationId?: string) {
    const carrierUpdate = await storage.getCarrierUpdateById(updateId);
    
    if (!carrierUpdate) {
      console.log(`Carrier update ${updateId} not found`);
      return;
    }

    if (carrierUpdate.processed) {
      console.log(`Carrier update ${updateId} already processed`);
      return;
    }

    if (expectedIntegrationId && carrierUpdate.integrationId !== expectedIntegrationId) {
      console.log(`Carrier update ${updateId} belongs to different integration`);
      return;
    }
    
    const container = await storage.getContainerByNumber(carrierUpdate.containerNumber);
    if (!container) {
      console.log(`Container ${carrierUpdate.containerNumber} not found, skipping update`);
      await storage.markCarrierUpdateProcessed(updateId);
      return;
    }

    await storage.updateContainer(container.id, {
      status: carrierUpdate.status || container.status,
    });

    if (carrierUpdate.location) {
      await storage.createTimelineEvent({
        containerId: container.id,
        title: carrierUpdate.status || "Status Update",
        location: carrierUpdate.location,
        timestamp: carrierUpdate.timestamp,
        completed: true,
        isCurrent: false,
      });
    }

    await storage.markCarrierUpdateProcessed(updateId);
    
    // Trigger risk assessment after carrier update
    try {
      const updatedContainer = await storage.getContainerById(container.id);
      if (updatedContainer) {
        await riskAssessmentService.assessContainerRisk(updatedContainer);
      }
    } catch (error) {
      console.error(`Failed to assess container ${container.id} after carrier update:`, error);
    }
  }

  async processWebhook(integrationId: string, payload: any, signature?: string) {
    const config = await storage.getIntegrationConfigById(integrationId);
    if (!config) {
      throw new Error(`Integration ${integrationId} not found`);
    }

    let adapter;
    try {
      adapter = createShippingLineAdapter(config);
    } catch (error) {
      throw new Error(`Unsupported carrier: ${config.carrier}`);
    }
    
    if (signature && !adapter.validateWebhook(payload, signature)) {
      throw new Error("Webhook signature validation failed");
    }

    const updates = adapter.parseWebhook(payload);
    
    for (const update of updates) {
      const carrierUpdate = await storage.createCarrierUpdate({
        ...adapter.buildCarrierUpdate(update),
        integrationId: config.id,
      });

      await this.processCarrierUpdate(carrierUpdate.id, config.id);
    }

    return { processed: updates.length };
  }
}

export const integrationOrchestrator = new IntegrationOrchestrator();
