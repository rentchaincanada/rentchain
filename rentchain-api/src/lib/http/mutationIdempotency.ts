import type { Request } from "express";

export const IDEMPOTENCY_KEY_HEADER = "Idempotency-Key";
export const MAX_IDEMPOTENCY_KEY_LENGTH = 128;

export type MutationIdempotencyValidation =
  | { ok: true; key: string }
  | { ok: false; error: "idempotency_key_required" | "idempotency_key_invalid" };

export function readMutationIdempotencyKey(req: Pick<Request, "get"> & { headers?: Record<string, unknown> }): MutationIdempotencyValidation {
  const raw = typeof req.get === "function"
    ? req.get(IDEMPOTENCY_KEY_HEADER)
    : req.headers?.[IDEMPOTENCY_KEY_HEADER.toLowerCase()];
  if (raw == null) return { ok: false, error: "idempotency_key_required" };

  const key = String(raw).trim();
  if (!key) return { ok: false, error: "idempotency_key_required" };
  if (key.length > MAX_IDEMPOTENCY_KEY_LENGTH || /[\u0000-\u001f\u007f,]/.test(key)) {
    return { ok: false, error: "idempotency_key_invalid" };
  }
  return { ok: true, key };
}
