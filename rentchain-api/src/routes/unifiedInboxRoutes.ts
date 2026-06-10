import { Router, type Request, type Response } from "express";
import { requireAuth } from "../middleware/requireAuth";
import { getUnifiedInbox, UnifiedInboxError, type UnifiedInboxContext, type UnifiedInboxRole } from "../services/unifiedInbox";

const router = Router();

function asString(value: unknown, max = 240): string {
  return String(value || "").trim().slice(0, max);
}

function resolveContext(req: Request): UnifiedInboxContext | null {
  const user: Record<string, unknown> = ((req as Request & { user?: Record<string, unknown> }).user || {}) as Record<
    string,
    unknown
  >;
  const role = asString(user.actorRole || user.role, 40).toLowerCase() as UnifiedInboxRole;

  if (role === "tenant") {
    const tenantId = asString(user.tenantId || user.id, 240);
    const tenantWorkspaceId = asString(user.tenantWorkspaceId || user.workspaceId || tenantId, 240);
    if (!tenantId || !tenantWorkspaceId) return null;
    return { role, tenantId, tenantWorkspaceId };
  }

  if (role === "landlord") {
    const landlordId = asString(user.landlordId || user.id, 240);
    if (!landlordId) return null;
    return { role, landlordId };
  }

  if (role === "contractor") {
    const contractorId = asString(user.contractorId || user.id, 160);
    if (!contractorId) return null;
    return { role, contractorId };
  }

  return null;
}

router.get("/inbox", requireAuth, async (req: Request, res: Response) => {
  try {
    const context = resolveContext(req);
    if (!context) {
      return res.status(403).json({ ok: false, error: "UNIFIED_INBOX_FORBIDDEN", message: "Unified inbox is not available" });
    }

    const result = await getUnifiedInbox(context, req.query);
    return res.json(result);
  } catch (error: unknown) {
    if (error instanceof UnifiedInboxError) {
      return res.status(error.status).json({ ok: false, error: error.code, message: error.message });
    }

    console.error("[unified-inbox] failed", error instanceof Error ? error.message : "unknown_error");
    return res.status(500).json({ ok: false, error: "UNIFIED_INBOX_FAILED", message: "Unable to load inbox" });
  }
});

export default router;
