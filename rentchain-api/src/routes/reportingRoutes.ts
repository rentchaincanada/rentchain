import { Router } from "express";
import { authenticateJwt } from "../middleware/authMiddleware";

const router = Router();
router.use(authenticateJwt);

router.get("/monthly-snapshot", (req: any, res) => {
  res.setHeader("x-route-source", "reportingRoutes");
  const landlordId = req.user?.landlordId || req.user?.id;
  if (!landlordId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const snapshot = {
    rentCollected: 48250,
    arrears: 3200,
    occupancy: 94,
    activeTenants: 38,
    alerts: ["2 tenants overdue >14 days", "1 lease expiring in 30 days"],
    aiSummary:
      "Portfolio is stable with strong occupancy. Monitor overdue tenants and prepare renewal outreach for upcoming lease expirations.",
  };

  return res.json(snapshot);
});

export default router;
