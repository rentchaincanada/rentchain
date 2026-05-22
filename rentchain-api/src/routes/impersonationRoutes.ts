import { Router } from "express";
import { db } from "../firebase";
import { requireAuth } from "../middleware/requireAuth";
import { requirePermission } from "../middleware/requireAuthz";
import { signAuthToken } from "../auth/jwt";
import { logEvent } from "../services/telemetryService";
import {
  buildImpersonationAuditEvent,
  buildImpersonationSessionId,
  buildImpersonationTelemetryMeta,
  normalizeImpersonationReasonCategory,
} from "../lib/impersonationGovernance/impersonationGovernance";

const router = Router();

router.post(
  "/landlord/tenants/:tenantId/impersonate",
  requireAuth,
  requirePermission("system.admin"),
  async (req: any, res) => {
    res.setHeader("x-route-source", "impersonationRoutes");
    const operatorId = String(req.user?.id || "").trim();
    const operatorRole = String(req.user?.actorRole || req.user?.role || "").trim().toLowerCase();
    const tenantId = String(req.params.tenantId || "");
    const reasonCategory = normalizeImpersonationReasonCategory(req.body?.reasonCategory || req.body?.reason);
    if (!operatorId) return res.status(401).json({ ok: false, error: "Unauthorized" });
    if (!tenantId) return res.status(400).json({ error: "Missing tenantId" });
    if (!reasonCategory) return res.status(400).json({ ok: false, error: "impersonation_reason_required" });

    const tenantSnap = await db.collection("tenants").doc(tenantId).get();
    if (!tenantSnap.exists) return res.status(404).json({ error: "Tenant not found" });
    const tenant = tenantSnap.data() as any;
    const landlordId = String(tenant?.landlordId || "").trim();
    if (!landlordId) {
      return res.status(403).json({ ok: false, error: "impersonation_target_scope_missing" });
    }
    const startedAt = new Date().toISOString();
    const sessionId = buildImpersonationSessionId({
      realActorId: operatorId,
      effectiveActorId: tenantId,
      occurredAt: startedAt,
    });
    const auditEvent = buildImpersonationAuditEvent({
      eventType: "impersonation.started",
      sessionId,
      lifecycleState: "started",
      reasonCategory,
      realActorId: operatorId,
      realActorRole: operatorRole,
      effectiveActorId: tenantId,
      effectiveActorRole: "tenant",
      targetAccountId: tenantId,
      targetAccountType: "tenant",
      targetLandlordId: landlordId,
      occurredAt: startedAt,
      startedAt,
      policyDecision: "allowed",
    });

    const token = signAuthToken(
      {
        sub: tenantId,
        role: "tenant",
        tenantId,
        landlordId,
        permissions: [],
        revokedPermissions: [],
        realActorId: operatorId,
        realActorRole: auditEvent.actorChain.realActorRole,
        effectiveActorId: tenantId,
        effectiveActorRole: "tenant",
        impersonationSessionId: sessionId,
        impersonationReason: reasonCategory,
        impersonationStartedAt: startedAt,
      },
      { expiresIn: "15m" }
    );

    await logEvent({
      type: "impersonation.started",
      landlordId,
      actor: operatorId,
      meta: buildImpersonationTelemetryMeta(auditEvent),
    });

    return res.json({
      ok: true,
      token,
      tenantId,
      exp: Date.now() + 15 * 60 * 1000,
      impersonation: {
        sessionId,
        state: "active",
        reasonCategory,
        targetAccountType: "tenant",
        targetAccountId: tenantId,
        startedAt,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
        metadataOnly: true,
        tenantVisible: false,
      },
    });
  }
);

router.post(
  "/landlord/tenants/:tenantId/impersonate/end",
  requireAuth,
  requirePermission("system.admin"),
  async (req: any, res) => {
    res.setHeader("x-route-source", "impersonationRoutes");
    const operatorId = String(req.user?.id || "").trim();
    const operatorRole = String(req.user?.actorRole || req.user?.role || "").trim().toLowerCase();
    const tenantId = String(req.params.tenantId || "");
    const sessionId = String(req.body?.sessionId || "").trim();
    const reasonCategory = normalizeImpersonationReasonCategory(req.body?.reasonCategory || req.body?.reason);
    if (!operatorId) return res.status(401).json({ ok: false, error: "Unauthorized" });
    if (!tenantId) return res.status(400).json({ ok: false, error: "Missing tenantId" });
    if (!sessionId) return res.status(400).json({ ok: false, error: "impersonation_session_required" });
    if (!reasonCategory) return res.status(400).json({ ok: false, error: "impersonation_reason_required" });

    const tenantSnap = await db.collection("tenants").doc(tenantId).get();
    if (!tenantSnap.exists) return res.status(404).json({ ok: false, error: "Tenant not found" });
    const tenant = tenantSnap.data() as any;
    const landlordId = String(tenant?.landlordId || "").trim();
    if (!landlordId) {
      return res.status(403).json({ ok: false, error: "impersonation_target_scope_missing" });
    }
    const endedAt = new Date().toISOString();
    const auditEvent = buildImpersonationAuditEvent({
      eventType: "impersonation.ended",
      sessionId,
      lifecycleState: "ended",
      reasonCategory,
      realActorId: operatorId,
      realActorRole: operatorRole,
      effectiveActorId: tenantId,
      effectiveActorRole: "tenant",
      targetAccountId: tenantId,
      targetAccountType: "tenant",
      targetLandlordId: landlordId,
      occurredAt: endedAt,
      endedAt,
      policyDecision: "allowed",
    });

    await logEvent({
      type: "impersonation.ended",
      landlordId,
      actor: operatorId,
      meta: buildImpersonationTelemetryMeta(auditEvent),
    });

    return res.json({
      ok: true,
      impersonation: {
        sessionId,
        state: "ended",
        reasonCategory,
        targetAccountType: "tenant",
        targetAccountId: tenantId,
        endedAt,
        metadataOnly: true,
        tenantVisible: false,
      },
    });
  }
);

export default router;
