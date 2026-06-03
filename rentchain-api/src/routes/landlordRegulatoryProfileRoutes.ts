import { Router } from "express";
import { db } from "../firebase";
import { requireAuth } from "../middleware/requireAuth";
import { requireLandlord } from "../middleware/requireLandlord";
import { deriveAuditComplianceReadiness } from "../lib/auditCompliance/deriveAuditComplianceReadiness";
import { deriveInstitutionExportPackage } from "../lib/institutionExports/deriveInstitutionExportPackage";
import { deriveRegulatoryProfile } from "../lib/regulatoryProfiles/deriveRegulatoryProfile";
import { deriveSettlementReadiness } from "../lib/settlementReadiness/deriveSettlementReadiness";
import { buildPaymentObligationLedgerRows } from "../lib/payments/paymentObligationLedger";
import type { RegulatoryProfile, RegulatoryProfileStatus } from "../lib/regulatoryProfiles/regulatoryProfileTypes";

const router = Router();
const STATUSES = new Set<RegulatoryProfileStatus>(["ready_for_review", "partially_ready", "blocked", "unknown"]);

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
    for (const doc of snap?.docs || []) byId.set(doc.id, { id: doc.id, ...((doc.data() as any) || {}) });
  }
  await Promise.all([collect("landlordId"), collect("ownerId"), collect("userId")]);
  return Array.from(byId.values()).filter((record) =>
    [record?.landlordId, record?.ownerId, record?.userId].some((value) => asString(value, 240) === landlordId)
  );
}

function filterJurisdiction(records: any[], filters: { province: string; municipality: string }) {
  return records.filter((record) => {
    if (filters.province) {
      const province = asString(record?.province || record?.provinceState || record?.state, 80).toUpperCase();
      if (province !== filters.province.toUpperCase()) return false;
    }
    if (filters.municipality) {
      const municipality = asString(record?.municipality || record?.city, 160).toLowerCase();
      if (municipality !== filters.municipality.toLowerCase()) return false;
    }
    return true;
  });
}

function profileMatches(profile: RegulatoryProfile, id: string) {
  return profile.regulatoryProfileId === id;
}

async function buildProfiles(landlordId: string, filters: { country: string; province: string; municipality: string }) {
  const [propertiesRaw, registryStatuses, screeningOrders, consents, sharingRooms, evidencePacks, reviews, events, leases, paymentIntents, rentPayments, reconciliationRecords] =
    await Promise.all([
      loadLandlordCollection("properties", landlordId),
      loadLandlordCollection("propertyRegistryStatuses", landlordId),
      loadLandlordCollection("screeningOrders", landlordId),
      loadLandlordCollection("consents", landlordId),
      loadLandlordCollection("institutionalSharingRooms", landlordId),
      loadLandlordCollection("evidencePacks", landlordId),
      loadLandlordCollection("operatorReviewSessions", landlordId),
      loadLandlordCollection("events", landlordId),
      loadLandlordCollection("leases", landlordId),
      loadLandlordCollection("paymentIntents", landlordId),
      loadLandlordCollection("rentPayments", landlordId),
      loadLandlordCollection("paymentReconciliationRecords", landlordId),
    ]);
  const properties = filterJurisdiction(propertiesRaw, filters);
  const obligationRows = buildPaymentObligationLedgerRows({ leases, paymentIntents, rentPayments, reconciliationRecords });
  const settlementReadiness = deriveSettlementReadiness({
    landlordId,
    obligationRows,
    reconciliationRecords,
    evidencePacks,
    operatorReviewSessions: reviews,
    auditEvents: events,
  });
  const institutionExportPackage = deriveInstitutionExportPackage({
    packageType: "lender_due_diligence",
    landlordId,
    properties,
    leases,
    maintenanceRequests: [],
    auditEvents: events,
    decisionItems: [],
  });
  const auditComplianceReadiness = deriveAuditComplianceReadiness({
    scope: "landlord_portfolio",
    landlordId,
    properties,
    leases,
    rentPayments,
    decisions: [],
    auditEvents: events,
    policyEvents: events.filter((event) => asString(event.domain, 80) === "policy"),
    institutionExportPackage,
  });
  const profile = deriveRegulatoryProfile({
    landlordId,
    country: filters.country || "CA",
    province: filters.province,
    municipality: filters.municipality,
    properties,
    registryStatuses,
    screeningOrders,
    consentRecords: consents,
    sharingRooms,
    institutionExportPackages: [institutionExportPackage],
    evidencePacks,
    operatorReviewSessions: reviews,
    auditEvents: events,
    auditComplianceReadiness,
    settlementReadiness,
  });
  return [profile];
}

router.get("/regulatory-profiles", requireAuth, requireLandlord, async (req: any, res) => {
  try {
    const landlordId = landlordIdFromReq(req);
    if (!landlordId) return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });
    const filters = {
      country: asString(req.query?.country, 20) || "CA",
      province: asString(req.query?.province, 80),
      municipality: asString(req.query?.municipality, 160),
    };
    const status = asString(req.query?.status, 80) as RegulatoryProfileStatus;
    let profiles = await buildProfiles(landlordId, filters);
    if (status && STATUSES.has(status)) profiles = profiles.filter((profile) => profile.status === status);
    return res.json({ ok: true, profiles });
  } catch (err: any) {
    console.error("[landlord-regulatory-profiles] list failed", err?.message || err);
    return res.status(500).json({ ok: false, error: "REGULATORY_PROFILES_FAILED" });
  }
});

router.get("/regulatory-profiles/:regulatoryProfileId", requireAuth, requireLandlord, async (req: any, res) => {
  try {
    const landlordId = landlordIdFromReq(req);
    const regulatoryProfileId = decodeURIComponent(asString(req.params?.regulatoryProfileId, 500));
    if (!landlordId || !regulatoryProfileId) return res.status(400).json({ ok: false, error: "REGULATORY_PROFILE_ID_REQUIRED" });
    const profiles = await buildProfiles(landlordId, { country: "CA", province: "", municipality: "" });
    const profile = profiles.find((item) => profileMatches(item, regulatoryProfileId));
    if (!profile) return res.status(404).json({ ok: false, error: "REGULATORY_PROFILE_NOT_FOUND" });
    return res.json({ ok: true, profile });
  } catch (err: any) {
    console.error("[landlord-regulatory-profiles] get failed", err?.message || err);
    return res.status(500).json({ ok: false, error: "REGULATORY_PROFILE_GET_FAILED" });
  }
});

export default router;
