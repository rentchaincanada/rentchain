import { Router } from "express";
import { db } from "../firebase";
import { requireLandlord } from "../middleware/requireLandlord";
import { recordRiskDecisionAudit } from "../services/riskAgent/riskDecisionAuditService";
import { evaluateApplicationRisk, getLatestApplicationRisk } from "../services/riskAgent/riskAgentService";

const router = Router();

router.use(requireLandlord);

async function assertApplicationAccess(req: any, applicationId: string) {
  if (!applicationId) {
    const error = new Error("NOT_FOUND") as Error & { statusCode?: number };
    error.statusCode = 404;
    throw error;
  }

  const snap = await db.collection("rentalApplications").doc(applicationId).get();
  if (!snap.exists) {
    const error = new Error("NOT_FOUND") as Error & { statusCode?: number };
    error.statusCode = 404;
    throw error;
  }

  const application = snap.data() as any;
  const role = String(req.user?.role || "").toLowerCase();
  const landlordId = String(req.user?.landlordId || req.user?.id || "").trim();
  if (role !== "admin" && application?.landlordId && application.landlordId !== landlordId) {
    const error = new Error("FORBIDDEN") as Error & { statusCode?: number };
    error.statusCode = 403;
    throw error;
  }
}

router.post("/risk-agent/applications/:id/evaluate", async (req: any, res) => {
  try {
    const applicationId = String(req.params?.id || "").trim();
    await assertApplicationAccess(req, applicationId);
    const result = await evaluateApplicationRisk({ applicationId });
    return res.json({ ok: true, ...result });
  } catch (err: any) {
    const statusCode = typeof err?.statusCode === "number" ? err.statusCode : 500;
    if (statusCode >= 500) {
      console.error("[risk-agent] evaluate failed", err?.message || err);
    }
    return res.status(statusCode).json({
      ok: false,
      error: statusCode >= 500 ? "risk_agent_evaluation_failed" : String(err?.message || "bad_request"),
    });
  }
});

router.get("/risk-agent/applications/:id/latest", async (req: any, res) => {
  try {
    const applicationId = String(req.params?.id || "").trim();
    await assertApplicationAccess(req, applicationId);
    const latest = await getLatestApplicationRisk({ applicationId });
    return res.json({ ok: true, latest });
  } catch (err: any) {
    const statusCode = typeof err?.statusCode === "number" ? err.statusCode : 500;
    if (statusCode >= 500) {
      console.error("[risk-agent] latest failed", err?.message || err);
    }
    return res.status(statusCode).json({
      ok: false,
      error: statusCode >= 500 ? "risk_agent_latest_failed" : String(err?.message || "bad_request"),
    });
  }
});

router.post("/risk-agent/applications/:id/decision", async (req: any, res) => {
  try {
    const applicationId = String(req.params?.id || "").trim();
    await assertApplicationAccess(req, applicationId);

    const decision = String(req.body?.decision || "").trim().toLowerCase();
    if (!["approve", "reject", "request_info"].includes(decision)) {
      return res.status(400).json({ ok: false, error: "invalid_decision" });
    }

    const notes = String(req.body?.notes || "").trim();
    const audit = await recordRiskDecisionAudit({
      applicationId,
      landlordId: String(req.user?.landlordId || req.user?.id || "").trim() || null,
      userId: String(req.user?.id || "").trim() || null,
      role: String(req.user?.role || "").trim() || null,
      decision: decision as "approve" | "reject" | "request_info",
      notes: notes || null,
    });

    return res.json({ ok: true, decision: audit });
  } catch (err: any) {
    const statusCode = typeof err?.statusCode === "number" ? err.statusCode : 500;
    if (statusCode >= 500) {
      console.error("[risk-agent] decision audit failed", err?.message || err);
    }
    return res.status(statusCode).json({
      ok: false,
      error: statusCode >= 500 ? "risk_agent_decision_failed" : String(err?.message || "bad_request"),
    });
  }
});

export default router;
