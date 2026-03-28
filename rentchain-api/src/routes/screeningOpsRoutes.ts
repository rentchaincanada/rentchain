import { Router } from "express";
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

const router = Router();

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
