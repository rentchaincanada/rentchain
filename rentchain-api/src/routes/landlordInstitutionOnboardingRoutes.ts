import { Router } from "express";
import { db } from "../config/firebase";
import { requireAuth } from "../middleware/requireAuth";
import { requireLandlord } from "../middleware/requireLandlord";
import { deriveCrossOrganizationTrust } from "../lib/crossOrganizationTrust/deriveCrossOrganizationTrust";
import { deriveIdentityProfile } from "../lib/identityLayer/deriveIdentityProfile";
import { deriveInstitutionOnboardingReadiness } from "../lib/institutionOnboarding/deriveInstitutionOnboardingReadiness";
import { deriveNetworkParticipantProfile } from "../lib/networkParticipants/deriveNetworkParticipantProfile";
import { deriveRegulatoryProfile } from "../lib/regulatoryProfiles/deriveRegulatoryProfile";
import { deriveSettlementReadiness } from "../lib/settlementReadiness/deriveSettlementReadiness";
import { buildPaymentObligationLedgerRows } from "../lib/payments/paymentObligationLedger";
import type { CrossOrganizationTrustRelationshipType } from "../lib/crossOrganizationTrust/crossOrganizationTrustTypes";
import type { InstitutionOnboardingReadiness, InstitutionOnboardingStatus, InstitutionType } from "../lib/institutionOnboarding/institutionOnboardingTypes";
import type { NetworkParticipantType } from "../lib/networkParticipants/networkParticipantTypes";

const router = Router();
const INSTITUTION_TYPES = new Set<InstitutionType>(["lender", "insurer", "auditor", "regulator", "municipality", "institutional_landlord", "operational_partner"]);
const STATUSES = new Set<InstitutionOnboardingStatus>(["ready_for_review", "partially_ready", "review_required", "blocked", "unknown"]);
const PARTICIPANT_TYPES: NetworkParticipantType[] = ["landlord", "operator", "lender", "insurer", "auditor", "regulator", "contractor", "institutional_partner", "review_actor"];
const TRUST_TYPES: CrossOrganizationTrustRelationshipType[] = ["operational_trust", "evidence_trust", "review_trust", "settlement_trust", "regulatory_trust", "sharing_trust"];

function asString(value: unknown, max = 500): string {
  return String(value ?? "").trim().slice(0, max);
}

function landlordIdFromReq(req: any) {
  return asString(req.user?.landlordId || req.user?.id || req.user?.sub, 240);
}

function normalizedInstitutionType(value: unknown): InstitutionType | "" {
  const raw = asString(value, 80) as InstitutionType;
  return INSTITUTION_TYPES.has(raw) ? raw : "";
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

function readinessMatches(readiness: InstitutionOnboardingReadiness, id: string) {
  return readiness.onboardingReadinessId === id;
}

function participantTypeForInstitution(type: InstitutionType): NetworkParticipantType {
  if (type === "lender" || type === "insurer" || type === "auditor" || type === "regulator") return type;
  if (type === "institutional_landlord") return "landlord";
  return "institutional_partner";
}

async function buildReadiness(landlordId: string, institutionType: InstitutionType | "") {
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

  const identityProfiles = PARTICIPANT_TYPES.map((participantType) =>
    deriveIdentityProfile({
      identityType: participantType === "operator" || participantType === "review_actor" ? participantType : "organization",
      identityId: participantType,
      organization: { id: participantType, organizationId: participantType },
      operator: reviews[0] || null,
      consentRecords: consents,
      reviewSessions: reviews,
      canonicalEvents: events,
    })
  );

  const networkParticipants = PARTICIPANT_TYPES.map((participantType, index) =>
    deriveNetworkParticipantProfile({
      landlordId,
      participantType,
      participantId: participantType,
      identityProfiles: [identityProfiles[index]],
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
    })
  );

  const trustRelationships = TRUST_TYPES.map((relationshipType) =>
    deriveCrossOrganizationTrust({
      landlordId,
      relationshipType,
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

  const types = institutionType ? [institutionType] : Array.from(INSTITUTION_TYPES);
  return types.map((type) => {
    const participantType = participantTypeForInstitution(type);
    return deriveInstitutionOnboardingReadiness({
      landlordId,
      institutionType: type,
      networkParticipants: networkParticipants.filter((participant) => participant.participantType === participantType),
      trustRelationships,
      identityProfiles: identityProfiles.filter((profile) => profile.identityId === participantType || profile.identityId === type),
      evidencePacks,
      operatorReviewSessions: reviews,
      settlementReadiness,
      regulatoryProfiles: [regulatoryProfile],
      sharingRooms:
        type === "lender" || type === "insurer" || type === "auditor" || type === "regulator"
          ? sharingRooms.filter((room) => asString(room.accessControls?.institutionType || room.institutionType, 80) === type)
          : sharingRooms,
      auditEvents: events,
      consentRecords: consents,
    });
  });
}

router.get("/institution-onboarding-readiness", requireAuth, requireLandlord, async (req: any, res) => {
  try {
    const landlordId = landlordIdFromReq(req);
    if (!landlordId) return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });
    const institutionType = normalizedInstitutionType(req.query?.institutionType);
    const status = asString(req.query?.status, 80) as InstitutionOnboardingStatus;
    let readiness = await buildReadiness(landlordId, institutionType);
    if (status && STATUSES.has(status)) readiness = readiness.filter((item) => item.status === status);
    return res.json({ ok: true, readiness });
  } catch (err: any) {
    console.error("[landlord-institution-onboarding-readiness] list failed", err?.message || err);
    return res.status(500).json({ ok: false, error: "INSTITUTION_ONBOARDING_READINESS_FAILED" });
  }
});

router.get("/institution-onboarding-readiness/:onboardingReadinessId", requireAuth, requireLandlord, async (req: any, res) => {
  try {
    const landlordId = landlordIdFromReq(req);
    const onboardingReadinessId = decodeURIComponent(asString(req.params?.onboardingReadinessId, 500));
    if (!landlordId || !onboardingReadinessId) return res.status(400).json({ ok: false, error: "ONBOARDING_READINESS_ID_REQUIRED" });
    const readiness = await buildReadiness(landlordId, "");
    const item = readiness.find((next) => readinessMatches(next, onboardingReadinessId));
    if (!item) return res.status(404).json({ ok: false, error: "ONBOARDING_READINESS_NOT_FOUND" });
    return res.json({ ok: true, readiness: item });
  } catch (err: any) {
    console.error("[landlord-institution-onboarding-readiness] get failed", err?.message || err);
    return res.status(500).json({ ok: false, error: "INSTITUTION_ONBOARDING_READINESS_GET_FAILED" });
  }
});

export default router;
