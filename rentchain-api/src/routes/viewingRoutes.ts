import { Router } from "express";
import { rateLimitPublicApply } from "../middleware/rateLimit";
import { requireLandlord } from "../middleware/requireLandlord";
import {
  getViewingRequestById,
  getViewingRequests,
  postCancelViewing,
  postCompleteViewing,
  postProposeViewingSlots,
  postSelectViewingSlot,
  postViewingRequest,
} from "../services/viewings/viewingController";

const router = Router();

router.post("/viewings/request", rateLimitPublicApply, postViewingRequest);

router.get("/viewings", requireLandlord, getViewingRequests);
router.get("/viewings/:id", requireLandlord, getViewingRequestById);
router.post("/viewings/:id/propose-slots", requireLandlord, postProposeViewingSlots);
router.post("/viewings/:id/select-slot", requireLandlord, postSelectViewingSlot);
router.post("/viewings/:id/complete", requireLandlord, postCompleteViewing);
router.post("/viewings/:id/cancel", requireLandlord, postCancelViewing);

export default router;
