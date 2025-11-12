import { db } from "./db.js";
import { 
  containers,
  exceptions,
  vesselPositions,
  railSegments,
  timelineEvents,
  milestones,
  shipmentUsers,
  shipments,
} from "./shared/schema";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

async function cleanAndReseed() {
  try {
    console.log("🧹 Cleaning database...");
    
    // Delete all existing data in reverse dependency order
    await db.delete(timelineEvents);
    console.log("  ✓ Cleared timeline events");
    
    await db.delete(railSegments);
    console.log("  ✓ Cleared rail segments");
    
    await db.delete(vesselPositions);
    console.log("  ✓ Cleared vessel positions");
    
    await db.delete(exceptions);
    console.log("  ✓ Cleared exceptions");
    
    await db.delete(containers);
    console.log("  ✓ Cleared containers");
    
    await db.delete(milestones);
    console.log("  ✓ Cleared milestones");
    
    await db.delete(shipmentUsers);
    console.log("  ✓ Cleared shipment users");
    
    await db.delete(shipments);
    console.log("  ✓ Cleared shipments");
    
    console.log("✅ Database cleaned successfully!");
    
    // Now run the seed script
    console.log("\n🌱 Re-seeding database with one test container...");
    await execAsync("tsx server/seed.ts");
    
    console.log("✅ Database re-seeded successfully!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Error during clean and reseed:", error);
    process.exit(1);
  }
}

cleanAndReseed();