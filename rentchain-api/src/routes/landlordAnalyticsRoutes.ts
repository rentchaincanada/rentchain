import { Router } from "express";
import { writeCanonicalEvent } from "../lib/events/buildEvent";
import { requireAuth } from "../middleware/requireAuth";
import { requireLandlord } from "../middleware/requireLandlord";
import { loadLandlordAnalyticsSnapshot } from "../services/landlord/landlordAnalyticsSnapshot";
import {
  saveDismissedLandlordDecisionState,
  saveReviewedLandlordDecisionState,
  saveSnoozedLandlordDecisionState,
} from "../services/landlord/landlordDecisionStates";

const router = Router();

function asString(value: unknown, max = 240) {
  return String(value || "").trim().slice(0, max);
}

async function resolveVisibleDecision(req: any, res: any) {
  const landlordId = asString(req.user?.landlordId || req.user?.id, 240);
  if (!landlordId) {
    res.status(401).json({ ok: false, error: "UNAUTHORIZED" });
    return null;
  }

  const decisionId = asString(req.params?.decisionId, 240);
  if (!decisionId) {
    res.status(400).json({ ok: false, error: "DECISION_ID_REQUIRED" });
    return null;
  }

  const snapshot = await loadLandlordAnalyticsSnapshot({
    landlordId,
    period: req.query?.period,
    propertyId: req.query?.propertyId,
  });
  const decision = snapshot.decisions.items.find((item) => asString(item.id, 240) === decisionId) || null;
  if (!decision) {
    res.status(404).json({ ok: false, error: "DECISION_NOT_VISIBLE" });
    return null;
  }

  return { landlordId, decisionId, decision };
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
    const resolved = await resolveVisibleDecision(req, res);
    if (!resolved) return;
    const { landlordId, decisionId, decision } = resolved;

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

router.post("/landlord/analytics/decisions/:decisionId/snooze", requireAuth, requireLandlord, async (req: any, res) => {
  try {
    const resolved = await resolveVisibleDecision(req, res);
    if (!resolved) return;
    const { landlordId, decisionId, decision } = resolved;

    const snoozedUntil = asString(req.body?.snoozedUntil, 80);
    if (!snoozedUntil) {
      return res.status(400).json({ ok: false, error: "SNOOZED_UNTIL_REQUIRED" });
    }

    const state = await saveSnoozedLandlordDecisionState({
      landlordId,
      decisionId,
      snoozedUntil,
    });

    await writeCanonicalEvent({
      type: "decision.snoozed",
      domain: "system",
      action: "snoozed",
      actor: { type: "landlord", id: landlordId, role: "landlord" },
      resource: { type: "analytics_decision", id: decisionId },
      occurredAt: state.snoozedAt || state.updatedAt,
      visibility: "landlord",
      summary: `Analytics decision ${decisionId} snoozed.`,
      metadata: {
        landlordId,
        decisionId,
        decisionType: decision.decisionType,
        snoozedUntil: state.snoozedUntil || null,
        source: "landlord_analytics_decisions",
      },
    });

    return res.json({
      ok: true,
      state: {
        decisionId: state.decisionId,
        state: state.state,
        snoozedAt: state.snoozedAt || null,
        snoozedUntil: state.snoozedUntil || null,
        updatedAt: state.updatedAt,
      },
    });
  } catch (err: any) {
    const message = err?.message || "";
    if (message === "landlord_decision_state_invalid_snoozed_until" || message === "landlord_decision_state_snooze_must_be_future") {
      return res.status(400).json({ ok: false, error: "INVALID_SNOOZE_WINDOW" });
    }
    console.error("[landlord-analytics] decision snooze failed", message || err);
    return res.status(500).json({ ok: false, error: "LANDLORD_DECISION_SNOOZE_FAILED" });
  }
});

router.post("/landlord/analytics/decisions/:decisionId/dismiss", requireAuth, requireLandlord, async (req: any, res) => {
  try {
    const resolved = await resolveVisibleDecision(req, res);
    if (!resolved) return;
    const { landlordId, decisionId, decision } = resolved;

    const state = await saveDismissedLandlordDecisionState({
      landlordId,
      decisionId,
    });

    await writeCanonicalEvent({
      type: "decision.dismissed",
      domain: "system",
      action: "dismissed",
      actor: { type: "landlord", id: landlordId, role: "landlord" },
      resource: { type: "analytics_decision", id: decisionId },
      occurredAt: state.dismissedAt || state.updatedAt,
      visibility: "landlord",
      summary: `Analytics decision ${decisionId} dismissed.`,
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
        dismissedAt: state.dismissedAt || null,
        updatedAt: state.updatedAt,
      },
    });
  } catch (err: any) {
    console.error("[landlord-analytics] decision dismiss failed", err?.message || err);
    return res.status(500).json({ ok: false, error: "LANDLORD_DECISION_DISMISS_FAILED" });
  }
});

export default router;
