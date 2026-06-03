import { Router } from "express";
import { db } from "../firebase";
import { requireAuth } from "../middleware/requireAuth";
import { requireLandlord } from "../middleware/requireLandlord";
import { deriveCrossOrganizationTrust } from "../lib/crossOrganizationTrust/deriveCrossOrganizationTrust";
import { deriveIdentityProfile } from "../lib/identityLayer/deriveIdentityProfile";
import { deriveNetworkParticipantProfile } from "../lib/networkParticipants/deriveNetworkParticipantProfile";
import { deriveRegulatoryProfile } from "../lib/regulatoryProfiles/deriveRegulatoryProfile";
import { deriveSettlementReadiness } from "../lib/settlementReadiness/deriveSettlementReadiness";
import { buildPaymentObligationLedgerRows } from "../lib/payments/paymentObligationLedger";
import type {
  CrossOrganizationTrustRelationship,
  CrossOrganizationTrustRelationshipType,
  CrossOrganizationTrustStatus,
} from "../lib/crossOrganizationTrust/crossOrganizationTrustTypes";
import type { NetworkParticipantType } from "../lib/networkParticipants/networkParticipantTypes";

const router = Router();
const RELATIONSHIP_TYPES = new Set<CrossOrganizationTrustRelationshipType>([
  "operational_trust",
  "evidence_trust",
  "review_trust",
  "settlement_trust",
  "regulatory_trust",
  "sharing_trust",
]);
const STATUSES = new Set<CrossOrganizationTrustStatus>(["verified", "partially_verified", "review_required", "blocked", "unknown"]);
const PARTICIPANT_TYPES: NetworkParticipantType[] = [
  "landlord",
  "operator",
  "lender",
  "insurer",
  "auditor",
  "regulator",
  "contractor",
  "institutional_partner",
  "review_actor",
];

function asString(value: unknown, max = 500): string {
  return String(value ?? "").trim().slice(0, max);
}

function landlordIdFromReq(req: any) {
  return asString(req.user?.landlordId || req.user?.id || req.user?.sub, 240);
}

async function loadLandlordCollection(collectionName: string, landlordId: string) {
  const byId = new Map<string, any>();
  async function collect(field: "landlordId" | "ownerId" | "userId" | "createdByLandlordId") {
    const snap = await db.collection(collectionName).where(field, "==", landlordId).get().catch(() => null);
    for (const doc of snap?.docs || []) byId.set(doc.id, { id: doc.id, ...((doc.data() as any) || {}) });
  }
  await Promise.all([collect("landlordId"), collect("ownerId"), collect("userId"), collect("createdByLandlordId")]);
  return Array.from(byId.values()).filter((record) =>
    [record?.landlordId, record?.ownerId, record?.userId, record?.createdByLandlordId].some((value) => asString(value, 240) === landlordId)
  );
}

function trustMatches(trust: CrossOrganizationTrustRelationship, id: string) {
  return trust.trustRelationshipId === id;
}

async function buildTrustRelationships(landlordId: string, relationshipType: CrossOrganizationTrustRelationshipType | "") {
  const [properties, registryStatuses, screeningOrders, consents, sharingRooms, evidencePacks, reviews, events, leases, paymentIntents, rentPayments, reconciliationRecords, contractors] =
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
      loadLandlordCollection("contractorProfiles", landlordId),
    ]);

  const obligationRows = buildPaymentObligationLedgerRows({ leases, paymentIntents, rentPayments, reconciliationRecords });
  const settlementReadiness = deriveSettlementReadiness({
    landlordId,
    obligationRows,
    reconciliationRecords,
    evidencePacks,
    operatorReviewSessions: reviews,
    auditEvents: events,
  });
  const regulatoryProfile = deriveRegulatoryProfile({
    landlordId,
    properties,
    registryStatuses,
    screeningOrders,
    consentRecords: consents,
    sharingRooms,
    institutionExportPackages: [],
    evidencePacks,
    operatorReviewSessions: reviews,
    auditEvents: events,
    settlementReadiness,
  });
  const networkParticipants = PARTICIPANT_TYPES.map((participantType) => {
    const identityProfile = deriveIdentityProfile({
      identityType: participantType === "operator" || participantType === "review_actor" ? participantType : "organization",
      identityId: participantType,
      organization: { id: participantType, organizationId: participantType },
      operator: reviews[0] || null,
      consentRecords: consents,
      reviewSessions: reviews,
      canonicalEvents: events,
    });
    return deriveNetworkParticipantProfile({
      landlordId,
      participantType,
      participantId: participantType,
      identityProfiles: [identityProfile],
      sharingRooms:
        participantType === "lender" || participantType === "insurer" || participantType === "auditor" || participantType === "regulator"
          ? sharingRooms.filter((room) => asString(room.accessControls?.institutionType || room.institutionType, 80) === participantType)
          : sharingRooms,
      operatorReviewSessions: reviews,
      evidencePacks,
      settlementReadiness,
      regulatoryProfiles: [regulatoryProfile],
      canonicalEvents: events,
      contractorProfiles: participantType === "contractor" ? contractors : [],
    });
  });

  const types = relationshipType ? [relationshipType] : Array.from(RELATIONSHIP_TYPES);
  return types.map((type) =>
    deriveCrossOrganizationTrust({
      landlordId,
      relationshipType: type,
      networkParticipants,
      evidencePacks,
      operatorReviewSessions: reviews,
      settlementReadiness,
      regulatoryProfiles: [regulatoryProfile],
      sharingRooms,
      auditEvents: events,
      consentRecords: consents,
    })
  );
}

router.get("/cross-organization-trust", requireAuth, requireLandlord, async (req: any, res) => {
  try {
    const landlordId = landlordIdFromReq(req);
    if (!landlordId) return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });
    const relationshipType = asString(req.query?.relationshipType, 80) as CrossOrganizationTrustRelationshipType | "";
    const status = asString(req.query?.status, 80) as CrossOrganizationTrustStatus;
    let trustRelationships = await buildTrustRelationships(landlordId, RELATIONSHIP_TYPES.has(relationshipType as any) ? relationshipType : "");
    if (status && STATUSES.has(status)) trustRelationships = trustRelationships.filter((trust) => trust.status === status);
    return res.json({ ok: true, trustRelationships });
  } catch (err: any) {
    console.error("[landlord-cross-organization-trust] list failed", err?.message || err);
    return res.status(500).json({ ok: false, error: "CROSS_ORGANIZATION_TRUST_FAILED" });
  }
});

router.get("/cross-organization-trust/:trustRelationshipId", requireAuth, requireLandlord, async (req: any, res) => {
  try {
    const landlordId = landlordIdFromReq(req);
    const trustRelationshipId = decodeURIComponent(asString(req.params?.trustRelationshipId, 500));
    if (!landlordId || !trustRelationshipId) return res.status(400).json({ ok: false, error: "TRUST_RELATIONSHIP_ID_REQUIRED" });
    const trustRelationships = await buildTrustRelationships(landlordId, "");
    const trustRelationship = trustRelationships.find((trust) => trustMatches(trust, trustRelationshipId));
    if (!trustRelationship) return res.status(404).json({ ok: false, error: "TRUST_RELATIONSHIP_NOT_FOUND" });
    return res.json({ ok: true, trustRelationship });
  } catch (err: any) {
    console.error("[landlord-cross-organization-trust] get failed", err?.message || err);
    return res.status(500).json({ ok: false, error: "CROSS_ORGANIZATION_TRUST_GET_FAILED" });
  }
});

export default router;
