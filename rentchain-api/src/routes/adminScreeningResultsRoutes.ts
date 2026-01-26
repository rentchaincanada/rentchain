import { Router } from "express";
import { requireAdmin } from "../middleware/requireAdmin";
import { markScreeningComplete, markScreeningFailed } from "../services/screening/screeningOrchestrator";

const router = Router();

router.use(requireAdmin);

router.post("/rental-applications/:id/screening/complete", async (req: any, res) => {
  try {
    const applicationId = String(req.params?.id || "").trim();
    if (!applicationId) return res.status(404).json({ ok: false, error: "NOT_FOUND" });
    const body = req.body || {};
    const overall = String(body.overall || "").toLowerCase();
    if (!["pass", "review", "fail"].includes(overall)) {
      return res.status(400).json({ ok: false, error: "INVALID_OVERALL" });
    }
    const scoreBand = body.scoreBand ? String(body.scoreBand).toUpperCase() : undefined;
    const flags = Array.isArray(body.flags)
      ? body.flags.map((flag: any) => String(flag)).filter(Boolean)
      : typeof body.flags === "string"
        ? body.flags.split(",").map((flag: string) => flag.trim()).filter(Boolean)
        : undefined;
    const reportText = body.reportText ? String(body.reportText).trim() : undefined;

    const summary = {
      overall: overall as "pass" | "review" | "fail",
      scoreBand: scoreBand as "A" | "B" | "C" | "D" | "E" | undefined,
      flags: flags?.length ? flags : undefined,
      updatedAt: Date.now(),
    };

    const result = await markScreeningComplete(
      applicationId,
      {
        summary,
        reportText,
      },
      req.user
    );
    if (!result.ok) {
      return res.status(404).json({ ok: false, error: result.error || "complete_failed" });
    }

    console.log("[screening_admin]", { applicationId, action: "complete", status: "ok" });
    return res.json({ ok: true, resultId: result.resultId || null });
  } catch (err: any) {
    console.error("[screening_admin] complete failed", err?.message || err);
    return res.status(500).json({ ok: false, error: "COMPLETE_FAILED" });
  }
});

router.post("/rental-applications/:id/screening/fail", async (req: any, res) => {
  try {
    const applicationId = String(req.params?.id || "").trim();
    if (!applicationId) return res.status(404).json({ ok: false, error: "NOT_FOUND" });
    const body = req.body || {};
    const failureCode = String(body.failureCode || "").trim();
    if (!failureCode) {
      return res.status(400).json({ ok: false, error: "INVALID_FAILURE_CODE" });
    }
    const failureDetail = body.failureDetail ? String(body.failureDetail).trim() : undefined;

    const result = await markScreeningFailed(
      applicationId,
      { code: failureCode, detail: failureDetail },
      req.user
    );
    if (!result.ok) {
      return res.status(404).json({ ok: false, error: result.error || "fail_failed" });
    }

    console.log("[screening_admin]", { applicationId, action: "fail", status: "ok" });
    return res.json({ ok: true });
  } catch (err: any) {
    console.error("[screening_admin] fail failed", err?.message || err);
    return res.status(500).json({ ok: false, error: "FAIL_FAILED" });
  }
});

export default router;
