import { db } from "../db.js";
import { containers, notifications } from "@shared/schema.js";
import { eq, and, sql, isNotNull } from "drizzle-orm";

interface DemurrageResult {
  containerId: string;
  containerNumber: string;
  daysOverdue: number;
  calculatedFee: number;
  lastFreeDay: string;
}

export class DemurrageCalculator {
  async calculateAllDemurrage(): Promise<{
    updated: number;
    results: DemurrageResult[];
    notifications: number;
  }> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const allContainers = await db
      .select()
      .from(containers)
      .where(isNotNull(containers.lastFreeDay));

    const results: DemurrageResult[] = [];
    let updatedCount = 0;
    let notificationsCreated = 0;

    for (const container of allContainers) {
      if (!container.lastFreeDay) continue;

      const lfdDate = new Date(container.lastFreeDay);
      lfdDate.setHours(0, 0, 0, 0);

      if (today > lfdDate) {
        const daysOverdue = Math.floor(
          (today.getTime() - lfdDate.getTime()) / (1000 * 60 * 60 * 24)
        );

        const dailyRate = parseFloat(container.dailyFeeRate || "150");
        const calculatedFee = daysOverdue * dailyRate;

        const previousFee = parseFloat(container.demurrageFee || "0");
        const feeChanged = Math.abs(calculatedFee - previousFee) > 0.01;

        await db
          .update(containers)
          .set({
            demurrageFee: calculatedFee.toFixed(2),
            updatedAt: new Date(),
          })
          .where(eq(containers.id, container.id));

        results.push({
          containerId: container.id,
          containerNumber: container.containerNumber,
          daysOverdue,
          calculatedFee,
          lastFreeDay: container.lastFreeDay,
        });

        updatedCount++;

        if (feeChanged && daysOverdue % 3 === 0) {
          await this.createDemurrageAlert(
            container.id,
            container.containerNumber,
            daysOverdue,
            calculatedFee
          );
          notificationsCreated++;
        }
      }
    }

    if (updatedCount > 0 || notificationsCreated > 0) {
      console.log(`[Demurrage Calculator] Updated: ${updatedCount}, Notifications: ${notificationsCreated}`);
    }

    return {
      updated: updatedCount,
      results,
      notifications: notificationsCreated,
    };
  }

  private async createDemurrageAlert(
    containerId: string,
    containerNumber: string,
    daysOverdue: number,
    fee: number
  ): Promise<void> {
    const priority = daysOverdue > 7 ? "urgent" : daysOverdue > 3 ? "high" : "normal";

    await db.insert(notifications).values({
      type: "DEMURRAGE_ALERT",
      priority,
      title: `Demurrage Accruing: ${containerNumber}`,
      message: `Container ${containerNumber} is ${daysOverdue} days past Last Free Day. Estimated demurrage: $${fee.toFixed(2)}`,
      entityType: "CONTAINER",
      entityId: containerId,
      metadata: {
        containerNumber,
        daysOverdue,
        demurrageFee: fee,
      },
      isRead: false,
    });
  }

  async calculateSingleContainer(containerId: string): Promise<DemurrageResult | null> {
    const container = await db
      .select()
      .from(containers)
      .where(eq(containers.id, containerId))
      .limit(1);

    if (!container[0] || !container[0].lastFreeDay) {
      return null;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const lfdDate = new Date(container[0].lastFreeDay);
    lfdDate.setHours(0, 0, 0, 0);

    if (today <= lfdDate) {
      return null;
    }

    const daysOverdue = Math.floor(
      (today.getTime() - lfdDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    const dailyRate = parseFloat(container[0].dailyFeeRate || "150");
    const calculatedFee = daysOverdue * dailyRate;

    await db
      .update(containers)
      .set({
        demurrageFee: calculatedFee.toFixed(2),
        updatedAt: new Date(),
      })
      .where(eq(containers.id, containerId));

    return {
      containerId: container[0].id,
      containerNumber: container[0].containerNumber,
      daysOverdue,
      calculatedFee,
      lastFreeDay: container[0].lastFreeDay,
    };
  }
}

export const demurrageCalculator = new DemurrageCalculator();
