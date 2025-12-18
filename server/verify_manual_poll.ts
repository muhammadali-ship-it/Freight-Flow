
import "dotenv/config";
import { triggerManualPoll } from "./services/cargoes-flow-poller.js";

async function verifyManualPoll() {
    console.log("Triggering manual poll...");
    try {
        const log = await triggerManualPoll();
        console.log("Manual poll result:", log);
    } catch (error) {
        console.error("Manual poll failed:", error);
    }
    process.exit(0);
}

verifyManualPoll();
