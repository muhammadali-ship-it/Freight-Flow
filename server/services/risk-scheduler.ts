import { riskAssessmentService } from "./risk-assessment-service.js";
import { demurrageCalculator } from "./demurrage-calculator.js";

export class RiskScheduler {
  private intervalId: NodeJS.Timeout | null = null;
  private readonly INTERVAL_MINUTES = 15;
  
  /**
   * Start the risk assessment and demurrage scheduler
   */
  start(): void {
    if (this.intervalId) {
      return;
    }
    
    // Run immediately on start
    this.runAssessment();
    
    // Schedule to run every X minutes
    const intervalMs = this.INTERVAL_MINUTES * 60 * 1000;
    this.intervalId = setInterval(() => {
      this.runAssessment();
    }, intervalMs);
  }
  
  /**
   * Stop the scheduler
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log("[Risk Scheduler] Stopped");
    }
  }
  
  /**
   * Run risk assessment and demurrage calculation
   */
  private async runAssessment(): Promise<void> {
    try {
      // Run risk assessment
      await riskAssessmentService.assessAllContainers();
      
      // Run demurrage calculation
      await demurrageCalculator.calculateAllDemurrage();
    } catch (error) {
      console.error("[Risk Scheduler] Error:", error);
    }
  }
  
  /**
   * Manually trigger an assessment (for testing or manual runs)
   */
  async runNow(): Promise<void> {
    await this.runAssessment();
  }
}

export const riskScheduler = new RiskScheduler();
