import { Router } from "express";
import { db } from "../firebase";
import { requireAuth } from "../middleware/requireAuth";
import { requireLandlord } from "../middleware/requireLandlord";
import { deriveDecisionInbox } from "../lib/decisions/deriveDecisionInbox";
import { deriveInstitutionExportPackage } from "../lib/institutionExports/deriveInstitutionExportPackage";
import type { InstitutionExportPackageType } from "../lib/institutionExports/institutionExportTypes";

const router = Router();

const PACKAGE_TYPES = new Set<InstitutionExportPackageType>([
  "lender_due_diligence",
  "insurance_review",
  "government_program_review",
  "auditor_review",
  "internal_admin_review",
]);

function asString(value: unknown, max = 240): string {
  const next = String(value ?? "").trim().slice(0, max);
  return next || "";
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

  return deriveDecisionInbox({
    analyticsDecisions: Array.from(analyticsDecisions.values()),
  }).items;
}

router.get("/institution-exports/preview", requireAuth, requireLandlord, async (req: any, res) => {
  try {
    const landlordId = asString(req.user?.landlordId || req.user?.id, 240);
    if (!landlordId) {
      return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });
    }

    const packageType = requestedPackageType(req.query?.packageType);
    const [properties, leases, units, maintenanceRequests, auditEvents, decisionItems] = await Promise.all([
      loadLandlordCollection("properties", landlordId),
      loadLandlordCollection("leases", landlordId),
      loadLandlordCollection("units", landlordId),
      loadLandlordCollection("maintenanceRequests", landlordId),
      loadLandlordCollection("events", landlordId),
      loadLandlordDecisionItems(landlordId),
    ]);

    const exportPackage = deriveInstitutionExportPackage({
      packageType,
      landlordId,
      properties,
      leases,
      units,
      maintenanceRequests,
      auditEvents,
      decisionItems,
    });

    return res.json({ ok: true, package: exportPackage });
  } catch (err: any) {
    console.error("[landlord-institution-exports] preview failed", err?.message || err);
    return res.status(500).json({ ok: false, error: "INSTITUTION_EXPORT_PREVIEW_FAILED" });
  }
});

export default router;
