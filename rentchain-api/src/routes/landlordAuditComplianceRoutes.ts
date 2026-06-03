import { Router } from "express";
import { db } from "../firebase";
import { requireAuth } from "../middleware/requireAuth";
import { requireLandlord } from "../middleware/requireLandlord";
import { deriveDecisionInbox } from "../lib/decisions/deriveDecisionInbox";
import { deriveInstitutionExportPackage } from "../lib/institutionExports/deriveInstitutionExportPackage";
import { deriveAuditComplianceReadiness } from "../lib/auditCompliance/deriveAuditComplianceReadiness";
import type { AuditComplianceScope } from "../lib/auditCompliance/auditComplianceTypes";
import type { InstitutionExportPackageType } from "../lib/institutionExports/institutionExportTypes";

const router = Router();

const PACKAGE_TYPES = new Set<InstitutionExportPackageType>([
  "lender_due_diligence",
  "insurance_review",
  "government_program_review",
  "auditor_review",
  "internal_admin_review",
]);

const SCOPES = new Set<AuditComplianceScope>([
  "landlord_portfolio",
  "property",
  "lease",
  "export_package",
  "admin_review",
]);

function asString(value: unknown, max = 240): string {
  const next = String(value ?? "").trim().slice(0, max);
  return next || "";
}

function requestedPackageType(value: unknown): InstitutionExportPackageType {
  const raw = asString(value, 120) as InstitutionExportPackageType;
  return PACKAGE_TYPES.has(raw) ? raw : "lender_due_diligence";
}

function requestedScope(value: unknown): AuditComplianceScope {
  const raw = asString(value, 120) as AuditComplianceScope;
  return SCOPES.has(raw) ? raw : "landlord_portfolio";
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

function filterContext(records: any[], filters: { propertyId: string; leaseId: string }) {
  return records.filter((record) => {
    if (filters.leaseId) {
      return asString(record?.id || record?.leaseId || record?.leaseID, 240) === filters.leaseId || asString(record?.leaseId, 240) === filters.leaseId;
    }
    if (filters.propertyId) return asString(record?.propertyId || record?.id, 240) === filters.propertyId;
    return true;
  });
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

  return deriveDecisionInbox({
    analyticsDecisions: Array.from(analyticsDecisions.values()),
  }).items;
}

router.get("/audit-compliance/readiness", requireAuth, requireLandlord, async (req: any, res) => {
  try {
    const landlordId = asString(req.user?.landlordId || req.user?.id, 240);
    if (!landlordId) {
      return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });
    }

    const scope = requestedScope(req.query?.scope);
    const packageType = requestedPackageType(req.query?.packageType);
    const propertyId = asString(req.query?.propertyId, 240);
    const leaseId = asString(req.query?.leaseId, 240);
    const [allProperties, allLeases, units, maintenanceRequests, auditEventsRaw, rentPayments, decisions] = await Promise.all([
      loadLandlordCollection("properties", landlordId),
      loadLandlordCollection("leases", landlordId),
      loadLandlordCollection("units", landlordId),
      loadLandlordCollection("maintenanceRequests", landlordId),
      loadLandlordCollection("events", landlordId),
      loadLandlordCollection("rentPayments", landlordId),
      loadLandlordDecisionItems(landlordId),
    ]);

    const filters = { propertyId, leaseId };
    const properties = filterContext(allProperties, filters);
    const leases = filterContext(allLeases, filters);
    const paymentsForContext = filterContext(rentPayments, filters);
    const eventsForContext = filterContext(auditEventsRaw, filters);
    const policyEvents = eventsForContext.filter((event) => {
      return asString(event?.domain, 80) === "policy" || asString(event?.type, 120).startsWith("policy.");
    });

    const institutionExportPackage = deriveInstitutionExportPackage({
      packageType,
      landlordId,
      properties,
      leases,
      units: filterContext(units, filters),
      maintenanceRequests: filterContext(maintenanceRequests, filters),
      auditEvents: eventsForContext,
      decisionItems: decisions,
    });

    const readiness = deriveAuditComplianceReadiness({
      scope,
      landlordId,
      propertyId,
      leaseId,
      properties,
      leases,
      rentPayments: paymentsForContext,
      decisions,
      auditEvents: eventsForContext,
      policyEvents,
      institutionExportPackage,
    });

    return res.json({ ok: true, readiness });
  } catch (err: any) {
    console.error("[landlord-audit-compliance] readiness failed", err?.message || err);
    return res.status(500).json({ ok: false, error: "AUDIT_COMPLIANCE_READINESS_FAILED" });
  }
});

export default router;
