import { storage } from "./storage.js";

async function seed() {
  console.log("Seeding database with one test container...");

  // First create a shipment
  const shipment = await storage.createShipment({
    referenceNumber: "SHP-TEST-001",
    bookingNumber: "BK789456123",
    masterBillOfLading: "BL456789012",
    shipper: "Test Shipper Inc.",
    consignee: "Test Consignee Corp.",
    originPort: "Shanghai, China",
    destinationPort: "Los Angeles, USA",
    etd: "2025-12-03",
    eta: "2025-12-15",
    carrier: "MSC",
    vesselName: "MSC Gulsun",
    status: "active",
  });

  // Create only one test container linked to the shipment
  const container1 = await storage.createContainer({
    shipmentId: shipment.id,
    containerNumber: "MSCU1234567",
    status: "in-transit",
    origin: "Shanghai",
    destination: "Los Angeles",
    carrier: "MSC",
    vesselName: "MSC Gulsun",
    bookingNumber: "BK789456123",
    masterBillOfLading: "BL456789012",
    weight: "24,500 kg",
    volume: "33.2 CBM",
    eta: "2025-12-15",
    estimatedArrival: "Dec 15, 2025 14:00",
    progress: 65,
    reference: "PO-2024-1156",
    riskLevel: "low",
    riskReason: null,
    terminalStatus: null,
    lastFreeDay: "2025-12-20",
    demurrageFee: null,
  });

  // Add vessel position for the container
  await storage.createVesselPosition({
    containerId: container1.id,
    latitude: "35.6762",
    longitude: "-139.6503",
    speed: "18.5",
    course: "85",
    timestamp: "2 hours ago",
  });

  // Add timeline events for the container with correct field names
  const timelineEvents = [
    { 
      containerId: container1.id,
      title: "Container Picked Up",
      location: "Shanghai, China",
      timestamp: "Dec 1, 09:30",
      completed: true,
      isCurrent: false
    },
    { 
      containerId: container1.id,
      title: "Loaded on Vessel",
      location: "Port of Shanghai",
      timestamp: "Dec 2, 14:00",
      completed: true,
      isCurrent: false
    },
    { 
      containerId: container1.id,
      title: "Departed Port",
      location: "Shanghai, China",
      timestamp: "Dec 3, 08:00",
      completed: true,
      isCurrent: false
    },
    { 
      containerId: container1.id,
      title: "In Transit",
      location: "Pacific Ocean",
      timestamp: "Current",
      completed: false,
      isCurrent: true
    },
    { 
      containerId: container1.id,
      title: "Arrival at Destination Port",
      location: "Los Angeles, USA",
      timestamp: "Dec 15 (Est.)",
      completed: false,
      isCurrent: false
    }
  ];

  for (const event of timelineEvents) {
    await storage.createTimelineEvent(event);
  }

  console.log("✅ Database seeded successfully with 1 test shipment and container!");
  console.log("   - Shipment: SHP-TEST-001");
  console.log("   - Container: MSCU1234567");
  console.log("   - Status: In Transit");
  console.log("   - Route: Shanghai → Los Angeles");
}

seed().catch((error) => {
  console.error("Error seeding database:", error);
  process.exit(1);
});