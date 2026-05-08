import type { PdfExportEventName, PdfExportType, PdfRenderingPath } from "./pdfExportObservabilityTypes";
import {
  actorFromRequest,
  exportGovernanceMetadata,
  sanitizeTelemetryProps,
} from "../governance/platformGovernance";

type RecordPdfExportTelemetryInput = {
  eventName: PdfExportEventName;
  req?: any;
  exportType: PdfExportType;
  renderingPath: PdfRenderingPath;
  status?: string | null;
  durationMs?: number | null;
  byteSize?: number | null;
  errorCode?: string | null;
};

function asString(value: unknown, max = 120) {
  return String(value || "").trim().slice(0, max);
}

function asNumber(value: unknown) {
  const next = Number(value);
  return Number.isFinite(next) ? next : null;
}

function browserClass(userAgent: string) {
  const ua = userAgent.toLowerCase();
  if (ua.includes("edg/")) return "edge";
  if (ua.includes("chrome") || ua.includes("crios")) return "chrome";
  if (ua.includes("firefox") || ua.includes("fxios")) return "firefox";
  if (ua.includes("safari")) return "safari";
  return "other";
}

export async function recordPdfExportTelemetry(input: RecordPdfExportTelemetryInput): Promise<void> {
  try {
    const { db } = await import("../../config/firebase");
    const actor = actorFromRequest(input.req);
    const userId = actor.actorId;
    const landlordId = actor.landlordId;
    const role = actor.actorRole;
    const userAgent = asString(input.req?.headers?.["user-agent"], 400);
    const durationMs = asNumber(input.durationMs);
    const byteSize = asNumber(input.byteSize);

    await db.collection("telemetry_events").add({
      userId,
      landlordId,
      role,
      eventName: input.eventName,
      eventProps: sanitizeTelemetryProps({
        exportType: input.exportType,
        renderingPath: input.renderingPath,
        status: input.status || null,
        durationMs: durationMs == null ? null : Math.max(0, Math.round(durationMs)),
        byteSize: byteSize == null ? null : Math.max(0, Math.round(byteSize)),
        browserClass: userAgent ? browserClass(userAgent) : "unknown",
        viewportCategory: "server",
        errorCode: input.errorCode ? asString(input.errorCode, 120).toLowerCase().replace(/[^a-z0-9_:-]+/g, "_") : null,
      }),
      governance: exportGovernanceMetadata(input.exportType),
      createdAt: Date.now(),
    });
  } catch (err: any) {
    console.warn("[pdfExportObservability] telemetry write skipped", err?.message || err);
  }
}
