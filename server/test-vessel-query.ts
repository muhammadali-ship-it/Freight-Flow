import { db } from "./db.js";
import { sql } from "drizzle-orm";

async function testVesselQuery() {
    const vesselName = "MSC SUAPE VII";

    console.log(`Testing query for vessel: ${vesselName}\n`);

    // Test 1: Check if vessel exists in vessels table
    const vesselQuery = sql`SELECT * FROM vessels WHERE name = ${vesselName}`;
    const vesselResult = await db.execute(vesselQuery);
    console.log("1. Vessel in vessels table:");
    console.log(vesselResult.rows);
    console.log("\n");

    // Test 2: Check raw_data structure for a sample shipment
    const sampleQuery = sql`
    SELECT id, raw_data->'shipmentLegs'->'portToPort'->'segments' as segments
    FROM cargoes_flow_shipments
    WHERE raw_data->'shipmentLegs'->'portToPort'->'segments' IS NOT NULL
    LIMIT 1
  `;
    const sampleResult = await db.execute(sampleQuery);
    console.log("2. Sample shipment segments structure:");
    console.log(JSON.stringify(sampleResult.rows[0], null, 2));
    console.log("\n");

    // Test 3: Try the LIKE query
    const searchPattern = `%"transportName":"${vesselName}"%`;
    const likeQuery = sql`
    SELECT COUNT(*) as count
    FROM cargoes_flow_shipments
    WHERE raw_data::text LIKE ${searchPattern}
  `;
    const likeResult = await db.execute(likeQuery);
    console.log("3. LIKE query result:");
    console.log(likeResult.rows);
    console.log("\n");

    // Test 4: Search for any occurrence of the vessel name
    const anyOccurrenceQuery = sql`
    SELECT COUNT(*) as count
    FROM cargoes_flow_shipments
    WHERE raw_data::text LIKE ${'%' + vesselName + '%'}
  `;
    const anyResult = await db.execute(anyOccurrenceQuery);
    console.log("4. Any occurrence of vessel name:");
    console.log(anyResult.rows);
    console.log("\n");

    // Test 5: Get actual shipments that might contain this vessel
    const actualQuery = sql`
    SELECT id, raw_data->'shipmentLegs'->'portToPort'->'segments' as segments
    FROM cargoes_flow_shipments
    WHERE raw_data::text LIKE ${'%' + vesselName + '%'}
    LIMIT 3
  `;
    const actualResult = await db.execute(actualQuery);
    console.log("5. Actual shipments containing vessel name:");
    console.log(JSON.stringify(actualResult.rows, null, 2));

    process.exit(0);
}

testVesselQuery();
