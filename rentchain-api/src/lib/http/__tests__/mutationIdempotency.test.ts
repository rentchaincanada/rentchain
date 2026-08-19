import { describe, expect, it } from "vitest";
import { readMutationIdempotencyKey } from "../mutationIdempotency";

function request(value: string | undefined) {
  return { get: () => value } as any;
}

describe("readMutationIdempotencyKey", () => {
  it("requires a caller-owned mutation identity", () => {
    expect(readMutationIdempotencyKey(request(undefined))).toEqual({ ok: false, error: "idempotency_key_required" });
    expect(readMutationIdempotencyKey(request("   "))).toEqual({ ok: false, error: "idempotency_key_required" });
  });

  it("accepts a bounded opaque key and trims transport whitespace", () => {
    expect(readMutationIdempotencyKey(request(" mutation:lease:123 "))).toEqual({ ok: true, key: "mutation:lease:123" });
  });

  it("rejects control characters and unreasonable length", () => {
    expect(readMutationIdempotencyKey(request("bad\nkey"))).toEqual({ ok: false, error: "idempotency_key_invalid" });
    expect(readMutationIdempotencyKey(request("first, second"))).toEqual({ ok: false, error: "idempotency_key_invalid" });
    expect(readMutationIdempotencyKey(request("x".repeat(129)))).toEqual({ ok: false, error: "idempotency_key_invalid" });
  });
});
