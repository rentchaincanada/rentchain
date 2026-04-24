import { Router } from "express";
import { rateLimitSimple } from "../../../middleware/rateLimit";
import { requireLandlord } from "../../../middleware/requireLandlord";
import {
  getTransUnionIntegration,
  postTransUnionConnect,
  postTransUnionDisconnect,
  postTransUnionOnboardingRequest,
  postTransUnionUsageEvent,
  postTransUnionUpdateCredentials,
} from "./transunionController";

const router = Router();
const sensitiveWriteLimiter = rateLimitSimple({ windowMs: 15 * 60 * 1000, max: 10 });

router.use(requireLandlord);
router.get("/transunion", getTransUnionIntegration);
router.post("/transunion/usage-events", postTransUnionUsageEvent);
router.post("/transunion/onboarding-request", postTransUnionOnboardingRequest);
router.post("/transunion/connect", sensitiveWriteLimiter, postTransUnionConnect);
router.post(
  "/transunion/update-credentials",
  sensitiveWriteLimiter,
  postTransUnionUpdateCredentials
);
router.post("/transunion/disconnect", postTransUnionDisconnect);

export default router;
