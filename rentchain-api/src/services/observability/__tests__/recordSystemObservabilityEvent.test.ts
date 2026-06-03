import { beforeEach, describe, expect, it, vi } from "vitest";

const { store, ensureCollection, setShouldFail, getShouldFail } = vi.hoisted(() => {
  const store = new Map<string, Map<string, any>>();
  let shouldFail = false;

  function ensureCollection(name: string) {
    if (!store.has(name)) store.set(name, new Map<string, any>());
    return store.get(name)!;
  }

  return {
    store,
    ensureCollection,
    setShouldFail(value: boolean) {
      shouldFail = value;
    },
    getShouldFail() {
      return shouldFail;
    },
  };
});

vi.mock("../../../firebase", () => ({
  db: {
    collection: (name: string) => ({
      doc: (id: string) => ({
        id,
        async get() {
          return {
            exists: ensureCollection(name).has(id),
            data: () => ensureCollection(name).get(id),
          };
        },
        async set(payload: any) {
          if (getShouldFail()) {
            throw new Error("write_failed");
          }
          ensureCollection(name).set(id, payload);
        },
      }),
    }),
  },
}));

describe("recordSystemObservabilityEvent", () => {
  beforeEach(() => {
    store.clear();
    setShouldFail(false);
  });

  it("sanitizes unsafe context fields before writing", async () => {
    const { recordSystemObservabilityEvent } = await import("../recordSystemObservabilityEvent");
    const result = await recordSystemObservabilityEvent(
      {
        eventType: "integration_warning",
        workflow: "screening",
        severity: "warning",
        actorType: "system",
        title: "Unsafe context check",
        description: "Testing sanitization behavior.",
        safeContext: {
          route: "/api/stripe/webhook",
          actionKey: "screening_warning",
          resourceType: "screening_order",
          resourceId: "order-1",
          // @ts-expect-error test-only unknown key
          email: "tenant@example.com",
          // @ts-expect-error test-only unknown key
          signedUrl: "https://example.com/file.pdf?X-Amz-Signature=abc",
        },
      },
      { failSoft: false }
    );

    expect(result.ok).toBe(true);
    expect(result.record?.safeContext).toEqual({
      route: "/api/stripe/webhook",
      actionKey: "screening_warning",
      resourceType: "screening_order",
      resourceId: "order-1",
    });
    expect(JSON.stringify(result.record)).not.toContain("@");
    expect(JSON.stringify(result.record)).not.toContain("X-Amz-Signature");
  });

  it("writes a safe event record with resolved timestamps for completed workflows", async () => {
    const { recordSystemObservabilityEvent } = await import("../recordSystemObservabilityEvent");
    const result = await recordSystemObservabilityEvent(
      {
        eventType: "workflow_completed",
        workflow: "payment",
        severity: "info",
        actorType: "system",
        title: "Rent payment completed",
        description: "A rent payment completed successfully.",
        safeContext: {
          resourceType: "rent_payment",
          resourceId: "rp-1",
        },
        occurredAt: "2026-04-28T12:00:00.000Z",
      },
      { failSoft: false }
    );

    const stored = result.record;
    expect(stored).toEqual(
      expect.objectContaining({
        version: "v1",
        eventType: "workflow_completed",
        workflow: "payment",
        status: "resolved",
        resolvedAt: "2026-04-28T12:00:00.000Z",
      })
    );
  });

  it("deduplicates writes when the same idempotency key repeats", async () => {
    const { recordSystemObservabilityEvent } = await import("../recordSystemObservabilityEvent");
    const first = await recordSystemObservabilityEvent(
      {
        eventType: "integration_warning",
        workflow: "screening",
        severity: "warning",
        actorType: "system",
        title: "Webhook missing application",
        description: "Webhook missing application metadata.",
        idempotencyKey: "screening:webhook_missing_application:evt-1",
      },
      { failSoft: false }
    );
    const second = await recordSystemObservabilityEvent(
      {
        eventType: "integration_warning",
        workflow: "screening",
        severity: "warning",
        actorType: "system",
        title: "Webhook missing application",
        description: "Webhook missing application metadata.",
        idempotencyKey: "screening:webhook_missing_application:evt-1",
      },
      { failSoft: false }
    );

    expect(first.record?.id).toBe(second.record?.id);
    expect(second.duplicate).toBe(true);
    expect(Array.from(ensureCollection("systemObservabilityEvents").values())).toHaveLength(1);
  });

  it("fails softly when a write cannot be persisted", async () => {
    const { recordSystemObservabilityEvent } = await import("../recordSystemObservabilityEvent");
    setShouldFail(true);
    const result = await recordSystemObservabilityEvent({
      eventType: "action_failed",
      workflow: "payment",
      severity: "warning",
      actorType: "system",
      title: "Rent payment failed",
      description: "A payment failed.",
    });

    expect(result).toEqual({
      ok: false,
      duplicate: false,
      record: null,
    });
    expect(Array.from(ensureCollection("systemObservabilityEvents").values())).toHaveLength(0);
  });
});
