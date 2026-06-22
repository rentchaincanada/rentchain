import { Router } from "express";
import { requireAuth } from "../middleware/requireAuth";
import {
  cancelDelegatedAccessInvitationRecord,
  createDelegatedAccessInvitationRecord,
  expireDelegatedAccessInvitationRecord,
  listDelegatedAccessInvitationRecords,
} from "../services/delegatedAccessInvitationService";

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
  const code = error instanceof Error ? error.message : "delegated_access_invitation_failed";
  if (code === "delegated_invitation_not_found") {
    return res.status(404).json({ ok: false, error: "INVITATION_NOT_FOUND" });
  }
  if (code === "invitation_not_pending") {
    return res.status(409).json({ ok: false, error: "INVITATION_NOT_PENDING" });
  }
  if (code.startsWith("invalid_") || code.startsWith("missing_") || code.includes("_not_allowed")) {
    return res.status(400).json({ ok: false, error: code.toUpperCase() });
  }
  console.error("[delegated-access-invitations] request failed", code);
  return res.status(500).json({ ok: false, error: "DELEGATED_ACCESS_INVITATION_FAILED" });
}

router.use(requireAuth);

router.post("/delegated-access/invitations", async (req: any, res) => {
  const context = ownerContext(req);
  if (!context) return forbidden(res);

  try {
    const result = await createDelegatedAccessInvitationRecord({
      landlordId: context.landlordId,
      actorUserId: context.actorUserId,
      inviteeEmail: req.body?.inviteeEmail,
      role: req.body?.role,
      propertyScope: req.body?.propertyScope,
      workspaceScopes: Array.isArray(req.body?.workspaceScopes) ? req.body.workspaceScopes : [],
      resourceScope: req.body?.resourceScope,
      permissionFlags: Array.isArray(req.body?.permissionFlags) ? req.body.permissionFlags : [],
      expiresAt: req.body?.expiresAt,
    });
    return res.status(201).json({ ok: true, invitation: result.invitation });
  } catch (error) {
    return handleError(res, error);
  }
});

router.get("/delegated-access/invitations", async (req: any, res) => {
  const context = ownerContext(req);
  if (!context) return forbidden(res);

  try {
    const result = await listDelegatedAccessInvitationRecords({
      landlordId: context.landlordId,
    });
    return res.status(200).json({ ok: true, invitations: result.invitations });
  } catch (error) {
    return handleError(res, error);
  }
});

router.post("/delegated-access/invitations/:invitationId/cancel", async (req: any, res) => {
  const context = ownerContext(req);
  if (!context) return forbidden(res);

  try {
    const result = await cancelDelegatedAccessInvitationRecord({
      landlordId: context.landlordId,
      actorUserId: context.actorUserId,
      invitationId: req.params.invitationId,
    });
    return res.status(200).json({ ok: true, invitation: result.invitation });
  } catch (error) {
    return handleError(res, error);
  }
});

router.post("/delegated-access/invitations/:invitationId/expire", async (req: any, res) => {
  const context = ownerContext(req);
  if (!context) return forbidden(res);

  try {
    const result = await expireDelegatedAccessInvitationRecord({
      landlordId: context.landlordId,
      actorUserId: context.actorUserId,
      invitationId: req.params.invitationId,
      now: req.body?.now,
    });
    return res.status(200).json({ ok: true, changed: result.changed, invitation: result.invitation });
  } catch (error) {
    return handleError(res, error);
  }
});

export default router;
