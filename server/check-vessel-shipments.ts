import { db } from "./db.js";
import { sql } from "drizzle-orm";

async function checkVesselShipmentData() {
    const vesselId = "10c23437-1fcf-42ec-abfa-73f9dab5bb34";

    console.log("=== Checking Vessel Shipment Data ===\n");

    // Get vessel info
    const vesselQuery = sql`SELECT * FROM vessels WHERE id = ${vesselId}`;
    const vesselResult = await db.execute(vesselQuery);
    console.log("Vessel:", vesselResult.rows[0]);
    console.log("\n");

    // Get shipments for this vessel
    const searchPattern = `%${vesselResult.rows[0].name}%`;
    const shipmentsQuery = sql`
    SELECT id, container_number, mbl_number, origin_port, destination_port, carrier, status, raw_data
    FROM cargoes_flow_shipments
    WHERE raw_data::text LIKE ${searchPattern}
    LIMIT 3
  `;
    const shipmentsResult = await db.execute(shipmentsQuery);

    console.log("Sample shipments:");
    shipmentsResult.rows.forEach((shipment: any, index: number) => {
        console.log(`\n--- Shipment ${index + 1} ---`);
        console.log("ID:", shipment.id);
        console.log("container_number:", shipment.container_number);
        console.log("mbl_number:", shipment.mbl_number);
        console.log("origin_port:", shipment.origin_port);
        console.log("destination_port:", shipment.destination_port);
        console.log("carrier:", shipment.carrier);
        console.log("status:", shipment.status);
        console.log("\nraw_data fields:");
        const rawData = shipment.raw_data;
        console.log("  containerNumber:", rawData.containerNumber);
        console.log("  mblNumber:", rawData.mblNumber);
        console.log("  blNumber:", rawData.blNumber);
        console.log("  originPort:", rawData.originPort);
        console.log("  originOceanPort:", rawData.originOceanPort);
        console.log("  destinationPort:", rawData.destinationPort);
        console.log("  destinationOceanPort:", rawData.destinationOceanPort);
        console.log("  carrier:", rawData.carrier);
        console.log("  carrierScac:", rawData.carrierScac);
        console.log("  status:", rawData.status);
    });

    process.exit(0);
}

checkVesselShipmentData();
