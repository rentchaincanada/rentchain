import { Router } from "express";
import { db } from "../firebase";
import { requireAuth } from "../middleware/requireAuth";
import { requireLandlord } from "../middleware/requireLandlord";
import { deriveAssetTokenizationReadiness } from "../lib/assetTokenizationReadiness/deriveAssetTokenizationReadiness";
import { deriveAuditComplianceReadiness } from "../lib/auditCompliance/deriveAuditComplianceReadiness";
import { deriveInstitutionExportPackage } from "../lib/institutionExports/deriveInstitutionExportPackage";
import { deriveRegulatoryProfile } from "../lib/regulatoryProfiles/deriveRegulatoryProfile";
import { deriveSettlementReadiness } from "../lib/settlementReadiness/deriveSettlementReadiness";
import { buildPaymentObligationLedgerRows } from "../lib/payments/paymentObligationLedger";
import type {
  AssetTokenizationAssetType,
  AssetTokenizationReadiness,
  AssetTokenizationReadinessStatus,
} from "../lib/assetTokenizationReadiness/assetTokenizationReadinessTypes";

const router = Router();
const STATUSES = new Set<AssetTokenizationReadinessStatus>(["eligible_for_review", "partially_ready", "blocked", "unknown"]);
const ASSET_TYPES = new Set<AssetTokenizationAssetType>(["property", "lease_cashflow", "operational_asset"]);

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

function filterContext(records: any[], propertyId: string) {
  if (!propertyId) return records;
  return records.filter((record) => {
    return (
      asString(record?.propertyId || record?.id, 240) === propertyId ||
      asString(record?.scopeId, 240) === propertyId
    );
  });
}

function itemMatches(item: AssetTokenizationReadiness, id: string) {
  return item.assetReadinessId === id;
}

async function buildReadinessItems(landlordId: string, filters: { propertyId: string; assetType: AssetTokenizationAssetType | "" }) {
  const [
    propertiesRaw,
    leasesRaw,
    paymentIntentsRaw,
    rentPaymentsRaw,
    reconciliationRaw,
    maintenanceRaw,
    registryStatuses,
    screeningOrders,
    consents,
    sharingRooms,
    evidencePacksRaw,
    reviewsRaw,
    eventsRaw,
  ] = await Promise.all([
    loadLandlordCollection("properties", landlordId),
    loadLandlordCollection("leases", landlordId),
    loadLandlordCollection("paymentIntents", landlordId),
    loadLandlordCollection("rentPayments", landlordId),
    loadLandlordCollection("paymentReconciliationRecords", landlordId),
    loadLandlordCollection("maintenanceRequests", landlordId),
    loadLandlordCollection("propertyRegistryStatuses", landlordId),
    loadLandlordCollection("screeningOrders", landlordId),
    loadLandlordCollection("consents", landlordId),
    loadLandlordCollection("institutionalSharingRooms", landlordId),
    loadLandlordCollection("evidencePacks", landlordId),
    loadLandlordCollection("operatorReviewSessions", landlordId),
    loadLandlordCollection("events", landlordId),
  ]);

  const properties = filterContext(propertiesRaw, filters.propertyId);
  const leases = filterContext(leasesRaw, filters.propertyId);
  const propertyIds = new Set(properties.map((property) => asString(property.propertyId || property.id, 240)).filter(Boolean));
  const scopedPaymentIntents = filterContext(paymentIntentsRaw, filters.propertyId);
  const scopedRentPayments = filterContext(rentPaymentsRaw, filters.propertyId);
  const scopedReconciliation = filterContext(reconciliationRaw, filters.propertyId);
  const scopedMaintenance = filterContext(maintenanceRaw, filters.propertyId);
  const scopedEvidence = filterContext(evidencePacksRaw, filters.propertyId);
  const scopedReviews = filterContext(reviewsRaw, filters.propertyId);
  const scopedEvents = filterContext(eventsRaw, filters.propertyId);
  const obligationRows = buildPaymentObligationLedgerRows({
    leases,
    paymentIntents: scopedPaymentIntents,
    rentPayments: scopedRentPayments,
    reconciliationRecords: scopedReconciliation,
  });
  const settlementReadiness = deriveSettlementReadiness({
    landlordId,
    propertyId: filters.propertyId,
    obligationRows,
    reconciliationRecords: scopedReconciliation,
    evidencePacks: scopedEvidence,
    operatorReviewSessions: scopedReviews,
    auditEvents: scopedEvents,
  });
  const institutionExportPackage = deriveInstitutionExportPackage({
    packageType: "lender_due_diligence",
    landlordId,
    properties,
    leases,
    maintenanceRequests: scopedMaintenance,
    auditEvents: scopedEvents,
    decisionItems: [],
  });
  const auditComplianceReadiness = deriveAuditComplianceReadiness({
    scope: filters.propertyId ? "property" : "landlord_portfolio",
    landlordId,
    properties,
    leases,
    rentPayments: scopedRentPayments,
    decisions: [],
    auditEvents: scopedEvents,
    policyEvents: scopedEvents.filter((event) => asString(event.domain, 80) === "policy"),
    institutionExportPackage,
  });
  const regulatoryProfile = deriveRegulatoryProfile({
    landlordId,
    properties,
    registryStatuses: registryStatuses.filter((record) => !propertyIds.size || propertyIds.has(asString(record.propertyId || record.id, 240))),
    screeningOrders,
    consentRecords: consents,
    sharingRooms,
    institutionExportPackages: [institutionExportPackage],
    evidencePacks: scopedEvidence,
    operatorReviewSessions: scopedReviews,
    auditEvents: scopedEvents,
    auditComplianceReadiness,
    settlementReadiness,
  });
  const readiness = deriveAssetTokenizationReadiness({
    landlordId,
    propertyId: filters.propertyId,
    assetType: filters.assetType || "property",
    properties,
    leases,
    obligationRows,
    maintenanceRequests: scopedMaintenance,
    evidencePacks: scopedEvidence,
    operatorReviewSessions: scopedReviews,
    auditEvents: scopedEvents,
    settlementReadiness,
    regulatoryProfiles: [regulatoryProfile],
  });
  return [readiness];
}

router.get("/asset-tokenization-readiness", requireAuth, requireLandlord, async (req: any, res) => {
  try {
    const landlordId = landlordIdFromReq(req);
    if (!landlordId) return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });
    const propertyId = asString(req.query?.propertyId, 240);
    const assetType = asString(req.query?.assetType, 80) as AssetTokenizationAssetType | "";
    const status = asString(req.query?.status, 80) as AssetTokenizationReadinessStatus;
    let readiness = await buildReadinessItems(landlordId, { propertyId, assetType: ASSET_TYPES.has(assetType as any) ? assetType : "" });
    if (status && STATUSES.has(status)) readiness = readiness.filter((item) => item.status === status);
    return res.json({ ok: true, readiness });
  } catch (err: any) {
    console.error("[landlord-asset-tokenization-readiness] list failed", err?.message || err);
    return res.status(500).json({ ok: false, error: "ASSET_TOKENIZATION_READINESS_FAILED" });
  }
});

router.get("/asset-tokenization-readiness/:assetReadinessId", requireAuth, requireLandlord, async (req: any, res) => {
  try {
    const landlordId = landlordIdFromReq(req);
    const assetReadinessId = decodeURIComponent(asString(req.params?.assetReadinessId, 500));
    if (!landlordId || !assetReadinessId) return res.status(400).json({ ok: false, error: "ASSET_READINESS_ID_REQUIRED" });
    const readiness = await buildReadinessItems(landlordId, { propertyId: "", assetType: "" });
    const item = readiness.find((next) => itemMatches(next, assetReadinessId));
    if (!item) return res.status(404).json({ ok: false, error: "ASSET_READINESS_NOT_FOUND" });
    return res.json({ ok: true, readiness: item });
  } catch (err: any) {
    console.error("[landlord-asset-tokenization-readiness] get failed", err?.message || err);
    return res.status(500).json({ ok: false, error: "ASSET_TOKENIZATION_READINESS_GET_FAILED" });
  }
});

export default router;
