import { Router } from "express";
import { requireAuth } from "../middleware/requireAuth";
import {
  acceptLandlordCompanyRelationshipRecord,
  createLandlordCompanyRelationshipRecord,
  reactivateLandlordCompanyRelationshipRecord,
  suspendLandlordCompanyRelationshipRecord,
  terminateLandlordCompanyRelationshipRecord,
} from "../services/propertyManagerCompanyRelationshipService";
import {
  listCompanyMembersForManagement,
  listCompanyRelationshipManagementRecords,
  listCompanyStaffAssignmentsForManagement,
  listLandlordPropertyManagerRelationshipManagementRecords,
  listLandlordRelationshipStaffAssignmentsForManagement,
  listMyPropertyManagerCompanyContexts,
  searchPropertyManagerCompaniesForLandlord,
} from "../services/propertyManagerCompanyManagementReadService";
import {
  createPropertyManagerCompanyStaffAssignmentRecord,
  reactivatePropertyManagerCompanyStaffAssignmentRecord,
  removePropertyManagerCompanyStaffAssignmentRecord,
  suspendPropertyManagerCompanyStaffAssignmentRecord,
} from "../services/propertyManagerCompanyStaffAssignmentService";

const router = Router();
const companyRouter = Router();

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

function actorContext(req: any): { actorUserId: string } | null {
  const actorUserId = asString(req.user?.id || req.user?.uid || req.user?.sub, 240);
  if (!actorUserId) return null;
  return { actorUserId };
}

function forbidden(res: any) {
  return res.status(403).json({ ok: false, error: "FORBIDDEN" });
}

function handleError(res: any, error: unknown) {
  const code = error instanceof Error ? error.message : "property_manager_company_relationship_failed";
  if (
    code === "landlord_company_relationship_not_found" ||
    code === "property_manager_company_not_found" ||
    code === "property_manager_company_staff_assignment_not_found" ||
    code === "property_manager_company_staff_membership_not_found"
  ) {
    return res.status(404).json({ ok: false, error: code.toUpperCase() });
  }
  if (
    code === "relationship_not_active" ||
    code === "relationship_not_suspended" ||
    code === "relationship_not_pending" ||
    code === "relationship_already_terminated" ||
    code === "invalid_relationship_status_transition" ||
    code === "relationship_activation_requires_company_acceptance" ||
    code === "staff_assignment_not_active" ||
    code === "staff_assignment_not_suspended" ||
    code === "staff_assignment_already_removed"
  ) {
    return res.status(409).json({ ok: false, error: code.toUpperCase() });
  }
  if (code === "property_manager_company_not_active") {
    return res.status(409).json({ ok: false, error: "PROPERTY_MANAGER_COMPANY_NOT_ACTIVE" });
  }
  if (
    code === "property_manager_company_membership_not_found" ||
    code === "property_manager_company_membership_not_active" ||
    code === "property_manager_company_acceptance_role_not_allowed" ||
    code === "property_manager_company_membership_mismatch" ||
    code === "company_assignment_manager_required" ||
    code === "company_management_read_role_not_allowed" ||
    code === "membership_not_active" ||
    code === "invalid_company_role" ||
    code === "invalid_membership_status"
  ) {
    return res.status(403).json({ ok: false, error: code.toUpperCase() });
  }
  if (
    code.startsWith("invalid_") ||
    code.startsWith("missing_") ||
    code === "assignment_scope_exceeds_relationship_scope" ||
    code.includes("_not_allowed") ||
    code.includes("_mismatch")
  ) {
    return res.status(400).json({ ok: false, error: code.toUpperCase() });
  }
  console.error("[property-manager-company-relationships] request failed", code);
  return res.status(500).json({ ok: false, error: "PROPERTY_MANAGER_COMPANY_RELATIONSHIP_FAILED" });
}

router.use(requireAuth);

router.get("/property-manager-companies/search", async (req: any, res) => {
  const context = ownerContext(req);
  if (!context) return forbidden(res);

  try {
    const result = await searchPropertyManagerCompaniesForLandlord({
      query: req.query?.q,
    });
    return res.status(200).json({ ok: true, companies: result.companies });
  } catch (error) {
    return handleError(res, error);
  }
});

router.get("/property-manager-company-relationships", async (req: any, res) => {
  const context = ownerContext(req);
  if (!context) return forbidden(res);

  try {
    const result = await listLandlordPropertyManagerRelationshipManagementRecords({
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

router.get("/property-manager-company-relationships/:relationshipId/staff-assignments", async (req: any, res) => {
  const context = ownerContext(req);
  if (!context) return forbidden(res);

  try {
    const result = await listLandlordRelationshipStaffAssignmentsForManagement({
      landlordId: context.landlordId,
      relationshipId: req.params.relationshipId,
    });
    return res.status(200).json({ ok: true, assignments: result.assignments });
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

companyRouter.use(requireAuth);

companyRouter.get("/my-companies", async (req: any, res) => {
  const context = actorContext(req);
  if (!context) return forbidden(res);

  try {
    const result = await listMyPropertyManagerCompanyContexts({
      actorUserId: context.actorUserId,
    });
    return res.status(200).json({ ok: true, companies: result.companies });
  } catch (error) {
    return handleError(res, error);
  }
});

companyRouter.get("/:companyId/relationships", async (req: any, res) => {
  const context = actorContext(req);
  if (!context) return forbidden(res);

  try {
    const result = await listCompanyRelationshipManagementRecords({
      actorUserId: context.actorUserId,
      companyId: req.params.companyId,
    });
    return res.status(200).json({ ok: true, relationships: result.relationships });
  } catch (error) {
    return handleError(res, error);
  }
});

companyRouter.get("/:companyId/members", async (req: any, res) => {
  const context = actorContext(req);
  if (!context) return forbidden(res);

  try {
    const result = await listCompanyMembersForManagement({
      actorUserId: context.actorUserId,
      companyId: req.params.companyId,
    });
    return res.status(200).json({ ok: true, members: result.members });
  } catch (error) {
    return handleError(res, error);
  }
});

companyRouter.get("/:companyId/staff-assignments", async (req: any, res) => {
  const context = actorContext(req);
  if (!context) return forbidden(res);

  try {
    const result = await listCompanyStaffAssignmentsForManagement({
      actorUserId: context.actorUserId,
      companyId: req.params.companyId,
      relationshipId: req.query?.relationshipId,
    });
    return res.status(200).json({ ok: true, assignments: result.assignments });
  } catch (error) {
    return handleError(res, error);
  }
});

companyRouter.post("/:companyId/staff-assignments", async (req: any, res) => {
  const context = actorContext(req);
  if (!context) return forbidden(res);

  try {
    const result = await createPropertyManagerCompanyStaffAssignmentRecord({
      actorUserId: context.actorUserId,
      companyId: req.params.companyId,
      relationshipId: req.body?.relationshipId,
      staffUserId: req.body?.staffUserId,
      staffRole: req.body?.staffRole,
      propertyScope: req.body?.propertyScope,
      workspaceScopes: Array.isArray(req.body?.workspaceScopes) ? req.body.workspaceScopes : [],
    });
    return res.status(201).json({ ok: true, assignment: result.assignment });
  } catch (error) {
    return handleError(res, error);
  }
});

companyRouter.post("/:companyId/staff-assignments/:assignmentId/suspend", async (req: any, res) => {
  const context = actorContext(req);
  if (!context) return forbidden(res);

  try {
    const result = await suspendPropertyManagerCompanyStaffAssignmentRecord({
      actorUserId: context.actorUserId,
      companyId: req.params.companyId,
      assignmentId: req.params.assignmentId,
      reason: req.body?.reason,
    });
    return res.status(200).json({ ok: true, assignment: result.assignment });
  } catch (error) {
    return handleError(res, error);
  }
});

companyRouter.post("/:companyId/staff-assignments/:assignmentId/reactivate", async (req: any, res) => {
  const context = actorContext(req);
  if (!context) return forbidden(res);

  try {
    const result = await reactivatePropertyManagerCompanyStaffAssignmentRecord({
      actorUserId: context.actorUserId,
      companyId: req.params.companyId,
      assignmentId: req.params.assignmentId,
    });
    return res.status(200).json({ ok: true, assignment: result.assignment });
  } catch (error) {
    return handleError(res, error);
  }
});

companyRouter.post("/:companyId/staff-assignments/:assignmentId/remove", async (req: any, res) => {
  const context = actorContext(req);
  if (!context) return forbidden(res);

  try {
    const result = await removePropertyManagerCompanyStaffAssignmentRecord({
      actorUserId: context.actorUserId,
      companyId: req.params.companyId,
      assignmentId: req.params.assignmentId,
      reason: req.body?.reason,
    });
    return res.status(200).json({ ok: true, assignment: result.assignment });
  } catch (error) {
    return handleError(res, error);
  }
});

companyRouter.post("/:companyId/relationships/:relationshipId/accept", async (req: any, res) => {
  const context = actorContext(req);
  if (!context) return forbidden(res);

  try {
    const result = await acceptLandlordCompanyRelationshipRecord({
      actorUserId: context.actorUserId,
      companyId: req.params.companyId,
      relationshipId: req.params.relationshipId,
    });
    return res.status(200).json({ ok: true, relationship: result.relationship });
  } catch (error) {
    return handleError(res, error);
  }
});

export const propertyManagerCompanyRoutes = companyRouter;
export default router;
