import { Router } from "express";
import { authenticateJwt } from "../middleware/authMiddleware";
import { handleScreeningReport } from "./screeningReportHandler";

const router = Router();

router.use(authenticateJwt);
router.get("/screening/report", handleScreeningReport);

export default router;
