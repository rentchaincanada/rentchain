import crypto from "crypto";
import { db } from "../../config/firebase";
import { loadTenantIdentityRecord, type TenantIdentityRecord } from "./tenantProfileService";
import { resolveTenancyContext } from "./tenancyContextService";

const COLLECTION = "tenantSharePackages";
const DEFAULT_EXPIRES_DAYS = 7;
const MAX_EXPIRES_DAYS = 30;

export type TenantSharePackagePublicPayload = {
  identity: {
    identityStatus: TenantIdentityRecord["identityStatus"];
    verification: {
      level: TenantIdentityRecord["verification"]["level"];
    };
    readinessLabel: string;
    readinessDescription: string;
  };
  profile: {
    completionStatus: TenantIdentityRecord["profile"]["completionStatus"];
  };
  application: {
    reusable: boolean;
  };
  documents: {
    completionStatus: TenantIdentityRecord["documents"]["completionStatus"];
  };
  screening: {
    status: TenantIdentityRecord["screening"]["status"];
  };
  leases: {
    summary: {
      activeCount: number;
      historicalCount: number;
    };
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

function mapTenantIdentityToSharePackage(record: TenantIdentityRecord): TenantSharePackagePublicPayload {
  return {
    identity: {
      identityStatus: record.identityStatus,
      verification: {
        level: record.verification.level,
      },
      readinessLabel: record.readinessLabel,
      readinessDescription: record.readinessDescription,
    },
    profile: {
      completionStatus: record.profile.completionStatus,
    },
    application: {
      reusable: record.application.reusable,
    },
    documents: {
      completionStatus: record.documents.completionStatus,
    },
    screening: {
      status: record.screening.status,
    },
    leases: {
      summary: {
        activeCount: record.leases.activeCount,
        historicalCount: record.leases.historicalCount,
      },
    },
    generatedAt: new Date().toISOString(),
  };
}

async function loadTenantShareRecordByToken(token: string): Promise<TenantSharePackageRecord | null> {
  const tokenHash = hashToken(token);
  const snap = await db.collection(COLLECTION).where("tokenHash", "==", tokenHash).limit(1).get();
  const doc = snap.docs?.[0];
  if (!doc) return null;
  return {
    id: doc.id,
    ...((doc.data() as any) || {}),
  } as TenantSharePackageRecord;
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
  } satisfies TenantSharePackageRecord);

  return {
    id: ref.id,
    createdAt,
    expiresAt,
    status: "active" as const,
    shareUrl: buildFrontendShareUrl(token),
  };
}

export async function listTenantSharePackages(params: { tenantId: string }) {
  const tenantId = asString(params.tenantId);
  if (!tenantId) return [];

  const snap = await db.collection(COLLECTION).where("tenantId", "==", tenantId).limit(50).get();
  const now = nowMs();

  return (snap.docs || [])
    .map((doc: any) => ({ id: doc.id, ...((doc.data() as any) || {}) }))
    .filter((entry: any) => entry.status === "active" && Number(entry.expiresAt || 0) > now)
    .sort((left: any, right: any) => Number(right.createdAt || 0) - Number(left.createdAt || 0))
    .map((entry: any) => ({
      id: String(entry.id),
      createdAt: Number(entry.createdAt || 0),
      expiresAt: Number(entry.expiresAt || 0),
      status: "active" as const,
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

  const current = ((snap.data() as any) || {}) as TenantSharePackageRecord;
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

  return mapTenantIdentityToSharePackage(identity);
}
