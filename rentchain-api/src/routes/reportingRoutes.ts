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

router.get("/micro-live/status", (req: any, res) => {
  res.setHeader("x-route-source", "reportingRoutes");
  const landlordId = req.user?.landlordId || req.user?.id;
  if (!landlordId) {
    return res.status(401).json({ ok: false, error: "Unauthorized" });
  }

  return res.json({
    ok: true,
    status: "inactive",
    features: {
      reporting: false,
      tenantReports: false,
      ledgerPdf: false,
    },
  });
});

export default router;
