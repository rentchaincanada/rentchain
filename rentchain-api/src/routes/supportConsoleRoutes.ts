import { Router } from "express";
import { requireAuth } from "../middleware/requireAuth";
import { requirePermission } from "../middleware/requireAuthz";
import { buildSupportConsoleResource } from "../lib/supportConsole/buildSupportConsoleResource";
import { actorFromRequest } from "../lib/governance/platformGovernance";
import { writeCanonicalEvent } from "../lib/events/buildEvent";

const router = Router();

function asString(value: unknown, max = 240) {
  return String(value || "").trim().slice(0, max);
}

async function recordSupportConsoleAccess(req: any, input: { resourceType: string; resourceId: string }) {
  try {
    const actor = actorFromRequest(req);
    const now = new Date().toISOString();
    await writeCanonicalEvent({
      id: `support_console_accessed:${input.resourceType}:${input.resourceId}:${actor.actorId || "unknown"}:${Date.now()}`
        .toLowerCase()
        .replace(/[^a-z0-9_.:-]+/g, "_"),
      domain: "system",
      action: "support_console_accessed",
      status: "completed",
      actor: {
        type: actor.actorRole === "admin" ? "admin" : "user",
        id: actor.actorId,
        role: actor.actorRole,
      },
      resource: {
        type: "support_console_resource",
        id: input.resourceId,
        parentType: input.resourceType,
        parentId: input.resourceId,
      },
      occurredAt: now,
      visibility: "system",
      summary: "Support console resource accessed with redacted diagnostic identifiers.",
      metadata: {
        resourceType: input.resourceType,
        metadataOnly: true,
        redactionApplied: true,
        retentionCategory: "support_diagnostics",
      },
      tags: ["support_console", "governance"],
    });
  } catch (err: any) {
    console.warn("[support-console] access audit skipped", err?.message || err);
  }
}

router.get("/support-console/resource", requireAuth, requirePermission("system.admin"), async (req: any, res) => {
  try {
    const resourceType = asString(req.query?.resourceType, 120);
    const resourceId = asString(req.query?.resourceId, 240);
    if (!resourceType || !resourceId) {
      return res.status(400).json({ ok: false, error: "RESOURCE_QUERY_INVALID" });
    }

    const payload = await buildSupportConsoleResource({ resourceType, resourceId });
    if (!payload) {
      return res.status(400).json({ ok: false, error: "RESOURCE_TYPE_UNSUPPORTED" });
    }

    void recordSupportConsoleAccess(req, { resourceType, resourceId });
    return res.json(payload);
  } catch (err: any) {
    console.error("[support-console] resource fetch failed", err?.message || err);
    return res.status(500).json({ ok: false, error: "SUPPORT_CONSOLE_FETCH_FAILED" });
  }
});

export default router;
