import { db } from "../firebase";

async function run() {
  console.log("🔥 Seeding: Harbour View");

  // PROPERTY --------------------------
  await db.collection("properties").doc("harbour-view").set({
    name: "Harbour View Apartments",
    address: "123 Waterfront Rd, Halifax, NS",
  });

  console.log("✓ Added property");

  // UNITS ------------------------------
  const units = [
    { unitNumber: "101", tenantName: "Sarah Thompson", rent: 1450, status: "Paid", leaseEnd: "2025-09-01", risk: "Low" },
    { unitNumber: "102", tenantName: "Michael Lee", rent: 1390, status: "Late", leaseEnd: "2025-04-01", risk: "Medium" },
    { unitNumber: "103", tenantName: null, rent: null, status: "Vacant", leaseEnd: null, risk: "Unknown" },
    { unitNumber: "201", tenantName: "David Chen", rent: 1550, status: "Paid", leaseEnd: "2025-12-01", risk: "Low" },
    { unitNumber: "202", tenantName: "Emily Walker", rent: 1490, status: "On Time", leaseEnd: "2025-06-01", risk: "Low" },
  ];

  for (const u of units) {
    await db.collection("units").add({
      propertyId: "harbour-view",
      ...u,
      leaseEnd: u.leaseEnd ? new Date(u.leaseEnd) : null,
    });
  }

  console.log("✓ Added units");

  // RENT PAYMENTS (MTD) ----------------
  // Use the current month so KPI calculations work
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();

  const payments = [
    {
      tenantName: "Sarah Thompson",
      propertyId: "harbour-view",
      expectedAmount: 1450,
      amountPaid: 1450,
      paidAt: new Date(),
      dueDate: new Date(year, month, 1),
    },
    {
      tenantName: "Michael Lee",
      propertyId: "harbour-view",
      expectedAmount: 1390,
      amountPaid: 0,
      paidAt: null,
      dueDate: new Date(year, month, 1),
    },
    {
      tenantName: "David Chen",
      propertyId: "harbour-view",
      expectedAmount: 1550,
      amountPaid: 1550,
      paidAt: new Date(),
      dueDate: new Date(year, month, 1),
    },
  ];

  for (const p of payments) {
    await db.collection("rentPayments").add(p);
  }

  console.log("✓ Added rentPayments");

  console.log("🎉 Seeding complete!");
}

run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("❌ Seed failed", err);
    process.exit(1);
  });
