import { Router } from "express";
import { requireAuth } from "../middleware/requireAuth";
import { buildSupportConsoleResource } from "../lib/supportConsole/buildSupportConsoleResource";

const router = Router();

function asString(value: unknown, max = 240) {
  return String(value || "").trim().slice(0, max);
}

function normalizeRole(req: any): "admin" | "landlord" | "other" {
  const role = asString(req.user?.actorRole || req.user?.role, 40).toLowerCase();
  if (role === "admin") return "admin";
  if (role === "landlord") return "landlord";
  return "other";
}

router.get("/support-console/resource", requireAuth, async (req: any, res) => {
  try {
    if (normalizeRole(req) !== "admin") {
      return res.status(403).json({ ok: false, error: "FORBIDDEN" });
    }

    const resourceType = asString(req.query?.resourceType, 120);
    const resourceId = asString(req.query?.resourceId, 240);
    if (!resourceType || !resourceId) {
      return res.status(400).json({ ok: false, error: "RESOURCE_QUERY_INVALID" });
    }

    const payload = await buildSupportConsoleResource({ resourceType, resourceId });
    if (!payload) {
      return res.status(400).json({ ok: false, error: "RESOURCE_TYPE_UNSUPPORTED" });
    }

    return res.json(payload);
  } catch (err: any) {
    console.error("[support-console] resource fetch failed", err?.message || err);
    return res.status(500).json({ ok: false, error: "SUPPORT_CONSOLE_FETCH_FAILED" });
  }
});

export default router;
