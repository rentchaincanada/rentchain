import { Router } from "express";
import { db } from "../config/firebase";
import { requireAuth } from "../middleware/requireAuth";
import { requirePermission } from "../middleware/requireAuthz";
import { deriveConsumerReportingGovernanceProfile } from "../lib/consumerReportingGovernance/deriveConsumerReportingGovernanceProfile";
import type {
  ConsumerReportingGovernanceProfile,
  ConsumerReportingGovernanceStatus,
} from "../lib/consumerReportingGovernance/consumerReportingGovernanceTypes";

const router = Router();

const GOVERNANCE_KEY = "institutional-consumer-reporting-governance-v1";
const STATUSES = new Set<ConsumerReportingGovernanceStatus>([
  "ready_for_review",
  "partially_ready",
  "review_required",
  "blocked",
  "unknown",
]);

const CONSENT_BASELINE = [{ consentGovernanceId: "identity-consent-reporting-governance-baseline", status: "ready_for_review" }];
const DISPUTE_BASELINE = [{ disputeGovernanceId: "manual-dispute-governance-baseline", status: "ready_for_review" }];
const ADVERSE_ACTION_BASELINE = [{ adverseActionReadinessId: "manual-adverse-action-governance-baseline", status: "ready_for_review" }];

function asString(value: unknown, max = 500): string {
  return String(value ?? "").trim().slice(0, max);
}

async function loadCollection(collectionName: string, limit = 25) {
  const snap = await db.collection(collectionName).get().catch(() => null);
  return (snap?.docs || []).slice(0, limit).map((doc) => sanitizeRecord({ id: doc.id, ...((doc.data() as any) || {}) }));
}

function sanitizeRecord(record: Record<string, any>) {
  const safe: Record<string, any> = {};
  for (const key of [
    "id",
    "status",
    "state",
    "conclusion",
    "consentGovernanceId",
    "consentId",
    "identityConsentId",
    "disputeGovernanceId",
    "disputeId",
    "caseId",
    "adverseActionReadinessId",
    "adverseActionId",
    "platformCredentialingId",
    "operationalRiskId",
    "rentalHistoryLedgerId",
    "evidencePackId",
    "reviewSessionId",
    "eventId",
    "eventType",
    "resourceType",
    "resourceId",
    "createdAt",
    "updatedAt",
    "redacted",
  ]) {
    if (record[key] !== undefined) safe[key] = record[key];
  }
  return safe;
}

async function buildConsumerReportingGovernanceProfiles(): Promise<ConsumerReportingGovernanceProfile[]> {
  const [
    consentGovernance,
    disputeGovernance,
    adverseActionReadiness,
    credentialingReadiness,
    operationalRiskProfiles,
    rentalHistoryLineage,
    evidencePacks,
    reviews,
    auditEvents,
  ] = await Promise.all([
    loadCollection("consentGovernance"),
    loadCollection("consumerReportingDisputeGovernance"),
    loadCollection("adverseActionReadiness"),
    loadCollection("platformCredentialingReadiness"),
    loadCollection("operationalRiskProfiles"),
    loadCollection("verifiedRentalHistoryLedgers"),
    loadCollection("evidencePacks"),
    loadCollection("operatorReviewSessions"),
    loadCollection("events"),
  ]);

  return [
    deriveConsumerReportingGovernanceProfile({
      governanceKey: GOVERNANCE_KEY,
      consentGovernance: consentGovernance.length ? consentGovernance : CONSENT_BASELINE,
      disputeGovernance: disputeGovernance.length ? disputeGovernance : DISPUTE_BASELINE,
      adverseActionReadiness: adverseActionReadiness.length ? adverseActionReadiness : ADVERSE_ACTION_BASELINE,
      credentialingReadiness,
      operationalRiskProfiles,
      rentalHistoryLineage,
      evidencePacks,
      operatorReviewSessions: reviews,
      auditEvents,
    }),
  ];
}

function profileMatches(profile: ConsumerReportingGovernanceProfile, id: string) {
  return profile.consumerReportingGovernanceId === id;
}

router.get("/consumer-reporting-governance", requireAuth, requirePermission("system.admin"), async (req: any, res) => {
  try {
    const status = asString(req.query?.status, 80) as ConsumerReportingGovernanceStatus;
    let profiles = await buildConsumerReportingGovernanceProfiles();
    if (status && STATUSES.has(status)) profiles = profiles.filter((profile) => profile.status === status);
    return res.json({ ok: true, profiles });
  } catch (err: any) {
    console.error("[admin-consumer-reporting-governance] list failed", err?.message || err);
    return res.status(500).json({ ok: false, error: "CONSUMER_REPORTING_GOVERNANCE_FAILED" });
  }
});

router.get("/consumer-reporting-governance/:consumerReportingGovernanceId", requireAuth, requirePermission("system.admin"), async (req: any, res) => {
  try {
    const consumerReportingGovernanceId = decodeURIComponent(asString(req.params?.consumerReportingGovernanceId, 500));
    if (!consumerReportingGovernanceId) return res.status(400).json({ ok: false, error: "CONSUMER_REPORTING_GOVERNANCE_ID_REQUIRED" });
    const profiles = await buildConsumerReportingGovernanceProfiles();
    const profile = profiles.find((next) => profileMatches(next, consumerReportingGovernanceId));
    if (!profile) return res.status(404).json({ ok: false, error: "CONSUMER_REPORTING_GOVERNANCE_NOT_FOUND" });
    return res.json({ ok: true, profile });
  } catch (err: any) {
    console.error("[admin-consumer-reporting-governance] get failed", err?.message || err);
    return res.status(500).json({ ok: false, error: "CONSUMER_REPORTING_GOVERNANCE_GET_FAILED" });
  }
});

export default router;
