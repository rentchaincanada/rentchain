import { Router } from "express";
import { db } from "../firebase";
import { actorFromRequest, governanceMetadata, sanitizeTelemetryProps } from "../lib/governance/platformGovernance";
import { safeErrorLog } from "../lib/logging/safeLogger";
import { requireAuth } from "../middleware/requireAuth";

const router = Router();

const ALLOWED_EVENT_PREFIXES = ["nudge_", "pdf_"];

router.post("/telemetry", requireAuth, async (req: any, res) => {
  const actor = actorFromRequest(req);
  const userId = actor.actorId;
  if (!userId) return res.status(401).json({ ok: false, error: "Unauthorized" });

  const eventName = String(req.body?.eventName || "").trim().toLowerCase();
  if (!eventName || !ALLOWED_EVENT_PREFIXES.some((prefix) => eventName.startsWith(prefix))) {
    return res.status(400).json({ ok: false, error: "invalid_event_name" });
  }

  const role = actor.actorRole;
  const landlordId = actor.landlordId;
  const eventProps = sanitizeTelemetryProps(req.body?.eventProps || {});
  const createdAt = Date.now();

  try {
    await db.collection("telemetry_events").add({
      userId,
      landlordId,
      role,
      eventName,
      eventProps,
      governance: governanceMetadata({
        sensitivity: eventName.startsWith("pdf_") ? "confidential" : "internal",
        retentionCategory: eventName.startsWith("pdf_") ? "export_metadata" : "operational_short",
      }),
      createdAt,
    });
    return res.status(200).json({ ok: true });
  } catch (err: any) {
    safeErrorLog("[telemetryRoutes] write failed", err, { eventName, userId, landlordId, role });
    return res.status(500).json({ ok: false, error: "telemetry_write_failed" });
  }
});

export default router;
