import { Router, type Request } from "express";
import { requireAuth } from "../middleware/requireAuth";
import type { ReviewWorkflowType } from "../services/stateMachines/types";
import { buildDecisionReconciliation, inspectWorkflowState } from "../services/recovery/decisionStateInspector";
import {
  applyReconciliationDecision,
  findWorkflowsNeedingRecovery,
  listRecentRecoveryActions,
} from "../services/recovery/decisionReconciliationService";
import {
  OPERATOR_RECOVERY_LOGS_COLLECTION,
  loadSnapshot,
} from "../services/recovery/recoveryStore";
import { asSafeText, normalizeRecoveryAuthority, stableRecoveryHash } from "../services/recovery/recoveryShared";
import type { ReconciliationRequest, RecoveryAuthority } from "../types/recovery";

type AuthRequest = Request & {
  user?: unknown;
};

const router = Router();
const WORKFLOW_TYPES = new Set<ReviewWorkflowType>(["screening", "lease", "maintenance", "payment", "decision"]);

function authorityFromRequest(req: AuthRequest): RecoveryAuthority {
  const user = req.user && typeof req.user === "object" ? (req.user as unknown as Record<string, unknown>) : {};
  return normalizeRecoveryAuthority({
    role: user.actorRole || user.role,
    operatorId: user.uid || user.id,
    landlordId: user.landlordId || user.accountOwnerId,
  });
}

function requireOperator(authority: RecoveryAuthority): boolean {
  return authority.role === "admin" || authority.role === "support";
}

function workflowType(value: unknown): ReviewWorkflowType | null {
  const type = String(value || "").trim() as ReviewWorkflowType;
  return WORKFLOW_TYPES.has(type) ? type : null;
}

function workflowId(value: unknown): string {
  return asSafeText(value, 240);
}

function requestBody(req: AuthRequest): Record<string, unknown> {
  return req.body && typeof req.body === "object" ? (req.body as Record<string, unknown>) : {};
}

function mapError(error: unknown): { status: number; code: string } {
  const message = error instanceof Error ? error.message : String(error || "");
  if (message.includes("forbidden")) return { status: 403, code: "FORBIDDEN" };
  if (message === "recovery_workflow_not_found") return { status: 404, code: "RECOVERY_WORKFLOW_NOT_FOUND" };
  if (message === "recovery_already_logged") return { status: 409, code: "RECOVERY_ALREADY_LOGGED" };
  if (message === "recovery_not_required") return { status: 409, code: "RECOVERY_NOT_REQUIRED" };
  if (message.includes("invalid") || message.includes("required")) return { status: 400, code: "RECOVERY_REQUEST_INVALID" };
  return { status: 500, code: "RECOVERY_ROUTE_FAILED" };
}

function safeLogId(value: unknown): string {
  const raw = asSafeText(value, 300);
  return raw.startsWith("operator_recovery:") ? raw : `operator_recovery:${stableRecoveryHash(raw)}`;
}

router.post("/recovery/inspect", requireAuth, async (req: AuthRequest, res) => {
  try {
    const authority = authorityFromRequest(req);
    if (!requireOperator(authority)) return res.status(403).json({ ok: false, error: "FORBIDDEN" });
    const body = requestBody(req);
    const type = workflowType(body.workflowType);
    const id = workflowId(body.workflowId);
    if (!type || !id) return res.status(400).json({ ok: false, error: "WORKFLOW_REFERENCE_REQUIRED" });
    const inspection = await inspectWorkflowState({ workflowType: type, workflowId: id, authority });
    if (!inspection.found) return res.status(404).json({ ok: false, error: "RECOVERY_WORKFLOW_NOT_FOUND" });
    return res.json({ ok: true, reconciliation: buildDecisionReconciliation(inspection) });
  } catch (error) {
    const mapped = mapError(error);
    return res.status(mapped.status).json({ ok: false, error: mapped.code });
  }
});

router.post("/recovery/reconcile", requireAuth, async (req: AuthRequest, res) => {
  try {
    const authority = authorityFromRequest(req);
    if (!requireOperator(authority)) return res.status(403).json({ ok: false, error: "FORBIDDEN" });
    const body = requestBody(req);
    const type = workflowType(body.workflowType);
    const id = workflowId(body.workflowId);
    if (!type || !id) return res.status(400).json({ ok: false, error: "WORKFLOW_REFERENCE_REQUIRED" });
    const request: ReconciliationRequest = {
      decisionType: String(body.decisionType || "") as ReconciliationRequest["decisionType"],
      reasonCode: asSafeText(body.reasonCode, 120),
      reason: asSafeText(body.reason, 800),
    };
    const result = await applyReconciliationDecision({ workflowType: type, workflowId: id, request, authority });
    return res.status(201).json({ ok: true, recoveryLog: result.recoveryLog });
  } catch (error) {
    const mapped = mapError(error);
    return res.status(mapped.status).json({ ok: false, error: mapped.code });
  }
});

router.get("/recovery/logs", requireAuth, async (req: AuthRequest, res) => {
  try {
    const authority = authorityFromRequest(req);
    if (!requireOperator(authority)) return res.status(403).json({ ok: false, error: "FORBIDDEN" });
    const includeCandidates = String(req.query?.includeCandidates || "").toLowerCase() === "true";
    const limit = Number(req.query?.limit || 25);
    const logs = await listRecentRecoveryActions({ authority, limit });
    const candidates = includeCandidates ? await findWorkflowsNeedingRecovery({ authority, limit }) : [];
    return res.json({ ok: true, logs, candidates });
  } catch (error) {
    const mapped = mapError(error);
    return res.status(mapped.status).json({ ok: false, error: mapped.code });
  }
});

router.get("/recovery/logs/:logId", requireAuth, async (req: AuthRequest, res) => {
  try {
    const authority = authorityFromRequest(req);
    if (!requireOperator(authority)) return res.status(403).json({ ok: false, error: "FORBIDDEN" });
    const log = await loadSnapshot(OPERATOR_RECOVERY_LOGS_COLLECTION, safeLogId(req.params.logId));
    if (!log || log.rawIdsIncluded !== false) {
      return res.status(404).json({ ok: false, error: "RECOVERY_LOG_NOT_FOUND" });
    }
    return res.json({ ok: true, recoveryLog: log });
  } catch (error) {
    const mapped = mapError(error);
    return res.status(mapped.status).json({ ok: false, error: mapped.code });
  }
});

export default router;
