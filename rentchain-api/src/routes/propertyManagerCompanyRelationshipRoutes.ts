import { Router } from "express";
import { requireAuth } from "../middleware/requireAuth";
import {
  createLandlordCompanyRelationshipRecord,
  listLandlordCompanyRelationshipRecords,
  reactivateLandlordCompanyRelationshipRecord,
  suspendLandlordCompanyRelationshipRecord,
  terminateLandlordCompanyRelationshipRecord,
} from "../services/propertyManagerCompanyRelationshipService";

const router = Router();

function asString(value: unknown, max = 240): string {
  return String(value ?? "").trim().slice(0, max);
}

function ownerContext(req: any): { actorUserId: string; landlordId: string } | null {
  const role = asString(req.user?.role, 80).toLowerCase();
  if (role !== "landlord") return null;
  const actorUserId = asString(req.user?.id || req.user?.uid || req.user?.sub, 240);
  const landlordId = asString(req.user?.landlordId || req.user?.id, 240);
  if (!actorUserId || !landlordId) return null;
  return { actorUserId, landlordId };
}

function forbidden(res: any) {
  return res.status(403).json({ ok: false, error: "FORBIDDEN" });
}

function handleError(res: any, error: unknown) {
  const code = error instanceof Error ? error.message : "property_manager_company_relationship_failed";
  if (code === "landlord_company_relationship_not_found" || code === "property_manager_company_not_found") {
    return res.status(404).json({ ok: false, error: code.toUpperCase() });
  }
  if (
    code === "relationship_not_active" ||
    code === "relationship_not_suspended" ||
    code === "relationship_already_terminated" ||
    code === "invalid_relationship_status_transition" ||
    code === "relationship_activation_requires_company_acceptance"
  ) {
    return res.status(409).json({ ok: false, error: code.toUpperCase() });
  }
  if (code === "property_manager_company_not_active") {
    return res.status(409).json({ ok: false, error: "PROPERTY_MANAGER_COMPANY_NOT_ACTIVE" });
  }
  if (
    code.startsWith("invalid_") ||
    code.startsWith("missing_") ||
    code.includes("_not_allowed") ||
    code.includes("_mismatch")
  ) {
    return res.status(400).json({ ok: false, error: code.toUpperCase() });
  }
  console.error("[property-manager-company-relationships] request failed", code);
  return res.status(500).json({ ok: false, error: "PROPERTY_MANAGER_COMPANY_RELATIONSHIP_FAILED" });
}

router.use(requireAuth);

router.get("/property-manager-company-relationships", async (req: any, res) => {
  const context = ownerContext(req);
  if (!context) return forbidden(res);

  try {
    const result = await listLandlordCompanyRelationshipRecords({
      landlordId: context.landlordId,
    });
    return res.status(200).json({ ok: true, relationships: result.relationships });
  } catch (error) {
    return handleError(res, error);
  }
});

router.post("/property-manager-company-relationships", async (req: any, res) => {
  const context = ownerContext(req);
  if (!context) return forbidden(res);

  try {
    const result = await createLandlordCompanyRelationshipRecord({
      landlordId: context.landlordId,
      actorUserId: context.actorUserId,
      propertyManagerCompanyId: req.body?.propertyManagerCompanyId,
      propertyScope: req.body?.propertyScope,
      workspaceScopes: Array.isArray(req.body?.workspaceScopes) ? req.body.workspaceScopes : [],
      requestedStatus: req.body?.status,
    });
    return res.status(201).json({ ok: true, relationship: result.relationship });
  } catch (error) {
    return handleError(res, error);
  }
});

router.post("/property-manager-company-relationships/:relationshipId/suspend", async (req: any, res) => {
  const context = ownerContext(req);
  if (!context) return forbidden(res);

  try {
    const result = await suspendLandlordCompanyRelationshipRecord({
      landlordId: context.landlordId,
      actorUserId: context.actorUserId,
      relationshipId: req.params.relationshipId,
      reason: req.body?.reason,
    });
    return res.status(200).json({ ok: true, relationship: result.relationship });
  } catch (error) {
    return handleError(res, error);
  }
});

router.post("/property-manager-company-relationships/:relationshipId/reactivate", async (req: any, res) => {
  const context = ownerContext(req);
  if (!context) return forbidden(res);

  try {
    const result = await reactivateLandlordCompanyRelationshipRecord({
      landlordId: context.landlordId,
      actorUserId: context.actorUserId,
      relationshipId: req.params.relationshipId,
      reason: req.body?.reason,
    });
    return res.status(200).json({ ok: true, relationship: result.relationship });
  } catch (error) {
    return handleError(res, error);
  }
});

router.post("/property-manager-company-relationships/:relationshipId/terminate", async (req: any, res) => {
  const context = ownerContext(req);
  if (!context) return forbidden(res);

  try {
    const result = await terminateLandlordCompanyRelationshipRecord({
      landlordId: context.landlordId,
      actorUserId: context.actorUserId,
      relationshipId: req.params.relationshipId,
      reason: req.body?.reason,
    });
    return res.status(200).json({ ok: true, relationship: result.relationship });
  } catch (error) {
    return handleError(res, error);
  }
});

export default router;
