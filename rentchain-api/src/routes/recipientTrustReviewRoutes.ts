import { Router } from "express";
import { requireAuth } from "../middleware/requireAuth";
import { getRecipientTrustReview } from "../services/tenantPortal/tenantInstitutionAccessService";

const router = Router();

function statusForDecision(status: string) {
  if (status === "unauthenticated") return 401;
  if (status === "not_found" || status === "recipient_mismatch") return 404;
  if (status === "expired" || status === "revoked") return 410;
  return 403;
}

router.get("/trust-reviews/:grantId", requireAuth, async (req: any, res) => {
  const grantId = String(req.params?.grantId || "").trim();
  const recipientEmail = String(req.user?.email || "").trim();

  try {
    const result = await getRecipientTrustReview({ grantId, recipientEmail });
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
