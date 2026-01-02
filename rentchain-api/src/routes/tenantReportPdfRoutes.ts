import { Router } from "express";
import { requireAuth } from "../middleware/requireAuth";
import { requireLandlord } from "../middleware/requireLandlord";

const router = Router();

router.get("/tenants/:tenantId/report.pdf", requireAuth, requireLandlord, async (_req: any, res) => {
  res.setHeader("x-route-source", "tenantReportPdfRoutes");
  return res.status(501).json({
    ok: false,
    code: "PDF_REPORTING_DISABLED",
    message: "PDF reporting is temporarily unavailable on this deployment.",
  });
});

export default router;
