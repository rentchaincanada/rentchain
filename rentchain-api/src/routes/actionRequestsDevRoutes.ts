import { Router } from "express";
import { db } from "../config/firebase";

const router = Router();

router.post("/seed/action-requests", async (req, res) => {
  if (process.env.NODE_ENV === "production") {
    return res.status(404).json({ error: "Not found" });
  }

  const propertyId = String(req.body?.propertyId ?? "").trim();
  if (!propertyId) {
    return res.status(400).json({ error: "propertyId is required" });
  }

  try {
    const now = new Date();
    const samples = [
      {
        propertyId,
        type: "lease_missing",
        title: "Add first active lease for this property",
        status: "open",
        createdAt: now,
        priority: "high",
      },
      {
        propertyId,
        type: "unit_data_incomplete",
        title: "Complete unit data (beds/baths/sqft) for listing readiness",
        status: "open",
        createdAt: now,
        priority: "medium",
      },
      {
        propertyId,
        type: "rent_collection_setup",
        title: "Enable rent collection method (e-transfer / PAD)",
        status: "open",
        createdAt: now,
        priority: "low",
      },
    ];

    const col = db.collection("actionRequests");
    const batch = db.batch();
    const ids: string[] = [];

    samples.forEach((s) => {
      const ref = col.doc();
      ids.push(ref.id);
      batch.set(ref, s);
    });

    await batch.commit();

    return res.json({ ok: true, created: ids.length, ids });
  } catch (err: any) {
    console.error("[dev seed action-requests] error", err);
    return res.status(500).json({
      error: "Failed to seed action requests",
      details: process.env.NODE_ENV === "production" ? undefined : err?.message,
    });
  }
});

export default router;
