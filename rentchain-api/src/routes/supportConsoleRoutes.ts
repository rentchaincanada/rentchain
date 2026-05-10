import { Router } from "express";
import crypto from "crypto";
import { requireAuth } from "../middleware/requireAuth";
import { requirePermission } from "../middleware/requireAuthz";
import { buildSupportConsoleResource } from "../lib/supportConsole/buildSupportConsoleResource";
import { actorFromRequest } from "../lib/governance/platformGovernance";
import { writeCanonicalEvent } from "../lib/events/buildEvent";

const router = Router();

function asString(value: unknown, max = 240) {
  return String(value || "").trim().slice(0, max);
}

function telemetryHash(value: unknown) {
  const raw = asString(value, 500);
  if (!raw) return null;
  return crypto.createHash("sha256").update(raw).digest("hex").slice(0, 20);
}

function requestSecurityTelemetry(req: any) {
  const ip = String(req.headers?.["x-forwarded-for"] || "")
    .split(",")[0]
    .trim() || asString(req.ip || req.socket?.remoteAddress, 120);
  const userAgent = asString(req.get?.("user-agent") || req.headers?.["user-agent"], 500);
  const userAgentLower = String(userAgent || "").toLowerCase();
  const userAgentFamily = userAgentLower.includes("edg/")
    ? "edge"
    : userAgentLower.includes("chrome/")
    ? "chrome"
    : userAgentLower.includes("safari/")
    ? "safari"
    : userAgentLower.includes("firefox/")
    ? "firefox"
    : userAgentLower
    ? "other"
    : "unknown";
  return {
    schemaVersion: "security_session_telemetry.v1",
    workflow: "support_diagnostics",
    signal: "operator_diagnostics_access",
    internalOnly: true,
    metadataOnly: true,
    ipHash: telemetryHash(ip),
    userAgentHash: telemetryHash(userAgent),
    userAgentFamily,
    retentionClassification: "security_session_internal",
    rawIpVisible: false,
    rawUserAgentVisible: false,
    preciseGeolocationIncluded: false,
    deviceFingerprintingIncluded: false,
    behavioralProfileIncluded: false,
    riskScoreIncluded: false,
    portableVisible: false,
    exportable: false,
  };
}

function isInstitutionAccessResourceType(value: unknown) {
  const raw = asString(value, 120).toLowerCase();
  return raw === "institution_access" || raw === "tenant_institution_access" || raw === "tenant_institution_access_grant";
}

async function recordSupportConsoleAccess(req: any, input: { resourceType: string; resourceId: string }) {
  try {
    const actor = actorFromRequest(req);
    const now = new Date().toISOString();
    const institutionAccess = isInstitutionAccessResourceType(input.resourceType);
    const action = institutionAccess ? "institution_access_diagnostics_opened" : "support_console_accessed";
    await writeCanonicalEvent({
      id: `${action}:${input.resourceType}:${input.resourceId}:${actor.actorId || "unknown"}:${Date.now()}`
        .toLowerCase()
        .replace(/[^a-z0-9_.:-]+/g, "_"),
      domain: "system",
      action,
      status: "completed",
      actor: {
        type: actor.actorRole === "admin" ? "admin" : "user",
        id: actor.actorId,
        role: actor.actorRole,
      },
      resource: {
        type: institutionAccess ? "tenant_institution_access_grant" : "support_console_resource",
        id: input.resourceId,
        parentType: input.resourceType,
        parentId: input.resourceId,
      },
      occurredAt: now,
      visibility: "system",
      summary: institutionAccess
        ? "Institution access diagnostics opened with redacted metadata-only view."
        : "Support console resource accessed with redacted diagnostic identifiers.",
      metadata: {
        resourceType: input.resourceType,
        metadataOnly: true,
        redactionApplied: true,
        retentionCategory: "support_diagnostics",
        trustPayloadIncluded: false,
        rawProviderPayloadIncluded: false,
        downloadEnabled: false,
        securityTelemetry: requestSecurityTelemetry(req),
      },
      tags: institutionAccess
        ? ["support_console", "institution_access_diagnostics", "governance"]
        : ["support_console", "governance"],
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
