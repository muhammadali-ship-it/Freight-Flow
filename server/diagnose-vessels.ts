import { db } from "./db.js";
import { sql } from "drizzle-orm";

async function diagnoseVesselData() {
    console.log("=== Vessel Data Diagnostic ===\n");

    // Get a sample vessel from vessels table
    const vesselsQuery = sql`SELECT * FROM vessels LIMIT 5`;
    const vesselsResult = await db.execute(vesselsQuery);
    console.log("Sample vessels from vessels table:");
    console.log(vesselsResult.rows);
    console.log("\n");

    // Get a sample shipment with vessel_name
    const shipmentsQuery = sql`SELECT id, vessel_name, container_number FROM cargoes_flow_shipments WHERE vessel_name IS NOT NULL LIMIT 5`;
    const shipmentsResult = await db.execute(shipmentsQuery);
    console.log("Sample shipments with vessel_name:");
    console.log(shipmentsResult.rows);
    console.log("\n");

    // Check if any vessel names match
    const matchQuery = sql`
    SELECT v.name as vessel_table_name, COUNT(s.id) as shipment_count
    FROM vessels v
    LEFT JOIN cargoes_flow_shipments s ON s.vessel_name = v.name
    GROUP BY v.name
    LIMIT 10
  `;
    const matchResult = await db.execute(matchQuery);
    console.log("Vessel name matches:");
    console.log(matchResult.rows);
    console.log("\n");

    // Check distinct vessel names in shipments
    const distinctQuery = sql`SELECT DISTINCT vessel_name FROM cargoes_flow_shipments WHERE vessel_name IS NOT NULL LIMIT 10`;
    const distinctResult = await db.execute(distinctQuery);
    console.log("Distinct vessel names in cargoes_flow_shipments:");
    console.log(distinctResult.rows);

    process.exit(0);
}

diagnoseVesselData();
