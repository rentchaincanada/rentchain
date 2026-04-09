import { db } from "../../config/firebase";

export type TenancyAuthority = "applicant" | "active_tenant" | "invite";

export type TenantWorkspaceIdentity = {
  uid: string;
  email: string | null;
  tenantId: string | null;
  leaseId: string | null;
};

export type TenancyContext = {
  ok: boolean;
  authority: TenancyAuthority | null;
  propertyId: string | null;
  rc_prop_id: string | null;
  applicationId: string | null;
  leaseId: string | null;
  tenantId: string | null;
  unitId: string | null;
  invitedEmail: string | null;
  reason?: "unauthenticated" | "no_authority" | "ambiguous_authority";
};

type Candidate = {
  authority: TenancyAuthority;
  propertyId: string;
  applicationId: string | null;
  leaseId: string | null;
  tenantId: string | null;
  unitId: string | null;
  invitedEmail: string | null;
  score: number;
};

const ACTIVE_LEASE_STATUSES = new Set([
  "active",
  "current",
  "renewal_accepted",
  "notice_pending",
  "renewal_pending",
]);

function asString(value: unknown): string | null {
  const next = String(value || "").trim();
  return next || null;
}

function normalizeEmail(value: unknown): string | null {
  const next = String(value || "").trim().toLowerCase();
  return next || null;
}

function isActiveLeaseStatus(status: unknown): boolean {
  const next = String(status || "").trim().toLowerCase();
  return ACTIVE_LEASE_STATUSES.has(next);
}

async function safeGetDocs(collectionName: string, field: string, value: string, operator: "==" | "array-contains" = "==") {
  if (!value) return [];
  try {
    const snap = await db.collection(collectionName).where(field, operator, value).get();
    return snap.docs || [];
  } catch {
    return [];
  }
}

function candidateKey(candidate: Candidate): string {
  return [
    candidate.authority,
    candidate.propertyId,
    candidate.applicationId || "",
    candidate.leaseId || "",
    candidate.tenantId || "",
    candidate.unitId || "",
  ].join(":");
}

async function resolveRcPropId(propertyId: string): Promise<string | null> {
  const id = asString(propertyId);
  if (!id) return null;
  try {
    const snap = await db.collection("properties").doc(id).get();
    if (!snap.exists) return id;
    return asString((snap.data() as any)?.rc_prop_id) || id;
  } catch {
    return id;
  }
}

export async function resolveTenancyContext(identity: TenantWorkspaceIdentity): Promise<TenancyContext> {
  const uid = asString(identity.uid);
  const email = normalizeEmail(identity.email);
  const tenantId = asString(identity.tenantId);

  if (!uid) {
    return {
      ok: false,
      authority: null,
      propertyId: null,
      rc_prop_id: null,
      applicationId: null,
      leaseId: null,
      tenantId: null,
      unitId: null,
      invitedEmail: null,
      reason: "unauthenticated",
    };
  }

  const candidates = new Map<string, Candidate>();
  const pushCandidate = (candidate: Candidate | null) => {
    if (!candidate?.propertyId) return;
    candidates.set(candidateKey(candidate), candidate);
  };

  const applicationDocs = [
    ...(email ? await safeGetDocs("applications", "applicantEmail", email) : []),
    ...(email ? await safeGetDocs("applications", "email", email) : []),
    ...(uid ? await safeGetDocs("applications", "applicantUserId", uid) : []),
    ...(uid ? await safeGetDocs("applications", "userId", uid) : []),
    ...(tenantId ? await safeGetDocs("applications", "tenantId", tenantId) : []),
  ];

  for (const doc of applicationDocs) {
    const data = (doc.data() || {}) as any;
    const propertyId = asString(data?.propertyId);
    if (!propertyId) continue;
    pushCandidate({
      authority: "applicant",
      propertyId,
      applicationId: doc.id,
      leaseId: asString(data?.leaseId),
      tenantId: asString(data?.tenantId) || tenantId,
      unitId: asString(data?.unitId) || asString(data?.unitApplied) || asString(data?.unit),
      invitedEmail: email,
      score: 20,
    });
  }

  const leaseDocs = [
    ...(tenantId ? await safeGetDocs("leases", "tenantId", tenantId) : []),
    ...(tenantId ? await safeGetDocs("leases", "tenantIds", tenantId, "array-contains") : []),
    ...(asString(identity.leaseId) ? [await db.collection("leases").doc(String(identity.leaseId)).get().catch(() => null as any)] : []),
  ].filter(Boolean);

  for (const doc of leaseDocs as any[]) {
    if (!doc?.exists) continue;
    const data = (doc.data() || {}) as any;
    if (!isActiveLeaseStatus(data?.status)) continue;
    const propertyId = asString(data?.propertyId);
    if (!propertyId) continue;
    pushCandidate({
      authority: "active_tenant",
      propertyId,
      applicationId: asString(data?.applicationId),
      leaseId: doc.id,
      tenantId: asString(data?.tenantId) || tenantId,
      unitId: asString(data?.unitId) || asString(data?.unitNumber) || asString(data?.unitLabel),
      invitedEmail: email,
      score: 100,
    });
  }

  const tenancyDocs = tenantId ? await safeGetDocs("tenancies", "tenantId", tenantId) : [];
  for (const doc of tenancyDocs) {
    const data = (doc.data() || {}) as any;
    if (String(data?.status || "").trim().toLowerCase() !== "active") continue;
    const propertyId = asString(data?.propertyId);
    if (!propertyId) continue;
    pushCandidate({
      authority: "active_tenant",
      propertyId,
      applicationId: null,
      leaseId: asString(data?.leaseId),
      tenantId,
      unitId: asString(data?.unitId) || asString(data?.unitLabel),
      invitedEmail: email,
      score: 90,
    });
  }

  const inviteDocs = [
    ...(uid ? await safeGetDocs("tenancy_invites", "redeemed_by_uid", uid) : []),
    ...(email ? await safeGetDocs("tenancy_invites", "invited_email", email) : []),
  ];
  const now = Date.now();
  for (const doc of inviteDocs) {
    const data = (doc.data() || {}) as any;
    const propertyId = asString(data?.property_id) || asString(data?.propertyId);
    const expiresAt = Number(data?.expires_at ?? data?.expiresAt ?? 0);
    if (!propertyId || (expiresAt && expiresAt < now)) continue;
    pushCandidate({
      authority: "invite",
      propertyId,
      applicationId: asString(data?.application_id) || asString(data?.applicationId),
      leaseId: asString(data?.lease_id) || asString(data?.leaseId),
      tenantId,
      unitId: asString(data?.unit_id) || asString(data?.unitId),
      invitedEmail: normalizeEmail(data?.invited_email) || email,
      score: data?.status === "redeemed" ? 40 : 30,
    });
  }

  const allCandidates = Array.from(candidates.values());
  if (!allCandidates.length) {
    return {
      ok: false,
      authority: null,
      propertyId: null,
      rc_prop_id: null,
      applicationId: null,
      leaseId: null,
      tenantId,
      unitId: null,
      invitedEmail: email,
      reason: "no_authority",
    };
  }

  const propertyIds = Array.from(new Set(allCandidates.map((candidate) => candidate.propertyId)));
  if (propertyIds.length !== 1) {
    return {
      ok: false,
      authority: null,
      propertyId: null,
      rc_prop_id: null,
      applicationId: null,
      leaseId: null,
      tenantId,
      unitId: null,
      invitedEmail: email,
      reason: "ambiguous_authority",
    };
  }

  allCandidates.sort((left, right) => right.score - left.score);
  const winner = allCandidates[0];

  return {
    ok: true,
    authority: winner.authority,
    propertyId: winner.propertyId,
    rc_prop_id: await resolveRcPropId(winner.propertyId),
    applicationId: winner.applicationId,
    leaseId: winner.leaseId,
    tenantId: winner.tenantId,
    unitId: winner.unitId,
    invitedEmail: winner.invitedEmail,
  };
}
