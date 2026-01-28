import { Router } from "express";
import { requireAuth } from "../middleware/requireAuth";

const router = Router({ mergeParams: true });

// Set route source for debugging
router.use((req, res, next) => {
  res.setHeader("x-route-source", "compatRoutes");
  next();
});

// GET /api/account/limits
router.get("/account/limits", requireAuth, async (_req: any, res) => {
  return res.json({
    ok: true,
    data: {
      plan: "screening",
      propertiesCap: 1,
      unitsCap: 25,
      propertiesUsed: 0,
      unitsUsed: 0,
    },
  });
});

// GET /api/action-requests/snapshot
router.get("/action-requests/snapshot", requireAuth, async (_req: any, res) => {
  return res.json({
    ok: true,
    data: { openCount: 0, overdueCount: 0, highSeverityCount: 0 },
  });
});

// GET /api/action-requests/portfolio
router.get("/action-requests/portfolio", requireAuth, async (req: any, res) => {
  const limit = Math.max(1, Math.min(100, Number(req.query?.limit) || 25));
  return res.json({
    ok: true,
    data: { items: [], limit, total: 0 },
  });
});

// GET /api/events
router.get("/events", requireAuth, async (_req: any, res) => {
  return res.json({
    ok: true,
    events: [],
  });
});

// GET /api/leases/property/:propertyId
router.get("/leases/property/:propertyId", requireAuth, async (_req: any, res) => {
  return res.json({
    ok: true,
    leases: [],
  });
});

export default router;
