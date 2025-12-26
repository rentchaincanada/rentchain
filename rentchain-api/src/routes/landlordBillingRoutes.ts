import { Router } from "express";
import { requireRole } from "../middleware/requireRole";
import { getUsage, currentPeriod } from "../services/billingUsage";

const router = Router();

router.use(requireRole(["landlord", "admin"]));

router.get("/billing/usage", async (req: any, res) => {
  const landlordId = req.user?.landlordId || req.user?.id;
  if (!landlordId) return res.status(401).json({ ok: false, error: "Unauthorized" });
  const period = String(req.query?.period || currentPeriod());
  const usage = await getUsage(landlordId, period);
  return res.json({ ok: true, usage });
});

export default router;
