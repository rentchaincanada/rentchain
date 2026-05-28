import { Router } from "express";
import { requireAuth } from "../middleware/requireAuth";
import { requirePermission } from "../middleware/requireAuthz";
import { routeSource } from "../middleware/routeSource";
import {
  loadGovernedReviewWorkspaceDetail,
  loadGovernedReviewWorkspaces,
} from "../services/admin/governedReviewWorkspaceRead";

const router = Router();

router.use(routeSource("governedReviewWorkspaceRoutes.ts"));

router.get("/review-workspaces", requireAuth, requirePermission("system.admin"), async (req: any, res) => {
  res.setHeader("x-route-source", "governedReviewWorkspaceRoutes.ts");
  try {
    const result = await loadGovernedReviewWorkspaces({
      workspaceType: req.query?.workspaceType,
      q: req.query?.q,
      limit: Number(req.query?.limit || 50),
    });
    return res.json({ ok: true, ...result });
  } catch (err: any) {
    console.error("[governed-review-workspaces] list failed", err?.message || err);
    return res.status(500).json({ ok: false, error: "GOVERNED_REVIEW_WORKSPACES_FAILED" });
  }
});

router.get("/review-workspaces/:workspaceId", requireAuth, requirePermission("system.admin"), async (req: any, res) => {
  res.setHeader("x-route-source", "governedReviewWorkspaceRoutes.ts");
  try {
    const workspaceId = String(req.params?.workspaceId || "").trim();
    if (!workspaceId) return res.status(400).json({ ok: false, error: "WORKSPACE_ID_REQUIRED" });
    const workspace = await loadGovernedReviewWorkspaceDetail(workspaceId);
    if (!workspace) return res.status(404).json({ ok: false, error: "WORKSPACE_NOT_FOUND" });
    return res.json({ ok: true, workspace });
  } catch (err: any) {
    console.error("[governed-review-workspaces] detail failed", err?.message || err);
    return res.status(500).json({ ok: false, error: "GOVERNED_REVIEW_WORKSPACE_DETAIL_FAILED" });
  }
});

export default router;
