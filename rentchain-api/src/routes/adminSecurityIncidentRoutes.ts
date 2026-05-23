import { Router } from "express";
import { requireAuth } from "../middleware/requireAuth";
import { requirePermission } from "../middleware/requireAuthz";
import {
  loadAdminSecurityIncidentReviewDetail,
  loadAdminSecurityIncidentReviews,
} from "../services/admin/adminSecurityIncidentReview";

const router = Router();

router.get("/security/incidents", requireAuth, requirePermission("system.admin"), async (req: any, res) => {
  res.setHeader("x-route-source", "adminSecurityIncidentRoutes.ts");
  try {
    const result = await loadAdminSecurityIncidentReviews({
      category: req.query?.category,
      severity: req.query?.severity,
      status: req.query?.status,
      q: req.query?.q,
      limit: Number(req.query?.limit || 50),
    });
    return res.json({ ok: true, ...result });
  } catch (err: any) {
    console.error("[admin-security-incidents] list failed", err?.message || err);
    return res.status(500).json({ ok: false, error: "ADMIN_SECURITY_INCIDENTS_FAILED" });
  }
});

router.get("/security/incidents/:incidentId", requireAuth, requirePermission("system.admin"), async (req: any, res) => {
  res.setHeader("x-route-source", "adminSecurityIncidentRoutes.ts");
  try {
    const incidentId = String(req.params?.incidentId || "").trim();
    if (!incidentId) return res.status(400).json({ ok: false, error: "INCIDENT_ID_REQUIRED" });
    const incident = await loadAdminSecurityIncidentReviewDetail(incidentId);
    if (!incident) return res.status(404).json({ ok: false, error: "INCIDENT_NOT_FOUND" });
    return res.json({ ok: true, incident });
  } catch (err: any) {
    console.error("[admin-security-incidents] detail failed", err?.message || err);
    return res.status(500).json({ ok: false, error: "ADMIN_SECURITY_INCIDENT_DETAIL_FAILED" });
  }
});

export default router;

