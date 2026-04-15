import { describe, expect, it, vi } from "vitest";

vi.mock("../../config/firebase", () => ({
  db: {
    collection: () => ({
      doc: () => ({
        set: async () => undefined,
      }),
    }),
  },
}));

describe("buildEvent", () => {
  it("always includes the required canonical fields", async () => {
    const { buildEvent } = await import("../buildEvent");
    const event = buildEvent({
      domain: "maintenance",
      action: "request_created",
      actor: { type: "tenant", id: "tenant-1" },
      resource: { type: "maintenance_request", id: "mr-1" },
      occurredAt: 1700000000000,
      visibility: "landlord",
      summary: "Maintenance request created",
    });

    expect(event.version).toBe("v1");
    expect(event.type).toBe("maintenance.request_created");
    expect(event.domain).toBe("maintenance");
    expect(event.action).toBe("request_created");
    expect(event.actor).toEqual({
      type: "tenant",
      id: "tenant-1",
      role: null,
      displayName: null,
    });
    expect(event.resource).toEqual({
      type: "maintenance_request",
      id: "mr-1",
      parentType: null,
      parentId: null,
    });
    expect(event.visibility).toBe("landlord");
    expect(event.summary).toBe("Maintenance request created");
  });

  it("keeps actor null-safe while still requiring a resource block", async () => {
    const { buildEvent } = await import("../buildEvent");
    const event = buildEvent({
      domain: "application",
      action: "submitted",
      resource: { type: "application", id: "app-1" },
      summary: "Application submitted",
    });

    expect(event.actor).toEqual({
      type: undefined,
      id: null,
      role: null,
      displayName: null,
    });
    expect(event.resource.type).toBe("application");
    expect(event.resource.id).toBe("app-1");
  });

  it("falls back visibility to internal", async () => {
    const { buildEvent } = await import("../buildEvent");
    const event = buildEvent({
      domain: "expense",
      action: "created",
      resource: { type: "expense", id: "expense-1" },
      visibility: "unknown",
      summary: "Expense created",
    });

    expect(event.visibility).toBe("internal");
  });

  it("preserves metadata payloads", async () => {
    const { buildEvent } = await import("../buildEvent");
    const event = buildEvent({
      domain: "screening",
      action: "blocked",
      resource: { type: "rental_application", id: "app-1" },
      summary: "Screening blocked",
      metadata: { reasonCode: "provider_unavailable", status: "blocked" },
    });

    expect(event.metadata).toEqual({
      reasonCode: "provider_unavailable",
      status: "blocked",
    });
  });

  it("emits valid ISO timestamps", async () => {
    const { buildEvent } = await import("../buildEvent");
    const event = buildEvent({
      domain: "lease",
      action: "activated",
      resource: { type: "lease", id: "lease-1" },
      occurredAt: "2026-01-01T12:00:00.000Z",
      summary: "Lease activated",
    });

    expect(() => new Date(event.occurredAt).toISOString()).not.toThrow();
    expect(() => new Date(event.recordedAt).toISOString()).not.toThrow();
  });
});
