import { Router } from "express";
import { authenticateJwt } from "../middleware/authMiddleware";

const router = Router();
router.use(authenticateJwt);

// GET /api/landlord/micro-live/status
router.get("/micro-live/status", (req: any, res) => {
  const landlordId = req.user?.landlordId || req.user?.id;
  if (!landlordId) {
    return res.status(401).json({ ok: false, error: "Unauthorized" });
  }

  return res.json({
    ok: true,
    status: "inactive",
    features: {
      microLiveChecklist: false,
      tenantReportsPdf: false,
      aiSummary: true,
    },
  });
});

// GET /api/landlord/tenants/:tenantId/credit-history/export?format=csv
router.get("/tenants/:tenantId/credit-history/export", (req: any, res) => {
  const landlordId = req.user?.landlordId || req.user?.id;
  if (!landlordId) return res.status(401).json({ ok: false, error: "Unauthorized" });

  const format = String(req.query?.format || "csv").toLowerCase();
  if (format !== "csv") return res.status(400).json({ ok: false, error: "Only csv supported" });

  const csv = ["date,source,score,notes"].join("\n") + "\n";
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="credit-history-${req.params.tenantId}.csv"`
  );
  return res.status(200).send(csv);
});

export default router;
