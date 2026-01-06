import { Router } from "express";
import { getUsage, currentPeriod } from "../services/billingUsage";
import { requireAuth } from "../middleware/requireAuth";
import { requirePermission } from "../middleware/requireAuthz";
import { requireRole } from "../middleware/requireRole";

const router = Router();

router.use(requireRole(["landlord", "admin"]));
router.use(requirePermission("reports.view"));

router.get("/billing/usage", requireAuth, async (req: any, res) => {
  const landlordId = req.user?.landlordId || req.user?.id;
  if (!landlordId) return res.status(401).json({ ok: false, error: "Unauthorized" });
  const period = String(req.query?.period || currentPeriod());
  const usage = await getUsage(landlordId, period);
  return res.json({ ok: true, usage });
});

export default router;
