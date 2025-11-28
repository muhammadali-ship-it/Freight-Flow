import type { IStorage } from "../storage.js";
import type { CargoesFlowShipment } from "../shared/schema.js";

interface RiskAssessment {
  riskLevel: "low" | "medium" | "high" | "critical";
  riskScore: number;
  riskReasons: string[];
}

export class CargoesFlowRiskAssessmentService {
  constructor(private storage: IStorage) {}

  /**
   * Assess risk for a Cargoes Flow shipment based on various factors
   */
  assessShipmentRisk(shipment: CargoesFlowShipment): RiskAssessment {
    let riskScore = 0;
    const riskReasons: string[] = [];
    
    const now = new Date();
    
    // Extract container data from rawData if available
    const containers = shipment.rawData?.containers || [];
    const container = containers[0]; // Use first container for risk assessment
    const rawData = shipment.rawData || {};
    
    // Check if container has been picked up (gate out or empty returned)
    const terminalFullOut = rawData.terminalFullOut;
    const terminalEmptyReturned = rawData.terminalEmptyReturned;
    const events = rawData.shipmentEvents || [];
    
    const hasGateOutEvent = events.some((e: any) => {
      const code = (e.code || '').toLowerCase();
      const description = (e.description || '').toLowerCase();
      
      return code.includes('gateout') || 
             code.includes('gate-out') || 
             code.includes('gate_out') ||
             code === 'fullcontainergateout' ||
             code === 'emptycontainergatein' ||
             description.includes('gate out') ||
             description.includes('full container gate out');
    });
    
    const isContainerCompleted = terminalFullOut || terminalEmptyReturned || hasGateOutEvent;
    
    // Rule 1: ETA passed but container not arrived (CRITICAL)
    // Don't flag as delayed if container has been picked up/completed
    if (shipment.eta && !isContainerCompleted && !["arrived", "unloaded", "gate-out", "delivered", "completed"].includes(shipment.status?.toLowerCase() || "")) {
      const eta = new Date(shipment.eta);
      const daysPastEta = Math.floor((now.getTime() - eta.getTime()) / (1000 * 60 * 60 * 24));
      
      if (daysPastEta > 0) {
        // Check if vessel has arrived at destination
        const destinationPort = (shipment.destinationPort || '').toLowerCase().trim();
        const hasArrivedAtDestination = events.some((e: any) => {
          const code = (e.code || '').toLowerCase();
          const location = (e.location || '').toLowerCase().trim();
          const description = (e.description || '').toLowerCase();
          
          // Check for arrival event codes
          const isArrivalEvent = code.includes('vessalarrival') || 
                                 code.includes('vessel-arrival') ||
                                 code.includes('vessel_arrival') ||
                                 code === 'vessalarrivalais' ||
                                 code === 'dischargefromvessel' ||
                                 code.includes('discharge') ||
                                 description.includes('vessel arrival');
          
          if (isArrivalEvent && e.actualTime) {
            // If no destination port specified, assume any arrival means it arrived
            if (!destinationPort) {
              return true;
            }
            
            // If no location in event, can't verify - be lenient and assume it's the destination
            if (!location) {
              return true;
            }
            
            // Check if arrival is at the final destination port
            const isAtDestination =
              location.includes(destinationPort) ||
              destinationPort.includes(location) ||
              (destinationPort.split(/[\s,]/)[0].length > 3 && location.includes(destinationPort.split(/[\s,]/)[0])) ||
              (location.split(/[\s,]/)[0].length > 3 && destinationPort.includes(location.split(/[\s,]/)[0]));
            
            return isAtDestination;
          }
          return false;
        });
        
        // Only flag as delayed if vessel hasn't arrived at destination yet
        if (!hasArrivedAtDestination) {
          riskScore += 3;
          riskReasons.push(`ETA passed ${daysPastEta} day(s) ago - container delayed`);
        }
      }
    }
    
    // Rule 2: Last Free Day approaching or exceeded (HIGH PRIORITY)
    const lastFreeDay = container?.lastFreeDay || container?.containerFreeTime;
    if (lastFreeDay) {
      try {
        const lfd = new Date(lastFreeDay);
        lfd.setHours(0, 0, 0, 0);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const daysUntilLFD = Math.floor((lfd.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        
        if (daysUntilLFD < 0) {
          riskScore += 4;
          const daysPast = Math.abs(daysUntilLFD);
          riskReasons.push(`Demurrage accruing - ${daysPast} day(s) past LFD`);
        } else if (daysUntilLFD === 0) {
          riskScore += 3;
          riskReasons.push("LFD is TODAY - immediate action required");
        } else if (daysUntilLFD <= 2) {
          riskScore += 2;
          riskReasons.push(`LFD in ${daysUntilLFD} day(s)`);
        }
      } catch (e) {
        // Invalid date format, skip
      }
    }
    
    // Rule 3: Container status is delayed or on-hold
    const status = shipment.status?.toLowerCase() || "";
    if (status.includes("delay") || status.includes("hold") || status.includes("pending")) {
      riskScore += 2;
      riskReasons.push(`Container status: ${shipment.status}`);
    }
    
    // Rule 4: No updates in 7+ days for active shipments
    if (shipment.lastFetchedAt && !["delivered", "completed", "cancelled"].includes(status)) {
      const daysSinceUpdate = Math.floor((now.getTime() - new Date(shipment.lastFetchedAt).getTime()) / (1000 * 60 * 60 * 24));
      if (daysSinceUpdate > 7) {
        riskScore += 1;
        riskReasons.push(`No tracking updates for ${daysSinceUpdate} days`);
      }
    }
    
    // Rule 5: Long transit time check (using ETA and ETD for calculation only)
    if (shipment.etd && shipment.eta) {
      try {
        const etd = new Date(shipment.etd);
        const eta = new Date(shipment.eta);
        const transitDays = Math.floor((eta.getTime() - etd.getTime()) / (1000 * 60 * 60 * 24));
        
        if (transitDays > 45) {
          riskScore += 1;
          riskReasons.push(`Long transit time (${transitDays} days)`);
        }
      } catch (e) {
        // Invalid dates, skip
      }
    }
    
    // Determine risk level
    let riskLevel: "low" | "medium" | "high" | "critical";
    if (riskScore >= 7) {
      riskLevel = "critical";
    } else if (riskScore >= 4) {
      riskLevel = "high";
    } else if (riskScore >= 2) {
      riskLevel = "medium";
    } else {
      riskLevel = "low";
    }
    
    return {
      riskLevel,
      riskScore,
      riskReasons,
    };
  }

  /**
   * Assess and update risk for all active Cargoes Flow shipments
   */
  async assessAllShipments(): Promise<{ updated: number; errors: number }> {
    console.log("[Cargoes Flow Risk Assessment] Starting risk assessment...");
    
    let updated = 0;
    let errors = 0;
    let page = 1;
    const pageSize = 100;
    
    try {
      while (true) {
        // Fetch shipments in batches
        const result = await this.storage.getCargoesFlowShipments({ page, pageSize });
        
        if (result.data.length === 0) {
          break; // No more shipments
        }
        
        // Process each shipment
        for (const shipment of result.data) {
          try {
            const assessment = this.assessShipmentRisk(shipment);
            
            // Update shipment with risk data in rawData
            await this.storage.updateCargoesFlowShipment(shipment.id, {
              rawData: {
                ...shipment.rawData,
                riskLevel: assessment.riskLevel,
                riskScore: assessment.riskScore,
                riskReasons: assessment.riskReasons,
                riskAssessedAt: new Date().toISOString(),
              },
            });
            
            updated++;
          } catch (error) {
            console.error(`[Cargoes Flow Risk Assessment] Error assessing shipment ${shipment.id}:`, error);
            errors++;
          }
        }
        
        // Move to next page
        if (result.pagination.page >= result.pagination.totalPages) {
          break;
        }
        page++;
      }
      
      console.log(`[Cargoes Flow Risk Assessment] Complete - Updated: ${updated}, Errors: ${errors}`);
      return { updated, errors };
    } catch (error) {
      console.error("[Cargoes Flow Risk Assessment] Fatal error:", error);
      throw error;
    }
  }
}
