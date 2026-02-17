import { Router } from "express";
import { db } from "../config/firebase";
import { requireAuth } from "../middleware/requireAuth";

const router = Router();

const REDACT_KEYS = ["email", "phone", "address", "name", "fullName", "tenantEmail", "tenantName"];

function sanitizeValue(value: any, depth = 0): any {
  if (depth > 3) return null;
  if (value == null) return null;
  if (typeof value === "string") return value.slice(0, 180);
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (Array.isArray(value)) return value.slice(0, 25).map((item) => sanitizeValue(item, depth + 1));
  if (typeof value === "object") {
    const out: Record<string, any> = {};
    for (const [key, val] of Object.entries(value)) {
      const lowered = String(key || "").toLowerCase();
      if (REDACT_KEYS.some((k) => lowered.includes(k.toLowerCase()))) continue;
      out[key] = sanitizeValue(val, depth + 1);
    }
    return out;
  }
  return null;
}

router.post("/telemetry", requireAuth, async (req: any, res) => {
  const userId = String(req.user?.id || "").trim();
  if (!userId) return res.status(401).json({ ok: false, error: "Unauthorized" });

  const eventName = String(req.body?.eventName || "").trim().toLowerCase();
  if (!eventName || !eventName.startsWith("nudge_")) {
    return res.status(400).json({ ok: false, error: "invalid_event_name" });
  }

  const role = String(req.user?.role || "").trim().toLowerCase() || "unknown";
  const landlordId = String(req.user?.landlordId || req.user?.id || "").trim() || null;
  const eventProps = sanitizeValue(req.body?.eventProps || {});
  const createdAt = Date.now();

  try {
    await db.collection("telemetry_events").add({
      userId,
      landlordId,
      role,
      eventName,
      eventProps,
      createdAt,
    });
    return res.status(200).json({ ok: true });
  } catch (err: any) {
    console.error("[telemetryRoutes] write failed", err?.message || err);
    return res.status(500).json({ ok: false, error: "telemetry_write_failed" });
  }
});

export default router;
