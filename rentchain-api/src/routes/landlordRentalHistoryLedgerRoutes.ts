import { Router } from "express";
import { db } from "../firebase";
import { requireAuth } from "../middleware/requireAuth";
import { requireLandlord } from "../middleware/requireLandlord";
import { deriveDecisionInbox } from "../lib/decisions/deriveDecisionInbox";
import { CANONICAL_EVENTS_COLLECTION } from "../lib/events/buildEvent";
import { deriveIdentityProfile } from "../lib/identityLayer/deriveIdentityProfile";
import { deriveVerifiedRentalHistory } from "../lib/rentalHistoryLedger/deriveVerifiedRentalHistory";
import type { VerifiedRentalHistoryLedger } from "../lib/rentalHistoryLedger/rentalHistoryLedgerTypes";

const router = Router();

function asString(value: unknown, max = 500): string {
  return String(value ?? "").trim().slice(0, max);
}

function landlordIdFromReq(req: any) {
  return asString(req.user?.landlordId || req.user?.id || req.user?.sub, 240);
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

async function loadLandlordDecisionItems(landlordId: string) {
  const analyticsDecisions = new Map<string, any>();
  async function collectAnalytics(collectionName: string) {
    const records = await loadLandlordCollection(collectionName, landlordId).catch(() => []);
    for (const record of records) {
      const decisions = Array.isArray(record?.decisions?.items)
        ? record.decisions.items
        : Array.isArray(record?.decisions)
          ? record.decisions
          : [];
      for (const decision of decisions) {
        const id = asString(decision?.id || decision?.decisionId, 600);
        if (id) analyticsDecisions.set(id, decision);
      }
    }
  }
  await Promise.all([collectAnalytics("landlordAnalyticsSnapshots"), collectAnalytics("analyticsSnapshots")]);
  return deriveDecisionInbox({ analyticsDecisions: Array.from(analyticsDecisions.values()) }).items;
}

async function loadLandlordCanonicalEvents(landlordId: string) {
  const snap = await db.collection(CANONICAL_EVENTS_COLLECTION).get().catch(() => null);
  return (snap?.docs || [])
    .map((doc: any) => ({ id: doc.id, ...((doc.data() as any) || {}) }))
    .filter((event: any) => {
      const metadataLandlordId = asString(event?.metadata?.landlordId, 240);
      const topLevelLandlordId = asString(event?.landlordId || event?.ownerId || event?.userId, 240);
      return metadataLandlordId === landlordId || topLevelLandlordId === landlordId;
    })
    .filter((event: any) => !["admin", "internal", "tenant"].includes(asString(event?.visibility, 80)));
}

function includesTenant(record: Record<string, any>, tenantId: string) {
  const tenantIds = Array.isArray(record?.tenantIds) ? record.tenantIds.map((item: unknown) => asString(item, 500)) : [];
  return [record?.id, record?.tenantId, record?.tenantID, record?.primaryTenantId, record?.applicantTenantId]
    .map((value) => asString(value, 500))
    .concat(tenantIds)
    .includes(tenantId);
}

function tenantIdOf(record: Record<string, any>) {
  return asString(record?.id || record?.tenantId || record?.profileId, 500);
}

function filterByTenant(records: any[], tenantId: string, additionalKeys: string[] = []) {
  return records.filter((record) => {
    if (includesTenant(record, tenantId)) return true;
    return additionalKeys.some((key) => asString(record?.[key], 500) === tenantId);
  });
}

function ledgerMatches(ledger: VerifiedRentalHistoryLedger, ledgerIdOrIdentityId: string) {
  return ledger.ledgerId === ledgerIdOrIdentityId || ledger.identityId === ledgerIdOrIdentityId || ledger.identityId === `tenant:${ledgerIdOrIdentityId}`;
}

async function buildLedgers(landlordId: string, identityId?: string) {
  const [
    tenants,
    leases,
    properties,
    maintenanceRequests,
    decisions,
    operatorReviewSessions,
    evidencePacks,
    events,
    canonicalEvents,
    consents,
    registryStatuses,
  ] = await Promise.all([
    loadLandlordCollection("tenants", landlordId),
    loadLandlordCollection("leases", landlordId),
    loadLandlordCollection("properties", landlordId),
    loadLandlordCollection("maintenanceRequests", landlordId),
    loadLandlordDecisionItems(landlordId),
    loadLandlordCollection("operatorReviewSessions", landlordId),
    loadLandlordCollection("evidencePacks", landlordId),
    loadLandlordCollection("events", landlordId),
    loadLandlordCanonicalEvents(landlordId),
    loadLandlordCollection("consents", landlordId),
    loadLandlordCollection("propertyRegistryStatuses", landlordId),
  ]);

  const tenantIds = new Set<string>();
  for (const tenant of tenants) {
    const id = tenantIdOf(tenant);
    if (id) tenantIds.add(id);
  }
  for (const lease of leases) {
    const id = asString(lease.tenantId, 500);
    if (id) tenantIds.add(id);
    for (const tenantId of Array.isArray(lease.tenantIds) ? lease.tenantIds : []) {
      const safe = asString(tenantId, 500);
      if (safe) tenantIds.add(safe);
    }
  }

  const requested = asString(identityId, 500).replace(/^tenant:/, "");
  const targetTenantIds = requested ? Array.from(tenantIds).filter((tenantId) => tenantId === requested) : Array.from(tenantIds);
  const auditEvents = [...events, ...canonicalEvents];

  return targetTenantIds
    .map((tenantId) => {
      const tenant = tenants.find((record) => tenantIdOf(record) === tenantId) || null;
      const tenantLeases = filterByTenant(leases, tenantId);
      const tenantPropertyIds = new Set(tenantLeases.map((lease) => asString(lease.propertyId, 500)).filter(Boolean));
      const tenantProperties = properties.filter((property) =>
        [property.id, property.propertyId].some((value: unknown) => tenantPropertyIds.has(asString(value, 500)))
      );
      const tenantReviews = filterByTenant(operatorReviewSessions, tenantId, ["scopeId", "actorId", "openedById"]);
      const tenantConsents = filterByTenant(consents, tenantId, ["identityId", "scopeId"]);
      const identityProfile = deriveIdentityProfile({
        identityType: "tenant",
        identityId: tenantId,
        tenant,
        consentRecords: tenantConsents,
        reviewSessions: tenantReviews,
        canonicalEvents: auditEvents.filter((event) => filterByTenant([event], tenantId, ["resourceId", "scopeId"]).length),
        registryStatus: registryStatuses.find((status) => tenantPropertyIds.has(asString(status.propertyId, 500))) || null,
      });

      return deriveVerifiedRentalHistory({
        landlordId,
        identityId: tenantId,
        tenant,
        leases: tenantLeases,
        properties: tenantProperties,
        maintenanceRequests: filterByTenant(maintenanceRequests, tenantId, ["leaseId"]),
        decisions,
        operatorReviewSessions: tenantReviews,
        evidencePacks: filterByTenant(evidencePacks, tenantId, ["scopeId", "leaseId", "identityId"]),
        identityReferences: identityProfile.verificationReferences,
        consentRecords: tenantConsents,
        canonicalEvents: auditEvents.filter((event) => filterByTenant([event], tenantId, ["resourceId", "scopeId", "leaseId"]).length),
      });
    })
    .sort((a, b) => a.identityId.localeCompare(b.identityId));
}

router.get("/rental-history-ledger", requireAuth, requireLandlord, async (req: any, res) => {
  try {
    const landlordId = landlordIdFromReq(req);
    if (!landlordId) return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });
    const identityId = asString(req.query?.identityId, 500);
    const propertyId = asString(req.query?.propertyId, 500);
    const status = asString(req.query?.status, 80);
    let ledgers = await buildLedgers(landlordId, identityId);
    if (propertyId) {
      ledgers = ledgers.filter((ledger) =>
        ledger.historyEntries.some((entry) => entry.propertyReference?.referenceId === `property:${propertyId}`)
      );
    }
    if (status) {
      ledgers = ledgers.filter((ledger) => ledger.status === status);
    }
    return res.json({ ok: true, ledgers });
  } catch (err: any) {
    console.error("[landlord-rental-history-ledger] list failed", err?.message || err);
    return res.status(500).json({ ok: false, error: "RENTAL_HISTORY_LEDGER_FAILED" });
  }
});

router.get("/rental-history-ledger/:ledgerId", requireAuth, requireLandlord, async (req: any, res) => {
  try {
    const landlordId = landlordIdFromReq(req);
    const ledgerId = decodeURIComponent(asString(req.params?.ledgerId, 500));
    if (!landlordId || !ledgerId) return res.status(400).json({ ok: false, error: "RENTAL_HISTORY_LEDGER_ID_REQUIRED" });
    const ledgers = await buildLedgers(landlordId);
    const ledger = ledgers.find((item) => ledgerMatches(item, ledgerId));
    if (!ledger) return res.status(404).json({ ok: false, error: "RENTAL_HISTORY_LEDGER_NOT_FOUND" });
    return res.json({ ok: true, ledger });
  } catch (err: any) {
    console.error("[landlord-rental-history-ledger] get failed", err?.message || err);
    return res.status(500).json({ ok: false, error: "RENTAL_HISTORY_LEDGER_GET_FAILED" });
  }
});

export default router;
