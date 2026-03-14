import { db } from "../config/firebase";
import { buildEmailHtml, buildEmailText } from "../email/templates/baseEmailTemplate";
import { sendEmail } from "./emailService";
import {
  type LeaseNoticeRule,
  type LeaseNoticeType,
  type LeaseType,
  type RentChangeMode,
  resolveLeaseNoticeRule,
} from "../config/leaseNoticeRules";

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type LeaseWorkflowEventType =
  | "lease_notice_due"
  | "lease_notice_preview_generated"
  | "lease_notice_sent"
  | "tenant_viewed_notice"
  | "tenant_renewed"
  | "tenant_quit"
  | "tenant_no_response"
  | "landlord_notified";

export type LeaseNoticeDeliveryStatus = "pending" | "sent" | "failed" | "viewed";
export type LeaseNoticeTenantResponse = "pending" | "renew" | "quit" | "declined" | "no_response";

export type LeaseWorkflowLease = {
  id: string;
  landlordId: string;
  tenantId: string;
  propertyId: string | null;
  unitId: string | null;
  status: string;
  leaseType: LeaseType;
  province: string;
  leaseStartDate: string | null;
  leaseEndDate: string | null;
  currentRent: number | null;
  currency: string;
  autoNoticeEnabled: boolean;
  noticeRuleVersion: string | null;
  noticeLeadDays: number | null;
  nextNoticeDueAt: number | null;
  latestNoticeId: string | null;
  latestRenewalIntent: string | null;
  latestRenewalIntentAt: number | null;
  renewalOfferedRent: number | null;
  renewalDecisionDeadlineAt: number | null;
  moveOutDate: string | null;
  createdAt: number;
  updatedAt: number;
  tenantName: string | null;
  unitLabel: string | null;
  propertyLabel: string | null;
};

export type LeaseNoticePreviewInput = {
  rentChangeMode: RentChangeMode;
  proposedRent?: number | null;
  newTermType: LeaseType;
  newLeaseStartDate: string;
  newLeaseEndDate?: string | null;
  responseDeadlineAt: number;
  noticeType?: LeaseNoticeType;
};

function nowMs() {
  return Date.now();
}

function toMillis(value: unknown): number | null {
  if (value == null || value === "") return null;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const raw = String(value || "").trim();
  if (!raw) return null;
  if (/^\d+$/.test(raw)) {
    const numeric = Number(raw);
    return Number.isFinite(numeric) ? numeric : null;
  }
  const parsed = Date.parse(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

function toDateOnly(value: unknown): string | null {
  const raw = String(value || "").trim();
  if (!raw) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const ts = Date.parse(raw);
  if (!Number.isFinite(ts)) return null;
  return new Date(ts).toISOString().slice(0, 10);
}

function minusDays(dateOnly: string, days: number): number | null {
  const parsed = Date.parse(`${dateOnly}T00:00:00.000Z`);
  if (!Number.isFinite(parsed)) return null;
  return parsed - days * 24 * 60 * 60 * 1000;
}

function asCurrency(value: unknown): string {
  const raw = String(value || "CAD").trim().toUpperCase();
  return raw || "CAD";
}

function asLeaseType(value: unknown): LeaseType {
  const raw = String(value || "").trim().toLowerCase();
  if (raw === "fixed_term" || raw === "year_to_year" || raw === "month_to_month") return raw;
  return "fixed_term";
}

function determineNoticeType(lease: LeaseWorkflowLease): LeaseNoticeType {
  if (lease.leaseType === "month_to_month") return "month_to_month_notice";
  return "renewal_offer";
}

export function normalizeLeaseRecord(id: string, raw: any): LeaseWorkflowLease {
  const leaseEndDate =
    toDateOnly(raw?.leaseEndDate || raw?.endDate || raw?.leaseEnd || raw?.end_date || null) || null;
  const leaseType = asLeaseType(raw?.leaseType || raw?.termType || raw?.lease_type || null);
  const province = String(raw?.province || raw?.jurisdiction || "").trim().toUpperCase() || "NS";
  const rule = resolveLeaseNoticeRule({ province, leaseType });
  const nextNoticeDueAt =
    toMillis(raw?.nextNoticeDueAt) || (leaseEndDate && rule ? minusDays(leaseEndDate, rule.noticeLeadDays) : null);
  const createdAt = toMillis(raw?.createdAt) || nowMs();
  const updatedAt = toMillis(raw?.updatedAt) || createdAt;
  return {
    id,
    landlordId: String(raw?.landlordId || raw?.ownerId || "").trim(),
    tenantId: String(raw?.tenantId || "").trim(),
    propertyId: String(raw?.propertyId || "").trim() || null,
    unitId:
      String(raw?.unitId || raw?.unit || raw?.unitNumber || "").trim() || null,
    status: String(raw?.status || "active").trim().toLowerCase() || "active",
    leaseType,
    province,
    leaseStartDate:
      toDateOnly(raw?.leaseStartDate || raw?.startDate || raw?.leaseStart || null) || null,
    leaseEndDate,
    currentRent:
      typeof raw?.currentRent === "number"
        ? raw.currentRent
        : typeof raw?.monthlyRent === "number"
        ? raw.monthlyRent
        : typeof raw?.rentAmount === "number"
        ? raw.rentAmount
        : null,
    currency: asCurrency(raw?.currency),
    autoNoticeEnabled: Boolean(raw?.autoNoticeEnabled || false),
    noticeRuleVersion: String(raw?.noticeRuleVersion || rule?.ruleVersion || "").trim() || null,
    noticeLeadDays:
      typeof raw?.noticeLeadDays === "number"
        ? raw.noticeLeadDays
        : rule?.noticeLeadDays ?? null,
    nextNoticeDueAt,
    latestNoticeId: String(raw?.latestNoticeId || "").trim() || null,
    latestRenewalIntent: String(raw?.latestRenewalIntent || "").trim() || null,
    latestRenewalIntentAt: toMillis(raw?.latestRenewalIntentAt),
    renewalOfferedRent:
      typeof raw?.renewalOfferedRent === "number" ? raw.renewalOfferedRent : null,
    renewalDecisionDeadlineAt: toMillis(raw?.renewalDecisionDeadlineAt),
    moveOutDate: toDateOnly(raw?.moveOutDate || null),
    createdAt,
    updatedAt,
    tenantName: String(raw?.tenantName || raw?.residentName || "").trim() || null,
    unitLabel: String(raw?.unitLabel || raw?.unitNumber || raw?.unit || "").trim() || null,
    propertyLabel: String(raw?.propertyLabel || raw?.propertyName || "").trim() || null,
  };
}

export async function getLeaseForLandlordWorkflow(leaseId: string, landlordId: string) {
  const snap = await db.collection("leases").doc(leaseId).get();
  if (!snap.exists) return { ok: false as const, status: 404, error: "LEASE_NOT_FOUND" };
  const lease = normalizeLeaseRecord(snap.id, snap.data() as any);
  if (lease.landlordId !== landlordId) {
    return { ok: false as const, status: 403, error: "FORBIDDEN" };
  }
  return { ok: true as const, lease };
}

export async function getLeaseForTenantWorkflow(noticeId: string, tenantId: string) {
  const snap = await db.collection("leaseNotices").doc(noticeId).get();
  if (!snap.exists) return { ok: false as const, status: 404, error: "NOT_FOUND" };
  const notice = { id: snap.id, ...(snap.data() as any) };
  const canonicalTenantId = String(tenantId || "").trim();
  const noticeTenantId = String(notice.tenantId || "").trim();
  let leaseTenantId = "";
  const leaseId = String(notice.leaseId || "").trim();

  if (leaseId) {
    try {
      const leaseSnap = await db.collection("leases").doc(leaseId).get();
      if (leaseSnap.exists) {
        leaseTenantId = normalizeLeaseRecord(leaseSnap.id, leaseSnap.data() as any).tenantId;
      }
    } catch (err: any) {
      console.warn("[lease-notice] tenant-access lease lookup failed", {
        noticeId,
        leaseId,
        message: err?.message || "failed",
      });
    }
  }

  const authorized = [noticeTenantId, leaseTenantId].filter(Boolean).includes(canonicalTenantId);
  if (!authorized) {
    console.warn("[lease-notice] tenant-access forbidden", {
      noticeId,
      leaseId: leaseId || null,
      requestTenantId: canonicalTenantId || null,
      noticeTenantId: noticeTenantId || null,
      leaseTenantId: leaseTenantId || null,
    });
    return { ok: false as const, status: 403, error: "FORBIDDEN" };
  }

  if (!noticeTenantId && leaseTenantId) {
    notice.tenantId = leaseTenantId;
  }
  return { ok: true as const, notice };
}

export function buildPreview(lease: LeaseWorkflowLease, input: LeaseNoticePreviewInput) {
  const rule = resolveLeaseNoticeRule({ province: lease.province, leaseType: lease.leaseType });
  if (!rule) {
    return { ok: false as const, error: "RULE_NOT_SUPPORTED" };
  }
  const noticeType = input.noticeType || determineNoticeType(lease);
  if (!rule.allowedNoticeTypes.includes(noticeType)) {
    return { ok: false as const, error: "NOTICE_TYPE_NOT_ALLOWED" };
  }
  if (!["no_change", "increase", "decrease", "undecided"].includes(input.rentChangeMode)) {
    return { ok: false as const, error: "INVALID_RENT_CHANGE_MODE" };
  }
  const proposedRent = input.proposedRent ?? null;
  if ((input.rentChangeMode === "increase" || input.rentChangeMode === "decrease") && !(typeof proposedRent === "number" && Number.isFinite(proposedRent) && proposedRent > 0)) {
    return { ok: false as const, error: "PROPOSED_RENT_REQUIRED" };
  }
  if (input.rentChangeMode === "undecided" && !rule.allowUndecidedRent) {
    return { ok: false as const, error: "UNDECIDED_RENT_NOT_ALLOWED" };
  }
  const newLeaseStartDate = toDateOnly(input.newLeaseStartDate);
  const newLeaseEndDate = toDateOnly(input.newLeaseEndDate || null);
  if (!newLeaseStartDate) {
    return { ok: false as const, error: "NEW_LEASE_START_DATE_REQUIRED" };
  }
  if (rule.requireTermDates && !newLeaseEndDate) {
    return { ok: false as const, error: "NEW_LEASE_END_DATE_REQUIRED" };
  }
  const responseDeadlineAt = toMillis(input.responseDeadlineAt);
  if (!responseDeadlineAt) {
    return { ok: false as const, error: "RESPONSE_DEADLINE_REQUIRED" };
  }
  const noticeDueAt = lease.nextNoticeDueAt || (lease.leaseEndDate ? minusDays(lease.leaseEndDate, rule.noticeLeadDays) : null);
  const effectiveProposedRent =
    input.rentChangeMode === "no_change"
      ? lease.currentRent
      : input.rentChangeMode === "undecided"
      ? null
      : proposedRent;
  const preview = {
    leaseId: lease.id,
    landlordId: lease.landlordId,
    tenantId: lease.tenantId,
    propertyId: lease.propertyId,
    unitId: lease.unitId,
    province: lease.province,
    leaseType: lease.leaseType,
    legalTemplateKey: rule.templateKey,
    noticeRuleVersion: rule.ruleVersion,
    noticeType,
    noticeDueAt,
    rentChangeMode: input.rentChangeMode,
    currentRent: lease.currentRent,
    proposedRent: effectiveProposedRent,
    newTermType: input.newTermType,
    newTermStartDate: newLeaseStartDate,
    newTermEndDate: newLeaseEndDate,
    responseRequired: true,
    responseDeadlineAt,
    summary: {
      title: "Lease notice preview",
      body:
        input.rentChangeMode === "undecided"
          ? "Rent will be decided later by the landlord."
          : effectiveProposedRent != null
          ? `Proposed rent: ${effectiveProposedRent} ${lease.currency}`
          : "No rent change provided.",
    },
  };
  return { ok: true as const, rule, preview };
}

export async function appendLeaseWorkflowEvent(input: {
  batch?: FirebaseFirestore.WriteBatch;
  entityType: "lease" | "leaseNotice";
  entityId: string;
  leaseId: string;
  landlordId: string;
  tenantId: string;
  propertyId?: string | null;
  unitId?: string | null;
  actorType: "system" | "landlord" | "tenant" | "admin";
  actorId?: string | null;
  eventType: LeaseWorkflowEventType;
  eventData?: Record<string, unknown>;
}) {
  const ref = db.collection("leaseWorkflowEvents").doc();
  const payload = {
    id: ref.id,
    entityType: input.entityType,
    entityId: input.entityId,
    leaseId: input.leaseId,
    landlordId: input.landlordId,
    tenantId: input.tenantId,
    propertyId: input.propertyId || null,
    unitId: input.unitId || null,
    actorType: input.actorType,
    actorId: input.actorId || null,
    eventType: input.eventType,
    eventData: input.eventData || {},
    createdAt: nowMs(),
  };
  if (input.batch) {
    input.batch.set(ref, payload);
  } else {
    await ref.set(payload);
  }
  return payload;
}

export async function sendLeaseWorkflowEmail(input: {
  eventKey: string;
  to: string | null;
  subject: string;
  intro: string;
  ctaText: string;
  ctaUrl: string;
  leaseId: string;
  noticeId?: string | null;
  landlordId: string;
  tenantId: string;
  propertyId?: string | null;
  unitId?: string | null;
}) {
  const provider = String(process.env.EMAIL_PROVIDER || "mailgun").trim().toLowerCase() || "mailgun";
  const to = String(input.to || "").trim().toLowerCase();
  const from =
    String(process.env.EMAIL_FROM || process.env.FROM_EMAIL || "").trim() ||
    String(process.env.SENDGRID_FROM_EMAIL || process.env.SENDGRID_FROM || "").trim();

  console.info("[lease-notice] email-attempt", {
    eventKey: input.eventKey,
    leaseId: input.leaseId,
    noticeId: input.noticeId || null,
    landlordId: input.landlordId,
    tenantId: input.tenantId,
    propertyId: input.propertyId || null,
    unitId: input.unitId || null,
    to: to || null,
    provider,
  });

  if (!to || !emailRegex.test(to)) {
    console.warn("[lease-notice] email-skipped", {
      eventKey: input.eventKey,
      leaseId: input.leaseId,
      noticeId: input.noticeId || null,
      reason: "INVALID_RECIPIENT",
      to: to || null,
      provider,
    });
    return { ok: false as const, attempted: false, reason: "INVALID_RECIPIENT", provider };
  }
  if (!from) {
    console.error("[lease-notice] email-failed", {
      eventKey: input.eventKey,
      leaseId: input.leaseId,
      noticeId: input.noticeId || null,
      reason: "EMAIL_FROM_MISSING",
      provider,
    });
    return { ok: false as const, attempted: false, reason: "EMAIL_FROM_MISSING", provider };
  }

  try {
    await sendEmail({
      to,
      from,
      subject: input.subject,
      text: buildEmailText({
        intro: input.intro,
        ctaText: input.ctaText,
        ctaUrl: input.ctaUrl,
      }),
      html: buildEmailHtml({
        title: input.subject,
        intro: input.intro,
        ctaText: input.ctaText,
        ctaUrl: input.ctaUrl,
      }),
    });
    console.info("[lease-notice] email-sent", {
      eventKey: input.eventKey,
      leaseId: input.leaseId,
      noticeId: input.noticeId || null,
      to,
      provider,
    });
    return { ok: true as const, attempted: true, provider };
  } catch (err: any) {
    console.error("[lease-notice] email-failed", {
      eventKey: input.eventKey,
      leaseId: input.leaseId,
      noticeId: input.noticeId || null,
      to,
      provider,
      message: err?.message || "SEND_FAILED",
    });
    return {
      ok: false as const,
      attempted: true,
      reason: err?.message || "SEND_FAILED",
      provider,
    };
  }
}

export async function lookupUserEmail(id: string | null | undefined, collections: string[]) {
  const target = String(id || "").trim();
  if (!target) return null;
  for (const collection of collections) {
    const snap = await db.collection(collection).doc(target).get();
    if (!snap.exists) continue;
    const email = String((snap.data() as any)?.email || "").trim().toLowerCase();
    if (emailRegex.test(email)) return email;
  }
  return null;
}

export async function getLeaseNoticeByLeaseId(leaseId: string) {
  const snap = await db
    .collection("leaseNotices")
    .where("leaseId", "==", leaseId)
    .limit(20)
    .get();
  const items = snap.docs
    .map((doc) => ({ id: doc.id, ...(doc.data() as any) }))
    .sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0));
  return items;
}

export function computeNoResponseState(notice: any) {
  const response = String(notice?.tenantResponse || "pending").trim().toLowerCase();
  const deadline = toMillis(notice?.responseDeadlineAt);
  return response === "pending" && !!deadline && deadline < nowMs();
}
