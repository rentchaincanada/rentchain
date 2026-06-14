import { describe, expect, it } from "vitest";
import { generateLeaseEvidencePackage } from "../leaseEvidencePackageService";

function createStore() {
  const store = new Map<string, Map<string, any>>();
  const ensure = (name: string) => {
    if (!store.has(name)) store.set(name, new Map());
    return store.get(name)!;
  };
  const clone = (value: any) => JSON.parse(JSON.stringify(value));
  const getPath = (value: any, path: string) =>
    path.split(".").reduce((current, key) => (current == null ? undefined : current[key]), value);
  const matches = (data: any, filters: Array<{ field: string; value: any }>) =>
    filters.every((filter) => getPath(data, filter.field) === filter.value);
  const query = (name: string, filters: Array<{ field: string; value: any }> = [], cap = Infinity): any => ({
    where: (field: string, _op: string, value: any) => query(name, [...filters, { field, value }], cap),
    limit: (value: number) => query(name, filters, value),
    get: async () => ({
      docs: Array.from(ensure(name).entries())
        .filter(([, data]) => matches(data, filters))
        .slice(0, cap)
        .map(([id, data]) => ({ id, exists: true, data: () => clone(data) })),
    }),
  });
  return {
    seed: (collection: string, id: string, data: any) => ensure(collection).set(id, clone(data)),
    firestore: {
      collection: (name: string) => ({
        ...query(name),
        doc: (id: string) => ({
          get: async () => {
            const data = ensure(name).get(id);
            return { id, exists: Boolean(data), data: () => clone(data) };
          },
        }),
      }),
    },
  };
}

function seedLease(store: ReturnType<typeof createStore>, overrides: Record<string, any> = {}) {
  store.seed("leases", "lease-raw-firestore-id-123456789", {
    landlordId: "landlord-1",
    tenantId: "tenant-1",
    propertyId: "property-1",
    unitId: "unit-1",
    status: "active",
    startDate: "2026-01-01",
    endDate: "2026-12-31",
    monthlyRent: 1800,
    documentUrl: "gs://private-bucket/raw-lease-path.pdf",
    documentGeneratedAt: "2026-01-02T00:00:00.000Z",
    statusHistory: [
      { status: "created", createdAt: "2026-01-01T10:00:00.000Z", message: "Lease created." },
      { status: "signed", createdAt: "2026-01-03T10:00:00.000Z", message: "Lease signed." },
    ],
    ...overrides,
  });
}

describe("lease evidence package service", () => {
  it("derives all V1 sections even when optional source collections are empty", async () => {
    const store = createStore();
    seedLease(store);

    const pkg = await generateLeaseEvidencePackage({
      leaseId: "lease-raw-firestore-id-123456789",
      landlordId: "landlord-1",
      generatedBy: "landlord-1",
      generatedAt: "2026-06-14T12:00:00.000Z",
      firestore: store.firestore as any,
    });

    expect(pkg.sections.map((section) => section.key)).toEqual([
      "cover_summary",
      "lease_information",
      "parties",
      "timeline",
      "documents",
      "messages",
      "payments",
      "maintenance_events",
      "notices",
      "signature_events",
      "audit_trail",
    ]);
    expect(pkg.sections.find((section) => section.key === "messages")?.items).toEqual([]);
    expect(pkg.sections.find((section) => section.key === "messages")?.emptyState).toMatch(/No landlord-visible messages/);
  });

  it("sorts timeline entries deterministically by timestamp and safe reference", async () => {
    const store = createStore();
    seedLease(store);
    store.seed("leaseNotices", "notice-b", {
      landlordId: "landlord-1",
      leaseId: "lease-raw-firestore-id-123456789",
      noticeType: "renewal",
      createdAt: "2026-02-02T00:00:00.000Z",
    });
    store.seed("payments", "payment-a", {
      landlordId: "landlord-1",
      leaseId: "lease-raw-firestore-id-123456789",
      amount: 1800,
      method: "etransfer",
      paidAt: "2026-02-01T00:00:00.000Z",
    });

    const first = await generateLeaseEvidencePackage({
      leaseId: "lease-raw-firestore-id-123456789",
      landlordId: "landlord-1",
      generatedBy: "landlord-1",
      generatedAt: "2026-06-14T12:00:00.000Z",
      firestore: store.firestore as any,
    });
    const second = await generateLeaseEvidencePackage({
      leaseId: "lease-raw-firestore-id-123456789",
      landlordId: "landlord-1",
      generatedBy: "landlord-1",
      generatedAt: "2026-06-14T12:00:00.000Z",
      firestore: store.firestore as any,
    });

    const firstTimeline = first.sections.find((section) => section.key === "timeline")?.items || [];
    expect(firstTimeline.map((item) => item.timestamp)).toEqual([...firstTimeline.map((item) => item.timestamp)].sort());
    expect(firstTimeline).toEqual(second.sections.find((section) => section.key === "timeline")?.items);
  });

  it("uses bounded landlord-visible message excerpts and excludes raw IDs, storage paths, and provider identifiers", async () => {
    const store = createStore();
    seedLease(store);
    store.seed("conversations", "conversation-raw-id-abcdef123456", {
      landlordId: "landlord-1",
      leaseId: "lease-raw-firestore-id-123456789",
      tenantId: "tenant-1",
    });
    store.seed("messages", "message-raw-id-abcdef123456", {
      conversationId: "conversation-raw-id-abcdef123456",
      senderRole: "tenant",
      body: "This is a landlord-visible message with enough text to include as a bounded excerpt.",
      createdAt: "2026-02-03T00:00:00.000Z",
    });
    store.seed("leaseSigningRequests", "provider-request-doc-id-abcdef123456", {
      landlordId: "landlord-1",
      leaseId: "lease-raw-firestore-id-123456789",
      providerId: "dropbox_sign",
      providerRequestId: "provider_secret_request_123",
      providerRequestRef: "dropbox_sign_ref_secret",
      providerDispatchStatus: "sent",
      sentAt: "2026-02-04T00:00:00.000Z",
    });

    const pkg = await generateLeaseEvidencePackage({
      leaseId: "lease-raw-firestore-id-123456789",
      landlordId: "landlord-1",
      generatedBy: "landlord-1",
      generatedAt: "2026-06-14T12:00:00.000Z",
      firestore: store.firestore as any,
    });

    const serialized = JSON.stringify(pkg);
    expect(serialized).toContain("bounded excerpt");
    expect(serialized).not.toContain("conversation-raw-id-abcdef123456");
    expect(serialized).not.toContain("message-raw-id-abcdef123456");
    expect(serialized).not.toContain("provider-request-doc-id-abcdef123456");
    expect(serialized).not.toContain("provider_secret_request_123");
    expect(serialized).not.toContain("dropbox_sign");
    expect(serialized).not.toContain("gs://private-bucket/raw-lease-path.pdf");
    expect(serialized).not.toContain("storagePath");
  });

  it("rejects cross-landlord lease access", async () => {
    const store = createStore();
    seedLease(store);

    await expect(
      generateLeaseEvidencePackage({
        leaseId: "lease-raw-firestore-id-123456789",
        landlordId: "landlord-2",
        generatedBy: "landlord-2",
        firestore: store.firestore as any,
      })
    ).rejects.toMatchObject({ message: "forbidden", status: 403 });
  });
});

