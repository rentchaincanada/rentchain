import crypto from "crypto";
import { db } from "../../firebase";
import { safeOperationalLog } from "../../lib/logging/safeLogger";
import {
  SYSTEM_OBSERVABILITY_EVENTS_COLLECTION,
  type SystemObservabilityEventInput,
  type SystemObservabilityEventRecord,
  type SystemObservabilitySafeContext,
  type SystemObservabilityStatus,
} from "./observabilityTypes";

const SAFE_CONTEXT_KEYS = new Set(["route", "actionKey", "resourceType", "resourceId"]);
const EMAIL_PATTERN = /\b[^\s@]+@[^\s@]+\.[^\s@]+\b/;
const URL_PATTERN = /https?:\/\//i;
const SIGNED_URL_PATTERN = /(x-amz-signature|googleaccessid|signature=|expires=|token=)/i;
const TOKEN_PATTERN = /\b(bearer|token|whsec_|sk_live_|sk_test_|pk_live_|pk_test_|eyJ[a-zA-Z0-9._-]+)\b/i;
const BASE64ISH_PATTERN = /^[A-Za-z0-9+/_=-]{80,}$/;
const FILE_NAME_PATTERN = /\b[\w-]+\.(pdf|docx?|xlsx?|csv|png|jpe?g|gif)\b/i;

function normalizeString(value: unknown, max: number): string {
  return String(value || "").trim().replace(/\s+/g, " ").slice(0, max);
}

function toIsoString(value: unknown, fallback = new Date()): string {
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) return new Date(parsed).toISOString();
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return new Date(value).toISOString();
  }
  if (value instanceof Date && Number.isFinite(value.getTime())) {
    return value.toISOString();
  }
  return fallback.toISOString();
}

function isUnsafeValue(value: string, key: keyof SystemObservabilitySafeContext): boolean {
  if (!value) return true;
  if (URL_PATTERN.test(value) || SIGNED_URL_PATTERN.test(value)) return true;
  if (EMAIL_PATTERN.test(value) || TOKEN_PATTERN.test(value)) return true;
  if (BASE64ISH_PATTERN.test(value) || FILE_NAME_PATTERN.test(value)) return true;
  if (key !== "route" && value.includes("/")) return true;
  if (key === "route" && !value.startsWith("/")) return true;
  if (value.includes("projects/") || value.includes("documents/")) return true;
  return false;
}

export function sanitizeSystemObservabilitySafeContext(
  input?: SystemObservabilitySafeContext | null
): SystemObservabilitySafeContext | null {
  if (!input || typeof input !== "object") return null;

  const next: SystemObservabilitySafeContext = {};
  (Object.keys(input) as Array<keyof SystemObservabilitySafeContext>).forEach((key) => {
    if (!SAFE_CONTEXT_KEYS.has(key)) return;
    const max = key === "resourceId" ? 120 : 100;
    const value = normalizeString(input[key], max);
    if (!value) return;
    if (isUnsafeValue(value, key)) return;
    next[key] = value;
  });

  return Object.keys(next).length ? next : null;
}

function deriveDefaultStatus(eventType: SystemObservabilityEventInput["eventType"]): SystemObservabilityStatus {
  if (eventType === "workflow_completed") return "resolved";
  if (eventType === "workflow_started") return "open";
  return "open";
}

function deriveResolvedAt(input: SystemObservabilityEventInput, occurredAt: string): string | null {
  if (input.resolvedAt) return toIsoString(input.resolvedAt, new Date(occurredAt));
  if ((input.status || deriveDefaultStatus(input.eventType)) === "resolved") return occurredAt;
  return null;
}

function buildEventId(idempotencyKey?: string | null): string {
  const normalizedKey = normalizeString(idempotencyKey, 240);
  if (!normalizedKey) return crypto.randomUUID();
  return `obs_${crypto.createHash("sha256").update(normalizedKey).digest("hex").slice(0, 32)}`;
}

export async function recordSystemObservabilityEvent(
  input: SystemObservabilityEventInput,
  options?: { failSoft?: boolean }
): Promise<{ ok: boolean; duplicate: boolean; record: SystemObservabilityEventRecord | null }> {
  const failSoft = options?.failSoft !== false;

  try {
    const now = new Date();
    const occurredAt = toIsoString(input.occurredAt, now);
    const idempotencyKey = normalizeString(input.idempotencyKey, 240) || null;
    const id = buildEventId(idempotencyKey);
    const ref = db.collection(SYSTEM_OBSERVABILITY_EVENTS_COLLECTION).doc(id);
    const existingSnap = idempotencyKey ? await ref.get() : null;
    const existing = existingSnap?.exists ? ((existingSnap.data() as SystemObservabilityEventRecord) || null) : null;
    const recordedAt = existing?.recordedAt || now.toISOString();
    const status = input.status || deriveDefaultStatus(input.eventType);

    const record: SystemObservabilityEventRecord = {
      id,
      version: "v1",
      eventType: input.eventType,
      workflow: input.workflow,
      severity: input.severity,
      actorType: input.actorType,
      status,
      title: normalizeString(input.title, 160) || "System observability event",
      description: normalizeString(input.description, 500) || "Operational workflow event recorded.",
      safeContext: sanitizeSystemObservabilitySafeContext(input.safeContext),
      idempotencyKey,
      source: input.source?.kind
        ? {
            kind: input.source.kind,
            sourceEventId: normalizeString(input.source.sourceEventId, 160) || null,
          }
        : {
            kind: "system_observability",
            sourceEventId: null,
          },
      occurredAt,
      recordedAt,
      resolvedAt: deriveResolvedAt({ ...input, status }, occurredAt),
    };

    await ref.set(record, { merge: false });
    return { ok: true, duplicate: Boolean(existing), record };
  } catch (err) {
    if (!failSoft) throw err;
    safeOperationalLog("warn", "[systemObservability] record failed softly", {
      eventType: input?.eventType || null,
      workflow: input?.workflow || null,
      message: (err as any)?.message || err,
    });
    return { ok: false, duplicate: false, record: null };
  }
}
