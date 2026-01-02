import { db } from "../config/firebase";

async function seed(tenantId: string, landlordId: string) {
  const now = Date.now();

  const events = [
    {
      type: "LEASE_STARTED",
      severity: "positive",
      title: "Lease started",
      description: "Welcome to your new home.",
      occurredAt: new Date(now - 1000 * 60 * 60 * 24 * 90),
      source: "system",
    },
    {
      type: "RENT_PAID",
      severity: "positive",
      title: "Rent paid on time",
      description: "Payment received.",
      amountCents: 180000,
      currency: "CAD",
      occurredAt: new Date(now - 1000 * 60 * 60 * 24 * 30),
      source: "system",
    },
    {
      type: "RENT_LATE",
      severity: "negative",
      title: "Rent paid late",
      description: "Payment received 5 days late.",
      daysLate: 5,
      occurredAt: new Date(now - 1000 * 60 * 60 * 24 * 10),
      source: "system",
    },
  ];

  for (const e of events) {
    await db.collection("tenantEvents").add({
      tenantId,
      landlordId,
      createdAt: new Date(),
      anchorStatus: "none",
      ...e,
    });
  }

  console.log("Seeded tenantEvents for tenantId=", tenantId);
}

const [tenantId, landlordId] = process.argv.slice(2);
if (!tenantId || !landlordId) {
  console.error("Usage: ts-node seedTenantEvents.ts <tenantId> <landlordId>");
  process.exit(1);
}
seed(tenantId, landlordId).then(() => process.exit(0));
