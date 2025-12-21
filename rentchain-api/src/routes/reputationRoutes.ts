import { Router } from "express";
import { authenticateJwt } from "../middleware/authMiddleware";
import { getTenantReputationTimeline } from "../services/reputationService";

const router = Router();

router.get(
  "/tenants/:tenantId/reputation/timeline",
  authenticateJwt,
  async (req, res) => {
    try {
      const landlordId = req.user?.id;
      if (!landlordId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const { tenantId } = req.params;
      const events = await getTenantReputationTimeline(landlordId, tenantId);
      return res.json({ events });
    } catch (err: any) {
      console.error("[GET reputation timeline] error", err);
      return res
        .status(500)
        .json({ error: "Failed to load reputation timeline" });
    }
  }
);

export default router;
