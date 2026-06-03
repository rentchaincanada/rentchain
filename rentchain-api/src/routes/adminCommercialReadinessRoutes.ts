import { Router } from "express";
import { db } from "../firebase";
import { getPricingHealth } from "../config/planMatrix";
import { requireAuth } from "../middleware/requireAuth";
import { requirePermission } from "../middleware/requireAuthz";
import { deriveCommercialReadinessProfile } from "../lib/commercialReadiness/deriveCommercialReadinessProfile";
import type { CommercialReadinessProfile, CommercialReadinessStatus } from "../lib/commercialReadiness/commercialReadinessTypes";

const router = Router();

const READINESS_KEY = "institutional-commercial-operations-readiness-v1";
const STATUSES = new Set<CommercialReadinessStatus>([
  "ready_for_review",
  "partially_ready",
  "review_required",
  "blocked",
  "unknown",
]);

const BILLING_READINESS = [
  { billingReadinessId: "manual-billing-governance-baseline", status: "ready_for_review" },
];

const SUBSCRIPTION_READINESS = [
  { subscriptionReadinessId: "manual-subscription-governance-baseline", status: "ready_for_review" },
];

const SUPPORT_READINESS = [
  { supportReadinessId: "manual-commercial-support-readiness-baseline", status: "ready_for_review" },
];

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
    "key",
    "pricingReadinessId",
    "pricingId",
    "billingReadinessId",
    "billingId",
    "subscriptionReadinessId",
    "subscriptionId",
    "onboardingReadinessId",
    "institutionOnboardingId",
    "supportReadinessId",
    "supportId",
    "operationalRiskId",
    "releaseGovernanceId",
    "releaseVersion",
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

function pricingReadinessFromConfig() {
  const pricingHealth = getPricingHealth();
  return [
    {
      pricingReadinessId: "pricing-governance-config",
      status: pricingHealth.ok ? "ready_for_review" : "blocked",
      key: "pricing-governance-config",
    },
  ];
}

async function buildCommercialReadinessProfiles(): Promise<CommercialReadinessProfile[]> {
  const [
    pricingReadiness,
    billingReadiness,
    subscriptionReadiness,
    onboardingReadiness,
    supportReadiness,
    operationalRiskProfiles,
    releaseGovernanceProfiles,
    evidencePacks,
    reviews,
    auditEvents,
  ] = await Promise.all([
    loadCollection("pricingReadiness"),
    loadCollection("billingReadiness"),
    loadCollection("subscriptionReadiness"),
    loadCollection("institutionOnboardingReadiness"),
    loadCollection("commercialSupportReadiness"),
    loadCollection("operationalRiskProfiles"),
    loadCollection("releaseGovernanceProfiles"),
    loadCollection("evidencePacks"),
    loadCollection("operatorReviewSessions"),
    loadCollection("events"),
  ]);

  return [
    deriveCommercialReadinessProfile({
      readinessKey: READINESS_KEY,
      pricingReadiness: pricingReadiness.length ? pricingReadiness : pricingReadinessFromConfig(),
      billingReadiness: billingReadiness.length ? billingReadiness : BILLING_READINESS,
      subscriptionReadiness: subscriptionReadiness.length ? subscriptionReadiness : SUBSCRIPTION_READINESS,
      enterpriseOnboardingReadiness: onboardingReadiness,
      supportReadiness: supportReadiness.length ? supportReadiness : SUPPORT_READINESS,
      operationalRiskProfiles,
      releaseGovernanceProfiles,
      evidencePacks,
      operatorReviewSessions: reviews,
      auditEvents,
    }),
  ];
}

function profileMatches(profile: CommercialReadinessProfile, id: string) {
  return profile.commercialReadinessId === id;
}

router.get("/commercial-readiness", requireAuth, requirePermission("system.admin"), async (req: any, res) => {
  try {
    const status = asString(req.query?.status, 80) as CommercialReadinessStatus;
    let profiles = await buildCommercialReadinessProfiles();
    if (status && STATUSES.has(status)) profiles = profiles.filter((profile) => profile.status === status);
    return res.json({ ok: true, profiles });
  } catch (err: any) {
    console.error("[admin-commercial-readiness] list failed", err?.message || err);
    return res.status(500).json({ ok: false, error: "COMMERCIAL_READINESS_FAILED" });
  }
});

router.get("/commercial-readiness/:commercialReadinessId", requireAuth, requirePermission("system.admin"), async (req: any, res) => {
  try {
    const commercialReadinessId = decodeURIComponent(asString(req.params?.commercialReadinessId, 500));
    if (!commercialReadinessId) return res.status(400).json({ ok: false, error: "COMMERCIAL_READINESS_ID_REQUIRED" });
    const profiles = await buildCommercialReadinessProfiles();
    const profile = profiles.find((next) => profileMatches(next, commercialReadinessId));
    if (!profile) return res.status(404).json({ ok: false, error: "COMMERCIAL_READINESS_NOT_FOUND" });
    return res.json({ ok: true, profile });
  } catch (err: any) {
    console.error("[admin-commercial-readiness] get failed", err?.message || err);
    return res.status(500).json({ ok: false, error: "COMMERCIAL_READINESS_GET_FAILED" });
  }
});

export default router;
