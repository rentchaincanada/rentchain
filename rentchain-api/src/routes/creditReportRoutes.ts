// Skeleton credit report routes (non-production, simulated billing only).
import { Router, Request, Response } from "express";
import { billCreditReport } from "../billing/creditReportBilling";

const router = Router();
const DEMO_USER_ID = "demo-user";

// POST /api/credit/pull
router.post("/pull", async (req: Request, res: Response) => {
  try {
    const { tenantId, applicationId } = req.body as {
      tenantId?: string;
      applicationId?: string;
    };

    if (!tenantId) {
      return res.status(400).json({ error: "tenantId is required" });
    }

    // Placeholder: bill the demo user; plug in auth context later.
    const result = await billCreditReport(DEMO_USER_ID);

    return res.status(200).json({
      ok: true,
      reportId: result.reportId,
      cost: result.cost,
      message: result.message,
      tenantId,
      applicationId: applicationId ?? null,
    });
  } catch (err: any) {
    console.error("[POST /api/credit/pull] error:", err);
    return res.status(500).json({
      error: err?.message ?? "Failed to simulate credit pull",
    });
  }
});

export default router;
