import { beforeEach, describe, expect, it, vi } from "vitest";

const collections = new Map<string, Map<string, any>>();
const writeCanonicalEventMock = vi.fn(async () => undefined);

function ensureCollection(name: string) {
  if (!collections.has(name)) collections.set(name, new Map());
  return collections.get(name)!;
}

function clone(value: any) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function makeDoc(name: string, id: string) {
  const col = ensureCollection(name);
  return {
    id,
    get: async () => ({
      id,
      exists: col.has(id),
      data: () => clone(col.get(id)),
    }),
    set: async (value: any, options?: { merge?: boolean }) => {
      const current = col.get(id) || {};
      col.set(id, options?.merge ? { ...current, ...clone(value) } : clone(value));
    },
  };
}

function makeQuery(name: string, filters: Array<{ field: string; value: any }> = [], limitCount?: number) {
  return {
    where: (field: string, _op: string, value: any) => makeQuery(name, [...filters, { field, value }], limitCount),
    limit: (count: number) => makeQuery(name, filters, count),
    get: async () => {
      const docs = Array.from(ensureCollection(name).entries())
        .filter(([, data]) => filters.every((filter) => data?.[filter.field] === filter.value))
        .slice(0, limitCount || Number.MAX_SAFE_INTEGER)
        .map(([id, data]) => ({ id, exists: true, data: () => clone(data) }));
      return { docs, empty: docs.length === 0, size: docs.length };
    },
  };
}

vi.mock("../../firebase", () => ({
  db: {
    collection: (name: string) => ({
      doc: (id: string) => makeDoc(name, id),
      where: (field: string, _op: string, value: any) => makeQuery(name, [{ field, value }]),
    }),
  },
  FieldValue: {
    serverTimestamp: () => "SERVER_TIMESTAMP",
  },
}));

vi.mock("../../lib/events/buildEvent", () => ({
  writeCanonicalEvent: writeCanonicalEventMock,
}));

vi.mock("../../lib/gcs", () => ({
  uploadBufferToGcs: vi.fn(async ({ path }: { path: string }) => ({ bucket: "bucket", path })),
}));

vi.mock("../../lib/gcsSignedUrl", () => ({
  getSignedDownloadUrl: vi.fn(async ({ path }: { path: string }) => `https://signed.example/${path}`),
}));

describe("leaseSigningService", () => {
  beforeEach(() => {
    collections.clear();
    writeCanonicalEventMock.mockClear();
    process.env.SIGNING_PROVIDER = "mock";
    process.env.PUBLIC_APP_URL = "http://localhost:5173";
  });

  it("creates a pending signing request without exposing raw provider references in projected snapshot", async () => {
    const { sendLeaseForSignature } = await import("../signing/leaseSigningService");
    const snapshot = await sendLeaseForSignature({
      leaseId: "lease-1",
      landlordId: "landlord-1",
      lease: { startDate: "2026-01-01", documentUrl: "https://example.com/lease.pdf" },
      tenantEmails: ["tenant@example.com"],
    });

    expect(snapshot.signingStatus).toBe("pending_signature");
    expect(snapshot.signingRequestId).toMatch(/^lsr_/);
    expect(snapshot.providerRequestRef).toMatch(/^mock_ref_/);
    expect(snapshot.providerRequestRef).not.toContain("lease-1");
    expect(snapshot.events.map((event) => event.type)).toEqual(["sent"]);
    expect(writeCanonicalEventMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "signing_sent",
        actor: expect.objectContaining({ role: "landlord", type: "landlord" }),
        resource: { id: "lease-1", type: "lease" },
        status: "sent",
      })
    );
  });

  it("derives terminal states from appended webhook events", async () => {
    const { processSigningWebhook, sendLeaseForSignature, loadLeaseSigningSnapshot } = await import("../signing/leaseSigningService");
    const initial = await sendLeaseForSignature({
      leaseId: "lease-1",
      landlordId: "landlord-1",
      lease: { startDate: "2026-01-01" },
      tenantEmails: ["tenant@example.com"],
    });
    const storedRequest = Array.from(ensureCollection("leaseSigningRequests").values())[0];

    await processSigningWebhook({
      providerId: "mock",
      headers: {},
      body: {
        providerRequestId: storedRequest.providerRequestId,
        eventId: "evt_signed",
        type: "signed",
        signerEmail: "tenant@example.com",
        occurredAt: "2026-01-02T00:00:00.000Z",
      },
    });

    const snapshot = await loadLeaseSigningSnapshot({
      leaseId: "lease-1",
      landlordId: "landlord-1",
      lease: { startDate: "2026-01-01" },
    });
    expect(initial.signingStatus).toBe("pending_signature");
    expect(snapshot.signingStatus).toBe("signed");
    expect(snapshot.derivedLeaseState).toBe("active");
    expect(snapshot.events.map((event) => event.type)).toContain("signed");
  });
});
