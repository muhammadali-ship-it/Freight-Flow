import { Container, InsertException, InsertNotification } from "@shared/schema.js";
import { storage } from "../storage.js";

export interface RiskAssessment {
  riskLevel: "low" | "medium" | "high" | "critical";
  riskScore: number;
  riskReasons: string[];
  shouldCreateException: boolean;
  shouldNotify: boolean;
  notificationPriority: "low" | "normal" | "high" | "urgent";
}

export class RiskAssessmentService {
  
  /**
   * Calculate risk level for a container based on multiple rules
   */
  async assessContainerRisk(container: Container): Promise<RiskAssessment> {
    let riskScore = 0;
    const riskReasons: string[] = [];
    
    const now = new Date();
    
    // Rule 1: ETA passed but container not arrived (CRITICAL)
    if (container.eta && !["arrived", "unloaded", "gate-out", "delivered"].includes(container.status)) {
      const eta = new Date(container.eta);
      const daysPastEta = Math.floor((now.getTime() - eta.getTime()) / (1000 * 60 * 60 * 24));
      
      if (daysPastEta > 0) {
        riskScore += 3;
        riskReasons.push(`ETA passed ${daysPastEta} day(s) ago - container delayed`);
      }
    }
    
    // Rule 2: Last Free Day approaching or exceeded (HIGH PRIORITY)
    if (container.lastFreeDay) {
      const lfd = new Date(container.lastFreeDay);
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
    }
    
    // Rule 3: Customs clearance status (if in customs-clearance)
    if (container.status === "customs-clearance") {
      riskScore += 2;
      riskReasons.push("In customs clearance");
    }
    
    // Rule 4: Container has hold types (documentation, payment, etc.)
    if (container.holdTypes && container.holdTypes.length > 0) {
      riskScore += 2;
      riskReasons.push(`Active holds: ${container.holdTypes.join(", ")}`);
    }
    
    // Rule 5: Stale data - no updates in 48+ hours for in-transit containers
    if (["in-transit", "departed", "loaded"].includes(container.status) && container.updatedAt) {
      const hoursSinceUpdate = (now.getTime() - new Date(container.updatedAt).getTime()) / (1000 * 60 * 60);
      if (hoursSinceUpdate > 48) {
        riskScore += 1;
        riskReasons.push("No tracking updates for 48+ hours");
      }
    }
    
    // Rule 6: Delayed status (explicitly marked)
    if (container.status === "delayed") {
      riskScore += 2;
      riskReasons.push("Container marked as delayed");
    }
    
    // Rule 7: Long transit time check (using createdAt as proxy for booking date)
    if (container.eta && container.createdAt) {
      const transitDays = Math.floor((new Date(container.eta).getTime() - new Date(container.createdAt).getTime()) / (1000 * 60 * 60 * 24));
      
      // Heuristic: if transit time > 30 days from booking, flag it
      if (transitDays > 30) {
        riskScore += 1;
        riskReasons.push(`Long planned transit: ${transitDays} days`);
      }
    }
    
    // Rule 8: Gate-out readiness - container arrived but not gate-out after 3+ days
    if (container.status === "arrived" && container.updatedAt) {
      const daysSinceArrival = Math.floor((now.getTime() - new Date(container.updatedAt).getTime()) / (1000 * 60 * 60 * 24));
      if (daysSinceArrival >= 3) {
        riskScore += 2;
        riskReasons.push(`Arrived ${daysSinceArrival} days ago, not gated out`);
      }
    }
    
    // Determine risk level based on score
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
    
    // Determine if we should create exception/notification
    const shouldCreateException = riskScore >= 2; // Medium or higher
    const shouldNotify = riskScore >= 3; // High or critical
    
    let notificationPriority: "low" | "normal" | "high" | "urgent";
    if (riskScore >= 7) {
      notificationPriority = "urgent";
    } else if (riskScore >= 4) {
      notificationPriority = "high";
    } else if (riskScore >= 2) {
      notificationPriority = "normal";
    } else {
      notificationPriority = "low";
    }
    
    return {
      riskLevel,
      riskScore,
      riskReasons,
      shouldCreateException,
      shouldNotify,
      notificationPriority,
    };
  }
  
  /**
   * Update container risk and create exceptions/notifications if needed
   */
  async updateContainerRisk(container: Container): Promise<void> {
    const assessment = await this.assessContainerRisk(container);
    
    // Check if risk level has changed
    const oldRiskLevel = container.riskLevel;
    const newRiskLevel = assessment.riskLevel;
    
    // Only proceed if risk level changed or increased
    const riskChanged = oldRiskLevel !== newRiskLevel;
    const riskIncreased = this.getRiskLevelValue(newRiskLevel) > this.getRiskLevelValue(oldRiskLevel);
    const riskDecreased = this.getRiskLevelValue(newRiskLevel) < this.getRiskLevelValue(oldRiskLevel);
    
    // Update container risk fields
    await storage.updateContainer(container.id, {
      riskLevel: assessment.riskLevel,
      riskReason: assessment.riskReasons.join("; "),
    });
    
    // Create exception if risk is significant and changed/increased
    if (assessment.shouldCreateException && (riskChanged || riskIncreased)) {
      const exceptionType = this.getExceptionType(assessment);
      
      // Remove old risk alert exceptions before creating new one
      await storage.deleteRiskAlertExceptions(container.id);
      
      await storage.createException({
        containerId: container.id,
        type: exceptionType,
        title: `${assessment.riskLevel.toUpperCase()} Risk Alert`,
        description: assessment.riskReasons.join(". "),
        timestamp: new Date().toISOString(),
      });
    }
    
    // Create notifications if risk warrants it and increased
    if (assessment.shouldNotify && riskIncreased) {
      await this.notifyRiskEscalation(container, assessment);
    }
    
    // Auto-dismiss notifications if risk decreased
    if (riskDecreased && newRiskLevel) {
      const dismissedCount = await storage.dismissRiskNotificationsForContainer(container.id, newRiskLevel);
      if (dismissedCount > 0) {
      }
    }
  }
  
  /**
   * Bulk assess all active containers
   */
  async assessAllContainers(): Promise<void> {
    const activeStatuses = ["booking-confirmed", "gate-in", "loaded", "departed", "in-transit", "arrived", "at-terminal", "on-rail", "customs-clearance"];
    
    try {
      // Get all active containers
      const containers = await storage.getAllContainers();
      const activeContainers = containers.filter(c => activeStatuses.includes(c.status));
      
      let updatedCount = 0;
      let exceptionCount = 0;
      let notificationCount = 0;
      let dismissedCount = 0;
      
      for (const container of activeContainers) {
        try {
          const assessment = await this.assessContainerRisk(container);
          
          // Check if risk changed
          const oldRiskLevel = container.riskLevel;
          const riskChanged = oldRiskLevel !== assessment.riskLevel;
          const riskIncreased = this.getRiskLevelValue(assessment.riskLevel) > this.getRiskLevelValue(oldRiskLevel);
          const riskDecreased = this.getRiskLevelValue(assessment.riskLevel) < this.getRiskLevelValue(oldRiskLevel);
          
          if (riskChanged || assessment.riskScore > 0) {
            await storage.updateContainer(container.id, {
              riskLevel: assessment.riskLevel,
              riskReason: assessment.riskReasons.join("; "),
            });
            updatedCount++;
            
            // Create exception if needed
            if (assessment.shouldCreateException && (riskChanged || riskIncreased)) {
              const exceptionType = this.getExceptionType(assessment);
              
              // Remove old risk alert exceptions before creating new one
              await storage.deleteRiskAlertExceptions(container.id);
              
              await storage.createException({
                containerId: container.id,
                type: exceptionType,
                title: `${assessment.riskLevel.toUpperCase()} Risk Alert`,
                description: assessment.riskReasons.join(". "),
                timestamp: new Date().toISOString(),
              });
              exceptionCount++;
            }
            
            // Create notifications if needed
            if (assessment.shouldNotify && riskIncreased) {
              await this.notifyRiskEscalation(container, assessment);
              notificationCount++;
            }
            
            // Auto-dismiss notifications if risk decreased
            if (riskDecreased && assessment.riskLevel) {
              const dismissed = await storage.dismissRiskNotificationsForContainer(container.id, assessment.riskLevel);
              dismissedCount += dismissed;
            }
          }
        } catch (error) {
          console.error(`[Risk Assessment] Error assessing container ${container.containerNumber}:`, error);
        }
      }
      
      if (updatedCount > 0 || exceptionCount > 0 || notificationCount > 0) {
        console.log(`[Risk Assessment] Updated: ${updatedCount}, Exceptions: ${exceptionCount}, Notifications: ${notificationCount}`);
      }
    } catch (error) {
      console.error("[Risk Assessment] Error:", error);
    }
  }
  
  /**
   * Notify users about risk escalation
   */
  private async notifyRiskEscalation(container: Container, assessment: RiskAssessment): Promise<void> {
    // Get users to notify (all users for now, can be filtered by assignment later)
    const users = await storage.getAllUsers();
    
    const notificationType = this.getNotificationType(assessment);
    
    for (const user of users) {
      await storage.createNotification({
        userId: user.id,
        type: notificationType,
        priority: assessment.notificationPriority,
        title: `${container.containerNumber} - ${assessment.riskLevel.toUpperCase()} Risk`,
        message: assessment.riskReasons.join(". "),
        entityType: "CONTAINER",
        entityId: container.id,
        metadata: {
          containerNumber: container.containerNumber,
          riskLevel: assessment.riskLevel,
          riskScore: assessment.riskScore,
          riskReasons: assessment.riskReasons,
        },
        isRead: false,
      });
    }
  }
  
  /**
   * Get exception type based on risk assessment
   */
  private getExceptionType(assessment: RiskAssessment): string {
    if (assessment.riskReasons.some(r => r.includes("Demurrage"))) {
      return "DEMURRAGE_RISK";
    }
    if (assessment.riskReasons.some(r => r.includes("Customs"))) {
      return "CUSTOMS_ISSUE";
    }
    if (assessment.riskReasons.some(r => r.includes("delayed") || r.includes("ETA passed"))) {
      return "DELAY";
    }
    if (assessment.riskReasons.some(r => r.includes("hold"))) {
      return "DOCUMENTATION_HOLD";
    }
    return "RISK_ESCALATION";
  }
  
  /**
   * Get notification type based on risk assessment
   */
  private getNotificationType(assessment: RiskAssessment): string {
    if (assessment.riskReasons.some(r => r.includes("Demurrage"))) {
      return "DEMURRAGE_ALERT";
    }
    if (assessment.riskReasons.some(r => r.includes("Customs"))) {
      return "CUSTOMS_HOLD";
    }
    if (assessment.riskReasons.some(r => r.includes("delayed") || r.includes("ETA passed"))) {
      return "DELAY";
    }
    return "EXCEPTION";
  }
  
  /**
   * Convert risk level to numeric value for comparison
   */
  private getRiskLevelValue(level: string | null): number {
    switch (level) {
      case "critical": return 4;
      case "high": return 3;
      case "medium": return 2;
      case "low": return 1;
      default: return 0;
    }
  }
}

export const riskAssessmentService = new RiskAssessmentService();
