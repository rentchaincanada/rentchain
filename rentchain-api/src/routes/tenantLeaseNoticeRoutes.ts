import { Router } from "express";
import { authenticateJwt } from "../middleware/authMiddleware";
import { db } from "../firebase";
import { getLeaseNoticeWorkflowFlag } from "../config/leaseNoticeRules";
import {
  appendLeaseWorkflowEvent,
  computeNoResponseState,
  getLeaseForTenantWorkflow,
  lookupUserEmail,
  sendLeaseWorkflowEmail,
} from "../services/leaseNoticeWorkflowService";
import {
  deriveTenantSafeProjectionMetadata,
  deriveTenantSafeSourceRefs,
  type TenantSafeProjectionSourceReference,
} from "../services/tenantPortal/tenantSafeProjectionContract";

const router = Router();
router.use(authenticateJwt);

function requireLeaseNoticeFeature(req: any, res: any, next: any) {
  const flag = getLeaseNoticeWorkflowFlag();
  if (!flag.enabled) {
    return res.status(404).json({ ok: false, error: "FEATURE_DISABLED", source: flag.source });
  }
  return next();
}

function getCanonicalTenantId(req: any) {
  return String(req.user?.tenantId || "").trim();
}

function requireTenant(req: any, res: any, next: any) {
  const role = String(req.user?.role || "").trim().toLowerCase();
  const tenantId = getCanonicalTenantId(req);
  if (role !== "tenant" || !tenantId) {
    return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });
  }
  return next();
}

router.use(requireLeaseNoticeFeature, requireTenant);

function appBaseUrl() {
  return String(process.env.PUBLIC_APP_URL || process.env.VITE_PUBLIC_APP_URL || "https://www.rentchain.ai").replace(/\/$/, "");
}

function uniqueSourceCollections(sourceRefs: TenantSafeProjectionSourceReference[]) {
  return Array.from(new Set(sourceRefs.map((item) => item.sourceCollection))).sort((a, b) => a.localeCompare(b));
}

function buildLeaseNoticeProjectionMetadata(notice: any) {
  const sourceRefs = deriveTenantSafeSourceRefs({
    leaseId: String(notice?.leaseId || "").trim() || null,
    propertyId: String(notice?.propertyId || "").trim() || null,
    unitId: String(notice?.unitId || "").trim() || null,
    tenantId: String(notice?.tenantId || "").trim() || null,
  });
  const noticeId = String(notice?.id || "").trim();
  if (noticeId) sourceRefs.push({ sourceCollection: "leaseNotices", sourceId: noticeId });
  const sourceCollections = uniqueSourceCollections(sourceRefs);
  const metadata = deriveTenantSafeProjectionMetadata({
    projectionName: "tenant_safe_lease_notice_projection",
    scopeType: "tenant_lease_notice",
    sourceCollections,
    relationshipBasis: "Lease notice projection must be derived from the authenticated tenant's lease notice relationship.",
  });
  return { ...metadata, sourceCollections, sourceRefs };
}

function projectTenantLeaseNotice(notice: any) {
  const projected = {
    id: String(notice?.id || "").trim(),
    leaseId: String(notice?.leaseId || "").trim(),
    landlordId: String(notice?.landlordId || "").trim() || null,
    tenantId: String(notice?.tenantId || "").trim() || null,
    propertyId: String(notice?.propertyId || "").trim() || null,
    unitId: String(notice?.unitId || "").trim() || null,
    noticeType: String(notice?.noticeType || "").trim() || "lease_notice",
    legalTemplateKey: String(notice?.legalTemplateKey || "").trim() || null,
    province: String(notice?.province || "").trim() || null,
    leaseType: String(notice?.leaseType || "").trim() || null,
    noticeDueAt: typeof notice?.noticeDueAt === "number" ? notice.noticeDueAt : null,
    sentAt: typeof notice?.sentAt === "number" ? notice.sentAt : null,
    deliveryStatus: String(notice?.deliveryStatus || "pending").trim() || "pending",
    deliveryChannel: String(notice?.deliveryChannel || "").trim() || null,
    rentChangeMode: String(notice?.rentChangeMode || "no_change").trim() || "no_change",
    currentRent: typeof notice?.currentRent === "number" ? notice.currentRent : null,
    proposedRent: typeof notice?.proposedRent === "number" ? notice.proposedRent : null,
    newTermType: String(notice?.newTermType || "").trim() || null,
    newTermStartDate: String(notice?.newTermStartDate || "").trim() || null,
    newTermEndDate: String(notice?.newTermEndDate || "").trim() || null,
    responseRequired: notice?.responseRequired !== false,
    responseDeadlineAt: typeof notice?.responseDeadlineAt === "number" ? notice.responseDeadlineAt : null,
    tenantResponse: String(notice?.tenantResponse || "pending").trim() || "pending",
    tenantRespondedAt: typeof notice?.tenantRespondedAt === "number" ? notice.tenantRespondedAt : null,
    tenantViewedAt: typeof notice?.tenantViewedAt === "number" ? notice.tenantViewedAt : null,
    createdAt: typeof notice?.createdAt === "number" ? notice.createdAt : null,
    updatedAt: typeof notice?.updatedAt === "number" ? notice.updatedAt : null,
    metadata: {
      noticeRuleVersion: String(notice?.metadata?.noticeRuleVersion || "").trim() || null,
      summary: notice?.metadata?.summary
        ? {
            title: String(notice.metadata.summary.title || "").trim() || null,
            body: String(notice.metadata.summary.body || "").trim() || null,
          }
        : null,
    },
  };
  return { ...buildLeaseNoticeProjectionMetadata(projected), ...projected };
}

function buildLeaseNoticeCollectionMetadata(tenantId: string, items: any[]) {
  const sourceRefs = deriveTenantSafeSourceRefs({ tenantId });
  for (const item of items) {
    const noticeId = String(item?.id || "").trim();
    if (noticeId) sourceRefs.push({ sourceCollection: "leaseNotices", sourceId: noticeId });
  }
  const sourceCollections = uniqueSourceCollections(sourceRefs);
  const metadata = deriveTenantSafeProjectionMetadata({
    projectionName: "tenant_safe_lease_notice_projection",
    scopeType: "tenant_lease_notice",
    sourceCollections,
    relationshipBasis: "Lease notice list projection must be scoped to the authenticated tenant's notice records.",
  });
  return { ...metadata, sourceCollections, sourceRefs };
}

router.get("/", async (req: any, res) => {
  try {
    const tenantId = getCanonicalTenantId(req);
    const snap = await db.collection("leaseNotices").where("tenantId", "==", tenantId).limit(50).get();
    const items = snap.docs
      .map((doc) => ({ id: doc.id, ...(doc.data() as any) }))
      .sort((a, b) => Number(b.updatedAt || 0) - Number(a.updatedAt || 0));
    const projectedItems = items.map(projectTenantLeaseNotice);
    return res.json({
      ok: true,
      ...buildLeaseNoticeCollectionMetadata(tenantId, projectedItems),
      items: projectedItems,
      data: projectedItems,
    });
  } catch (err: any) {
    console.error("[lease-notice] tenant-list failed", { message: err?.message || "failed" });
    return res.status(500).json({ ok: false, error: "TENANT_LEASE_NOTICE_LIST_FAILED" });
  }
});

router.get("/:id", async (req: any, res) => {
  try {
    const tenantId = getCanonicalTenantId(req);
    const noticeId = String(req.params?.id || "").trim();
    const noticeResult = await getLeaseForTenantWorkflow(noticeId, tenantId);
    if (!noticeResult.ok) {
      return res.status(noticeResult.status).json({ ok: false, error: noticeResult.error });
    }

    const notice = noticeResult.notice;
    if (!notice.tenantViewedAt) {
      const now = Date.now();
      const batch = db.batch();
      batch.set(
        db.collection("leaseNotices").doc(noticeId),
        {
          tenantViewedAt: now,
          deliveryStatus: notice.deliveryStatus === "sent" ? "viewed" : notice.deliveryStatus,
          updatedAt: now,
        },
        { merge: true }
      );
      await appendLeaseWorkflowEvent({
        batch,
        entityType: "leaseNotice",
        entityId: noticeId,
        leaseId: String(notice.leaseId || "").trim(),
        landlordId: String(notice.landlordId || "").trim(),
        tenantId,
        propertyId: String(notice.propertyId || "").trim() || null,
        unitId: String(notice.unitId || "").trim() || null,
        actorType: "tenant",
        actorId: tenantId,
        eventType: "tenant_viewed_notice",
        eventData: {},
      });
      await batch.commit();
      console.info("[lease-notice] viewed", {
        leaseId: notice.leaseId,
        noticeId,
        landlordId: notice.landlordId,
        tenantId,
        propertyId: notice.propertyId || null,
        unitId: notice.unitId || null,
      });
      notice.tenantViewedAt = now;
      notice.deliveryStatus = notice.deliveryStatus === "sent" ? "viewed" : notice.deliveryStatus;
    }

    const projectedNotice = projectTenantLeaseNotice(notice);
    return res.json({
      ok: true,
      ...buildLeaseNoticeProjectionMetadata(projectedNotice),
      item: projectedNotice,
      data: projectedNotice,
      noResponse: computeNoResponseState(notice),
    });
  } catch (err: any) {
    console.error("[lease-notice] tenant-detail failed", { message: err?.message || "failed" });
    return res.status(500).json({ ok: false, error: "TENANT_LEASE_NOTICE_GET_FAILED" });
  }
});

router.post("/:id/respond", async (req: any, res) => {
  try {
    const tenantId = getCanonicalTenantId(req);
    const actorId = String(req.user?.id || tenantId || "").trim() || tenantId;
    const noticeId = String(req.params?.id || "").trim();
    const decision = String(req.body?.decision || "").trim().toLowerCase();
    if (decision !== "renew" && decision !== "quit") {
      return res.status(400).json({ ok: false, error: "INVALID_DECISION" });
    }

    const noticeResult = await getLeaseForTenantWorkflow(noticeId, tenantId);
    if (!noticeResult.ok) {
      return res.status(noticeResult.status).json({ ok: false, error: noticeResult.error });
    }
    const notice = noticeResult.notice;
    if (String(notice.tenantResponse || "pending").trim().toLowerCase() !== "pending") {
      return res.status(409).json({ ok: false, error: "NOTICE_ALREADY_RESPONDED" });
    }

    const leaseId = String(notice.leaseId || "").trim();
    const leaseRef = db.collection("leases").doc(leaseId);
    const leaseSnap = await leaseRef.get();
    const leaseData = leaseSnap.exists ? (leaseSnap.data() as any) : null;
    const leaseEndDate =
      String(
        leaseData?.leaseEndDate ||
          leaseData?.endDate ||
          leaseData?.leaseEnd ||
          leaseData?.end_date ||
          ""
      ).trim() || null;
    const now = Date.now();
    const batch = db.batch();
    batch.set(
      db.collection("leaseNotices").doc(noticeId),
      {
        tenantResponse: decision,
        tenantRespondedAt: now,
        updatedAt: now,
      },
      { merge: true }
    );
    batch.set(
      leaseRef,
      {
        latestRenewalIntent: decision,
        latestRenewalIntentAt: now,
        moveOutDate: decision === "quit" ? leaseEndDate : null,
        status: decision === "renew" ? "renewal_accepted" : "move_out_pending",
        updatedAt: now,
      },
      { merge: true }
    );
    await appendLeaseWorkflowEvent({
      batch,
      entityType: "leaseNotice",
      entityId: noticeId,
      leaseId,
      landlordId: String(notice.landlordId || "").trim(),
      tenantId,
      propertyId: String(notice.propertyId || "").trim() || null,
      unitId: String(notice.unitId || "").trim() || null,
      actorType: "tenant",
      actorId,
      eventType: decision === "renew" ? "tenant_renewed" : "tenant_quit",
      eventData: {
        noticeId,
        response: decision,
      },
    });
    await batch.commit();

    const landlordEmail = await lookupUserEmail(String(notice.landlordId || "").trim(), ["users", "accounts", "landlords"]);
    const landlordUrl = `${appBaseUrl()}/dashboard`;
    const notification = await sendLeaseWorkflowEmail({
      eventKey:
        decision === "renew"
          ? "lease_notice_response_renew_landlord"
          : "lease_notice_response_quit_landlord",
      to: landlordEmail,
      subject:
        decision === "renew"
          ? "Tenant chose to begin a new term"
          : "Tenant chose to quit at the end of the current term",
      intro:
        decision === "renew"
          ? "Your tenant responded to the lease notice and chose to begin a new term."
          : "Your tenant responded to the lease notice and chose to quit at the end of the current term.",
      ctaText: "Open RentChain",
      ctaUrl: landlordUrl,
      leaseId,
      noticeId,
      landlordId: String(notice.landlordId || "").trim(),
      tenantId,
      propertyId: String(notice.propertyId || "").trim() || null,
      unitId: String(notice.unitId || "").trim() || null,
    });

    await appendLeaseWorkflowEvent({
      entityType: "lease",
      entityId: leaseId,
      leaseId,
      landlordId: String(notice.landlordId || "").trim(),
      tenantId,
      propertyId: String(notice.propertyId || "").trim() || null,
      unitId: String(notice.unitId || "").trim() || null,
      actorType: "system",
      actorId: null,
      eventType: "landlord_notified",
      eventData: {
        noticeId,
        response: decision,
        notification,
      },
    });

    console.info("[lease-notice] tenant-responded", {
      leaseId,
      noticeId,
      landlordId: notice.landlordId,
      tenantId,
      propertyId: notice.propertyId || null,
      unitId: notice.unitId || null,
      response: decision,
    });

    return res.json({
      ok: true,
      ...buildLeaseNoticeProjectionMetadata({ ...notice, tenantResponse: decision, tenantRespondedAt: now, updatedAt: now }),
      decision,
      noticeId,
      leaseId,
      landlordNotification: {
        ok: notification?.ok,
        attempted: notification?.attempted,
        reason: notification?.reason || null,
      },
      nextStatus: decision === "renew" ? "renewal_accepted" : "move_out_pending",
    });
  } catch (err: any) {
    console.error("[lease-notice] tenant-respond failed", { message: err?.message || "failed" });
    return res.status(500).json({ ok: false, error: "TENANT_LEASE_NOTICE_RESPOND_FAILED" });
  }
});

export default router;
