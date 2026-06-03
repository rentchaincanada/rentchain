import { Router } from "express";
import { db } from "../firebase";
import { requireAuth } from "../middleware/requireAuth";
import { requireLandlord } from "../middleware/requireLandlord";
import { deriveAuditComplianceReadiness } from "../lib/auditCompliance/deriveAuditComplianceReadiness";
import { deriveDecisionInbox } from "../lib/decisions/deriveDecisionInbox";
import { deriveEvidencePack } from "../lib/evidencePacks/deriveEvidencePack";
import type { EvidencePackScope } from "../lib/evidencePacks/evidencePackTypes";
import { deriveInstitutionExportPackage } from "../lib/institutionExports/deriveInstitutionExportPackage";
import type { InstitutionExportPackageType } from "../lib/institutionExports/institutionExportTypes";
import { normalizeOperatorReviewSession } from "../lib/operatorReviews/buildOperatorReviewSession";
import { OPERATOR_REVIEW_SESSIONS_COLLECTION } from "../lib/operatorReviews/operatorReviewTypes";
import { getEffectiveLandlordId } from "../auth/requestAuthority";

const router = Router();

const SCOPES = new Set<EvidencePackScope>([
  "decision",
  "workflow",
  "delinquency",
  "institution_export",
  "audit_compliance",
  "lease",
  "property",
  "tenant",
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

function requestedScope(value: unknown): EvidencePackScope | null {
  const raw = asString(value, 120) as EvidencePackScope;
  return SCOPES.has(raw) ? raw : null;
}

function requestedPackageType(value: unknown): InstitutionExportPackageType {
  const raw = asString(value, 120) as InstitutionExportPackageType;
  return PACKAGE_TYPES.has(raw) ? raw : "lender_due_diligence";
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

router.get("/evidence-packs/preview", requireAuth, requireLandlord, async (req: any, res) => {
  try {
    const landlordId = asString(getEffectiveLandlordId(req), 240);
    const scope = requestedScope(req.query?.scope);
    const scopeId = asString(req.query?.scopeId, 500);
    if (!landlordId) return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });
    if (!scope || !scopeId) return res.status(400).json({ ok: false, error: "EVIDENCE_PACK_SCOPE_REQUIRED" });

    const packageType = requestedPackageType(req.query?.packageType);
    const [properties, leases, units, maintenanceRequests, rentPayments, events, decisions, operatorReviewSessions] =
      await Promise.all([
        loadLandlordCollection("properties", landlordId),
        loadLandlordCollection("leases", landlordId),
        loadLandlordCollection("units", landlordId),
        loadLandlordCollection("maintenanceRequests", landlordId),
        loadLandlordCollection("rentPayments", landlordId),
        loadLandlordCollection("events", landlordId),
        loadLandlordDecisionItems(landlordId),
        loadOperatorReviewSessions(landlordId),
      ]);

    const institutionExportPackage = deriveInstitutionExportPackage({
      packageType,
      landlordId,
      properties,
      leases,
      units,
      maintenanceRequests,
      auditEvents: events,
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
      auditEvents: events,
      policyEvents: events.filter((event) => asString(event?.domain, 80) === "policy" || asString(event?.type, 120).startsWith("policy.")),
      institutionExportPackage,
    });

    const evidencePack = deriveEvidencePack({
      scope,
      scopeId,
      landlordId,
      decisions,
      operatorReviewSessions: operatorReviewSessions as any,
      institutionExportPackage,
      auditComplianceReadiness,
      canonicalEvents: events,
      leases,
      properties,
      maintenanceRequests,
    });

    return res.json({ ok: true, evidencePack });
  } catch (err: any) {
    console.error("[landlord-evidence-packs] preview failed", err?.message || err);
    return res.status(500).json({ ok: false, error: "EVIDENCE_PACK_PREVIEW_FAILED" });
  }
});

export default router;
