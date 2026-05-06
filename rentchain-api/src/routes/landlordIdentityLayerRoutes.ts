import { Router } from "express";
import { db } from "../config/firebase";
import { requireAuth } from "../middleware/requireAuth";
import { requireLandlord } from "../middleware/requireLandlord";
import { deriveIdentityProfile } from "../lib/identityLayer/deriveIdentityProfile";
import type { IdentityLayerType } from "../lib/identityLayer/identityLayerTypes";

const router = Router();

const IDENTITY_TYPES = new Set<IdentityLayerType>(["tenant", "property", "organization", "operator", "review_actor"]);

function asString(value: unknown, max = 240): string {
  const next = String(value ?? "").trim().slice(0, max);
  return next || "";
}

function requestedIdentityType(value: unknown): IdentityLayerType {
  const raw = asString(value, 80) as IdentityLayerType;
  return IDENTITY_TYPES.has(raw) ? raw : "tenant";
}

async function loadLandlordCollection(collectionName: string, landlordId: string) {
  const byId = new Map<string, any>();
  async function collect(field: "landlordId" | "ownerId" | "userId") {
    const snap = await db.collection(collectionName).where(field, "==", landlordId).get().catch(() => null);
    for (const doc of snap?.docs || []) {
      byId.set(doc.id, { id: doc.id, ...((doc.data() as any) || {}) });
    }
  }

  await Promise.all([collect("landlordId"), collect("ownerId"), collect("userId")]);

  return Array.from(byId.values()).filter((record) =>
    [record?.landlordId, record?.ownerId, record?.userId].some((value) => asString(value, 240) === landlordId)
  );
}

function selectRecord(records: any[], identityId: string, fields: string[]) {
  if (!records.length) return null;
  if (!identityId) return records[0];
  return (
    records.find((record) => {
      return [record?.id, ...fields.map((field) => record?.[field])].some((value) => asString(value, 400) === identityId);
    }) || null
  );
}

function relatedRecords(records: any[], identityId: string, fields: string[]) {
  if (!identityId) return records;
  return records.filter((record) => {
    return fields.some((field) => asString(record?.[field], 400) === identityId) || asString(record?.id, 400) === identityId;
  });
}

async function buildProfile(req: any) {
  const landlordId = asString(req.user?.landlordId || req.user?.id, 240);
  if (!landlordId) return null;

  const identityType = requestedIdentityType(req.query?.identityType);
  const identityId = asString(req.query?.identityId, 400);

  const [tenants, properties, organizations, reviews, events, consents, registryStatuses] = await Promise.all([
    loadLandlordCollection("tenants", landlordId),
    loadLandlordCollection("properties", landlordId),
    loadLandlordCollection("organizations", landlordId),
    loadLandlordCollection("operatorReviewSessions", landlordId),
    loadLandlordCollection("events", landlordId),
    loadLandlordCollection("consents", landlordId),
    loadLandlordCollection("propertyRegistryStatuses", landlordId),
  ]);

  const tenant = selectRecord(tenants, identityId, ["tenantId", "profileId"]);
  const property = selectRecord(properties, identityId, ["propertyId"]);
  const organization = selectRecord(organizations, identityId, ["organizationId"]);
  const operator = selectRecord(reviews, identityId, ["actorId", "openedById", "userId"]);
  const propertyId = asString(property?.id || property?.propertyId || identityId, 400);
  const registryStatus = selectRecord(registryStatuses, propertyId, ["propertyId"]);
  const consentRecords = relatedRecords(consents, identityId, ["identityId", "tenantId", "propertyId", "userId"]);
  const reviewSessions = relatedRecords(reviews, identityId, ["scopeId", "tenantId", "propertyId", "actorId", "openedById"]);
  const canonicalEvents = relatedRecords(events, identityId, ["resourceId", "tenantId", "propertyId", "actorId"]);

  return deriveIdentityProfile({
    identityType,
    identityId,
    tenant: identityType === "tenant" ? tenant : null,
    property: identityType === "property" ? property : null,
    organization: identityType === "organization" ? organization : null,
    operator: identityType === "operator" || identityType === "review_actor" ? operator : null,
    registryStatus: identityType === "property" ? registryStatus : null,
    consentRecords,
    reviewSessions,
    canonicalEvents,
  });
}

router.get("/identity-layer/profile", requireAuth, requireLandlord, async (req: any, res) => {
  try {
    const profile = await buildProfile(req);
    if (!profile) return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });
    return res.json({ ok: true, profile });
  } catch (err: any) {
    console.error("[landlord-identity-layer] profile failed", err?.message || err);
    return res.status(500).json({ ok: false, error: "IDENTITY_PROFILE_FAILED" });
  }
});

router.get("/identity-layer/status", requireAuth, requireLandlord, async (req: any, res) => {
  try {
    const profile = await buildProfile(req);
    if (!profile) return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });
    return res.json({
      ok: true,
      status: {
        identityId: profile.identityId,
        identityType: profile.identityType,
        status: profile.status,
        manualReviewRequired: profile.manualReviewRequired,
        publiclyShareable: profile.publiclyShareable,
        externalInstitutionSharingEnabled: profile.externalInstitutionSharingEnabled,
        tokenizationEnabled: profile.tokenizationEnabled,
      },
    });
  } catch (err: any) {
    console.error("[landlord-identity-layer] status failed", err?.message || err);
    return res.status(500).json({ ok: false, error: "IDENTITY_STATUS_FAILED" });
  }
});

export default router;
