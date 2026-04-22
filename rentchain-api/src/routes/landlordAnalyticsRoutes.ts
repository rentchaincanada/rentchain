import { Router } from "express";
import { writeCanonicalEvent } from "../lib/events/buildEvent";
import { requireAuth } from "../middleware/requireAuth";
import { requireLandlord } from "../middleware/requireLandlord";
import { loadLandlordAnalyticsSnapshot } from "../services/landlord/landlordAnalyticsSnapshot";
import { saveReviewedLandlordDecisionState } from "../services/landlord/landlordDecisionStates";

const router = Router();

function asString(value: unknown, max = 240) {
  return String(value || "").trim().slice(0, max);
}

router.get("/landlord/analytics", requireAuth, requireLandlord, async (req: any, res) => {
  try {
    const landlordId = asString(req.user?.landlordId || req.user?.id, 240);
    if (!landlordId) {
      return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });
    }

    const snapshot = await loadLandlordAnalyticsSnapshot({
      landlordId,
      period: req.query?.period,
      propertyId: req.query?.propertyId,
    });

    return res.json({ ok: true, ...snapshot });
  } catch (err: any) {
    console.error("[landlord-analytics] fetch failed", err?.message || err);
    return res.status(500).json({ ok: false, error: "LANDLORD_ANALYTICS_FETCH_FAILED" });
  }
});

router.post("/landlord/analytics/decisions/:decisionId/review", requireAuth, requireLandlord, async (req: any, res) => {
  try {
    const landlordId = asString(req.user?.landlordId || req.user?.id, 240);
    if (!landlordId) {
      return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });
    }

    const decisionId = asString(req.params?.decisionId, 240);
    if (!decisionId) {
      return res.status(400).json({ ok: false, error: "DECISION_ID_REQUIRED" });
    }

    const snapshot = await loadLandlordAnalyticsSnapshot({
      landlordId,
      period: req.query?.period,
      propertyId: req.query?.propertyId,
    });
    const decision = snapshot.decisions.items.find((item) => asString(item.id, 240) === decisionId) || null;
    if (!decision) {
      return res.status(404).json({ ok: false, error: "DECISION_NOT_VISIBLE" });
    }

    const state = await saveReviewedLandlordDecisionState({
      landlordId,
      decisionId,
    });

    await writeCanonicalEvent({
      type: "decision.reviewed",
      domain: "system",
      action: "reviewed",
      actor: { type: "landlord", id: landlordId, role: "landlord" },
      resource: { type: "analytics_decision", id: decisionId },
      occurredAt: state.reviewedAt || state.updatedAt,
      visibility: "landlord",
      summary: `Analytics decision ${decisionId} reviewed.`,
      metadata: {
        landlordId,
        decisionId,
        decisionType: decision.decisionType,
        source: "landlord_analytics_decisions",
      },
    });

    return res.json({
      ok: true,
      state: {
        decisionId: state.decisionId,
        state: state.state,
        reviewedAt: state.reviewedAt || null,
        updatedAt: state.updatedAt,
      },
    });
  } catch (err: any) {
    console.error("[landlord-analytics] decision review failed", err?.message || err);
    return res.status(500).json({ ok: false, error: "LANDLORD_DECISION_REVIEW_FAILED" });
  }
});

export default router;
