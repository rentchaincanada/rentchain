import { Router } from "express";
import { db } from "../config/firebase";

const router = Router();

router.get("/tenant-by-email", async (req, res) => {
  if (process.env.DEV_DIAG_ENABLED !== "true") {
    return res.status(404).json({ error: "Not found" });
  }

  const headerSecret = req.header("x-dev-diag-secret");
  if (!headerSecret || headerSecret !== process.env.DEV_DIAG_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const email = req.query.email as string | undefined;
  if (!email) return res.status(400).json({ error: "email required" });

  try {
    const snap = await db.collection("tenants").where("email", "==", String(email)).limit(1).get();
    if (snap.empty) {
      return res.json({ ok: true, found: false });
    }
    const doc = snap.docs[0];
    const data = doc.data() as any;
    return res.json({
      ok: true,
      found: true,
      tenantId: doc.id,
      email: data.email ?? email,
      status: data.status ?? null,
      landlordId: data.landlordId ?? null,
      projectHint: process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || null,
    });
  } catch (err: any) {
    console.error("[dev diag] tenant lookup error", err);
    return res.status(500).json({ error: "Failed to lookup tenant" });
  }
});

export default router;
