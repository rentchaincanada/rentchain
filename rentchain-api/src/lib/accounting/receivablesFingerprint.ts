import { createHash } from "crypto";

export const RECEIVABLE_SCHEDULE_STATE_STALE = "RECEIVABLE_SCHEDULE_STATE_STALE";

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (!value || typeof value !== "object") return value === undefined ? null : value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, child]) => [key, stableValue(child)])
  );
}

export function stableSerializeReceivables(value: unknown): string {
  return JSON.stringify(stableValue(value));
}

export function buildReceivablesFingerprint(value: unknown): string {
  const digest = createHash("sha256").update(stableSerializeReceivables(value)).digest("hex").slice(0, 32);
  return `lease_charge_schedule_preview:v1:${digest}`;
}

export function validateChargeSchedulePreviewFingerprint(input: {
  expectedPreviewFingerprint?: string | null;
  currentPreviewFingerprint: string;
}): { ok: true } | { ok: false; code: typeof RECEIVABLE_SCHEDULE_STATE_STALE } {
  if (
    !input.expectedPreviewFingerprint ||
    input.expectedPreviewFingerprint !== input.currentPreviewFingerprint
  ) {
    return { ok: false, code: RECEIVABLE_SCHEDULE_STATE_STALE };
  }
  return { ok: true };
}
