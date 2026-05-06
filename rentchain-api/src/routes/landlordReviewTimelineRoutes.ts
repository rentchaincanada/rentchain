import { Router } from "express";
import { db } from "../config/firebase";
import { requireAuth } from "../middleware/requireAuth";
import { requireLandlord } from "../middleware/requireLandlord";
import { deriveAuditComplianceReadiness } from "../lib/auditCompliance/deriveAuditComplianceReadiness";
import { deriveDecisionInbox } from "../lib/decisions/deriveDecisionInbox";
import { deriveEvidencePack } from "../lib/evidencePacks/deriveEvidencePack";
import type { EvidencePackScope } from "../lib/evidencePacks/evidencePackTypes";
import { CANONICAL_EVENTS_COLLECTION } from "../lib/events/buildEvent";
import { deriveInstitutionExportPackage } from "../lib/institutionExports/deriveInstitutionExportPackage";
import type { InstitutionExportPackageType } from "../lib/institutionExports/institutionExportTypes";
import { normalizeOperatorReviewSession } from "../lib/operatorReviews/buildOperatorReviewSession";
import { OPERATOR_REVIEW_SESSIONS_COLLECTION } from "../lib/operatorReviews/operatorReviewTypes";
import { deriveCanonicalReviewTimeline } from "../lib/reviewTimeline/deriveCanonicalReviewTimeline";
import type { ReviewTimelineScope } from "../lib/reviewTimeline/reviewTimelineTypes";

const router = Router();

const SCOPES = new Set<ReviewTimelineScope>([
  "decision",
  "workflow",
  "operator_review",
  "evidence_pack",
  "institution_export",
  "audit_compliance",
  "lease",
  "property",
  "delinquency",
  "maintenance",
  "admin_review",
]);

const PACKAGE_TYPES = new Set<InstitutionExportPackageType>([
  "lender_due_diligence",
  "insurance_review",
  "government_program_review",
  "auditor_review",
  "internal_admin_review",
]);

function asString(value: unknown, max = 500): string {
  return String(value ?? "").trim().slice(0, max);
}

function requestedScope(value: unknown): ReviewTimelineScope | null {
  const raw = asString(value, 120) as ReviewTimelineScope;
  return SCOPES.has(raw) ? raw : null;
}

function requestedPackageType(value: unknown): InstitutionExportPackageType {
  const raw = asString(value, 120) as InstitutionExportPackageType;
  return PACKAGE_TYPES.has(raw) ? raw : "lender_due_diligence";
}

function queryValue(req: any, key: string): unknown {
  if (req.query && Object.prototype.hasOwnProperty.call(req.query, key)) return req.query[key];
  const rawUrl = asString(req.originalUrl || req.url, 4000);
  const query = rawUrl.includes("?") ? rawUrl.slice(rawUrl.indexOf("?") + 1) : "";
  return new URLSearchParams(query).get(key);
}

function evidenceScope(scope: ReviewTimelineScope): EvidencePackScope {
  if (scope === "operator_review") return "decision";
  if (scope === "evidence_pack") return "decision";
  return scope as EvidencePackScope;
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

async function loadOperatorReviewSessions(landlordId: string) {
  const snap = await db.collection(OPERATOR_REVIEW_SESSIONS_COLLECTION).where("landlordId", "==", landlordId).get().catch(() => null);
  return (snap?.docs || [])
    .map((doc: any) => normalizeOperatorReviewSession({ id: doc.id, ...((doc.data() as any) || {}) }))
    .filter(Boolean);
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

router.get("/review-timeline", requireAuth, requireLandlord, async (req: any, res) => {
  try {
    const landlordId = asString(req.user?.landlordId || req.user?.id, 240);
    const scope = requestedScope(queryValue(req, "scope"));
    const scopeId = asString(queryValue(req, "scopeId"), 500);
    if (!landlordId) return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });
    if (!scope || !scopeId) return res.status(400).json({ ok: false, error: "REVIEW_TIMELINE_SCOPE_REQUIRED" });

    const packageType = requestedPackageType(queryValue(req, "packageType"));
    const [properties, leases, units, maintenanceRequests, rentPayments, events, canonicalEvents, decisions, operatorReviewSessions] =
      await Promise.all([
        loadLandlordCollection("properties", landlordId),
        loadLandlordCollection("leases", landlordId),
        loadLandlordCollection("units", landlordId),
        loadLandlordCollection("maintenanceRequests", landlordId),
        loadLandlordCollection("rentPayments", landlordId),
        loadLandlordCollection("events", landlordId),
        loadLandlordCanonicalEvents(landlordId),
        loadLandlordDecisionItems(landlordId),
        loadOperatorReviewSessions(landlordId),
      ]);
    const auditEvents = [...events, ...canonicalEvents];

    const institutionExportPackage = deriveInstitutionExportPackage({
      packageType,
      landlordId,
      properties,
      leases,
      units,
      maintenanceRequests,
      auditEvents,
      decisionItems: decisions,
    });
    const auditComplianceReadiness = deriveAuditComplianceReadiness({
      scope: scope === "audit_compliance" ? "landlord_portfolio" : scope === "lease" ? "lease" : scope === "property" ? "property" : "landlord_portfolio",
      landlordId,
      propertyId: scope === "property" ? scopeId : undefined,
      leaseId: scope === "lease" ? scopeId : undefined,
      properties,
      leases,
      rentPayments,
      decisions,
      auditEvents,
      policyEvents: auditEvents.filter((event) => asString(event?.domain, 80) === "policy" || asString(event?.type, 120).startsWith("policy.")),
      institutionExportPackage,
    });
    const evidencePack = deriveEvidencePack({
      scope: evidenceScope(scope),
      scopeId,
      landlordId,
      decisions,
      operatorReviewSessions: operatorReviewSessions as any,
      institutionExportPackage,
      auditComplianceReadiness,
      canonicalEvents: auditEvents,
      leases,
      properties,
      maintenanceRequests,
    });

    const timeline = deriveCanonicalReviewTimeline({
      scope,
      scopeId,
      landlordId,
      decisions,
      operatorReviewSessions: operatorReviewSessions as any,
      evidencePack,
      institutionExportPackage,
      auditComplianceReadiness,
      canonicalEvents: auditEvents,
      filters: {
        entryType: queryValue(req, "entryType"),
        status: queryValue(req, "status"),
        source: queryValue(req, "source"),
      },
    });

    return res.json({ ok: true, timeline });
  } catch (err: any) {
    console.error("[landlord-review-timeline] failed", err?.message || err);
    return res.status(500).json({ ok: false, error: "REVIEW_TIMELINE_FAILED" });
  }
});

export default router;
