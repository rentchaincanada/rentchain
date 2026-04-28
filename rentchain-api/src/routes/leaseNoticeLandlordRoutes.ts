import { Router } from "express";
import { db } from "../config/firebase";
import { requireLandlord } from "../middleware/requireLandlord";
import {
  getLeaseNoticeWorkflowFlag,
  type LeaseNoticeType,
  type RentChangeMode,
} from "../config/leaseNoticeRules";
import {
  appendLeaseWorkflowEvent,
  buildLeaseNoticePreviewInputFromLease,
  buildPreview,
  computeNoResponseState,
  deriveLeaseRenewalOperatorInputRecord,
  getLeaseForLandlordWorkflow,
  getLeaseNoticeByLeaseId,
  lookupUserEmail,
  normalizeLeaseRecord,
  performLeaseNoticeSendFromPreviewInput,
  sanitizeLeaseRenewalOperatorInput,
  sendLeaseWorkflowEmail,
} from "../services/leaseNoticeWorkflowService";
import { executeAutomation } from "../lib/automation/automationExecutor";
import { buildLeaseNoticePolicyRequest } from "../lib/policy/policyAdapters";
import { evaluatePolicy, toAutopilotPolicySummary, writePolicyEvaluatedEvent } from "../lib/policy/policyEvaluator";

const router = Router();

function requireLeaseNoticeFeature(req: any, res: any, next: any) {
  const flag = getLeaseNoticeWorkflowFlag();
  if (!flag.enabled) {
    return res.status(404).json({ ok: false, error: "FEATURE_DISABLED", source: flag.source });
  }
  return next();
}

router.use(requireLandlord, requireLeaseNoticeFeature);

function asNumber(value: unknown): number | null {
  if (value == null || value === "") return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function isAutomationRequested(body: any) {
  return Boolean(body?.automationEnabled || body?.automation?.enabled);
}

type LeaseRenewalWorkflowBucket = "expiring" | "pending-response" | "no-response";

function asLeaseRenewalWorkflowBucket(value: unknown): LeaseRenewalWorkflowBucket | null {
  const raw = String(value || "").trim().toLowerCase();
  if (raw === "expiring" || raw === "pending-response" || raw === "no-response") return raw;
  return null;
}

function deriveLeaseRenewalWorkflowBucket(params: {
  lease: any;
  latestNotice: any | null;
  now: number;
  horizon: number;
}): LeaseRenewalWorkflowBucket | null {
  const { lease, latestNotice, now, horizon } = params;
  const noResponse = latestNotice ? computeNoResponseState(latestNotice) : false;
  if (noResponse) return "no-response";
  const response = String(latestNotice?.tenantResponse || "pending").trim().toLowerCase();
  if (latestNotice && response === "pending") return "pending-response";
  const dueAt = Number(lease?.nextNoticeDueAt || 0);
  if (dueAt > 0 && dueAt >= now && dueAt <= horizon) return "expiring";
  return null;
}

async function performLeaseNoticeSend(params: {
  leaseId: string;
  landlordId: string;
  actorId: string | null;
  lease: any;
  reqBody: any;
  autopilotPolicy: ReturnType<typeof toAutopilotPolicySummary>;
}) {
  const { leaseId, landlordId, actorId, lease, reqBody, autopilotPolicy } = params;
  const previewInput = {
    rentChangeMode: String(reqBody?.rentChangeMode || "").trim().toLowerCase() as RentChangeMode,
    proposedRent: asNumber(reqBody?.proposedRent),
    newTermType: String(reqBody?.newTermType || "").trim().toLowerCase() as any,
    newLeaseStartDate: String(reqBody?.newLeaseStartDate || "").trim(),
    newLeaseEndDate: reqBody?.newLeaseEndDate ?? null,
    responseDeadlineAt: Number(reqBody?.responseDeadlineAt || 0),
    noticeType: (String(reqBody?.noticeType || "").trim().toLowerCase() || undefined) as LeaseNoticeType | undefined,
  };
  return performLeaseNoticeSendFromPreviewInput({
    leaseId,
    landlordId,
    actorId,
    lease,
    previewInput,
    autopilotPolicy,
  });
}

router.get("/expiring", async (req: any, res) => {
  try {
    const landlordId = String(req.user?.landlordId || req.user?.id || "").trim();
    const withinDays = Math.max(1, Number(req.query?.withinDays || 120));
    const propertyId = String(req.query?.propertyId || "").trim();
    const statusFilter = asLeaseRenewalWorkflowBucket(req.query?.status);
    const now = Date.now();
    const horizon = now + withinDays * 24 * 60 * 60 * 1000;
    const [leaseSnap, noticeSnap] = await Promise.all([
      db.collection("leases").where("landlordId", "==", landlordId).limit(400).get(),
      db.collection("leaseNotices").where("landlordId", "==", landlordId).limit(400).get(),
    ]);
    const latestNoticeByLeaseId = new Map<string, any>();
    const leaseNotices = noticeSnap.docs
      .map((doc) => ({ id: doc.id, ...(doc.data() as any) }))
      .sort((a, b) => Number(b.updatedAt || b.createdAt || 0) - Number(a.updatedAt || a.createdAt || 0));
    for (const notice of leaseNotices) {
      const leaseId = String(notice?.leaseId || "").trim();
      if (!leaseId || latestNoticeByLeaseId.has(leaseId)) continue;
      latestNoticeByLeaseId.set(leaseId, notice);
    }

    const items = leaseSnap.docs
      .map((doc) => normalizeLeaseRecord(doc.id, doc.data() as any))
      .filter((lease) => !propertyId || lease.propertyId === propertyId)
      .filter((lease) => lease.status === "active" || lease.status === "notice_pending" || lease.status === "renewal_pending")
      .map((lease) => {
        const latestNotice = latestNoticeByLeaseId.get(lease.id) || null;
        const noticeBucket = deriveLeaseRenewalWorkflowBucket({
          lease,
          latestNotice,
          now,
          horizon,
        });
        return noticeBucket ? { ...lease, noticeBucket } : null;
      })
      .filter((lease): lease is ReturnType<typeof normalizeLeaseRecord> & { noticeBucket: LeaseRenewalWorkflowBucket } => Boolean(lease))
      .filter((lease: any) => !statusFilter || lease.noticeBucket === statusFilter)
      .sort((a, b) => Number(a.nextNoticeDueAt || 0) - Number(b.nextNoticeDueAt || 0));

    console.info("[lease-notice] expiring-list", {
      landlordId,
      withinDays,
      statusFilter,
      count: items.length,
    });

    return res.json({ ok: true, items, data: items });
  } catch (err: any) {
    console.error("[lease-notice] expiring-list failed", { message: err?.message || "failed" });
    return res.status(500).json({ ok: false, error: "LEASE_EXPIRING_LIST_FAILED" });
  }
});

router.get("/:id/renewal-inputs", async (req: any, res) => {
  try {
    const landlordId = String(req.user?.landlordId || req.user?.id || "").trim();
    const leaseId = String(req.params?.id || "").trim();
    const leaseResult = await getLeaseForLandlordWorkflow(leaseId, landlordId);
    if (!leaseResult.ok) {
      return res.status(leaseResult.status).json({ ok: false, error: leaseResult.error });
    }
    const lease = normalizeLeaseRecord(leaseId, leaseResult.lease);
    return res.json({
      ok: true,
      lease,
      renewalInputs: deriveLeaseRenewalOperatorInputRecord(lease),
    });
  } catch (err: any) {
    console.error("[lease-notice] renewal-inputs load failed", { message: err?.message || "failed" });
    return res.status(500).json({ ok: false, error: "LEASE_RENEWAL_INPUT_LOAD_FAILED" });
  }
});

router.put("/:id/renewal-inputs", async (req: any, res) => {
  try {
    const landlordId = String(req.user?.landlordId || req.user?.id || "").trim();
    const actorId = String(req.user?.id || landlordId || "").trim() || null;
    const leaseId = String(req.params?.id || "").trim();
    const leaseResult = await getLeaseForLandlordWorkflow(leaseId, landlordId);
    if (!leaseResult.ok) {
      return res.status(leaseResult.status).json({ ok: false, error: leaseResult.error });
    }

    const sanitized = sanitizeLeaseRenewalOperatorInput(req.body || {});
    if (!sanitized.ok) {
      return res.status(400).json({ ok: false, error: sanitized.error });
    }

    const now = Date.now();
    await db.collection("leases").doc(leaseId).set(
      {
        renewalRentChangeMode: sanitized.data.rentChangeMode,
        renewalOfferedRent: sanitized.data.proposedRent,
        renewalDecisionDeadlineAt: sanitized.data.responseDeadlineAt,
        renewalNewTermType: sanitized.data.newTermType,
        renewalNewLeaseStartDate: sanitized.data.newLeaseStartDate,
        renewalNewLeaseEndDate: sanitized.data.newLeaseEndDate,
        updatedAt: now,
      },
      { merge: true }
    );

    const lease = normalizeLeaseRecord(leaseId, {
      ...(leaseResult.lease || {}),
      renewalRentChangeMode: sanitized.data.rentChangeMode,
      renewalOfferedRent: sanitized.data.proposedRent,
      renewalDecisionDeadlineAt: sanitized.data.responseDeadlineAt,
      renewalNewTermType: sanitized.data.newTermType,
      renewalNewLeaseStartDate: sanitized.data.newLeaseStartDate,
      renewalNewLeaseEndDate: sanitized.data.newLeaseEndDate,
      updatedAt: now,
    });

    await appendLeaseWorkflowEvent({
      entityType: "lease",
      entityId: leaseId,
      leaseId,
      landlordId,
      tenantId: lease.tenantId,
      propertyId: lease.propertyId,
      unitId: lease.unitId,
      actorType: "landlord",
      actorId,
      eventType: "lease_notice_preview_generated",
      eventData: {
        kind: "renewal_inputs_saved",
        rentChangeMode: sanitized.data.rentChangeMode,
        proposedRent: sanitized.data.proposedRent,
        newTermType: sanitized.data.newTermType,
        responseDeadlineAt: sanitized.data.responseDeadlineAt,
      },
    });

    return res.json({
      ok: true,
      lease,
      renewalInputs: deriveLeaseRenewalOperatorInputRecord(lease),
    });
  } catch (err: any) {
    console.error("[lease-notice] renewal-inputs save failed", { message: err?.message || "failed" });
    return res.status(500).json({ ok: false, error: "LEASE_RENEWAL_INPUT_SAVE_FAILED" });
  }
});

router.post("/:id/notice-preview", async (req: any, res) => {
  try {
    const landlordId = String(req.user?.landlordId || req.user?.id || "").trim();
    const leaseId = String(req.params?.id || "").trim();
    const actorId = String(req.user?.id || landlordId || "").trim() || null;
    const leaseResult = await getLeaseForLandlordWorkflow(leaseId, landlordId);
    if (!leaseResult.ok) {
      return res.status(leaseResult.status).json({ ok: false, error: leaseResult.error });
    }
    const policyRequest = buildLeaseNoticePolicyRequest({
      action: "preview_notice",
      actorRole: String(req.user?.role || "").trim().toLowerCase() || "landlord",
      actorUserId: actorId,
      lease: leaseResult.lease,
      leaseId,
      requestBody: req.body || {},
    });
    const policyResult = evaluatePolicy(policyRequest);
    const autopilotPolicy = toAutopilotPolicySummary(policyResult);
    await writePolicyEvaluatedEvent({
      request: policyRequest,
      result: policyResult,
      actorType: "landlord",
      metadata: {
        landlordId,
        tenantId: leaseResult.lease.tenantId,
        propertyId: leaseResult.lease.propertyId,
        unitId: leaseResult.lease.unitId,
      },
    });
    if (policyResult.outcome === "block") {
      return res.status(400).json({ ok: false, error: "LEASE_NOTICE_POLICY_BLOCKED", autopilotPolicy });
    }

    const previewResult = buildPreview(leaseResult.lease, {
      rentChangeMode: String(req.body?.rentChangeMode || "").trim().toLowerCase() as RentChangeMode,
      proposedRent: asNumber(req.body?.proposedRent),
      newTermType: String(req.body?.newTermType || "").trim().toLowerCase() as any,
      newLeaseStartDate: String(req.body?.newLeaseStartDate || "").trim(),
      newLeaseEndDate: req.body?.newLeaseEndDate ?? null,
      responseDeadlineAt: Number(req.body?.responseDeadlineAt || 0),
      noticeType: (String(req.body?.noticeType || "").trim().toLowerCase() || undefined) as LeaseNoticeType | undefined,
    });
    if (!previewResult.ok) {
      return res.status(400).json({ ok: false, error: previewResult.error });
    }

    console.info("[lease-notice] preview-generated", {
      leaseId,
      landlordId,
      tenantId: leaseResult.lease.tenantId,
      propertyId: leaseResult.lease.propertyId,
      unitId: leaseResult.lease.unitId,
      rentChangeMode: previewResult.preview.rentChangeMode,
    });

    await appendLeaseWorkflowEvent({
      entityType: "lease",
      entityId: leaseId,
      leaseId,
      landlordId,
      tenantId: leaseResult.lease.tenantId,
      propertyId: leaseResult.lease.propertyId,
      unitId: leaseResult.lease.unitId,
      actorType: "landlord",
      actorId,
      eventType: "lease_notice_preview_generated",
      eventData: {
        rentChangeMode: previewResult.preview.rentChangeMode,
        proposedRent: previewResult.preview.proposedRent,
        newTermType: previewResult.preview.newTermType,
        responseDeadlineAt: previewResult.preview.responseDeadlineAt,
      },
    });
    if (!isAutomationRequested(req.body)) {
      return res.json({ ok: true, preview: previewResult.preview, rule: previewResult.rule, autopilotPolicy });
    }

    const sendPolicyRequest = buildLeaseNoticePolicyRequest({
      action: "send_notice",
      actorRole: String(req.user?.role || "").trim().toLowerCase() || "landlord",
      actorUserId: actorId,
      lease: leaseResult.lease,
      leaseId,
      requestBody: req.body || {},
    });
    const sendPolicyResult = evaluatePolicy(sendPolicyRequest);
    await writePolicyEvaluatedEvent({
      request: sendPolicyRequest,
      result: sendPolicyResult,
      actorType: "landlord",
      metadata: {
        landlordId,
        tenantId: leaseResult.lease.tenantId,
        propertyId: leaseResult.lease.propertyId,
        unitId: leaseResult.lease.unitId,
        initiatedFrom: "notice_preview",
      },
    });
    const automation = await executeAutomation({
      action: "lease.auto_send_notice",
      policyResult: sendPolicyResult,
      actor: {
        type: "landlord",
        id: actorId,
        role: "landlord",
      },
      resource: {
        type: "lease",
        id: leaseId,
      },
      visibility: "internal",
      metadata: {
        domain: "lease_notice",
        initiatedFrom: "preview",
        landlordId,
        tenantId: leaseResult.lease.tenantId,
        propertyId: leaseResult.lease.propertyId,
        unitId: leaseResult.lease.unitId,
        policyAction: "send_notice",
      },
      context: {
        noticeReady: previewResult.ok,
        alreadySent: Boolean(leaseResult.lease.latestNoticeId),
        hasRequiredLegalInputs: Boolean(sendPolicyRequest.context.hasRequiredLegalInputs),
        execute: async () => {
          const execution = await performLeaseNoticeSend({
            leaseId,
            landlordId,
            actorId,
            lease: leaseResult.lease,
            reqBody: req.body || {},
            autopilotPolicy,
          });
          if (execution.status >= 400) {
            const error = new Error(String(execution.payload?.error || "AUTOMATION_EXECUTION_FAILED"));
            (error as any).code = execution.payload?.error || "AUTOMATION_EXECUTION_FAILED";
            throw error;
          }
          return execution.payload;
        },
      },
    });

    return res.json({
      ok: true,
      preview: previewResult.preview,
      rule: previewResult.rule,
      autopilotPolicy,
      ...(automation.data && typeof automation.data === "object" ? automation.data : {}),
      automationResult: automation.automationResult,
    });
  } catch (err: any) {
    console.error("[lease-notice] preview failed", { message: err?.message || "failed" });
    return res.status(500).json({ ok: false, error: "LEASE_NOTICE_PREVIEW_FAILED" });
  }
});

router.post("/:id/send-notice", async (req: any, res) => {
  try {
    const landlordId = String(req.user?.landlordId || req.user?.id || "").trim();
    const actorId = String(req.user?.id || landlordId || "").trim() || null;
    const leaseId = String(req.params?.id || "").trim();
    const leaseResult = await getLeaseForLandlordWorkflow(leaseId, landlordId);
    if (!leaseResult.ok) {
      return res.status(leaseResult.status).json({ ok: false, error: leaseResult.error });
    }
    const lease = leaseResult.lease;
    const policyRequest = buildLeaseNoticePolicyRequest({
      action: "send_notice",
      actorRole: String(req.user?.role || "").trim().toLowerCase() || "landlord",
      actorUserId: actorId,
      lease,
      leaseId,
      requestBody: req.body || {},
    });
    const policyResult = evaluatePolicy(policyRequest);
    const autopilotPolicy = toAutopilotPolicySummary(policyResult);
    await writePolicyEvaluatedEvent({
      request: policyRequest,
      result: policyResult,
      actorType: "landlord",
      metadata: {
        landlordId,
        tenantId: lease.tenantId,
        propertyId: lease.propertyId,
        unitId: lease.unitId,
      },
    });
    if (policyResult.outcome === "block") {
      return res.status(400).json({ ok: false, error: "LEASE_NOTICE_POLICY_BLOCKED", autopilotPolicy });
    }
    const execution = await performLeaseNoticeSend({
      leaseId,
      landlordId,
      actorId,
      lease,
      reqBody: req.body || {},
      autopilotPolicy,
    });
    return res.status(execution.status).json(execution.payload);
  } catch (err: any) {
    console.error("[lease-notice] send failed", { message: err?.message || "failed" });
    return res.status(500).json({ ok: false, error: "LEASE_NOTICE_SEND_FAILED" });
  }
});

router.get("/:id/renewal-status", async (req: any, res) => {
  try {
    const landlordId = String(req.user?.landlordId || req.user?.id || "").trim();
    const leaseId = String(req.params?.id || "").trim();
    const leaseResult = await getLeaseForLandlordWorkflow(leaseId, landlordId);
    if (!leaseResult.ok) {
      return res.status(leaseResult.status).json({ ok: false, error: leaseResult.error });
    }
    const notices = await getLeaseNoticeByLeaseId(leaseId);
    const latest = notices[0] || null;
    return res.json({
      ok: true,
      lease: leaseResult.lease,
      latestNotice: latest,
      noResponse: latest ? computeNoResponseState(latest) : false,
      sent: Boolean(latest?.sentAt),
      viewed: Boolean(latest?.tenantViewedAt),
      responded: String(latest?.tenantResponse || "pending") !== "pending",
    });
  } catch (err: any) {
    console.error("[lease-notice] renewal-status failed", { message: err?.message || "failed" });
    return res.status(500).json({ ok: false, error: "LEASE_RENEWAL_STATUS_FAILED" });
  }
});

export default router;
