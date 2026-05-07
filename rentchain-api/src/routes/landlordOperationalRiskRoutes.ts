import { Router } from "express";
import { db } from "../config/firebase";
import { requireAuth } from "../middleware/requireAuth";
import { requireLandlord } from "../middleware/requireLandlord";
import { deriveAutomatedWorkflowTransitions } from "../lib/automatedWorkflows/deriveAutomatedWorkflowTransitions";
import { deriveCrossOrganizationTrust } from "../lib/crossOrganizationTrust/deriveCrossOrganizationTrust";
import { deriveDelinquencySignals } from "../lib/payments/delinquencySignals";
import { buildPaymentObligationLedgerRows } from "../lib/payments/paymentObligationLedger";
import { deriveIdentityProfile } from "../lib/identityLayer/deriveIdentityProfile";
import { deriveInstitutionOnboardingReadiness } from "../lib/institutionOnboarding/deriveInstitutionOnboardingReadiness";
import { deriveNetworkParticipantProfile } from "../lib/networkParticipants/deriveNetworkParticipantProfile";
import { deriveOperationalRiskProfile } from "../lib/operationalRisk/deriveOperationalRiskProfile";
import { deriveRegulatoryProfile } from "../lib/regulatoryProfiles/deriveRegulatoryProfile";
import { deriveSettlementReadiness } from "../lib/settlementReadiness/deriveSettlementReadiness";
import type { CrossOrganizationTrustRelationshipType } from "../lib/crossOrganizationTrust/crossOrganizationTrustTypes";
import type { InstitutionType } from "../lib/institutionOnboarding/institutionOnboardingTypes";
import type { NetworkParticipantType } from "../lib/networkParticipants/networkParticipantTypes";
import type { OperationalRiskScope, OperationalRiskSeverity, OperationalRiskStatus } from "../lib/operationalRisk/operationalRiskTypes";

const router = Router();

const RISK_SCOPES = new Set<OperationalRiskScope>(["property", "lease", "participant", "institution", "workflow", "onboarding", "settlement", "regulatory"]);
const STATUSES = new Set<OperationalRiskStatus>(["stable", "attention_required", "elevated", "blocked", "unknown"]);
const SEVERITIES = new Set<OperationalRiskSeverity>(["low", "moderate", "elevated", "critical"]);
const INSTITUTION_TYPES: InstitutionType[] = ["lender", "insurer", "auditor", "regulator", "municipality", "institutional_landlord", "operational_partner"];
const PARTICIPANT_TYPES: NetworkParticipantType[] = ["landlord", "operator", "lender", "insurer", "auditor", "regulator", "contractor", "institutional_partner", "review_actor"];
const TRUST_TYPES: CrossOrganizationTrustRelationshipType[] = ["operational_trust", "evidence_trust", "review_trust", "settlement_trust", "regulatory_trust", "sharing_trust"];

function asString(value: unknown, max = 500): string {
  return String(value ?? "").trim().slice(0, max);
}

function landlordIdFromReq(req: any) {
  return asString(req.user?.landlordId || req.user?.id || req.user?.sub, 240);
}

function normalizedRiskScope(value: unknown): OperationalRiskScope | "" {
  const raw = asString(value, 80) as OperationalRiskScope;
  return RISK_SCOPES.has(raw) ? raw : "";
}

function participantTypeForInstitution(type: InstitutionType): NetworkParticipantType {
  if (type === "lender" || type === "insurer" || type === "auditor" || type === "regulator") return type;
  if (type === "institutional_landlord") return "landlord";
  return "institutional_partner";
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

async function buildOperationalRiskProfiles(landlordId: string, riskScope: OperationalRiskScope | "") {
  const [properties, registryStatuses, screeningOrders, consents, sharingRooms, evidencePacks, reviews, events, leases, paymentIntents, rentPayments, reconciliationRecords, contractors, decisions] =
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
      loadLandlordCollection("decisionInboxItems", landlordId),
    ]);

  const obligationRows = buildPaymentObligationLedgerRows({ leases, paymentIntents, rentPayments, reconciliationRecords });
  const delinquencySignals = deriveDelinquencySignals(obligationRows);
  const automatedWorkflows = deriveAutomatedWorkflowTransitions({ decisions: decisions as any[] }).workflows;
  const settlementReadiness = deriveSettlementReadiness({
    landlordId,
    obligationRows,
    reconciliationRecords,
    evidencePacks,
    operatorReviewSessions: reviews,
    auditEvents: events,
    decisions: decisions as any[],
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

  const onboardingReadiness = INSTITUTION_TYPES.map((type) => {
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

  const scopes = riskScope ? [riskScope] : Array.from(RISK_SCOPES);
  return scopes.map((scope) =>
    deriveOperationalRiskProfile({
      landlordId,
      riskScope: scope,
      evidencePacks,
      operatorReviewSessions: reviews,
      settlementReadiness,
      regulatoryProfiles: [regulatoryProfile],
      institutionOnboardingReadiness: onboardingReadiness,
      trustRelationships,
      automatedWorkflows,
      delinquencySignals,
      auditEvents: events,
    })
  );
}

router.get("/operational-risk", requireAuth, requireLandlord, async (req: any, res) => {
  try {
    const landlordId = landlordIdFromReq(req);
    if (!landlordId) return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });
    const riskScope = normalizedRiskScope(req.query?.riskScope);
    const status = asString(req.query?.status, 80) as OperationalRiskStatus;
    const severity = asString(req.query?.severity, 80) as OperationalRiskSeverity;
    let profiles = await buildOperationalRiskProfiles(landlordId, riskScope);
    if (status && STATUSES.has(status)) profiles = profiles.filter((profile) => profile.status === status);
    if (severity && SEVERITIES.has(severity)) {
      profiles = profiles.filter((profile) => profile.riskReferences.some((reference) => reference.severity === severity));
    }
    return res.json({ ok: true, profiles });
  } catch (err: any) {
    console.error("[landlord-operational-risk] list failed", err?.message || err);
    return res.status(500).json({ ok: false, error: "OPERATIONAL_RISK_FAILED" });
  }
});

router.get("/operational-risk/:operationalRiskId", requireAuth, requireLandlord, async (req: any, res) => {
  try {
    const landlordId = landlordIdFromReq(req);
    const operationalRiskId = decodeURIComponent(asString(req.params?.operationalRiskId, 500));
    if (!landlordId || !operationalRiskId) return res.status(400).json({ ok: false, error: "OPERATIONAL_RISK_ID_REQUIRED" });
    const profiles = await buildOperationalRiskProfiles(landlordId, "");
    const profile = profiles.find((next) => next.operationalRiskId === operationalRiskId);
    if (!profile) return res.status(404).json({ ok: false, error: "OPERATIONAL_RISK_NOT_FOUND" });
    return res.json({ ok: true, profile });
  } catch (err: any) {
    console.error("[landlord-operational-risk] get failed", err?.message || err);
    return res.status(500).json({ ok: false, error: "OPERATIONAL_RISK_GET_FAILED" });
  }
});

export default router;
