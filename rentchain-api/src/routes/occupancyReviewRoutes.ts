import { Router } from "express";
import { requireLandlord } from "../middleware/requireLandlord";
import { requireCapability } from "../services/capabilityGuard";
import { getOccupancyReviewWorkspace } from "../services/occupancyReviewWorkspaceService";

const router = Router();

router.get("/", requireLandlord, async (req: any, res) => {
  const landlordId = String(req.user?.landlordId || req.user?.id || "").trim();
  try {
    if (String(req.user?.role || "").toLowerCase() !== "admin") {
      const capability = await requireCapability(landlordId, "leases", req.user);
      if (!capability.ok) return res.status(403).json({ ok: false, error: "Upgrade required", capability: "leases", plan: capability.plan });
    }
    const workspace = await getOccupancyReviewWorkspace(landlordId);
    return res.status(200).json({ ok: true, ...workspace });
  } catch (error) {
    console.error("[occupancy-reviews] aggregation failed", error instanceof Error ? error.message : "unknown_error");
    return res.status(500).json({ ok: false, error: "occupancy_reviews_unavailable" });
  }
});

export default router;
