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
  buildPreview,
  computeNoResponseState,
  getLeaseForLandlordWorkflow,
  getLeaseNoticeByLeaseId,
  lookupUserEmail,
  normalizeLeaseRecord,
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

function appBaseUrl() {
  return String(process.env.PUBLIC_APP_URL || process.env.VITE_PUBLIC_APP_URL || "https://www.rentchain.ai").replace(/\/$/, "");
}

function isAutomationRequested(body: any) {
  return Boolean(body?.automationEnabled || body?.automation?.enabled);
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
  const previewResult = buildPreview(lease, {
    rentChangeMode: String(reqBody?.rentChangeMode || "").trim().toLowerCase() as RentChangeMode,
    proposedRent: asNumber(reqBody?.proposedRent),
    newTermType: String(reqBody?.newTermType || "").trim().toLowerCase() as any,
    newLeaseStartDate: String(reqBody?.newLeaseStartDate || "").trim(),
    newLeaseEndDate: reqBody?.newLeaseEndDate ?? null,
    responseDeadlineAt: Number(reqBody?.responseDeadlineAt || 0),
    noticeType: (String(reqBody?.noticeType || "").trim().toLowerCase() || undefined) as LeaseNoticeType | undefined,
  });
  if (!previewResult.ok) {
    return { status: 400, payload: { ok: false, error: previewResult.error, autopilotPolicy } };
  }

  const noticeRef = db.collection("leaseNotices").doc();
  const now = Date.now();
  const baseNotice = {
    id: noticeRef.id,
    leaseId,
    landlordId,
    tenantId: lease.tenantId,
    propertyId: lease.propertyId,
    unitId: lease.unitId,
    noticeType: previewResult.preview.noticeType,
    legalTemplateKey: previewResult.preview.legalTemplateKey,
    province: lease.province,
    leaseType: lease.leaseType,
    noticeDueAt: previewResult.preview.noticeDueAt,
    sentAt: null,
    deliveryStatus: "pending",
    deliveryChannel: "email",
    rentChangeMode: previewResult.preview.rentChangeMode,
    currentRent: previewResult.preview.currentRent,
    proposedRent: previewResult.preview.proposedRent,
    newTermType: previewResult.preview.newTermType,
    newTermStartDate: previewResult.preview.newTermStartDate,
    newTermEndDate: previewResult.preview.newTermEndDate,
    responseRequired: true,
    responseDeadlineAt: previewResult.preview.responseDeadlineAt,
    tenantResponse: "pending",
    tenantRespondedAt: null,
    tenantViewedAt: null,
    landlordNotifiedOfResponseAt: null,
    metadata: {
      noticeRuleVersion: previewResult.preview.noticeRuleVersion,
      summary: previewResult.preview.summary,
    },
    createdAt: now,
    updatedAt: now,
  };

  const batch = db.batch();
  batch.set(noticeRef, baseNotice);
  batch.set(
    db.collection("leases").doc(leaseId),
    {
      status: "renewal_pending",
      latestNoticeId: noticeRef.id,
      noticeRuleVersion: previewResult.preview.noticeRuleVersion,
      noticeLeadDays: previewResult.rule.noticeLeadDays,
      nextNoticeDueAt: previewResult.preview.noticeDueAt,
      renewalOfferedRent: previewResult.preview.proposedRent,
      renewalDecisionDeadlineAt: previewResult.preview.responseDeadlineAt,
      updatedAt: now,
    },
    { merge: true }
  );
  await appendLeaseWorkflowEvent({
    batch,
    entityType: "leaseNotice",
    entityId: noticeRef.id,
    leaseId,
    landlordId,
    tenantId: lease.tenantId,
    propertyId: lease.propertyId,
    unitId: lease.unitId,
    actorType: "landlord",
    actorId,
    eventType: "lease_notice_due",
    eventData: {
      noticeType: baseNotice.noticeType,
      responseDeadlineAt: baseNotice.responseDeadlineAt,
    },
  });
  await batch.commit();

  const tenantEmail = await lookupUserEmail(lease.tenantId, ["tenants", "users"]);
  const tenantUrl = `${appBaseUrl()}/tenant/login?next=${encodeURIComponent(`/tenant/lease-notices/${noticeRef.id}`)}`;
  const emailResult = await sendLeaseWorkflowEmail({
    eventKey: "lease_notice_sent_tenant",
    to: tenantEmail,
    subject: "Lease notice from your landlord",
    intro:
      previewResult.preview.rentChangeMode === "undecided"
        ? "Your landlord sent a lease notice and will decide rent later. Review the next-term options in RentChain."
        : "Your landlord sent a lease notice. Review the next-term options and choose whether to begin a new term or quit at the end of the current term.",
    ctaText: "Review lease notice",
    ctaUrl: tenantUrl,
    leaseId,
    noticeId: noticeRef.id,
    landlordId,
    tenantId: lease.tenantId,
    propertyId: lease.propertyId,
    unitId: lease.unitId,
  });

  if (!emailResult.ok) {
    await Promise.all([
      noticeRef.set(
        {
          deliveryStatus: "failed",
          metadata: {
            ...baseNotice.metadata,
            lastDeliveryError: emailResult.reason,
          },
          updatedAt: Date.now(),
        },
        { merge: true }
      ),
      appendLeaseWorkflowEvent({
        entityType: "leaseNotice",
        entityId: noticeRef.id,
        leaseId,
        landlordId,
        tenantId: lease.tenantId,
        propertyId: lease.propertyId,
        unitId: lease.unitId,
        actorType: "system",
        actorId: null,
        eventType: "landlord_notified",
        eventData: {
          kind: "send_failed",
          noticeId: noticeRef.id,
          reason: emailResult.reason,
        },
      }),
    ]);
    return {
      status: 502,
      payload: {
        ok: false,
        error: "LEASE_NOTICE_DELIVERY_FAILED",
        noticeId: noticeRef.id,
        delivery: emailResult,
        autopilotPolicy,
      },
    };
  }

  const sentAt = Date.now();
  const sentBatch = db.batch();
  sentBatch.set(
    noticeRef,
    {
      sentAt,
      deliveryStatus: "sent",
      updatedAt: sentAt,
    },
    { merge: true }
  );
  await appendLeaseWorkflowEvent({
    batch: sentBatch,
    entityType: "leaseNotice",
    entityId: noticeRef.id,
    leaseId,
    landlordId,
    tenantId: lease.tenantId,
    propertyId: lease.propertyId,
    unitId: lease.unitId,
    actorType: "landlord",
    actorId,
    eventType: "lease_notice_sent",
    eventData: {
      deliveryStatus: "sent",
      noticeType: baseNotice.noticeType,
    },
  });
  await appendLeaseWorkflowEvent({
    batch: sentBatch,
    entityType: "lease",
    entityId: leaseId,
    leaseId,
    landlordId,
    tenantId: lease.tenantId,
    propertyId: lease.propertyId,
    unitId: lease.unitId,
    actorType: "system",
    actorId: null,
    eventType: "landlord_notified",
    eventData: {
      kind: "notice_send_success",
      noticeId: noticeRef.id,
    },
  });
  await sentBatch.commit();

  console.info("[lease-notice] sent", {
    leaseId,
    noticeId: noticeRef.id,
    landlordId,
    tenantId: lease.tenantId,
    propertyId: lease.propertyId,
    unitId: lease.unitId,
    deliveryStatus: "sent",
  });

  return {
    status: 201,
    payload: {
      ok: true,
      noticeId: noticeRef.id,
      delivery: emailResult,
      autopilotPolicy,
    },
  };
}

router.get("/expiring", async (req: any, res) => {
  try {
    const landlordId = String(req.user?.landlordId || req.user?.id || "").trim();
    const withinDays = Math.max(1, Number(req.query?.withinDays || 120));
    const now = Date.now();
    const horizon = now + withinDays * 24 * 60 * 60 * 1000;
    const snap = await db.collection("leases").where("landlordId", "==", landlordId).limit(400).get();
    const items = snap.docs
      .map((doc) => normalizeLeaseRecord(doc.id, doc.data() as any))
      .filter((lease) => lease.status === "active" || lease.status === "notice_pending" || lease.status === "renewal_pending")
      .filter((lease) => !!lease.nextNoticeDueAt && Number(lease.nextNoticeDueAt) <= horizon)
      .sort((a, b) => Number(a.nextNoticeDueAt || 0) - Number(b.nextNoticeDueAt || 0));

    console.info("[lease-notice] expiring-list", {
      landlordId,
      withinDays,
      count: items.length,
    });

    return res.json({ ok: true, items, data: items });
  } catch (err: any) {
    console.error("[lease-notice] expiring-list failed", { message: err?.message || "failed" });
    return res.status(500).json({ ok: false, error: "LEASE_EXPIRING_LIST_FAILED" });
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
