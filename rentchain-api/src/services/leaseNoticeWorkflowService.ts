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
import {
  getJurisdictionWorkflowConfig,
  toJurisdictionWorkflowSummary,
  type JurisdictionWorkflowSummary,
} from "../lib/jurisdiction/leaseWorkflowRegistry";
import { toAutopilotPolicySummary } from "../lib/policy/policyEvaluator";
import { loadUnitsForProperty, resolveUnitReference } from "./leaseCanonicalizationService";
import { isTargetedHiddenLeaseId } from "../lib/testDataVisibilityTargets";
import { composeLeaseNoticeLegalDocument } from "../lib/legalDocuments/leaseNoticeComposition";

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
  renewalRentChangeMode: RentChangeMode | null;
  renewalOfferedRent: number | null;
  renewalDecisionDeadlineAt: number | null;
  renewalNewTermType: LeaseType | null;
  renewalNewLeaseStartDate: string | null;
  renewalNewLeaseEndDate: string | null;
  moveOutDate: string | null;
  createdAt: number;
  updatedAt: number;
  tenantName: string | null;
  unitLabel: string | null;
  propertyLabel: string | null;
  propertyAddress: string | null;
  jurisdictionWorkflow: JurisdictionWorkflowSummary | null;
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

export type LeaseNoticeSendResult = {
  status: number;
  payload: {
    ok: boolean;
    error?: string;
    noticeId?: string;
    delivery?: {
      ok?: boolean;
      attempted?: boolean;
      provider?: string | null;
      reason?: string | null;
    } | null;
    autopilotPolicy: ReturnType<typeof toAutopilotPolicySummary>;
  };
};

export type LeaseNoticeExecutionInputState = "none" | "partial" | "complete";
export type LeaseNoticeExecutionInputMissingField =
  | "rentChangeMode"
  | "proposedRent"
  | "newTermType"
  | "newLeaseStartDate"
  | "newLeaseEndDate"
  | "responseDeadlineAt";

export type LeaseNoticeExecutionInputSnapshot = {
  noticeType: LeaseNoticeType | null;
  legalTemplateKey: string | null;
  noticeRuleVersion: string | null;
  province: string | null;
  leaseType: LeaseType | null;
  currentRent: number | null;
  noticeDueAt: number | null;
  rentChangeMode: RentChangeMode | null;
  proposedRent: number | null;
  newTermType: LeaseType | null;
  newLeaseStartDate: string | null;
  newLeaseEndDate: string | null;
  responseDeadlineAt: number | null;
};

export type LeaseRenewalWorkflowBucket = "expiring" | "pending-response" | "no-response";

export type LandlordVisibleExpiringLeaseItem = LeaseWorkflowLease & {
  noticeBucket: LeaseRenewalWorkflowBucket;
  latestNotice: any | null;
};

type FirestoreLikeDoc = {
  id: string;
  data(): any;
};

type NormalizedLeaseCandidate = {
  id: string;
  raw: any;
  lease: LeaseWorkflowLease;
};

export type LeaseRenewalOperatorInputRecord = {
  rentChangeMode: RentChangeMode | null;
  proposedRent: number | null;
  newTermType: LeaseType | null;
  newLeaseStartDate: string | null;
  newLeaseEndDate: string | null;
  responseDeadlineAt: number | null;
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

function normalizePortfolioStatus(value: unknown): "active" | "archived" {
  return String(value || "").trim().toLowerCase() === "archived" ? "archived" : "active";
}

function normalizeStatus(value: unknown): string {
  return String(value || "").trim().toLowerCase();
}

function resolveUnitOccupancyStatus(unit: Record<string, unknown> | null | undefined): "occupied" | "vacant" | null {
  const explicitStatus = normalizeStatus(unit?.status);
  if (explicitStatus === "occupied" || explicitStatus === "vacant") {
    return explicitStatus;
  }
  const occupancyStatus = normalizeStatus(unit?.occupancyStatus);
  if (occupancyStatus === "occupied" || occupancyStatus === "vacant") {
    return occupancyStatus;
  }
  return null;
}

function asLeaseType(value: unknown): LeaseType {
  const raw = String(value || "").trim().toLowerCase();
  if (raw === "fixed_term" || raw === "year_to_year" || raw === "month_to_month") return raw;
  return "fixed_term";
}

function asOptionalLeaseType(value: unknown): LeaseType | null {
  const raw = String(value || "").trim().toLowerCase();
  if (raw === "fixed_term" || raw === "year_to_year" || raw === "month_to_month") return raw;
  return null;
}

function determineNoticeType(lease: LeaseWorkflowLease): LeaseNoticeType {
  if (lease.leaseType === "month_to_month") return "month_to_month_notice";
  return "renewal_offer";
}

function addMissingField(target: Set<string>, field: string, condition: boolean) {
  if (!condition) target.add(field);
}

function asRentChangeMode(value: unknown): RentChangeMode | null {
  const raw = String(value || "").trim().toLowerCase();
  if (raw === "no_change" || raw === "increase" || raw === "decrease" || raw === "undecided") {
    return raw;
  }
  return null;
}

function deriveRentChangeModeFromLease(lease: LeaseWorkflowLease): RentChangeMode | null {
  if (lease.renewalRentChangeMode) return lease.renewalRentChangeMode;
  if (typeof lease.renewalOfferedRent !== "number" || !Number.isFinite(lease.renewalOfferedRent) || lease.renewalOfferedRent <= 0) {
    return null;
  }
  if (typeof lease.currentRent !== "number" || !Number.isFinite(lease.currentRent) || lease.currentRent <= 0) {
    return null;
  }
  if (lease.renewalOfferedRent === lease.currentRent) return "no_change";
  if (lease.renewalOfferedRent > lease.currentRent) return "increase";
  return "decrease";
}

export function normalizeLeaseRecord(id: string, raw: any): LeaseWorkflowLease {
  const leaseEndDate =
    toDateOnly(raw?.leaseEndDate || raw?.endDate || raw?.leaseEnd || raw?.end_date || null) || null;
  const leaseType = asLeaseType(raw?.leaseType || raw?.termType || raw?.lease_type || null);
  const workflowConfig = getJurisdictionWorkflowConfig(raw?.province || raw?.jurisdiction || null);
  const province = workflowConfig?.province || String(raw?.province || raw?.jurisdiction || "").trim().toUpperCase() || "UNSET";
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
    renewalRentChangeMode: asRentChangeMode(raw?.renewalRentChangeMode),
    renewalOfferedRent:
      typeof raw?.renewalOfferedRent === "number" ? raw.renewalOfferedRent : null,
    renewalDecisionDeadlineAt: toMillis(raw?.renewalDecisionDeadlineAt),
    renewalNewTermType: asOptionalLeaseType(raw?.renewalNewTermType || raw?.newTermType || null),
    renewalNewLeaseStartDate: toDateOnly(raw?.renewalNewLeaseStartDate || raw?.newLeaseStartDate || null),
    renewalNewLeaseEndDate: toDateOnly(raw?.renewalNewLeaseEndDate || raw?.newLeaseEndDate || null),
    moveOutDate: toDateOnly(raw?.moveOutDate || null),
    createdAt,
    updatedAt,
    tenantName: String(raw?.tenantName || raw?.residentName || "").trim() || null,
    unitLabel: String(raw?.unitLabel || raw?.unitNumber || raw?.unit || "").trim() || null,
    propertyLabel: String(raw?.propertyLabel || raw?.propertyName || "").trim() || null,
    propertyAddress: String(raw?.propertyAddress || raw?.propertyAddressLine1 || raw?.addressLine1 || raw?.propertyAddress1 || raw?.address || "").trim() || null,
    jurisdictionWorkflow: workflowConfig ? toJurisdictionWorkflowSummary(workflowConfig) : null,
  };
}

function isLeaseRenewalWorkflowStatus(status: unknown) {
  const normalized = String(status || "").trim().toLowerCase();
  return normalized === "active" || normalized === "notice_pending" || normalized === "renewal_pending";
}

function toLeaseEndAt(lease: LeaseWorkflowLease | null | undefined): number {
  return toMillis(lease?.leaseEndDate) || 0;
}

function deriveLeaseRenewalWorkflowBucket(params: {
  lease: LeaseWorkflowLease;
  latestNotice: any | null;
}): LeaseRenewalWorkflowBucket {
  const { latestNotice } = params;
  const noResponse = latestNotice ? computeNoResponseState(latestNotice) : false;
  if (noResponse) return "no-response";
  const response = String(latestNotice?.tenantResponse || "").trim().toLowerCase();
  if (latestNotice && response === "pending") return "pending-response";
  return "expiring";
}

export async function deriveLandlordVisibleExpiringLeases(params: {
  landlordId: string;
  withinDays?: number;
  propertyId?: string | null;
  now?: number;
  leaseDocs?: FirestoreLikeDoc[];
  noticeDocs?: FirestoreLikeDoc[];
  propertyRecords?: Array<{ id: string; [key: string]: any }>;
}): Promise<LandlordVisibleExpiringLeaseItem[]> {
  const landlordId = String(params.landlordId || "").trim();
  if (!landlordId) return [];

  const now = typeof params.now === "number" ? params.now : nowMs();
  const withinDays = Math.max(1, Number(params.withinDays || 120));
  const horizon = now + withinDays * 24 * 60 * 60 * 1000;
  const propertyIdFilter = String(params.propertyId || "").trim() || null;

  const [leaseDocs, noticeDocs] = await Promise.all([
    params.leaseDocs
      ? Promise.resolve(params.leaseDocs)
      : db.collection("leases").where("landlordId", "==", landlordId).limit(400).get().then((snap) => snap.docs as any),
    params.noticeDocs
      ? Promise.resolve(params.noticeDocs)
      : db.collection("leaseNotices").where("landlordId", "==", landlordId).limit(400).get().then((snap) => snap.docs as any),
  ]);

  const normalizedLeases: NormalizedLeaseCandidate[] = leaseDocs
    .map((doc: any) => {
      const raw = doc.data() as any;
      return { id: doc.id, raw, lease: normalizeLeaseRecord(doc.id, raw) };
    })
    .filter(({ id, raw, lease }: NormalizedLeaseCandidate) => {
      if (raw?.hiddenFromActiveLists === true || isTargetedHiddenLeaseId(id)) return false;
      if (!isLeaseRenewalWorkflowStatus(lease.status)) return false;
      if (propertyIdFilter && lease.propertyId !== propertyIdFilter) return false;
      const leaseEndAt = toLeaseEndAt(lease);
      if (!(leaseEndAt > 0 && leaseEndAt <= horizon)) return false;
      return true;
    });

  const propertyIds = Array.from(
    new Set(
      normalizedLeases
        .map(({ lease }: NormalizedLeaseCandidate) => String(lease.propertyId || "").trim())
        .filter(Boolean)
    )
  );

  const propertyRecords = params.propertyRecords
    ? params.propertyRecords
    : await Promise.all(
        (propertyIds as string[]).map(async (id) => {
          const snap = await db.collection("properties").doc(id).get();
          return snap.exists ? { id: snap.id, ...(snap.data() as any) } : null;
        })
      ).then((items) => items.filter(Boolean) as Array<{ id: string; [key: string]: any }>);

  const propertyById = new Map<string, any>(
    propertyRecords.map((property) => [String(property?.id || "").trim(), property])
  );

  const unitsByPropertyId = new Map<string, Awaited<ReturnType<typeof loadUnitsForProperty>>>();
  for (const propertyId of propertyIds as string[]) {
    unitsByPropertyId.set(propertyId, await loadUnitsForProperty(db as any, propertyId, landlordId));
  }

  const latestNoticeByLeaseId = new Map<string, any>();
  const notices = noticeDocs
    .map((doc: any) => ({ id: doc.id, ...(doc.data() as any) }))
    .sort((a: any, b: any) => Number(b.updatedAt || b.createdAt || 0) - Number(a.updatedAt || a.createdAt || 0));
  for (const notice of notices) {
    const leaseId = String(notice?.leaseId || "").trim();
    if (!leaseId || latestNoticeByLeaseId.has(leaseId)) continue;
    latestNoticeByLeaseId.set(leaseId, notice);
  }

  const items: LandlordVisibleExpiringLeaseItem[] = [];
  for (const { lease, raw } of normalizedLeases) {
    const propertyId = String(lease.propertyId || "").trim();
    if (!propertyId) continue;
    const property = propertyById.get(propertyId);
    if (!property) continue;
    if (property?.hiddenFromActiveLists === true) continue;
    if (Boolean(property?.archivedAt) || normalizePortfolioStatus(property?.portfolioStatus) === "archived") continue;

    const units = unitsByPropertyId.get(propertyId) || [];
    const resolution = resolveUnitReference(units, lease.unitId || lease.unitLabel || raw?.unitNumber || raw?.unit || null);
    if (!resolution.unit || resolution.ambiguous) continue;
    if (resolution.unit.raw?.hiddenFromActiveLists === true) continue;
    if (resolveUnitOccupancyStatus(resolution.unit.raw) !== "occupied") continue;

    const latestNotice = latestNoticeByLeaseId.get(lease.id) || null;
    const noticeBucket = deriveLeaseRenewalWorkflowBucket({
      lease,
      latestNotice,
    });

    items.push({
      ...lease,
      propertyLabel:
        String(property?.name || property?.addressLine1 || property?.address || "").trim() ||
        lease.propertyLabel,
      propertyAddress:
        String(property?.addressLine1 || property?.address || "").trim() || lease.propertyAddress,
      unitLabel: resolution.unit.label || resolution.unit.unitNumber || lease.unitLabel,
      latestNotice,
      noticeBucket,
    });
  }

  return items.sort((a, b) => {
    const endDiff = toLeaseEndAt(a) - toLeaseEndAt(b);
    if (endDiff !== 0) return endDiff;
    const noticeDiff = Number(a.nextNoticeDueAt || 0) - Number(b.nextNoticeDueAt || 0);
    if (noticeDiff !== 0) return noticeDiff;
    return String(a.id || "").localeCompare(String(b.id || ""));
  });
}

export function deriveLeaseRenewalOperatorInputRecord(lease: LeaseWorkflowLease): LeaseRenewalOperatorInputRecord {
  return {
    rentChangeMode: deriveRentChangeModeFromLease(lease),
    proposedRent:
      typeof lease.renewalOfferedRent === "number" && Number.isFinite(lease.renewalOfferedRent) && lease.renewalOfferedRent > 0
        ? lease.renewalOfferedRent
        : null,
    newTermType: lease.renewalNewTermType || null,
    newLeaseStartDate: lease.renewalNewLeaseStartDate || null,
    newLeaseEndDate: lease.renewalNewLeaseEndDate || null,
    responseDeadlineAt: typeof lease.renewalDecisionDeadlineAt === "number" ? lease.renewalDecisionDeadlineAt : null,
  };
}

export function sanitizeLeaseRenewalOperatorInput(input: any): {
  ok: true;
  data: LeaseRenewalOperatorInputRecord;
} | {
  ok: false;
  error: string;
} {
  const rentChangeMode = asRentChangeMode(input?.rentChangeMode);
  const proposedRentRaw = input?.proposedRent;
  const proposedRent =
    proposedRentRaw == null || proposedRentRaw === ""
      ? null
      : typeof proposedRentRaw === "number" && Number.isFinite(proposedRentRaw) && proposedRentRaw > 0
      ? proposedRentRaw
      : Number.isFinite(Number(proposedRentRaw)) && Number(proposedRentRaw) > 0
      ? Number(proposedRentRaw)
      : NaN;
  if (Number.isNaN(proposedRent)) {
    return { ok: false, error: "INVALID_PROPOSED_RENT" };
  }

  const newTermTypeRaw = input?.newTermType;
  const newTermType =
    newTermTypeRaw == null || newTermTypeRaw === ""
      ? null
      : (() => {
          const value = String(newTermTypeRaw || "").trim().toLowerCase();
          if (value === "fixed_term" || value === "year_to_year" || value === "month_to_month") return value;
          return "__invalid__";
        })();
  if (newTermType === "__invalid__") {
    return { ok: false, error: "INVALID_NEW_TERM_TYPE" };
  }

  const newLeaseStartDate =
    input?.newLeaseStartDate == null || input?.newLeaseStartDate === "" ? null : toDateOnly(input?.newLeaseStartDate);
  if (input?.newLeaseStartDate != null && input?.newLeaseStartDate !== "" && !newLeaseStartDate) {
    return { ok: false, error: "INVALID_NEW_LEASE_START_DATE" };
  }

  const newLeaseEndDate =
    input?.newLeaseEndDate == null || input?.newLeaseEndDate === "" ? null : toDateOnly(input?.newLeaseEndDate);
  if (input?.newLeaseEndDate != null && input?.newLeaseEndDate !== "" && !newLeaseEndDate) {
    return { ok: false, error: "INVALID_NEW_LEASE_END_DATE" };
  }

  const responseDeadlineAt =
    input?.responseDeadlineAt == null || input?.responseDeadlineAt === "" ? null : toMillis(input?.responseDeadlineAt);
  if (input?.responseDeadlineAt != null && input?.responseDeadlineAt !== "" && !responseDeadlineAt) {
    return { ok: false, error: "INVALID_RESPONSE_DEADLINE" };
  }

  if ((rentChangeMode === "increase" || rentChangeMode === "decrease") && proposedRent == null) {
    return {
      ok: true,
      data: {
        rentChangeMode,
        proposedRent: null,
        newTermType: newTermType as LeaseType | null,
        newLeaseStartDate,
        newLeaseEndDate,
        responseDeadlineAt,
      },
    };
  }

  if ((rentChangeMode === "no_change" || rentChangeMode === "undecided") && proposedRent != null) {
    return { ok: false, error: "PROPOSED_RENT_NOT_ALLOWED_FOR_RENT_CHANGE_MODE" };
  }

  if (!rentChangeMode && proposedRent != null) {
    return { ok: false, error: "RENT_CHANGE_MODE_REQUIRED_FOR_PROPOSED_RENT" };
  }

  return {
    ok: true,
    data: {
      rentChangeMode,
      proposedRent,
      newTermType: newTermType as LeaseType | null,
      newLeaseStartDate,
      newLeaseEndDate,
      responseDeadlineAt,
    },
  };
}

export function deriveLeaseNoticeExecutionInputSnapshot(lease: LeaseWorkflowLease): {
  state: LeaseNoticeExecutionInputState;
  reason: string | null;
  missingFields: LeaseNoticeExecutionInputMissingField[];
  input: LeaseNoticeExecutionInputSnapshot | null;
} {
  const rule = resolveLeaseNoticeRule({ province: lease.province, leaseType: lease.leaseType });
  if (!rule) {
    return {
      state: "none",
      reason: "This lease does not currently resolve to a supported lease notice rule.",
      missingFields: [],
      input: null,
    };
  }

  const noticeType = determineNoticeType(lease);
  const noticeDueAt = lease.nextNoticeDueAt || (lease.leaseEndDate ? minusDays(lease.leaseEndDate, rule.noticeLeadDays) : null);
  const persistedInput = deriveLeaseRenewalOperatorInputRecord(lease);
  const rentChangeMode = persistedInput.rentChangeMode;
  const proposedRent = persistedInput.proposedRent;
  const responseDeadlineAt = persistedInput.responseDeadlineAt;

  const input: LeaseNoticeExecutionInputSnapshot = {
    noticeType,
    legalTemplateKey: rule.templateKey,
    noticeRuleVersion: rule.ruleVersion,
    province: lease.province || null,
    leaseType: lease.leaseType || null,
    currentRent: lease.currentRent,
    noticeDueAt,
    rentChangeMode,
    proposedRent,
    newTermType: persistedInput.newTermType,
    newLeaseStartDate: persistedInput.newLeaseStartDate,
    newLeaseEndDate: persistedInput.newLeaseEndDate,
    responseDeadlineAt,
  };

  const missing = new Set<string>();
  addMissingField(missing, "rentChangeMode", Boolean(input.rentChangeMode));
  if (input.rentChangeMode === "increase" || input.rentChangeMode === "decrease") {
    addMissingField(missing, "proposedRent", typeof input.proposedRent === "number" && Number.isFinite(input.proposedRent) && input.proposedRent > 0);
  }
  addMissingField(missing, "newTermType", Boolean(input.newTermType));
  addMissingField(missing, "newLeaseStartDate", Boolean(input.newLeaseStartDate));
  if (rule.requireTermDates) {
    addMissingField(missing, "newLeaseEndDate", Boolean(input.newLeaseEndDate));
  }
  addMissingField(missing, "responseDeadlineAt", typeof input.responseDeadlineAt === "number" && Number.isFinite(input.responseDeadlineAt) && input.responseDeadlineAt > 0);

  if (!missing.size) {
    return {
      state: "complete",
      reason: null,
      missingFields: [],
      input,
    };
  }

  return {
    state: "partial",
    reason: `Lease notice execution still requires explicit landlord input for: ${Array.from(missing).join(", ")}.`,
    missingFields: Array.from(missing) as LeaseNoticeExecutionInputMissingField[],
    input,
  };
}

export function buildLeaseNoticePreviewInputFromLease(lease: LeaseWorkflowLease): LeaseNoticePreviewInput | null {
  const snapshot = deriveLeaseNoticeExecutionInputSnapshot(lease);
  if (snapshot.state !== "complete" || !snapshot.input) return null;
  if (
    !snapshot.input.rentChangeMode ||
    !snapshot.input.newTermType ||
    !snapshot.input.newLeaseStartDate ||
    !snapshot.input.responseDeadlineAt
  ) {
    return null;
  }

  return {
    rentChangeMode: snapshot.input.rentChangeMode,
    proposedRent: snapshot.input.proposedRent,
    newTermType: snapshot.input.newTermType,
    newLeaseStartDate: snapshot.input.newLeaseStartDate,
    newLeaseEndDate: snapshot.input.newLeaseEndDate,
    responseDeadlineAt: snapshot.input.responseDeadlineAt,
    noticeType: snapshot.input.noticeType || undefined,
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
  const legalDocument = composeLeaseNoticeLegalDocument({
    leaseId: lease.id,
    landlordId: lease.landlordId,
    tenantId: lease.tenantId,
    propertyId: lease.propertyId,
    unitId: lease.unitId,
    province: lease.province,
    leaseType: lease.leaseType,
    noticeType,
    rule,
    rentChangeMode: input.rentChangeMode,
    currency: lease.currency,
    currentRent: lease.currentRent,
    proposedRent: effectiveProposedRent,
    newTermType: input.newTermType,
    newTermStartDate: newLeaseStartDate,
    newTermEndDate: newLeaseEndDate,
    responseDeadlineAt,
    noticeDueAt,
  });
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
      title: legalDocument.heading.title,
      body: legalDocument.heading.description,
    },
    legalDocumentMetadata: legalDocument.metadata,
  };
  return { ok: true as const, rule, preview };
}

export async function performLeaseNoticeSendFromPreviewInput(params: {
  leaseId: string;
  landlordId: string;
  actorId: string | null;
  lease: LeaseWorkflowLease;
  previewInput: LeaseNoticePreviewInput;
  autopilotPolicy: ReturnType<typeof toAutopilotPolicySummary>;
}): Promise<LeaseNoticeSendResult> {
  const { leaseId, landlordId, actorId, lease, previewInput, autopilotPolicy } = params;
  const previewResult = buildPreview(lease, previewInput);
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
      renewalRentChangeMode: previewResult.preview.rentChangeMode,
      renewalOfferedRent: previewResult.preview.proposedRent,
      renewalDecisionDeadlineAt: previewResult.preview.responseDeadlineAt,
      renewalNewTermType: previewResult.preview.newTermType,
      renewalNewLeaseStartDate: previewResult.preview.newTermStartDate,
      renewalNewLeaseEndDate: previewResult.preview.newTermEndDate,
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
  const tenantUrl = `${String(process.env.PUBLIC_APP_URL || process.env.VITE_PUBLIC_APP_URL || "https://www.rentchain.ai").replace(/\/$/, "")}/tenant/login?next=${encodeURIComponent(`/tenant/lease-notices/${noticeRef.id}`)}`;
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
  // Lease notice state changes keep the original notice fields intact and append workflow events for audit continuity.
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
