import { Router } from "express";
import { requireAdmin } from "../middleware/requireAdmin";
import { markScreeningComplete, markScreeningFailed } from "../services/screening/screeningOrchestrator";
import { db } from "../config/firebase";
import { writeScreeningEvent } from "../services/screening/screeningEvents";

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

    const appSnap = await db.collection("rentalApplications").doc(applicationId).get();
    const appData = appSnap.data() as any;
    await writeScreeningEvent({
      applicationId,
      landlordId: appData?.landlordId || null,
      type: "manual_complete",
      at: Date.now(),
      meta: { status: "complete" },
      actor: "admin",
    });

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

    const appSnap = await db.collection("rentalApplications").doc(applicationId).get();
    const appData = appSnap.data() as any;
    await writeScreeningEvent({
      applicationId,
      landlordId: appData?.landlordId || null,
      type: "manual_fail",
      at: Date.now(),
      meta: { status: "failed", reasonCode: failureCode },
      actor: "admin",
    });

    console.log("[screening_admin]", { applicationId, action: "fail", status: "ok" });
    return res.json({ ok: true });
  } catch (err: any) {
    console.error("[screening_admin] fail failed", err?.message || err);
    return res.status(500).json({ ok: false, error: "FAIL_FAILED" });
  }
});

router.post("/rental-applications/:id/screening/recompute", async (req: any, res) => {
  try {
    const applicationId = String(req.params?.id || "").trim();
    if (!applicationId) return res.status(404).json({ ok: false, error: "NOT_FOUND" });

    const appRef = db.collection("rentalApplications").doc(applicationId);
    const snap = await appRef.get();
    if (!snap.exists) return res.status(404).json({ ok: false, error: "NOT_FOUND" });
    const data = snap.data() as any;
    const current = String(data?.screeningStatus || "").toLowerCase();

    let next = "unpaid";
    if (data?.screeningResultId) {
      next = "complete";
    } else if (typeof data?.screeningPaidAt === "number") {
      next = "processing";
    } else if (current === "ineligible") {
      next = "ineligible";
    }

    const now = Date.now();
    if (current !== next) {
      await appRef.set(
        {
          screeningStatus: next,
          screeningLastUpdatedAt: now,
        },
        { merge: true }
      );
    }

    await writeScreeningEvent({
      applicationId,
      landlordId: data?.landlordId || null,
      type: "recomputed",
      at: now,
      meta: { from: current || "unknown", to: next },
      actor: "admin",
    });

    return res.json({ ok: true, from: current, to: next });
  } catch (err: any) {
    console.error("[screening_admin] recompute failed", err?.message || err);
    return res.status(500).json({ ok: false, error: "RECOMPUTE_FAILED" });
  }
});

export default router;
