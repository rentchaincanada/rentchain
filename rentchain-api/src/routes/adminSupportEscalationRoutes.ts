import { Router } from "express";
import { requireAuth } from "../middleware/requireAuth";
import { requirePermission } from "../middleware/requireAuthz";
import {
  loadAdminSupportEscalationReviewDetail,
  loadAdminSupportEscalationReviews,
} from "../services/admin/adminSupportEscalationReview";

const router = Router();

router.get("/support/escalations", requireAuth, requirePermission("system.admin"), async (req: any, res) => {
  res.setHeader("x-route-source", "adminSupportEscalationRoutes.ts");
  try {
    const result = await loadAdminSupportEscalationReviews({
      category: req.query?.category,
      severity: req.query?.severity,
      state: req.query?.state,
      approvalExpectation: req.query?.approvalExpectation,
      q: req.query?.q,
      limit: Number(req.query?.limit || 50),
    });
    return res.json({ ok: true, ...result });
  } catch (err: any) {
    console.error("[admin-support-escalations] list failed", err?.message || err);
    return res.status(500).json({ ok: false, error: "ADMIN_SUPPORT_ESCALATIONS_FAILED" });
  }
});

router.get("/support/escalations/:escalationId", requireAuth, requirePermission("system.admin"), async (req: any, res) => {
  res.setHeader("x-route-source", "adminSupportEscalationRoutes.ts");
  try {
    const escalationId = String(req.params?.escalationId || "").trim();
    if (!escalationId) return res.status(400).json({ ok: false, error: "ESCALATION_ID_REQUIRED" });
    const escalation = await loadAdminSupportEscalationReviewDetail(escalationId);
    if (!escalation) return res.status(404).json({ ok: false, error: "ESCALATION_NOT_FOUND" });
    return res.json({ ok: true, escalation });
  } catch (err: any) {
    console.error("[admin-support-escalations] detail failed", err?.message || err);
    return res.status(500).json({ ok: false, error: "ADMIN_SUPPORT_ESCALATION_DETAIL_FAILED" });
  }
});

export default router;
