import { Router } from "express";
import type { Query, DocumentData } from "firebase-admin/firestore";
import { db } from "../config/firebase";
import { requireAuth } from "../middleware/requireAuth";
import { requireLandlord } from "../middleware/requireLandlord";

const router = Router();

function monthRange(d = new Date()) {
  const start = new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
  const end = new Date(d.getFullYear(), d.getMonth() + 1, 1, 0, 0, 0, 0);
  return { start, end };
}

async function countSnap(q: Query<DocumentData>) {
  const snap = await q.get();
  return snap.size;
}

async function sumFieldCents(q: Query<DocumentData>, field: string) {
  const snap = await q.get();
  let sum = 0;
  snap.forEach((doc: any) => {
    const v = (doc.data() as any)?.[field];
    const n = Number(v);
    if (Number.isFinite(n)) sum += n;
  });
  return sum;
}

router.get("/landlord/usage/breakdown", requireAuth, requireLandlord, async (req: any, res) => {
  res.setHeader("x-route-source", "usageBreakdownRoutes");

  const landlordId = req.user?.landlordId || req.user?.id;
  if (!landlordId) return res.status(401).json({ error: "Unauthorized" });

  const { start, end } = monthRange(new Date());

  let properties = 0;
  let units: number | null = null;
  let tenants: number | null = null;
  let applications: number | null = null;
  let occupiedUnits: number | null = null;
  let vacantUnits: number | null = null;
  let rentCollectedCents: number | null = null;
  let rentOutstandingCents: number | null = null;
  let rentOnTimePct: number | null = null;

  // Properties
  try {
    properties = await countSnap(db.collection("properties").where("landlordId", "==", landlordId));
  } catch {
    properties = 0;
  }

  // Units (preferred: units collection)
  try {
    const unitsSnap = await db.collection("units").where("landlordId", "==", landlordId).get();
    units = unitsSnap.size;
  } catch {
    units = null;
  }

  if (units == null) {
    try {
      const propsSnap = await db.collection("properties").where("landlordId", "==", landlordId).get();
      let sum = 0;
      propsSnap.forEach((doc) => {
        const n = Number((doc.data() as any)?.unitCount);
        if (Number.isFinite(n)) sum += n;
      });
      units = sum || 0;
    } catch {
      units = null;
    }
  }

  // Tenants
  try {
    tenants = await countSnap(
      db.collection("tenants").where("landlordId", "==", landlordId).where("status", "==", "active")
    );
  } catch {
    try {
      tenants = await countSnap(db.collection("tenants").where("landlordId", "==", landlordId));
    } catch {
      tenants = null;
    }
  }

  // Occupied units via leases
  try {
    occupiedUnits = await countSnap(
      db.collection("leases").where("landlordId", "==", landlordId).where("status", "==", "active")
    );
  } catch {
    occupiedUnits = null;
  }

  if (typeof units === "number" && typeof occupiedUnits === "number") {
    vacantUnits = Math.max(units - occupiedUnits, 0);
  } else {
    vacantUnits = null;
  }

  // Applications (this month)
  try {
    applications = await countSnap(
      db
        .collection("applications")
        .where("landlordId", "==", landlordId)
        .where("createdAt", ">=", start)
        .where("createdAt", "<", end)
    );
  } catch {
    try {
      applications = await countSnap(db.collection("applications").where("landlordId", "==", landlordId));
    } catch {
      applications = null;
    }
  }

  // Rent collected (this month)
  try {
    rentCollectedCents = await sumFieldCents(
      db
        .collection("payments")
        .where("landlordId", "==", landlordId)
        .where("status", "==", "succeeded")
        .where("paidAt", ">=", start)
        .where("paidAt", "<", end),
      "amountCents"
    );
  } catch {
    rentCollectedCents = null;
  }

  // Rent outstanding (this month)
  try {
    rentOutstandingCents = await sumFieldCents(
      db
        .collection("charges")
        .where("landlordId", "==", landlordId)
        .where("status", "==", "unpaid")
        .where("dueAt", ">=", start)
        .where("dueAt", "<", end),
      "amountCents"
    );
  } catch {
    rentOutstandingCents = null;
  }

  if (typeof rentCollectedCents === "number" && typeof rentOutstandingCents === "number") {
    const denom = rentCollectedCents + rentOutstandingCents;
    rentOnTimePct = denom > 0 ? Math.round((rentCollectedCents / denom) * 100) : null;
  } else {
    rentOnTimePct = null;
  }

  return res.json({
    ok: true,
    period: {
      month: start.getMonth() + 1,
      year: start.getFullYear(),
      startISO: start.toISOString(),
      endISO: end.toISOString(),
    },
    usage: {
      properties,
      units,
      tenants,
      applications,
      occupiedUnits,
      vacantUnits,
      rentCollectedCents,
      rentOutstandingCents,
      rentOnTimePct,
    },
  });
});

export default router;
