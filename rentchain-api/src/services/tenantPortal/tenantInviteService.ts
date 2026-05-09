import crypto from "crypto";
import { db, FieldValue } from "../../config/firebase";
import { recordTenantEvent } from "./tenantEventLogService";

export type CreateTenancyInviteInput = {
  landlordId: string;
  rcPropId?: string | null;
  propertyId: string;
  applicationId?: string | null;
  invitedEmail?: string | null;
  invitedName?: string | null;
  unitId?: string | null;
  leaseId?: string | null;
  expiresAt?: number | null;
  createdBy: string;
};

export type RedeemTenancyInviteInput = {
  token: string;
  redeemedByUid: string;
  redeemedByEmail?: string | null;
};

export type TenancyInviteRecord = {
  id: string;
  tokenHash: string;
  tokenPreview: string;
  landlordId: string;
  rc_prop_id: string | null;
  propertyId: string;
  applicationId: string | null;
  unitId: string | null;
  leaseId: string | null;
  invitedEmail: string | null;
  invitedName: string | null;
  status: "pending" | "redeemed" | "expired" | "superseded";
  createdAt: number | null;
  expiresAt: number | null;
  redeemedAt: number | null;
  redeemedByUid: string | null;
};

function nowMillis(): number {
  return Date.now();
}

function normalizeEmail(value: unknown): string | null {
  const next = String(value || "").trim().toLowerCase();
  return next || null;
}

function previewToken(token: string): string {
  if (!token) return "none";
  return `${token.slice(0, 6)}...${token.slice(-4)}`;
}

export function hashTenancyInviteToken(token: string): string {
  return crypto.createHash("sha256").update(String(token || "").trim()).digest("hex");
}

function mapInvite(docId: string, data: any): TenancyInviteRecord {
  return {
    id: docId,
    tokenHash: String(data?.token_hash || docId),
    tokenPreview: String(data?.token_preview || ""),
    landlordId: String(data?.landlord_id || data?.landlordId || ""),
    rc_prop_id: String(data?.rc_prop_id || "").trim() || null,
    propertyId: String(data?.property_id || data?.propertyId || ""),
    applicationId: String(data?.application_id || data?.applicationId || "").trim() || null,
    unitId: String(data?.unit_id || data?.unitId || "").trim() || null,
    leaseId: String(data?.lease_id || data?.leaseId || "").trim() || null,
    invitedEmail: normalizeEmail(data?.invited_email || data?.invitedEmail),
    invitedName: String(data?.invited_name || data?.invitedName || "").trim() || null,
    status:
      data?.status === "redeemed"
        ? "redeemed"
        : data?.status === "expired"
        ? "expired"
        : data?.status === "superseded"
        ? "superseded"
        : "pending",
    createdAt: typeof data?.created_at === "number" ? data.created_at : typeof data?.createdAt === "number" ? data.createdAt : null,
    expiresAt: typeof data?.expires_at === "number" ? data.expires_at : typeof data?.expiresAt === "number" ? data.expiresAt : null,
    redeemedAt: typeof data?.redeemed_at === "number" ? data.redeemed_at : typeof data?.redeemedAt === "number" ? data.redeemedAt : null,
    redeemedByUid: String(data?.redeemed_by_uid || data?.redeemedByUid || "").trim() || null,
  };
}

async function findPendingInviteForContext(input: CreateTenancyInviteInput): Promise<TenancyInviteRecord | null> {
  const landlordId = String(input.landlordId || "").trim();
  const propertyId = String(input.propertyId || "").trim();
  const invitedEmail = normalizeEmail(input.invitedEmail);
  if (!landlordId || !propertyId || !invitedEmail) return null;

  const snap = await db.collection("tenancy_invites").where("landlord_id", "==", landlordId).get();
  const now = nowMillis();
  const matches = snap.docs
    .map((doc: any) => mapInvite(doc.id, doc.data() as any))
    .filter((invite) => {
      if (invite.status !== "pending") return false;
      if (invite.expiresAt && invite.expiresAt <= now) return false;
      return (
        invite.propertyId === propertyId &&
        invite.invitedEmail === invitedEmail &&
        String(invite.applicationId || "") === String(input.applicationId || "") &&
        String(invite.unitId || "") === String(input.unitId || "") &&
        String(invite.leaseId || "") === String(input.leaseId || "")
      );
    })
    .sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0));

  return matches[0] || null;
}

async function supersedeInvite(invite: TenancyInviteRecord, replacementTokenPreview: string, actorId: string) {
  const now = nowMillis();
  await db.collection("tenancy_invites").doc(invite.id).set(
    {
      status: "superseded",
      superseded_at: now,
      superseded_by_token_preview: replacementTokenPreview,
      updated_at: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  await recordTenantEvent({
    eventType: "tenant_invite_superseded",
    entityType: "tenancy_invite",
    entityId: invite.id,
    createdBy: actorId,
    context: {
      rc_prop_id: invite.rc_prop_id,
      propertyId: invite.propertyId,
      applicationId: invite.applicationId,
    },
    payload: {
      invitedEmail: invite.invitedEmail,
      tokenPreview: invite.tokenPreview,
      replacementTokenPreview,
    },
  });
}

export async function createTenancyInvite(input: CreateTenancyInviteInput): Promise<{
  token: string;
  invite: TenancyInviteRecord;
}> {
  const token = crypto.randomBytes(24).toString("base64url");
  const tokenHash = hashTenancyInviteToken(token);
  const createdAt = nowMillis();
  const expiresAt = typeof input.expiresAt === "number" ? input.expiresAt : createdAt + 7 * 24 * 60 * 60 * 1000;

  const payload = {
    token_hash: tokenHash,
    token_preview: previewToken(token),
    landlord_id: String(input.landlordId || "").trim(),
    rc_prop_id: String(input.rcPropId || "").trim() || null,
    property_id: String(input.propertyId || "").trim(),
    application_id: String(input.applicationId || "").trim() || null,
    unit_id: String(input.unitId || "").trim() || null,
    lease_id: String(input.leaseId || "").trim() || null,
    invited_email: normalizeEmail(input.invitedEmail),
    invited_name: String(input.invitedName || "").trim() || null,
    status: "pending",
    created_at: createdAt,
    expires_at: expiresAt,
    redeemed_at: null,
    redeemed_by_uid: null,
    updated_at: FieldValue.serverTimestamp(),
  };

  await db.collection("tenancy_invites").doc(tokenHash).set(payload);

  await recordTenantEvent({
    eventType: "tenant_invite_created",
    entityType: "tenancy_invite",
    entityId: tokenHash,
    createdBy: input.createdBy,
    context: {
      rc_prop_id: payload.rc_prop_id,
      propertyId: payload.property_id,
      applicationId: payload.application_id,
    },
    payload: {
      invitedEmail: payload.invited_email,
      expiresAt,
      tokenPreview: payload.token_preview,
    },
  });

  return {
    token,
    invite: mapInvite(tokenHash, payload),
  };
}

export async function createReplacementTenancyInvite(input: CreateTenancyInviteInput): Promise<{
  token: string;
  invite: TenancyInviteRecord;
  replacedInviteId: string | null;
}> {
  const existing = await findPendingInviteForContext(input);
  const created = await createTenancyInvite(input);
  if (existing) {
    await supersedeInvite(existing, created.invite.tokenPreview, String(input.createdBy || input.landlordId || "system"));
  }
  return { ...created, replacedInviteId: existing?.id || null };
}

export async function resolveTenancyInviteByToken(token: string): Promise<TenancyInviteRecord | null> {
  const tokenHash = hashTenancyInviteToken(token);
  const snap = await db.collection("tenancy_invites").doc(tokenHash).get();
  if (!snap.exists) return null;
  return mapInvite(snap.id, snap.data() as any);
}

export async function listTenancyInvitesForLandlord(landlordId: string): Promise<TenancyInviteRecord[]> {
  const snap = await db.collection("tenancy_invites").where("landlord_id", "==", String(landlordId || "").trim()).get();
  return snap.docs
    .map((doc) => mapInvite(doc.id, doc.data() as any))
    .sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0));
}

export async function redeemTenancyInvite(input: RedeemTenancyInviteInput): Promise<{
  ok: boolean;
  invite?: TenancyInviteRecord;
  error?: "invite_not_found" | "invite_expired" | "invite_used" | "invite_email_mismatch";
}> {
  const tokenHash = hashTenancyInviteToken(input.token);
  const ref = db.collection("tenancy_invites").doc(tokenHash);
  const snap = await ref.get();
  if (!snap.exists) return { ok: false, error: "invite_not_found" };

  const invite = mapInvite(snap.id, snap.data() as any);
  const now = nowMillis();

  if (invite.expiresAt && invite.expiresAt < now) {
    await ref.set({ status: "expired", updated_at: FieldValue.serverTimestamp() }, { merge: true });
    return { ok: false, error: "invite_expired" };
  }
  if (invite.status === "redeemed") {
    return { ok: false, error: "invite_used" };
  }
  if (invite.status === "superseded" || invite.status === "expired") {
    return { ok: false, error: "invite_expired" };
  }

  const redeemedEmail = normalizeEmail(input.redeemedByEmail);
  if (invite.invitedEmail && redeemedEmail && invite.invitedEmail !== redeemedEmail) {
    return { ok: false, error: "invite_email_mismatch" };
  }

  const update = {
    status: "redeemed",
    redeemed_at: now,
    redeemed_by_uid: String(input.redeemedByUid || "").trim(),
    redeemed_by_email: redeemedEmail,
    updated_at: FieldValue.serverTimestamp(),
  };

  await ref.set(update, { merge: true });

  await recordTenantEvent({
    eventType: "tenant_invite_redeemed",
    entityType: "tenancy_invite",
    entityId: tokenHash,
    createdBy: String(input.redeemedByUid || "").trim(),
    context: {
      propertyId: invite.propertyId,
      applicationId: invite.applicationId,
      rc_prop_id: invite.rc_prop_id,
    },
    payload: {
      invitedEmail: invite.invitedEmail,
      redeemedByUid: input.redeemedByUid,
      tokenPreview: invite.tokenPreview,
    },
  });

  return {
    ok: true,
    invite: mapInvite(invite.id, { ...snap.data(), ...update }),
  };
}
