import { Router } from "express";
import { authenticateJwt } from "../middleware/authMiddleware";

const router = Router();
router.use(authenticateJwt);

// GET /api/landlord/micro-live/status
router.get("/micro-live/status", (req: any, res) => {
  const landlordId = req.user?.landlordId || req.user?.id;
  if (!landlordId) {
    return res.status(401).json({ ok: false, error: "Unauthorized" });
  }

  return res.json({
    ok: true,
    status: "inactive",
    features: {
      microLiveChecklist: false,
      tenantReportsPdf: false,
      aiSummary: true,
    },
  });
});

export default router;
