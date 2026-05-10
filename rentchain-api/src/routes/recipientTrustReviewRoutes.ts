import { Router } from "express";
import { requireAuth } from "../middleware/requireAuth";
import { getRecipientTrustReview } from "../services/tenantPortal/tenantInstitutionAccessService";

const router = Router();

function requestSecurityContext(req: any) {
  const forwardedFor = String(req.headers?.["x-forwarded-for"] || "")
    .split(",")[0]
    .trim();
  return {
    ipAddress: forwardedFor || String(req.ip || req.socket?.remoteAddress || "").trim() || null,
    userAgent: String(req.get?.("user-agent") || req.headers?.["user-agent"] || "").trim() || null,
    requestId: String(req.headers?.["x-request-id"] || req.headers?.["x-correlation-id"] || "").trim() || null,
  };
}

function statusForDecision(status: string) {
  if (status === "unauthenticated") return 401;
  if (status === "session_expired" || status === "reauthentication_required") return 401;
  if (status === "not_found" || status === "recipient_mismatch") return 404;
  if (status === "expired" || status === "revoked" || status === "session_revoked") return 410;
  return 403;
}

router.get("/trust-reviews/:grantId", requireAuth, async (req: any, res) => {
  const grantId = String(req.params?.grantId || "").trim();
  const recipientEmail = String(req.user?.email || "").trim();
  const recipientUserId = String(req.user?.id || req.user?.uid || req.user?.sub || "").trim();
  const recipientSessionId = String(
    req.headers?.["x-recipient-review-session-id"] ||
      req.headers?.["X-Recipient-Review-Session-Id"] ||
      req.query?.recipientSessionId ||
      ""
  ).trim();

  try {
    const result = await getRecipientTrustReview({
      grantId,
      recipientEmail,
      recipientUserId,
      recipientSessionId,
      requestContext: requestSecurityContext(req),
    });
    if (!result.decision.allowed) {
      return res.status(statusForDecision(result.decision.status)).json({
        ok: false,
        error: "RECIPIENT_TRUST_REVIEW_BLOCKED",
        decision: result.decision,
      });
    }

    return res.json({ ok: true, data: result });
  } catch (err: any) {
    console.error("[recipient/trust-review] failed", {
      grantId,
      recipientEmail,
      message: err?.message || "failed",
    });
    return res.status(500).json({ ok: false, error: "RECIPIENT_TRUST_REVIEW_FAILED" });
  }
});

export default router;
