import { Router } from "express";
import { requireAuth } from "../middleware/requireAuth";
import {
  acceptDelegatedAccessInvitationRecord,
  cancelDelegatedAccessInvitationRecord,
  createDelegatedAccessInvitationRecord,
  expireDelegatedAccessInvitationRecord,
  listActiveDelegatedAccessGrantRecordsForDelegate,
  listDelegatedAccessDelegateRecords,
  listDelegatedAccessGrantRecords,
  listDelegatedAccessInvitationRecords,
  resendDelegatedAccessInvitationEmailRecord,
  revokeDelegatedAccessGrantRecord,
} from "../services/delegatedAccessInvitationService";

const router = Router();
const selfRouter = Router();

function asString(value: unknown, max = 240): string {
  return String(value ?? "").trim().slice(0, max);
}

function ownerContext(req: any): { actorUserId: string; landlordId: string; actorEmail: string | null } | null {
  const role = asString(req.user?.role, 80).toLowerCase();
  if (role !== "landlord") return null;
  const actorUserId = asString(req.user?.id || req.user?.uid || req.user?.sub, 240);
  const landlordId = asString(req.user?.landlordId || req.user?.id, 240);
  const actorEmail = asString(req.user?.email, 320) || null;
  if (!actorUserId || !landlordId) return null;
  return { actorUserId, landlordId, actorEmail };
}

function actorContext(req: any): { actorUserId: string; actorEmail: string | null } | null {
  const actorUserId = asString(req.user?.id || req.user?.uid || req.user?.sub, 240);
  if (!actorUserId) return null;
  const actorEmail = asString(req.user?.email, 320) || null;
  return { actorUserId, actorEmail };
}

function delegateContext(req: any): { actorUserId: string; actorEmail: string | null } | null {
  const role = asString(req.user?.actorRole || req.user?.role, 80).toLowerCase();
  if (role !== "delegate") return null;
  return actorContext(req);
}

function forbidden(res: any) {
  return res.status(403).json({ ok: false, error: "FORBIDDEN" });
}

function handleError(res: any, error: unknown) {
  const code = error instanceof Error ? error.message : "delegated_access_invitation_failed";
  if (code === "delegated_invitation_not_found") {
    return res.status(404).json({ ok: false, error: "INVITATION_NOT_FOUND" });
  }
  if (code === "delegated_grant_not_found") {
    return res.status(404).json({ ok: false, error: "GRANT_NOT_FOUND" });
  }
  if (code === "invalid_invitation_token") {
    return res.status(404).json({ ok: false, error: "INVITATION_NOT_FOUND" });
  }
  if (code === "invitation_not_pending") {
    return res.status(409).json({ ok: false, error: "INVITATION_NOT_PENDING" });
  }
  if (code === "grant_not_active") {
    return res.status(409).json({ ok: false, error: "GRANT_NOT_ACTIVE" });
  }
  if (code === "invitation_expired") {
    return res.status(410).json({ ok: false, error: "INVITATION_EXPIRED" });
  }
  if (code === "invitee_email_mismatch") {
    return res.status(403).json({ ok: false, error: "INVITEE_EMAIL_MISMATCH" });
  }
  if (code === "delegate_account_role_conflict") {
    return res.status(403).json({ ok: false, error: "DELEGATE_ACCOUNT_ROLE_CONFLICT" });
  }
  if (code.startsWith("invalid_") || code.startsWith("missing_") || code.includes("_not_allowed")) {
    return res.status(400).json({ ok: false, error: code.toUpperCase() });
  }
  console.error("[delegated-access-invitations] request failed", code);
  return res.status(500).json({ ok: false, error: "DELEGATED_ACCESS_INVITATION_FAILED" });
}

router.use(requireAuth);

async function handleMyDelegatedAccessGrants(req: any, res: any) {
  const context = delegateContext(req);
  if (!context) return forbidden(res);

  try {
    const result = await listActiveDelegatedAccessGrantRecordsForDelegate({
      actorUserId: context.actorUserId,
    });
    return res.status(200).json({ ok: true, grants: result.grants });
  } catch (error) {
    return handleError(res, error);
  }
}

selfRouter.use(requireAuth);
selfRouter.get("/my-grants", handleMyDelegatedAccessGrants);

router.get("/delegated-access/my-grants", handleMyDelegatedAccessGrants);

router.get("/delegated-access/delegates", async (req: any, res) => {
  const context = ownerContext(req);
  if (!context) return forbidden(res);

  try {
    const result = await listDelegatedAccessDelegateRecords({
      landlordId: context.landlordId,
    });
    return res.status(200).json({ ok: true, delegates: result.delegates });
  } catch (error) {
    return handleError(res, error);
  }
});

router.get("/delegated-access/grants", async (req: any, res) => {
  const context = ownerContext(req);
  if (!context) return forbidden(res);

  try {
    const result = await listDelegatedAccessGrantRecords({
      landlordId: context.landlordId,
    });
    return res.status(200).json({ ok: true, grants: result.grants });
  } catch (error) {
    return handleError(res, error);
  }
});

router.post("/delegated-access/grants/:grantId/revoke", async (req: any, res) => {
  const context = ownerContext(req);
  if (!context) return forbidden(res);

  try {
    const result = await revokeDelegatedAccessGrantRecord({
      landlordId: context.landlordId,
      actorUserId: context.actorUserId,
      grantId: req.params.grantId,
      reason: req.body?.reason,
    });
    return res.status(200).json({ ok: true, grant: result.grant });
  } catch (error) {
    return handleError(res, error);
  }
});

router.post("/delegated-access/invitations/accept", async (req: any, res) => {
  const context = actorContext(req);
  if (!context) return forbidden(res);

  try {
    const result = await acceptDelegatedAccessInvitationRecord({
      actorUserId: context.actorUserId,
      actorEmail: context.actorEmail,
      actorRole: req.user?.actorRole || req.user?.role || null,
      token: req.body?.token,
    });
    return res.status(200).json({ ok: true, invitation: result.invitation, grant: result.grant });
  } catch (error) {
    return handleError(res, error);
  }
});

router.post("/delegated-access/invitations", async (req: any, res) => {
  const context = ownerContext(req);
  if (!context) return forbidden(res);

  try {
    const result = await createDelegatedAccessInvitationRecord({
      landlordId: context.landlordId,
      actorUserId: context.actorUserId,
      actorEmail: context.actorEmail,
      inviteeEmail: req.body?.inviteeEmail,
      role: req.body?.role,
      propertyScope: req.body?.propertyScope,
      workspaceScopes: Array.isArray(req.body?.workspaceScopes) ? req.body.workspaceScopes : [],
      resourceScope: req.body?.resourceScope,
      permissionFlags: Array.isArray(req.body?.permissionFlags) ? req.body.permissionFlags : [],
      expiresAt: req.body?.expiresAt,
    });
    return res.status(201).json({
      ok: true,
      invitation: result.invitation,
      emailDispatch: { status: result.emailDispatched ? "sent" : "failed" },
    });
  } catch (error) {
    return handleError(res, error);
  }
});

router.post("/delegated-access/invitations/:invitationId/resend", async (req: any, res) => {
  const context = ownerContext(req);
  if (!context) return forbidden(res);

  try {
    const result = await resendDelegatedAccessInvitationEmailRecord({
      landlordId: context.landlordId,
      actorUserId: context.actorUserId,
      actorEmail: context.actorEmail,
      invitationId: req.params.invitationId,
    });
    return res.status(result.emailDispatched ? 200 : 502).json({
      ok: result.emailDispatched,
      invitation: result.invitation,
      emailDispatch: { status: result.emailDispatched ? "sent" : "failed" },
      ...(result.emailDispatched ? {} : { error: "EMAIL_DISPATCH_FAILED" }),
    });
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

export const delegatedAccessSelfRoutes = selfRouter;
export default router;
