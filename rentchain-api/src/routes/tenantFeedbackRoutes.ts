import { Router } from "express";
import { requireAuth } from "../middleware/requireAuth";
import { resolveFeedbackResourceScope } from "../lib/feedback/resolveFeedbackResourceScope";
import { saveTenantFeedback } from "../lib/feedback/saveTenantFeedback";
import type { FeedbackSentiment, FeedbackType } from "../lib/feedback/feedbackTypes";

const router = Router();

const FEEDBACK_TYPES: FeedbackType[] = [
  "application_experience",
  "screening_experience",
  "maintenance_experience",
  "communication_experience",
];

const FEEDBACK_SENTIMENTS: FeedbackSentiment[] = ["positive", "neutral", "negative"];

function asString(value: unknown, max = 240) {
  return String(value || "").trim().slice(0, max);
}

function requireTenant(req: any, res: any, next: any) {
  const role = asString(req.user?.role, 80).toLowerCase();
  const tenantId = asString(req.user?.tenantId || req.user?.id, 240);
  if (!tenantId || role !== "tenant") {
    return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });
  }
  req.user.tenantId = tenantId;
  return next();
}

router.post("/tenant/feedback", requireAuth, requireTenant, async (req: any, res) => {
  try {
    const type = asString(req.body?.type, 80) as FeedbackType;
    const resourceType = asString(req.body?.resourceType, 80);
    const resourceId = asString(req.body?.resourceId, 240);
    const sentiment = asString(req.body?.sentiment, 40) as FeedbackSentiment;
    const tags = Array.isArray(req.body?.tags) ? req.body.tags : [];
    const notes = asString(req.body?.notes, 500) || null;

    if (!FEEDBACK_TYPES.includes(type) || !resourceType || !resourceId || !FEEDBACK_SENTIMENTS.includes(sentiment)) {
      return res.status(400).json({ ok: false, error: "INVALID_FEEDBACK_INPUT" });
    }

    const tenantId = asString(req.user?.tenantId || req.user?.id, 240);
    const email = asString(req.user?.email, 240);
    const scope = await resolveFeedbackResourceScope({
      tenantId,
      email,
      resourceType,
      resourceId,
    });

    if (!scope?.portfolioId) {
      return res.status(403).json({ ok: false, error: "FORBIDDEN" });
    }

    const feedback = await saveTenantFeedback({
      type,
      resourceType: scope.resourceType,
      resourceId: scope.resourceId,
      portfolioId: scope.portfolioId,
      sentiment,
      tags,
      notes,
      tenantId,
    });

    return res.status(201).json({ feedback: { id: feedback.id, createdAt: feedback.createdAt } });
  } catch (err: any) {
    console.error("[tenant-feedback] submit failed", err?.message || err);
    return res.status(500).json({ ok: false, error: "TENANT_FEEDBACK_SUBMIT_FAILED" });
  }
});

export default router;
