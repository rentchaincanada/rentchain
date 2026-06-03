import { beforeEach, describe, expect, it, vi } from "vitest";

const { collections, dbMock } = vi.hoisted(() => {
  const collections = new Map<string, Map<string, any>>();

  function ensureCollection(name: string) {
    if (!collections.has(name)) {
      collections.set(name, new Map<string, any>());
    }
    return collections.get(name)!;
  }

  return {
    collections,
    dbMock: {
      collection: (name: string) => ({
        async get() {
          const docs = Array.from(ensureCollection(name).entries()).map(([id, data]) => ({
            id,
            data: () => data,
          }));
          return { docs, empty: docs.length === 0, size: docs.length };
        },
      }),
    },
  };
});

vi.mock("../../../firebase", () => ({
  db: dbMock,
}));

function seedCanonicalEvent(id: string, data: any) {
  if (!collections.has("canonicalEvents")) {
    collections.set("canonicalEvents", new Map<string, any>());
  }
  collections.get("canonicalEvents")!.set(id, { id, ...data });
}

describe("deriveIdentityTimeline", () => {
  beforeEach(() => {
    collections.clear();
  });

  it("builds a sanitized timeline in chronological order", async () => {
    seedCanonicalEvent("b-event", {
      version: "v1",
      type: "application.submitted",
      domain: "application",
      action: "submitted",
      actor: { type: "tenant", id: "tenant-1", displayName: "Taylor Tenant" },
      resource: { type: "rental_application", id: "app-1" },
      occurredAt: "2026-04-02T09:00:00.000Z",
      recordedAt: "2026-04-02T09:00:00.000Z",
      visibility: "tenant",
      summary: "Application submitted",
      metadata: { tenantId: "tenant-1", ssn: "should-not-leak" },
      tags: ["submitted"],
    });
    seedCanonicalEvent("a-event", {
      version: "v1",
      type: "application.created",
      domain: "application",
      action: "created",
      actor: { type: "tenant", id: "tenant-1" },
      resource: { type: "rental_application", id: "app-1" },
      occurredAt: "2026-04-01T09:00:00.000Z",
      recordedAt: "2026-04-01T09:00:00.000Z",
      visibility: "tenant",
      summary: "Application created",
    });
    seedCanonicalEvent("c-event", {
      version: "v1",
      type: "screening.screening_consent_confirmed",
      domain: "screening",
      action: "screening_consent_confirmed",
      actor: { type: "tenant", id: "tenant-1" },
      resource: { type: "screening_request", id: "screening-1", parentType: "rental_application", parentId: "app-1" },
      occurredAt: "2026-04-03T09:00:00.000Z",
      recordedAt: "2026-04-03T09:00:00.000Z",
      visibility: "tenant",
      summary: "Tenant screening consent confirmed",
      metadata: { tenantId: "tenant-1", providerLabel: "TransUnion" },
    });

    const { deriveIdentityTimeline } = await import("../deriveIdentityTimeline");
    const result = await deriveIdentityTimeline({
      tenantId: "tenant-1",
      applicationId: "app-1",
      leaseId: "lease-1",
    });

    expect(result).toEqual({
      events: [
        {
          type: "application.created",
          label: "Application created",
          description: "A rental application record was started.",
          occurredAt: "2026-04-01T09:00:00.000Z",
        },
        {
          type: "application.submitted",
          label: "Application submitted",
          description: "Your rental application was submitted for review.",
          occurredAt: "2026-04-02T09:00:00.000Z",
        },
        {
          type: "screening_consent_confirmed",
          label: "Screening authorized",
          description: "Screening consent was recorded for this application.",
          occurredAt: "2026-04-03T09:00:00.000Z",
        },
      ],
    });
    expect((result.events[0] as any).id).toBeUndefined();
    expect((result.events[0] as any).metadata).toBeUndefined();
    expect((result.events[0] as any).actor).toBeUndefined();
  });

  it("ignores unrelated, unknown, and ambiguously linked events", async () => {
    seedCanonicalEvent("unknown", {
      version: "v1",
      type: "document.uploaded",
      domain: "tenant",
      action: "uploaded",
      actor: { type: "tenant", id: "tenant-1" },
      resource: { type: "tenant_document", id: "doc-1" },
      occurredAt: "2026-04-01T09:00:00.000Z",
      recordedAt: "2026-04-01T09:00:00.000Z",
      visibility: "tenant",
      summary: "Document uploaded",
    });
    seedCanonicalEvent("other-app", {
      version: "v1",
      type: "application.created",
      domain: "application",
      action: "created",
      actor: { type: "tenant", id: "tenant-2" },
      resource: { type: "rental_application", id: "app-2" },
      occurredAt: "2026-04-01T09:00:00.000Z",
      recordedAt: "2026-04-01T09:00:00.000Z",
      visibility: "tenant",
      summary: "Application created",
    });
    seedCanonicalEvent("mismatch-screening", {
      version: "v1",
      type: "screening.completed",
      domain: "screening",
      action: "completed",
      actor: { type: "system", id: "system" },
      resource: { type: "screening_request", id: "screening-2", parentType: "rental_application", parentId: "app-1" },
      occurredAt: "2026-04-02T09:00:00.000Z",
      recordedAt: "2026-04-02T09:00:00.000Z",
      visibility: "tenant",
      summary: "Screening completed",
      metadata: { tenantId: "tenant-2", applicationId: "app-1", provider: "transunion_redirect" },
    });

    const { deriveIdentityTimeline } = await import("../deriveIdentityTimeline");
    const result = await deriveIdentityTimeline({
      tenantId: "tenant-1",
      applicationId: "app-1",
      leaseId: "lease-1",
    });

    expect(result).toEqual({ events: [] });
  });

  it("returns an empty timeline when tenant context is missing", async () => {
    const { deriveIdentityTimeline } = await import("../deriveIdentityTimeline");
    await expect(
      deriveIdentityTimeline({
        tenantId: "",
        applicationId: "app-1",
        leaseId: "lease-1",
      })
    ).resolves.toEqual({ events: [] });
  });
});
