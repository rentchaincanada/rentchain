import { Router } from "express";
import { db } from "../config/firebase";
import { requireAdmin } from "../middleware/requireAdmin";
import { requireLandlordOrAdmin } from "../middleware/requireLandlordOrAdmin";
import {
  getAdminScreeningOp,
  getAdminScreeningOps,
  getManualScreeningStatus,
  postAdminScreeningOpCancel,
  postAdminScreeningOpComplete,
  postAdminScreeningOpStart,
  postManualScreeningRequest,
} from "../services/screeningOps/screeningOpsController";
import { buildValidationSummary, validateScreeningTransition } from "../services/stateMachines/transitionValidation";
import type { ScreeningApplicationState, ScreeningEvent } from "../services/stateMachines/types";

const router = Router();

router.post("/screening/validate-transition", requireAdmin, async (req: any, res) => {
  try {
    const applicationId = String(req.body?.applicationId || "").trim();
    if (!applicationId) return res.status(400).json({ ok: false, error: "applicationId is required" });
    const applicationSnap = await db.collection("rentalApplications").doc(applicationId).get();
    if (!applicationSnap.exists) return res.status(404).json({ ok: false, error: "application_not_found" });
    const application: Record<string, unknown> = { id: applicationSnap.id, ...((applicationSnap.data() as Record<string, unknown>) || {}) };
    const result = validateScreeningTransition(application, {
      to: String(req.body?.proposedTransition || req.body?.to || "") as ScreeningApplicationState,
      event: String(req.body?.event || "") as ScreeningEvent,
      context: {
        actorRole: "admin",
        actorId: String(req.user?.id || req.user?.uid || req.user?.sub || "").trim() || null,
        authorized: true,
        applicationId,
        landlordId: String(application.landlordId || "").trim() || null,
        orderId: String(req.body?.orderId || "").trim() || null,
        checkoutSessionId: String(req.body?.checkoutSessionId || "").trim() || null,
        resultId: String(req.body?.resultId || "").trim() || null,
        failureCode: String(req.body?.failureCode || "").trim() || null,
      },
    });
    return res.status(200).json(buildValidationSummary(result));
  } catch (err: any) {
    console.error("[state-machine] screening validation failed", { message: err?.message || "failed" });
    return res.status(500).json({ ok: false, error: "screening_transition_validation_failed" });
  }
});

router.post(
  "/rental-applications/:id/screening/request",
  requireLandlordOrAdmin,
  postManualScreeningRequest
);
router.get(
  "/rental-applications/:id/screening/status",
  requireLandlordOrAdmin,
  getManualScreeningStatus
);

router.get("/admin/screening-ops", requireAdmin, getAdminScreeningOps);
router.get("/admin/screening-ops/:id", requireAdmin, getAdminScreeningOp);
router.post("/admin/screening-ops/:id/start", requireAdmin, postAdminScreeningOpStart);
router.post("/admin/screening-ops/:id/complete", requireAdmin, postAdminScreeningOpComplete);
router.post("/admin/screening-ops/:id/cancel", requireAdmin, postAdminScreeningOpCancel);

export default router;
