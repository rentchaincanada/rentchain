import { Router } from "express";
import { requireAuth } from "../middleware/requireAuth";
import { requireRole } from "../middleware/requireRole";
import { getCountersSummary } from "../services/telemetryService";
import { db } from "../config/firebase";
import { isMicroLiveEnabledForLandlord } from "../services/microLive";

const router = Router();

router.get("/micro-live/metrics", requireAuth, requireRole(["landlord", "admin"]), async (req: any, res) => {
  const days = Number(req.query?.days ?? 7);
  const summary = await getCountersSummary(days);

  const snap = await db.collection("landlords").orderBy("updatedAt", "desc").limit(200).get();
  let enabled = 0;
  const enabledIds: string[] = [];

  for (const doc of snap.docs) {
    const id = doc.id;
    const ok = await isMicroLiveEnabledForLandlord(id);
    if (ok) {
      enabled++;
      if (enabledIds.length < 50) enabledIds.push(id);
    }
  }

  return res.json({
    ok: true,
    days: summary.days,
    counters: summary.byName,
    enabledLandlordsInSample: enabled,
    enabledLandlordIds: enabledIds,
  });
});

export default router;
