import crypto from "crypto";
import { db } from "../../firebase";
import {
  loadTenantApplicationReuseProjection,
  loadTenantIdentityRecord,
  type TenantApplicationReuseProjection,
  type TenantIdentityRecord,
} from "./tenantProfileService";
import { resolveTenancyContext } from "./tenancyContextService";
import { deriveTenantCredibilitySignals } from "../tenantCredibility/deriveTenantCredibilitySignals";
import { deriveIdentityPortability, type PortableIdentity } from "../identityPortability/deriveIdentityPortability";
import {
  deriveApplyWithRentChainContext,
  type ApplyWithRentChainContext,
} from "../identityPortability/deriveApplyWithRentChainContext";
import { deriveIdentityTimeline } from "../identityTimeline/deriveIdentityTimeline";
import { derivePaymentReadiness, type PaymentReadiness } from "../paymentReadiness/derivePaymentReadiness";
import {
  deriveIdentityExchangeReference,
  type IdentityExchangeReference,
} from "../identityExchange/deriveIdentityExchangeReference";

const COLLECTION = "tenantSharePackages";
const DEFAULT_EXPIRES_DAYS = 7;
const MAX_EXPIRES_DAYS = 30;

export type TenantSharePermissionKey =
  | "identity_summary"
  | "credibility_summary"
  | "application_summary"
  | "documents_summary"
  | "lease_summary"
  | "payment_readiness_summary";

export type TenantSharePermissions = {
  identitySummary: boolean;
  credibilitySummary: boolean;
  applicationSummary: boolean;
  documents: "none" | "summary" | "approved_only";
  leaseSummary: boolean;
  paymentReadinessSummary: boolean;
};

export type TenantSharePackageAvailabilitySection =
  | "identity"
  | "credibilitySummary"
  | "application"
  | "documents"
  | "leaseSummary"
  | "paymentReadinessSummary";

export type TenantShareVerificationRequestScope = TenantSharePermissionKey;

export type TenantShareVerificationRequest = {
  requestId: string;
  requestedByType: "landlord" | "internal" | "future_institution";
  requestedScopes: TenantShareVerificationRequestScope[];
  status: "requested" | "approved" | "declined" | "revoked" | "expired";
  createdAt: number;
  expiresAt?: number;
};

export type TenantSharePackagePublicPayload = {
  identity?: {
    identityStatus: TenantIdentityRecord["identityStatus"];
    verification: {
      level: TenantIdentityRecord["verification"]["level"];
    };
    readinessLabel: string;
    readinessDescription: string;
  };
  credibilitySummary?: {
    completenessLevel: "low" | "medium" | "high";
    verificationLevel: "none" | "partial" | "strong";
    summaryLabel: string;
    summaryDescription: string;
  };
  application?: {
    reusable: boolean;
  };
  documents?: {
    completionStatus: TenantIdentityRecord["documents"]["completionStatus"];
  };
  leaseSummary?: {
    status: string | null;
    startDate: string | null;
    endDate: string | null;
    monthlyRent: number | null;
  };
  paymentReadinessSummary?: Pick<
    PaymentReadiness,
    "readinessStatus" | "readinessLabel" | "readinessDescription" | "requiredNextAction"
  >;
  identityExchangeReference?: Pick<
    IdentityExchangeReference,
    "referenceType" | "referenceStatus" | "referenceLabel" | "referenceDescription" | "portabilityStatus"
  >;
  availability: {
    canRequestMore: boolean;
    availableSections: TenantSharePackageAvailabilitySection[];
  };
  generatedAt: string;
};

export type TenantShareApplyPayload = {
  applyWithRentChain: ApplyWithRentChainContext;
};

export type TenantSharePackageRecord = {
  id: string;
  tenantId: string;
  tokenHash: string;
  createdAt: number;
  expiresAt: number;
  status: "active" | "revoked";
  revokedAt?: number;
  permissions: TenantSharePermissions;
  requestedItems: TenantSharePermissionKey[];
  approvedItems: TenantSharePermissionKey[];
  verificationRequests: TenantShareVerificationRequest[];
};

const ALLOWED_REQUESTED_ITEMS = new Set<TenantSharePermissionKey>([
  "identity_summary",
  "credibility_summary",
  "application_summary",
  "documents_summary",
  "lease_summary",
  "payment_readiness_summary",
]);

const DEFAULT_PERMISSIONS: TenantSharePermissions = {
  identitySummary: true,
  credibilitySummary: false,
  applicationSummary: false,
  documents: "none",
  leaseSummary: false,
  paymentReadinessSummary: false,
};

function asString(value: unknown): string | null {
  const next = String(value || "").trim();
  return next || null;
}

function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function nowMs() {
  return Date.now();
}

function buildFrontendShareUrl(token: string) {
  const base = String(process.env.PUBLIC_APP_URL || "").trim().replace(/\/$/, "");
  const path = `/share/${encodeURIComponent(token)}`;
  return base ? `${base}${path}` : path;
}

function clampExpiresInDays(value: unknown) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return DEFAULT_EXPIRES_DAYS;
  return Math.min(Math.max(Math.round(numeric), 1), MAX_EXPIRES_DAYS);
}

function sanitizeRequestedItems(input: unknown): TenantSharePermissionKey[] {
  if (!Array.isArray(input)) return [];
  const seen = new Set<TenantSharePermissionKey>();
  const next: TenantSharePermissionKey[] = [];
  for (const item of input) {
    const normalized = asString(item) as TenantSharePermissionKey | null;
    if (!normalized || !ALLOWED_REQUESTED_ITEMS.has(normalized) || seen.has(normalized)) continue;
    seen.add(normalized);
    next.push(normalized);
  }
  return next;
}

function sanitizeRequestedByType(
  value: unknown
): TenantShareVerificationRequest["requestedByType"] {
  return value === "internal" || value === "future_institution" ? value : "landlord";
}

function generateRequestId() {
  return crypto.randomBytes(12).toString("hex");
}

function getEffectiveVerificationRequestStatus(
  request: TenantShareVerificationRequest
): TenantShareVerificationRequest["status"] {
  if (request.status === "requested" && typeof request.expiresAt === "number" && request.expiresAt <= nowMs()) {
    return "expired";
  }
  return request.status;
}

function sanitizeVerificationRequests(input: unknown): TenantShareVerificationRequest[] {
  if (!Array.isArray(input)) return [];
  const seen = new Set<string>();
  const next: TenantShareVerificationRequest[] = [];
  for (const entry of input) {
    const requestId = asString((entry as any)?.requestId);
    if (!requestId || seen.has(requestId)) continue;
    seen.add(requestId);
    const status = (() => {
      const value = asString((entry as any)?.status);
      if (
        value === "approved" ||
        value === "declined" ||
        value === "revoked" ||
        value === "expired" ||
        value === "requested"
      ) {
        return value;
      }
      return "requested" as const;
    })();
    next.push({
      requestId,
      requestedByType: sanitizeRequestedByType((entry as any)?.requestedByType),
      requestedScopes: sanitizeRequestedItems((entry as any)?.requestedScopes),
      status,
      createdAt: Number((entry as any)?.createdAt || 0),
      expiresAt: typeof (entry as any)?.expiresAt === "number" ? Number((entry as any)?.expiresAt) : undefined,
    });
  }
  return next;
}

function deriveShareStateFromVerificationRequests(
  requests: TenantShareVerificationRequest[],
  fallbackApprovedItems: TenantSharePermissionKey[]
) {
  const approvedSet = new Set<TenantSharePermissionKey>();
  const requestedSet = new Set<TenantSharePermissionKey>();

  for (const request of requests) {
    const effectiveStatus = getEffectiveVerificationRequestStatus(request);
    if (effectiveStatus === "approved") {
      for (const scope of request.requestedScopes) approvedSet.add(scope);
    }
    if (effectiveStatus === "requested") {
      for (const scope of request.requestedScopes) requestedSet.add(scope);
    }
  }

  const approvedItems = Array.from(approvedSet);
  const requestedItems = Array.from(requestedSet);
  const resolvedApprovedItems = requests.length ? approvedItems : fallbackApprovedItems;

  return {
    approvedItems: resolvedApprovedItems,
    requestedItems,
    permissions: derivePermissionsFromApprovedItems(resolvedApprovedItems),
  };
}

function derivePermissionsFromApprovedItems(approvedItems: TenantSharePermissionKey[]): TenantSharePermissions {
  const approved = new Set(approvedItems);
  return {
    identitySummary: true,
    credibilitySummary: approved.has("credibility_summary"),
    applicationSummary: approved.has("application_summary"),
    documents: approved.has("documents_summary") ? "approved_only" : "none",
    leaseSummary: approved.has("lease_summary"),
    paymentReadinessSummary: approved.has("payment_readiness_summary"),
  };
}

function asTenantShareRecord(doc: any): TenantSharePackageRecord {
  const data = ((doc?.data?.() as any) || {}) as Partial<TenantSharePackageRecord>;
  const verificationRequests = sanitizeVerificationRequests(data.verificationRequests);
  const derived = deriveShareStateFromVerificationRequests(
    verificationRequests,
    sanitizeRequestedItems(data.approvedItems)
  );
  return {
    id: String(doc?.id || data.id || ""),
    tenantId: String(data.tenantId || ""),
    tokenHash: String(data.tokenHash || ""),
    createdAt: Number(data.createdAt || 0),
    expiresAt: Number(data.expiresAt || 0),
    status: data.status === "revoked" ? "revoked" : "active",
    revokedAt: typeof data.revokedAt === "number" ? data.revokedAt : undefined,
    permissions: data.permissions
      ? {
          ...DEFAULT_PERMISSIONS,
          ...(data.permissions as Partial<TenantSharePermissions>),
        }
      : derived.permissions,
    requestedItems: derived.requestedItems.length ? derived.requestedItems : sanitizeRequestedItems(data.requestedItems),
    approvedItems: derived.approvedItems,
    verificationRequests,
  };
}

async function loadTenantShareRecordByToken(token: string): Promise<TenantSharePackageRecord | null> {
  const tokenHash = hashToken(token);
  const snap = await db.collection(COLLECTION).where("tokenHash", "==", tokenHash).limit(1).get();
  const doc = snap.docs?.[0];
  if (!doc) return null;
  return asTenantShareRecord(doc);
}

type ResolvedShareTenantContext = {
  identity: TenantIdentityRecord;
  applicationReuse: TenantApplicationReuseProjection;
  portableIdentity: PortableIdentity;
  paymentReadiness: PaymentReadiness | null;
  identityExchangeReference: IdentityExchangeReference;
  leaseSummary: {
    status: string | null;
    startDate: string | null;
    endDate: string | null;
    monthlyRent: number | null;
  } | null;
};

async function resolveShareTenantContext(params: {
  tenantId: string;
  sharingControlsReady: boolean;
}): Promise<ResolvedShareTenantContext | null> {
  const tenantId = asString(params.tenantId);
  if (!tenantId) return null;

  const tenantSnap = await db.collection("tenants").doc(tenantId).get().catch(() => null as any);
  const tenantData = tenantSnap?.exists ? ((tenantSnap.data() as any) || {}) : {};
  const email = asString(tenantData?.email);

  const context = await resolveTenancyContext({
    uid: tenantId,
    email,
    tenantId,
    leaseId: asString(tenantData?.leaseId) || asString(tenantData?.currentLeaseId),
  });

  if (!context?.ok) return null;

  const identity = await loadTenantIdentityRecord({
    context,
    userId: tenantId,
    userEmail: email,
  });
  if (!identity) return null;
  const applicationReuse = await loadTenantApplicationReuseProjection({
    context,
    userEmail: email,
  });

  const leaseSnap = context.leaseId
    ? await db.collection("leases").doc(String(context.leaseId || "")).get().catch(() => null as any)
    : null;
  const lease = leaseSnap?.exists ? ((leaseSnap.data() as any) || {}) : null;
  const paymentReadiness = lease
    ? derivePaymentReadiness({
        leaseId: String(context.leaseId || ""),
        monthlyRent: lease?.monthlyRent,
        startDate: lease?.startDate,
        endDate: lease?.endDate,
        dueDay: lease?.dueDay,
        tenantId,
        propertyId: context.propertyId,
        unitId: context.unitId,
        leaseExecution: null,
      })
    : null;
  const { landlordSafeSummary } = deriveTenantCredibilitySignals({
    tenantIdentityRecord: identity,
    leaseExecution: null,
  });
  const identityTimeline = await deriveIdentityTimeline({
    tenantId,
    applicationId: context.applicationId,
    leaseId: context.leaseId,
  });
  const { portableIdentity } = deriveIdentityPortability({
    tenantIdentityRecord: identity,
    credibilitySummary: landlordSafeSummary,
    shareAvailability: {
      sharingEnabled: params.sharingControlsReady,
    },
    timelineAvailability: {
      hasIdentityTimeline: Array.isArray(identityTimeline?.events) && identityTimeline.events.length > 0,
    },
  });
  const identityExchangeReference = deriveIdentityExchangeReference({
    portableIdentity,
    auditTimelineReady: Array.isArray(identityTimeline?.events) && identityTimeline.events.length > 0,
    paymentReadinessAvailable: Boolean(paymentReadiness),
    sharingControlsReady: params.sharingControlsReady,
  });

  return {
    identity,
    applicationReuse,
    portableIdentity,
    paymentReadiness,
    identityExchangeReference,
    leaseSummary: lease
      ? {
          status: asString(lease?.status),
          startDate: asString(lease?.startDate),
          endDate: asString(lease?.endDate),
          monthlyRent: Number.isFinite(Number(lease?.monthlyRent)) ? Number(lease?.monthlyRent) : null,
        }
      : null,
  };
}

async function loadTenantShareRecordById(sharePackageId: string): Promise<TenantSharePackageRecord | null> {
  const ref = db.collection(COLLECTION).doc(sharePackageId);
  const snap = await ref.get();
  if (!snap.exists) return null;
  return asTenantShareRecord(snap);
}

function buildPublicPayload(params: {
  identity: TenantIdentityRecord;
  permissions: TenantSharePermissions;
  identityExchangeReference: IdentityExchangeReference;
  leaseSummary: {
    status: string | null;
    startDate: string | null;
    endDate: string | null;
    monthlyRent: number | null;
  } | null;
  paymentReadiness: PaymentReadiness | null;
}): TenantSharePackagePublicPayload {
  const { identity, permissions, identityExchangeReference, leaseSummary, paymentReadiness } = params;
  const availableSections: TenantSharePackageAvailabilitySection[] = [];
  const payload: TenantSharePackagePublicPayload = {
    identityExchangeReference: {
      referenceType: identityExchangeReference.referenceType,
      referenceStatus: identityExchangeReference.referenceStatus,
      referenceLabel: identityExchangeReference.referenceLabel,
      referenceDescription: identityExchangeReference.referenceDescription,
      portabilityStatus: identityExchangeReference.portabilityStatus,
    },
    availability: {
      canRequestMore: true,
      availableSections,
    },
    generatedAt: new Date().toISOString(),
  };

  if (permissions.identitySummary) {
    payload.identity = {
      identityStatus: identity.identityStatus,
      verification: {
        level: identity.verification.level,
      },
      readinessLabel: identity.readinessLabel,
      readinessDescription: identity.readinessDescription,
    };
    availableSections.push("identity");
  }

  if (permissions.credibilitySummary) {
    const { landlordSafeSummary } = deriveTenantCredibilitySignals({
      tenantIdentityRecord: identity,
      leaseExecution: null,
    });
    payload.credibilitySummary = landlordSafeSummary;
    availableSections.push("credibilitySummary");
  }

  if (permissions.applicationSummary) {
    payload.application = {
      reusable: identity.application.reusable,
    };
    availableSections.push("application");
  }

  if (permissions.documents === "summary" || permissions.documents === "approved_only") {
    payload.documents = {
      completionStatus: identity.documents.completionStatus,
    };
    availableSections.push("documents");
  }

  if (permissions.leaseSummary && leaseSummary) {
    payload.leaseSummary = leaseSummary;
    availableSections.push("leaseSummary");
  }

  if (permissions.paymentReadinessSummary && paymentReadiness) {
    payload.paymentReadinessSummary = {
      readinessStatus: paymentReadiness.readinessStatus,
      readinessLabel: paymentReadiness.readinessLabel,
      readinessDescription: paymentReadiness.readinessDescription,
      requiredNextAction: paymentReadiness.requiredNextAction,
    };
    availableSections.push("paymentReadinessSummary");
  }

  return payload;
}

function deriveApprovedScopeKeysFromPermissions(
  permissions: TenantSharePermissions
): TenantSharePermissionKey[] {
  const approved: TenantSharePermissionKey[] = [];
  if (permissions.identitySummary) approved.push("identity_summary");
  if (permissions.credibilitySummary) approved.push("credibility_summary");
  if (permissions.applicationSummary) approved.push("application_summary");
  if (permissions.documents === "summary" || permissions.documents === "approved_only") {
    approved.push("documents_summary");
  }
  if (permissions.leaseSummary) approved.push("lease_summary");
  if (permissions.paymentReadinessSummary) approved.push("payment_readiness_summary");
  return approved;
}

export async function createTenantSharePackage(params: {
  tenantId: string;
  expiresInDays?: number;
}) {
  const tenantId = asString(params.tenantId);
  if (!tenantId) {
    throw new Error("tenant_id_required");
  }

  const createdAt = nowMs();
  const expiresAt = createdAt + clampExpiresInDays(params.expiresInDays) * 24 * 60 * 60 * 1000;
  const token = crypto.randomBytes(32).toString("hex");
  const tokenHash = hashToken(token);
  const ref = db.collection(COLLECTION).doc();

  await ref.set({
    id: ref.id,
    tenantId,
    tokenHash,
    createdAt,
    expiresAt,
    status: "active",
    permissions: DEFAULT_PERMISSIONS,
    requestedItems: [],
    approvedItems: [],
    verificationRequests: [],
  } satisfies TenantSharePackageRecord);

  const resolved = await resolveShareTenantContext({
    tenantId,
    sharingControlsReady: true,
  });

  return {
    id: ref.id,
    createdAt,
    expiresAt,
    status: "active" as const,
    permissions: DEFAULT_PERMISSIONS,
    requestedItems: [] as TenantSharePermissionKey[],
    approvedItems: [] as TenantSharePermissionKey[],
    verificationRequests: [] as TenantShareVerificationRequest[],
    identityExchangeReference: resolved?.identityExchangeReference || null,
    shareUrl: buildFrontendShareUrl(token),
  };
}

export async function listTenantSharePackages(params: { tenantId: string }) {
  const tenantId = asString(params.tenantId);
  if (!tenantId) return [];

  const snap = await db.collection(COLLECTION).where("tenantId", "==", tenantId).limit(50).get();
  const now = nowMs();

  const entries = (snap.docs || [])
    .map((doc: any) => asTenantShareRecord(doc))
    .filter((entry) => entry.status === "active" && Number(entry.expiresAt || 0) > now)
    .sort((left, right) => Number(right.createdAt || 0) - Number(left.createdAt || 0));

  const resolved = entries.length
    ? await resolveShareTenantContext({
        tenantId,
        sharingControlsReady: true,
      })
    : null;

  return entries.map((entry) => ({
      id: entry.id,
      createdAt: entry.createdAt,
      expiresAt: entry.expiresAt,
      status: "active" as const,
      permissions: entry.permissions,
      requestedItems: entry.requestedItems,
      approvedItems: entry.approvedItems,
      verificationRequests: entry.verificationRequests.map((request) => ({
        ...request,
        status: getEffectiveVerificationRequestStatus(request),
      })),
      identityExchangeReference: resolved?.identityExchangeReference || null,
    }));
}

export async function revokeTenantSharePackage(params: {
  tenantId: string;
  sharePackageId: string;
}) {
  const tenantId = asString(params.tenantId);
  const sharePackageId = asString(params.sharePackageId);
  if (!tenantId || !sharePackageId) return false;

  const ref = db.collection(COLLECTION).doc(sharePackageId);
  const snap = await ref.get();
  if (!snap.exists) return false;

  const current = asTenantShareRecord(snap);
  if (String(current.tenantId || "") !== tenantId) return false;

  await ref.set(
    {
      status: "revoked",
      revokedAt: nowMs(),
    },
    { merge: true }
  );
  return true;
}

export async function requestTenantSharePackageItems(params: {
  token: string;
  requestedItems: unknown;
}) {
  const normalized = asString(params.token);
  if (!normalized) return null;
  const record = await loadTenantShareRecordByToken(normalized);
  if (!record) return null;
  if (record.status !== "active") return null;
  if (Number(record.expiresAt || 0) <= nowMs()) return null;

  const requestedItems = sanitizeRequestedItems(params.requestedItems);
  await db.collection(COLLECTION).doc(record.id).set(
    {
      requestedItems,
    },
    { merge: true }
  );

  return { requestedItems };
}

export async function createTenantShareVerificationRequest(params: {
  token: string;
  requestedScopes: unknown;
  requestedByType?: TenantShareVerificationRequest["requestedByType"];
}) {
  const normalized = asString(params.token);
  if (!normalized) return null;
  const record = await loadTenantShareRecordByToken(normalized);
  if (!record) return null;
  if (record.status !== "active") return null;
  if (Number(record.expiresAt || 0) <= nowMs()) return null;

  const requestedScopes = sanitizeRequestedItems(params.requestedScopes);
  const createdAt = nowMs();
  const request: TenantShareVerificationRequest = {
    requestId: generateRequestId(),
    requestedByType: sanitizeRequestedByType(params.requestedByType),
    requestedScopes,
    status: "requested",
    createdAt,
    expiresAt: Number(record.expiresAt || 0) > createdAt ? Number(record.expiresAt || 0) : undefined,
  };
  const verificationRequests = [...record.verificationRequests, request];
  const derived = deriveShareStateFromVerificationRequests(verificationRequests, record.approvedItems);

  await db.collection(COLLECTION).doc(record.id).set(
    {
      verificationRequests,
      requestedItems: derived.requestedItems,
      approvedItems: derived.approvedItems,
      permissions: derived.permissions,
    },
    { merge: true }
  );

  return {
    status: "requested" as const,
    requestedScopes,
  };
}

export async function respondToTenantSharePackage(params: {
  tenantId: string;
  sharePackageId: string;
  approvedItems: unknown;
}) {
  const tenantId = asString(params.tenantId);
  const sharePackageId = asString(params.sharePackageId);
  if (!tenantId || !sharePackageId) return null;

  const current = await loadTenantShareRecordById(sharePackageId);
  if (!current) return null;
  if (current.tenantId !== tenantId) return false;

  const approvedItems = sanitizeRequestedItems(params.approvedItems).filter((item) =>
    current.requestedItems.includes(item)
  );
  const permissions = derivePermissionsFromApprovedItems(approvedItems);

  await db.collection(COLLECTION).doc(sharePackageId).set(
    {
      approvedItems,
      requestedItems: [],
      permissions,
    },
    { merge: true }
  );

  return {
    id: sharePackageId,
    approvedItems,
    requestedItems: [],
    permissions,
    status: current.status,
    createdAt: current.createdAt,
    expiresAt: current.expiresAt,
  };
}

export async function respondToTenantShareVerificationRequest(params: {
  tenantId: string;
  sharePackageId: string;
  requestId: string;
  approvedScopes: unknown;
}) {
  const tenantId = asString(params.tenantId);
  const sharePackageId = asString(params.sharePackageId);
  const requestId = asString(params.requestId);
  if (!tenantId || !sharePackageId || !requestId) return null;

  const current = await loadTenantShareRecordById(sharePackageId);
  if (!current) return null;
  if (current.tenantId !== tenantId) return false;

  const requests = current.verificationRequests.map((entry) => ({ ...entry }));
  const index = requests.findIndex((entry) => entry.requestId === requestId);
  if (index < 0) return null;

  const request = requests[index];
  const approvedScopes = sanitizeRequestedItems(params.approvedScopes).filter((scope) =>
    request.requestedScopes.includes(scope)
  );
  requests[index] = {
    ...request,
    requestedScopes: approvedScopes.length ? approvedScopes : request.requestedScopes,
    status: approvedScopes.length ? "approved" : "declined",
  };
  const derived = deriveShareStateFromVerificationRequests(requests, current.approvedItems);

  await db.collection(COLLECTION).doc(sharePackageId).set(
    {
      verificationRequests: requests,
      requestedItems: derived.requestedItems,
      approvedItems: derived.approvedItems,
      permissions: derived.permissions,
    },
    { merge: true }
  );

  return {
    id: sharePackageId,
    verificationRequests: requests.map((entry) => ({
      ...entry,
      status: getEffectiveVerificationRequestStatus(entry),
    })),
    requestedItems: derived.requestedItems,
    approvedItems: derived.approvedItems,
    permissions: derived.permissions,
    status: current.status,
    createdAt: current.createdAt,
    expiresAt: current.expiresAt,
  };
}

export async function revokeTenantShareVerificationRequest(params: {
  tenantId: string;
  sharePackageId: string;
  requestId: string;
}) {
  const tenantId = asString(params.tenantId);
  const sharePackageId = asString(params.sharePackageId);
  const requestId = asString(params.requestId);
  if (!tenantId || !sharePackageId || !requestId) return null;

  const current = await loadTenantShareRecordById(sharePackageId);
  if (!current) return null;
  if (current.tenantId !== tenantId) return false;

  const requests = current.verificationRequests.map((entry) =>
    entry.requestId === requestId ? { ...entry, status: "revoked" as const } : { ...entry }
  );
  if (!requests.some((entry) => entry.requestId === requestId)) return null;

  const derived = deriveShareStateFromVerificationRequests(requests, current.approvedItems);
  await db.collection(COLLECTION).doc(sharePackageId).set(
    {
      verificationRequests: requests,
      requestedItems: derived.requestedItems,
      approvedItems: derived.approvedItems,
      permissions: derived.permissions,
    },
    { merge: true }
  );

  return {
    id: sharePackageId,
    verificationRequests: requests.map((entry) => ({
      ...entry,
      status: getEffectiveVerificationRequestStatus(entry),
    })),
    requestedItems: derived.requestedItems,
    approvedItems: derived.approvedItems,
    permissions: derived.permissions,
    status: current.status,
    createdAt: current.createdAt,
    expiresAt: current.expiresAt,
  };
}

export async function readTenantSharePackageByToken(
  token: string
): Promise<TenantSharePackagePublicPayload | null> {
  const normalized = asString(token);
  if (!normalized) return null;

  const record = await loadTenantShareRecordByToken(normalized);
  if (!record) return null;
  if (record.status !== "active") return null;
  if (Number(record.expiresAt || 0) <= nowMs()) return null;

  const resolved = await resolveShareTenantContext({
    tenantId: record.tenantId,
    sharingControlsReady: true,
  });
  if (!resolved) return null;

  return buildPublicPayload({
    identity: resolved.identity,
    permissions: record.permissions || derivePermissionsFromApprovedItems(record.approvedItems || []),
    identityExchangeReference: resolved.identityExchangeReference,
    leaseSummary: resolved.leaseSummary,
    paymentReadiness: resolved.paymentReadiness,
  });
}

export async function readTenantShareApplyContextByToken(
  token: string
): Promise<TenantShareApplyPayload | null> {
  const normalized = asString(token);
  if (!normalized) return null;

  const record = await loadTenantShareRecordByToken(normalized);
  if (!record) return null;
  if (record.status !== "active") return null;
  if (Number(record.expiresAt || 0) <= nowMs()) return null;

  const resolved = await resolveShareTenantContext({
    tenantId: record.tenantId,
    sharingControlsReady: true,
  });
  if (!resolved) return null;

  return {
    applyWithRentChain: deriveApplyWithRentChainContext({
      approvedScopeKeys: deriveApprovedScopeKeysFromPermissions(
        record.permissions || derivePermissionsFromApprovedItems(record.approvedItems || [])
      ),
      identityExchangeReference: resolved.identityExchangeReference,
      applicationReuse: resolved.applicationReuse,
    }),
  };
}
