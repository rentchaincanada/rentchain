import { Router } from "express";
import { authenticateJwt } from "../middleware/authMiddleware";
import { devOnly } from "../middleware/devOnly";
import { getProviderStatus } from "../services/screening/providerStatusService";

const router = Router();

router.get("/providers/status", devOnly, authenticateJwt, (_req, res) => {
  return res.status(200).json(getProviderStatus());
});

export default router;
