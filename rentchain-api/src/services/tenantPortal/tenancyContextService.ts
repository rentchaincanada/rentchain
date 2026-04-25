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

type TenantRecordMatch = {
  id: string;
  data: any;
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

async function resolveTenantRecordMatch(identity: TenantWorkspaceIdentity): Promise<TenantRecordMatch | null> {
  const tenantId = asString(identity.tenantId);
  const email = normalizeEmail(identity.email);

  if (tenantId) {
    try {
      const direct = await db.collection("tenants").doc(tenantId).get();
      if (direct.exists) {
        return {
          id: direct.id,
          data: (direct.data() || {}) as any,
        };
      }
    } catch {
      // ignore direct lookup errors
    }

    const byTenantId = await safeGetDocs("tenants", "tenantId", tenantId);
    if (byTenantId.length === 1) {
      return {
        id: byTenantId[0].id,
        data: (byTenantId[0].data() || {}) as any,
      };
    }
  }

  if (!email) return null;
  const byEmail = await safeGetDocs("tenants", "email", email);
  if (byEmail.length !== 1) return null;

  const match = byEmail[0];
  const data = (match.data() || {}) as any;
  const recordEmail = normalizeEmail(data?.email);
  if (!recordEmail || recordEmail !== email) return null;

  return {
    id: match.id,
    data,
  };
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

  const tenantRecord = await resolveTenantRecordMatch(identity);
  const tenantRecordId = tenantRecord?.id || tenantId;
  const tenantRecordData = tenantRecord?.data || null;
  const tenantRecordLeaseId =
    asString(tenantRecordData?.leaseId) ||
    asString(tenantRecordData?.currentLeaseId) ||
    asString(identity.leaseId);
  const tenantRecordPropertyId = asString(tenantRecordData?.propertyId);
  const tenantRecordUnitId =
    asString(tenantRecordData?.unitId) ||
    asString(tenantRecordData?.unit) ||
    null;
  const tenantRecordEmail = normalizeEmail(tenantRecordData?.email) || email;

  if (tenantRecordPropertyId) {
    pushCandidate({
      authority: "active_tenant",
      propertyId: tenantRecordPropertyId,
      applicationId: null,
      leaseId: tenantRecordLeaseId,
      tenantId: asString(tenantRecordData?.tenantId) || tenantRecordId,
      unitId: tenantRecordUnitId,
      invitedEmail: tenantRecordEmail,
      score: tenantRecordLeaseId ? 95 : 80,
    });
  }

  const applicationDocs = [
    ...(email ? await safeGetDocs("applications", "applicantEmail", email) : []),
    ...(email ? await safeGetDocs("applications", "email", email) : []),
    ...(uid ? await safeGetDocs("applications", "applicantUserId", uid) : []),
    ...(uid ? await safeGetDocs("applications", "userId", uid) : []),
    ...(tenantRecordId ? await safeGetDocs("applications", "tenantId", tenantRecordId) : []),
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
      tenantId: asString(data?.tenantId) || tenantRecordId,
      unitId: asString(data?.unitId) || asString(data?.unitApplied) || asString(data?.unit),
      invitedEmail: email,
      score: 20,
    });
  }

  const leaseDocs = [
    ...(tenantRecordId ? await safeGetDocs("leases", "tenantId", tenantRecordId) : []),
    ...(tenantRecordId ? await safeGetDocs("leases", "tenantIds", tenantRecordId, "array-contains") : []),
    ...(tenantRecordLeaseId ? [await db.collection("leases").doc(String(tenantRecordLeaseId)).get().catch(() => null as any)] : []),
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
      tenantId: asString(data?.tenantId) || tenantRecordId,
      unitId: asString(data?.unitId) || asString(data?.unitNumber) || asString(data?.unitLabel),
      invitedEmail: email,
      score: 100,
    });
  }

  const tenancyDocs = tenantRecordId ? await safeGetDocs("tenancies", "tenantId", tenantRecordId) : [];
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
      tenantId: tenantRecordId,
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
      tenantId: tenantRecordId,
      unitId: null,
      invitedEmail: tenantRecordEmail,
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
      tenantId: tenantRecordId,
      unitId: null,
      invitedEmail: tenantRecordEmail,
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
