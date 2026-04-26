import crypto from "crypto";
import { db } from "../../config/firebase";
import { loadTenantIdentityRecord, type TenantIdentityRecord } from "./tenantProfileService";
import { resolveTenancyContext } from "./tenancyContextService";
import { deriveTenantCredibilitySignals } from "../tenantCredibility/deriveTenantCredibilitySignals";

const COLLECTION = "tenantSharePackages";
const DEFAULT_EXPIRES_DAYS = 7;
const MAX_EXPIRES_DAYS = 30;

export type TenantSharePermissionKey =
  | "identity_summary"
  | "credibility_summary"
  | "application_summary"
  | "documents_summary";

export type TenantSharePermissions = {
  identitySummary: boolean;
  credibilitySummary: boolean;
  applicationSummary: boolean;
  documents: "none" | "summary" | "approved_only";
};

export type TenantSharePackageAvailabilitySection =
  | "identity"
  | "credibilitySummary"
  | "application"
  | "documents";

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
  availability: {
    canRequestMore: boolean;
    availableSections: TenantSharePackageAvailabilitySection[];
  };
  generatedAt: string;
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
};

const ALLOWED_REQUESTED_ITEMS = new Set<TenantSharePermissionKey>([
  "identity_summary",
  "credibility_summary",
  "application_summary",
  "documents_summary",
]);

const DEFAULT_PERMISSIONS: TenantSharePermissions = {
  identitySummary: true,
  credibilitySummary: false,
  applicationSummary: false,
  documents: "none",
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

function derivePermissionsFromApprovedItems(approvedItems: TenantSharePermissionKey[]): TenantSharePermissions {
  const approved = new Set(approvedItems);
  return {
    identitySummary: true,
    credibilitySummary: approved.has("credibility_summary"),
    applicationSummary: approved.has("application_summary"),
    documents: approved.has("documents_summary") ? "approved_only" : "none",
  };
}

function asTenantShareRecord(doc: any): TenantSharePackageRecord {
  const data = ((doc?.data?.() as any) || {}) as Partial<TenantSharePackageRecord>;
  const approvedItems = sanitizeRequestedItems(data.approvedItems);
  return {
    id: String(doc?.id || data.id || ""),
    tenantId: String(data.tenantId || ""),
    tokenHash: String(data.tokenHash || ""),
    createdAt: Number(data.createdAt || 0),
    expiresAt: Number(data.expiresAt || 0),
    status: data.status === "revoked" ? "revoked" : "active",
    revokedAt: typeof data.revokedAt === "number" ? data.revokedAt : undefined,
    permissions: data.permissions || derivePermissionsFromApprovedItems(approvedItems),
    requestedItems: sanitizeRequestedItems(data.requestedItems),
    approvedItems,
  };
}

async function loadTenantShareRecordByToken(token: string): Promise<TenantSharePackageRecord | null> {
  const tokenHash = hashToken(token);
  const snap = await db.collection(COLLECTION).where("tokenHash", "==", tokenHash).limit(1).get();
  const doc = snap.docs?.[0];
  if (!doc) return null;
  return asTenantShareRecord(doc);
}

async function resolveShareTenantIdentity(params: { tenantId: string }) {
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

  return await loadTenantIdentityRecord({
    context,
    userId: tenantId,
    userEmail: email,
  });
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
}): TenantSharePackagePublicPayload {
  const { identity, permissions } = params;
  const availableSections: TenantSharePackageAvailabilitySection[] = [];
  const payload: TenantSharePackagePublicPayload = {
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

  return payload;
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
  } satisfies TenantSharePackageRecord);

  return {
    id: ref.id,
    createdAt,
    expiresAt,
    status: "active" as const,
    permissions: DEFAULT_PERMISSIONS,
    requestedItems: [] as TenantSharePermissionKey[],
    approvedItems: [] as TenantSharePermissionKey[],
    shareUrl: buildFrontendShareUrl(token),
  };
}

export async function listTenantSharePackages(params: { tenantId: string }) {
  const tenantId = asString(params.tenantId);
  if (!tenantId) return [];

  const snap = await db.collection(COLLECTION).where("tenantId", "==", tenantId).limit(50).get();
  const now = nowMs();

  return (snap.docs || [])
    .map((doc: any) => asTenantShareRecord(doc))
    .filter((entry) => entry.status === "active" && Number(entry.expiresAt || 0) > now)
    .sort((left, right) => Number(right.createdAt || 0) - Number(left.createdAt || 0))
    .map((entry) => ({
      id: entry.id,
      createdAt: entry.createdAt,
      expiresAt: entry.expiresAt,
      status: "active" as const,
      permissions: entry.permissions,
      requestedItems: entry.requestedItems,
      approvedItems: entry.approvedItems,
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

export async function readTenantSharePackageByToken(
  token: string
): Promise<TenantSharePackagePublicPayload | null> {
  const normalized = asString(token);
  if (!normalized) return null;

  const record = await loadTenantShareRecordByToken(normalized);
  if (!record) return null;
  if (record.status !== "active") return null;
  if (Number(record.expiresAt || 0) <= nowMs()) return null;

  const identity = await resolveShareTenantIdentity({ tenantId: record.tenantId });
  if (!identity) return null;

  return buildPublicPayload({
    identity,
    permissions: record.permissions || derivePermissionsFromApprovedItems(record.approvedItems || []),
  });
}
