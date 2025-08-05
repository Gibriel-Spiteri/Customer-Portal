import { db } from "../db";
import { estimates } from "@shared/schema";
import { nanoid } from "nanoid";

async function seedEstimates() {
  console.log("Seeding estimates data...");

  const demoUserId = "demo-user-1";
  const currentDate = new Date();

  const sampleEstimates = [
    {
      id: nanoid(),
      userId: demoUserId,
      netsuiteId: `EST-${Math.floor(Math.random() * 100000)}`,
      estimateNumber: "EST-2025-001",
      estimateDate: new Date(currentDate.getTime() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
      expirationDate: new Date(currentDate.getTime() + 23 * 24 * 60 * 60 * 1000), // 23 days from now
      status: "draft",
      customerName: "Acme Corporation",
      totalAmount: "25000.00",
      items: JSON.stringify([
        { name: "Consulting Services", quantity: 40, rate: 500, amount: 20000 },
        { name: "Implementation", quantity: 10, rate: 500, amount: 5000 }
      ]),
      isFresh: true,
      lastSyncAt: new Date(),
      createdAt: new Date(currentDate.getTime() - 7 * 24 * 60 * 60 * 1000),
      updatedAt: new Date()
    },
    {
      id: nanoid(),
      userId: demoUserId,
      netsuiteId: `EST-${Math.floor(Math.random() * 100000)}`,
      estimateNumber: "EST-2025-002",
      estimateDate: new Date(currentDate.getTime() - 14 * 24 * 60 * 60 * 1000), // 14 days ago
      expirationDate: new Date(currentDate.getTime() + 16 * 24 * 60 * 60 * 1000), // 16 days from now
      status: "sent",
      customerName: "Acme Corporation",
      totalAmount: "45000.00",
      items: JSON.stringify([
        { name: "Software Development", quantity: 80, rate: 500, amount: 40000 },
        { name: "Training", quantity: 10, rate: 500, amount: 5000 }
      ]),
      isFresh: true,
      lastSyncAt: new Date(),
      createdAt: new Date(currentDate.getTime() - 14 * 24 * 60 * 60 * 1000),
      updatedAt: new Date()
    },
    {
      id: nanoid(),
      userId: demoUserId,
      netsuiteId: `EST-${Math.floor(Math.random() * 100000)}`,
      estimateNumber: "EST-2025-003",
      estimateDate: new Date(currentDate.getTime() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
      expirationDate: new Date(currentDate.getTime() - 5 * 24 * 60 * 60 * 1000), // Expired 5 days ago
      status: "expired",
      customerName: "Acme Corporation",
      totalAmount: "15000.00",
      items: JSON.stringify([
        { name: "Support Services", quantity: 30, rate: 500, amount: 15000 }
      ]),
      isFresh: false,
      lastSyncAt: new Date(currentDate.getTime() - 24 * 60 * 60 * 1000),
      createdAt: new Date(currentDate.getTime() - 30 * 24 * 60 * 60 * 1000),
      updatedAt: new Date()
    },
    {
      id: nanoid(),
      userId: demoUserId,
      netsuiteId: `EST-${Math.floor(Math.random() * 100000)}`,
      estimateNumber: "EST-2025-004",
      estimateDate: new Date(currentDate.getTime() - 5 * 24 * 60 * 60 * 1000), // 5 days ago
      expirationDate: new Date(currentDate.getTime() + 10 * 24 * 60 * 60 * 1000), // 10 days from now
      status: "accepted",
      customerName: "Acme Corporation",
      totalAmount: "75000.00",
      items: JSON.stringify([
        { name: "Enterprise Solution", quantity: 1, rate: 50000, amount: 50000 },
        { name: "Customization", quantity: 50, rate: 500, amount: 25000 }
      ]),
      convertedOrderId: "ORD-2025-042",
      isFresh: true,
      lastSyncAt: new Date(),
      createdAt: new Date(currentDate.getTime() - 5 * 24 * 60 * 60 * 1000),
      updatedAt: new Date()
    },
    {
      id: nanoid(),
      userId: demoUserId,
      netsuiteId: `EST-${Math.floor(Math.random() * 100000)}`,
      estimateNumber: "EST-2025-005",
      estimateDate: new Date(currentDate.getTime() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
      expirationDate: new Date(currentDate.getTime() + 5 * 24 * 60 * 60 * 1000), // 5 days from now
      status: "sent",
      customerName: "Acme Corporation",
      totalAmount: "32500.00",
      items: JSON.stringify([
        { name: "API Integration", quantity: 25, rate: 1000, amount: 25000 },
        { name: "Documentation", quantity: 15, rate: 500, amount: 7500 }
      ]),
      isFresh: true,
      lastSyncAt: new Date(),
      createdAt: new Date(currentDate.getTime() - 2 * 24 * 60 * 60 * 1000),
      updatedAt: new Date()
    }
  ];

  try {
    // Insert all estimates
    await db.insert(estimates).values(sampleEstimates);
    console.log(`Successfully seeded ${sampleEstimates.length} estimates`);
  } catch (error) {
    console.error("Error seeding estimates:", error);
  }

  process.exit(0);
}

seedEstimates();