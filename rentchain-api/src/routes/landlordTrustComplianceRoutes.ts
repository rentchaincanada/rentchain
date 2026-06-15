import { Router } from "express";
import { getEffectiveLandlordId } from "../auth/requestAuthority";
import { requireAuth } from "../middleware/requireAuth";
import { requireLandlord } from "../middleware/requireLandlord";
import { buildTrustComplianceSummary } from "../services/trustCompliance/trustComplianceSummaryService";
import { TRUST_COMPLIANCE_ROUTE_VERSION } from "../services/trustCompliance/trustComplianceTypes";

const router = Router();

function asString(value: unknown, max = 500): string {
  return String(value ?? "").trim().slice(0, max);
}

function statusFor(error: any): number {
  const status = Number(error?.status);
  return Number.isInteger(status) && status >= 400 && status < 600 ? status : 500;
}

function codeFor(error: any): string {
  const code = asString(error?.message, 120);
  if (code === "landlord_id_required") return "UNAUTHORIZED";
  return "TRUST_COMPLIANCE_SUMMARY_FAILED";
}

function trustComplianceRouteVersion(_req: any, res: any, next: any) {
  res.setHeader("x-trust-compliance-route-version", TRUST_COMPLIANCE_ROUTE_VERSION);
  return next();
}

router.get("/trust-compliance/summary", trustComplianceRouteVersion, requireAuth, requireLandlord, async (req: any, res) => {
  try {
    const landlordId = asString(getEffectiveLandlordId(req), 240);
    const summary = await buildTrustComplianceSummary({ landlordId });
    return res.json({ ok: true, summary });
  } catch (error: any) {
    const status = statusFor(error);
    if (status >= 500) {
      console.error("[landlord-trust-compliance] summary failed", { message: error?.message || "failed" });
    }
    return res.status(status).json({ ok: false, error: codeFor(error) });
  }
});

export default router;
