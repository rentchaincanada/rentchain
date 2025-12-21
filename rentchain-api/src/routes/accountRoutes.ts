import { Router } from "express";
import { PLANS, resolvePlan } from "../entitlements/plans";
import { db } from "../config/firebase";

const router = Router();

/**
 * GET /api/account/limits
 * MUST be ungated so UI can render plan + capabilities
 */
router.get("/limits", async (req: any, res) => {
  if (!req.user) {
    return res.status(401).json({ error: "unauthorized" });
  }

  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");

  const plan = resolvePlan(req.user?.plan);
  const spec = PLANS[plan];

  // Compute usage from Firestore where available
  const landlordId = req.user?.landlordId || req.user?.id;
  let usage = { properties: 0, units: 0, screeningsThisMonth: 0 };

  if (landlordId) {
    try {
      const snap = await db
        .collection("properties")
        .where("landlordId", "==", landlordId)
        .get();
      usage.properties = snap.size;
      usage.units = snap.docs.reduce((acc, doc) => {
        const data: any = doc.data() || {};
        const units = typeof data.unitCount === "number" ? data.unitCount : 0;
        return acc + units;
      }, 0);
    } catch {
      // leave usage as zero if Firestore unavailable
    }
  }

  return res.json({
    status: "ok",
    plan,
    limits: spec.limits,
    capabilities: spec.capabilities,
    usage,
  });
});

export default router;
