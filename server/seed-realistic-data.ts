import { storage } from "./storage.js";

async function seedRealisticData() {
  try {
    console.log("Creating realistic shipments and containers...\n");

    // Get all users with "User" role
    const allUsers = await storage.getAllUsers();
    const regularUsers = allUsers.filter(u => u.role === "User");
    
    if (regularUsers.length === 0) {
      console.log("No regular users found. Please create users first.");
      process.exit(1);
    }

    // Realistic shipment data
    const shipmentsData = [
      {
        shipment: {
          referenceNumber: "SHP-2024-1001",
          bookingNumber: "MAEU789456123",
          masterBillOfLading: "MAEU45678901234",
          shipper: "Global Electronics Manufacturing Ltd.",
          consignee: "TechMart Distribution Center",
          originPort: "Shenzhen, China",
          destinationPort: "Long Beach, CA, USA",
          etd: "2024-10-15",
          eta: "2024-11-05",
          carrier: "Maersk",
          scacCode: "MAEU",
          vesselName: "Maersk Sealand",
          status: "active",
        },
        containers: [
          {
            containerNumber: "MAEU1234567",
            containerType: "40HC",
            status: "in-transit",
            origin: "Shenzhen",
            destination: "Long Beach",
            carrier: "Maersk",
            vesselName: "Maersk Sealand",
            weight: "22,000 kg",
            volume: "28.5 CBM",
            eta: "2024-11-05",
            estimatedArrival: "Nov 5, 2024 09:00",
            progress: 45,
            riskLevel: "low",
          },
          {
            containerNumber: "MAEU2345678",
            containerType: "40HC",
            status: "in-transit",
            origin: "Shenzhen",
            destination: "Long Beach",
            carrier: "Maersk",
            vesselName: "Maersk Sealand",
            weight: "24,500 kg",
            volume: "31.2 CBM",
            eta: "2024-11-05",
            estimatedArrival: "Nov 5, 2024 09:00",
            progress: 45,
            riskLevel: "medium",
          }
        ],
        assignedUsers: ["sarah_chen", "mike_johnson"]
      },
      {
        shipment: {
          referenceNumber: "SHP-2024-1002",
          bookingNumber: "MSC567891234",
          masterBillOfLading: "MSC78901234567",
          shipper: "Automotive Parts International",
          consignee: "Detroit Auto Assembly",
          originPort: "Hamburg, Germany",
          destinationPort: "New York, NY, USA",
          etd: "2024-10-20",
          eta: "2024-11-12",
          carrier: "MSC",
          scacCode: "MSCU",
          vesselName: "MSC Oscar",
          status: "active",
        },
        containers: [
          {
            containerNumber: "MSCU3456789",
            containerType: "40HC",
            status: "loaded",
            origin: "Hamburg",
            destination: "New York",
            carrier: "MSC",
            vesselName: "MSC Oscar",
            weight: "26,800 kg",
            volume: "33.1 CBM",
            eta: "2024-11-12",
            estimatedArrival: "Nov 12, 2024 14:00",
            progress: 25,
            riskLevel: "low",
          }
        ],
        assignedUsers: ["emily_rodriguez"]
      },
      {
        shipment: {
          referenceNumber: "SHP-2024-1003",
          bookingNumber: "COSCO891234567",
          masterBillOfLading: "COSU12345678901",
          shipper: "Pacific Textile Mills",
          consignee: "Fashion Retailers Network",
          originPort: "Ningbo, China",
          destinationPort: "Los Angeles, CA, USA",
          etd: "2024-10-18",
          eta: "2024-11-08",
          carrier: "COSCO",
          scacCode: "COSU",
          vesselName: "COSCO Glory",
          status: "active",
        },
        containers: [
          {
            containerNumber: "COSU4567890",
            containerType: "20GP",
            status: "departed",
            origin: "Ningbo",
            destination: "Los Angeles",
            carrier: "COSCO",
            vesselName: "COSCO Glory",
            weight: "18,500 kg",
            volume: "27.3 CBM",
            eta: "2024-11-08",
            estimatedArrival: "Nov 8, 2024 16:00",
            progress: 55,
            riskLevel: "high",
          },
          {
            containerNumber: "COSU5678901",
            containerType: "40HC",
            status: "departed",
            origin: "Ningbo",
            destination: "Los Angeles",
            carrier: "COSCO",
            vesselName: "COSCO Glory",
            weight: "20,100 kg",
            volume: "29.8 CBM",
            eta: "2024-11-08",
            estimatedArrival: "Nov 8, 2024 16:00",
            progress: 55,
            riskLevel: "low",
          }
        ],
        assignedUsers: ["james_williams", "sarah_chen"]
      },
      {
        shipment: {
          referenceNumber: "SHP-2024-1004",
          bookingNumber: "HLCU234567890",
          masterBillOfLading: "HLCU90123456789",
          shipper: "Industrial Machinery Corp",
          consignee: "Midwest Manufacturing Hub",
          originPort: "Rotterdam, Netherlands",
          destinationPort: "Houston, TX, USA",
          etd: "2024-10-25",
          eta: "2024-11-18",
          carrier: "Hapag-Lloyd",
          scacCode: "HLCU",
          vesselName: "Hamburg Express",
          status: "active",
        },
        containers: [
          {
            containerNumber: "HLCU6789012",
            containerType: "40GP",
            status: "gate-in",
            origin: "Rotterdam",
            destination: "Houston",
            carrier: "Hapag-Lloyd",
            vesselName: "Hamburg Express",
            weight: "28,900 kg",
            volume: "35.6 CBM",
            eta: "2024-11-18",
            estimatedArrival: "Nov 18, 2024 11:00",
            progress: 15,
            riskLevel: "medium",
          }
        ],
        assignedUsers: ["lisa_thompson"]
      },
      {
        shipment: {
          referenceNumber: "SHP-2024-1005",
          bookingNumber: "CMAU345678901",
          masterBillOfLading: "CMAU01234567890",
          shipper: "Asian Foods Import Export",
          consignee: "National Food Distributors",
          originPort: "Singapore",
          destinationPort: "Miami, FL, USA",
          etd: "2024-10-22",
          eta: "2024-11-15",
          carrier: "CMA CGM",
          scacCode: "CMDU",
          vesselName: "CMA CGM Titan",
          status: "active",
        },
        containers: [
          {
            containerNumber: "CMAU7890123",
            containerType: "20GP",
            status: "loaded",
            origin: "Singapore",
            destination: "Miami",
            carrier: "CMA CGM",
            vesselName: "CMA CGM Titan",
            weight: "21,300 kg",
            volume: "30.5 CBM",
            eta: "2024-11-15",
            estimatedArrival: "Nov 15, 2024 08:00",
            progress: 30,
            riskLevel: "low",
          },
          {
            containerNumber: "CMAU8901234",
            containerType: "40HC",
            status: "loaded",
            origin: "Singapore",
            destination: "Miami",
            carrier: "CMA CGM",
            vesselName: "CMA CGM Titan",
            weight: "19,800 kg",
            volume: "28.9 CBM",
            eta: "2024-11-15",
            estimatedArrival: "Nov 15, 2024 08:00",
            progress: 30,
            riskLevel: "low",
          }
        ],
        assignedUsers: ["mike_johnson", "emily_rodriguez"]
      }
    ];

    // Create shipments, containers, and assign users
    for (const data of shipmentsData) {
      console.log(`📦 Creating shipment: ${data.shipment.referenceNumber}`);
      
      // Create shipment
      const shipment = await storage.createShipment(data.shipment);
      
      // Create containers for this shipment
      for (const containerData of data.containers) {
        const container = await storage.createContainer({
          shipmentId: shipment.id,
          containerNumber: containerData.containerNumber,
          containerType: containerData.containerType || "40HC",
          status: containerData.status,
          origin: containerData.origin,
          destination: containerData.destination,
          carrier: containerData.carrier,
          vesselName: containerData.vesselName,
          bookingNumber: data.shipment.bookingNumber,
          masterBillOfLading: data.shipment.masterBillOfLading,
          weight: containerData.weight,
          volume: containerData.volume,
          eta: containerData.eta,
          estimatedArrival: containerData.estimatedArrival,
          progress: containerData.progress,
          reference: `REF-${containerData.containerNumber.slice(-4)}`,
          riskLevel: containerData.riskLevel,
          riskReason: null,
          terminalStatus: null,
          lastFreeDay: null,
          demurrageFee: null,
        });
        
        console.log(`   ✓ Container: ${containerData.containerNumber} (${containerData.status})`);
      }
      
      // Assign users to this shipment
      for (const username of data.assignedUsers) {
        const user = regularUsers.find(u => u.username === username);
        if (user) {
          await storage.addShipmentUser({
            shipmentId: shipment.id,
            userId: user.id,
          });
          console.log(`   👤 Assigned to: ${user.name}`);
        }
      }
      
      console.log("");
    }

    console.log("✅ All realistic data created successfully!\n");
    console.log("📊 Summary:");
    console.log(`   - 5 shipments created`);
    console.log(`   - 8 containers created`);
    console.log(`   - Users assigned to specific shipments for visibility control`);
    console.log("\n👥 User Assignments:");
    console.log("   - sarah_chen: Can view SHP-2024-1001, SHP-2024-1003");
    console.log("   - mike_johnson: Can view SHP-2024-1001, SHP-2024-1005");
    console.log("   - emily_rodriguez: Can view SHP-2024-1002, SHP-2024-1005");
    console.log("   - james_williams: Can view SHP-2024-1003");
    console.log("   - lisa_thompson: Can view SHP-2024-1004");
    
    process.exit(0);
  } catch (error) {
    console.error("❌ Error creating realistic data:", error);
    process.exit(1);
  }
}

seedRealisticData();