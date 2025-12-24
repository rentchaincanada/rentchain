import { Router } from "express";
import { requireAuth } from "../middleware/requireAuth";
import { requireRole } from "../middleware/requireRole";
import { setMicroLiveForLandlord } from "../services/microLive";

const router = Router();

router.post("/landlords/:landlordId/micro-live/enable", requireAuth, requireRole(["landlord", "admin"]), async (req: any, res) => {
  const landlordId = String(req.params.landlordId || "").trim();
  if (!landlordId) return res.status(400).json({ ok: false, error: "Missing landlordId" });

  await setMicroLiveForLandlord(landlordId, true, {
    source: "admin",
    by: req.user?.email || req.user?.id || "admin",
    note: String(req.body?.note || "").slice(0, 200) || null,
  });

  return res.json({ ok: true, landlordId, enabled: true });
});

router.post("/landlords/:landlordId/micro-live/disable", requireAuth, requireRole(["landlord", "admin"]), async (req: any, res) => {
  const landlordId = String(req.params.landlordId || "").trim();
  if (!landlordId) return res.status(400).json({ ok: false, error: "Missing landlordId" });

  await setMicroLiveForLandlord(landlordId, false, {
    source: "admin",
    by: req.user?.email || req.user?.id || "admin",
    note: String(req.body?.note || "").slice(0, 200) || null,
  });

  return res.json({ ok: true, landlordId, enabled: false });
});

export default router;
