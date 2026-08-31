import { beforeEach, describe, expect, it, vi } from "vitest";

const collections = new Map<string, Map<string, any>>();
const writeCanonicalEventMock = vi.fn(async () => undefined);
const getCanonicalLeaseStartContextMock = vi.fn(async () => ({ expectedStateToken: "state-1" }));
const startCanonicalLeaseOccupancyMock = vi.fn(async () => ({ canonicalOutcome: "occupancy_effective", occupancyEffective: true, reasons: [] }));
const uploadBufferToGcsMock = vi.fn(async ({ path }: { path: string }) => ({ bucket: "bucket", path }));

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

vi.mock("../leaseStart/leaseStartService", () => ({
  getCanonicalLeaseStartContext: getCanonicalLeaseStartContextMock,
  startCanonicalLeaseOccupancy: startCanonicalLeaseOccupancyMock,
}));

vi.mock("../../lib/gcs", () => ({
  uploadBufferToGcs: uploadBufferToGcsMock,
}));

vi.mock("../../lib/gcsSignedUrl", () => ({
  getSignedDownloadUrl: vi.fn(async ({ path }: { path: string }) => `https://signed.example/${path}`),
}));

describe("leaseSigningService", () => {
  beforeEach(() => {
    collections.clear();
    writeCanonicalEventMock.mockClear();
    getCanonicalLeaseStartContextMock.mockClear();
    startCanonicalLeaseOccupancyMock.mockClear();
    uploadBufferToGcsMock.mockClear();
    process.env.SIGNING_PROVIDER = "mock";
    process.env.PUBLIC_APP_URL = "http://localhost:5173";
    delete process.env.SIGNING_PROVIDER_API_KEY;
    delete process.env.SIGNING_PROVIDER_WEBHOOK_SECRET;
    delete process.env.SIGNING_PROVIDER_TEST_MODE;
  });

  it("keeps current non-renewal signing completion execution-only and idempotent", async () => {
    const { processSigningWebhook, sendLeaseForSignature } = await import("../signing/leaseSigningService");
    ensureCollection("leases").set("lease-1", {
      landlordId: "landlord-1",
      propertyId: "property-1",
      unitId: "unit-1",
      tenantId: "tenant-1",
      status: "active",
      startDate: "2026-01-01",
      endDate: "2026-12-31",
    });
    const sent = await sendLeaseForSignature({
      leaseId: "lease-1",
      landlordId: "landlord-1",
      lease: { startDate: "2026-01-01" },
      tenantEmails: ["tenant@example.com"],
    });
    const request = ensureCollection("leaseSigningRequests").get(String(sent.signingRequestId));
    const body = {
      providerRequestId: request.providerRequestId,
      eventId: "provider-event-stable-1",
      type: "signed",
      occurredAt: "2026-08-19T12:00:00.000Z",
    };
    await processSigningWebhook({ providerId: "mock", headers: {}, body });
    await processSigningWebhook({ providerId: "mock", headers: {}, body });

    expect(startCanonicalLeaseOccupancyMock).not.toHaveBeenCalled();
    expect(getCanonicalLeaseStartContextMock).not.toHaveBeenCalled();
    expect(ensureCollection("leases").get("lease-1")).toEqual(expect.objectContaining({ executionStatus: "fully_executed" }));
    expect(ensureCollection("leases").get("lease-1")).not.toHaveProperty("occupancyEffective");
    expect(ensureCollection("leases").get("lease-1")).not.toHaveProperty("occupancyStartReview");
    expect(ensureCollection("leaseSigningCompletionOperations").size).toBe(0);
    expect(ensureCollection("leaseSigningEvents").size).toBe(2);
  });

  it("does not manually write occupancy review state from signing completion", async () => {
    const { processSigningWebhook, sendLeaseForSignature } = await import("../signing/leaseSigningService");
    ensureCollection("leases").set("lease-conflict", {
      landlordId: "landlord-1", propertyId: "property-1", unitId: "unit-1", tenantId: "tenant-1",
      status: "active", startDate: "2026-01-01", endDate: "2026-12-31",
    });
    const sent = await sendLeaseForSignature({ leaseId: "lease-conflict", landlordId: "landlord-1", lease: { startDate: "2026-01-01" }, tenantEmails: ["tenant@example.com"] });
    const signingRequest = ensureCollection("leaseSigningRequests").get(String(sent.signingRequestId));
    await processSigningWebhook({ providerId: "mock", headers: {}, body: { providerRequestId: signingRequest.providerRequestId, eventId: "provider-conflict-1", type: "signed", occurredAt: "2026-08-19T12:00:00.000Z" } });
    expect(ensureCollection("leases").get("lease-conflict")).toEqual(expect.objectContaining({ executionStatus: "fully_executed" }));
    expect(ensureCollection("leases").get("lease-conflict")).not.toHaveProperty("occupancyStartReview");
    expect(startCanonicalLeaseOccupancyMock).not.toHaveBeenCalled();
  });

  it("keeps a fully signed future lease deferred without an occupancy rejection", async () => {
    const { processSigningWebhook, sendLeaseForSignature } = await import("../signing/leaseSigningService");
    ensureCollection("leases").set("lease-future", {
      landlordId: "landlord-1", propertyId: "property-1", unitId: "unit-1", tenantId: "tenant-1",
      status: "pending", startDate: "2027-01-01", endDate: "2027-12-31",
    });
    const sent = await sendLeaseForSignature({ leaseId: "lease-future", landlordId: "landlord-1", lease: { startDate: "2027-01-01" }, tenantEmails: ["tenant@example.com"] });
    const signingRequest = ensureCollection("leaseSigningRequests").get(String(sent.signingRequestId));
    await processSigningWebhook({ providerId: "mock", headers: {}, body: { providerRequestId: signingRequest.providerRequestId, eventId: "provider-future-1", type: "signed", occurredAt: "2026-08-19T12:00:00.000Z" } });
    await processSigningWebhook({ providerId: "mock", headers: {}, body: { providerRequestId: signingRequest.providerRequestId, eventId: "provider-future-1", type: "signed", occurredAt: "2026-08-19T12:00:00.000Z" } });
    expect(ensureCollection("leases").get("lease-future")).toEqual(expect.objectContaining({ executionStatus: "fully_executed", status: "pending" }));
    expect(ensureCollection("leases").get("lease-future")).not.toHaveProperty("occupancyStartReview");
    expect(startCanonicalLeaseOccupancyMock).not.toHaveBeenCalled();
    expect(ensureCollection("leaseSigningCompletionOperations").size).toBe(0);
  });

  it("never hands linked renewal occupancy over when signing completes on its effective date", async () => {
    const { processSigningWebhook, sendLeaseForSignature } = await import("../signing/leaseSigningService");
    ensureCollection("leases").set("lease-renewal-effective", {
      landlordId: "landlord-1", propertyId: "property-1", unitId: "unit-1", tenantId: "tenant-1",
      status: "pending", predecessorLeaseId: "lease-predecessor", occupancyEffective: false,
      startDate: "2027-01-01", endDate: "2027-12-31",
    });
    const sent = await sendLeaseForSignature({ leaseId: "lease-renewal-effective", landlordId: "landlord-1", lease: { startDate: "2027-01-01" }, tenantEmails: ["tenant@example.com"] });
    const signingRequest = ensureCollection("leaseSigningRequests").get(String(sent.signingRequestId));
    await processSigningWebhook({ providerId: "mock", headers: {}, body: { providerRequestId: signingRequest.providerRequestId, eventId: "provider-renewal-effective", type: "signed", occurredAt: "2027-01-01T12:00:00.000Z" } });
    expect(ensureCollection("leases").get("lease-renewal-effective")).toEqual(expect.objectContaining({
      executionStatus: "fully_executed", status: "pending", occupancyEffective: false,
    }));
    expect(startCanonicalLeaseOccupancyMock).not.toHaveBeenCalled();
    expect(getCanonicalLeaseStartContextMock).not.toHaveBeenCalled();
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
    expect(snapshot.signingLifecycleState).toBe("pending_signature");
    expect(snapshot.signedDocumentState).toBe("not_expected");
    expect(snapshot.reminderEligible).toBe(true);
    expect(snapshot.viewSignedDocumentAllowed).toBe(false);
    expect(snapshot.signingRequestId).toMatch(/^lsr_/);
    expect(snapshot.providerRequestRef).toMatch(/^mock_ref_/);
    expect(snapshot.providerRequestRef).not.toContain("lease-1");
    expect(snapshot.providerDispatchMode).toBe("mock");
    expect(snapshot.providerDispatchStatus).toBe("mocked_no_email");
    expect(snapshot.events.map((event) => event.type)).toEqual(["sent"]);
    expect(snapshot.events[0]).toEqual(
      expect.objectContaining({
        providerDispatchMode: "mock",
        providerDispatchStatus: "mocked_no_email",
      })
    );
    expect(ensureCollection("leases").size).toBe(0);
    expect(writeCanonicalEventMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "signing_sent",
        actor: expect.objectContaining({ role: "landlord", type: "landlord" }),
        resource: { id: "lease-1", type: "lease" },
        status: "sent",
        metadata: expect.objectContaining({
          providerDispatchMode: "mock",
          providerDispatchStatus: "mocked_no_email",
        }),
      })
    );
  });

  it("derives terminal states from appended webhook events", async () => {
    const { processSigningWebhook, sendLeaseForSignature, loadLeaseSigningSnapshot } = await import("../signing/leaseSigningService");
    const initial = await sendLeaseForSignature({
      leaseId: "lease-1",
      landlordId: "landlord-1",
      lease: { startDate: "2026-01-01" },
      providerDocumentUrl: "https://signed.example.com/provider-fetch.pdf?X-Goog-Signature=secret",
      documentMetadata: {
        documentId: "ldoc_signed",
        documentHash: "doc_hash_signed",
        manifestHash: "manifest_hash_signed",
        jurisdictionCode: "CA_NS",
        templateVersion: "ca-ns-primary-lease-draft-v1",
        providerAccessUrlExpiresAt: "2026-01-01T04:00:00.000Z",
      },
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
        occurredAt: "2027-01-02T00:00:00.000Z",
      },
    });

    const snapshot = await loadLeaseSigningSnapshot({
      leaseId: "lease-1",
      landlordId: "landlord-1",
      lease: { startDate: "2026-01-01" },
    });
    expect(initial.signingStatus).toBe("pending_signature");
    expect(snapshot.signingStatus).toBe("signed");
    expect(snapshot.signedDocumentState).toBe("pending_persistence");
    expect(snapshot.signedDocumentRecoveryAction).toBe("retry_download");
    expect(snapshot.viewSignedDocumentAllowed).toBe(false);
    expect(snapshot.reminderEligible).toBe(false);
    expect(snapshot.derivedLeaseState).toBe("active");
    expect(snapshot.events.map((event) => event.type)).toContain("signed");
    expect(writeCanonicalEventMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "signing_signed",
        metadata: expect.objectContaining({
          documentId: "ldoc_signed",
          documentHash: "doc_hash_signed",
          manifestHash: "manifest_hash_signed",
          jurisdictionCode: "CA_NS",
          templateVersion: "ca-ns-primary-lease-draft-v1",
          providerRef: expect.stringMatching(/^mock_ref_/),
          providerDispatchMode: "mock",
          providerDispatchStatus: "mocked_no_email",
        }),
      })
    );
    const canonicalPayload = JSON.stringify(writeCanonicalEventMock.mock.calls);
    expect(canonicalPayload).not.toContain("https://signed.example.com");
    expect(canonicalPayload).not.toContain("X-Goog-Signature");
    expect(canonicalPayload).not.toContain(storedRequest.providerRequestId);
  });

  it("fails closed for explicitly configured Dropbox Sign when config is missing", async () => {
    process.env.SIGNING_PROVIDER = "dropbox_sign";
    const { sendLeaseForSignature } = await import("../signing/leaseSigningService");

    await expect(
      sendLeaseForSignature({
        leaseId: "lease-1",
        landlordId: "landlord-1",
        lease: { startDate: "2026-01-01", documentUrl: "https://example.com/lease.pdf" },
        tenantEmails: ["tenant@example.com"],
      })
    ).rejects.toMatchObject({ message: "provider_unavailable", status: 503 });
    expect(ensureCollection("leaseSigningRequests").size).toBe(0);
    expect(ensureCollection("leaseSigningEvents").size).toBe(0);
    expect(writeCanonicalEventMock).not.toHaveBeenCalled();
  });

  it("stores raw provider request id internally while projecting and auditing safe refs only", async () => {
    const { signingProviderRegistry } = await import("../signing/providers");
    signingProviderRegistry.register("boldsign", {
      getProviderId: () => "boldsign",
      getName: () => "Real test provider",
      isConfigured: () => true,
      sendForSignature: async () => ({
        providerRequestId: "raw-provider-request-123",
        dispatchMode: "sandbox",
        dispatchStatus: "accepted",
        dispatchMessage: "Provider accepted the request in test mode.",
        providerTestMode: true,
      }),
      getSigningUrl: async () => null,
      cancelRequest: async () => true,
      downloadSignedDocument: async () => null,
      verifyWebhookSignature: async () => true,
      parseWebhookPayload: async () => {
        throw new Error("not_used");
      },
    });
    process.env.SIGNING_PROVIDER = "boldsign";
    const { sendLeaseForSignature } = await import("../signing/leaseSigningService");

    const snapshot = await sendLeaseForSignature({
      leaseId: "lease-1",
      landlordId: "landlord-1",
      lease: { startDate: "2026-01-01" },
      providerDocumentUrl: "https://signed.example.com/provider-fetch.pdf?X-Goog-Signature=secret",
      documentMetadata: {
        documentId: "ldoc_1",
        documentHash: "doc_hash",
        manifestHash: "manifest_hash",
        jurisdictionCode: "CA_NS",
        templateVersion: "ca-ns-primary-lease-draft-v1",
        providerAccessUrlExpiresAt: "2026-01-01T04:00:00.000Z",
      },
      tenantEmails: ["tenant@example.com"],
    });

    const storedRequest = Array.from(ensureCollection("leaseSigningRequests").values())[0];
    expect(storedRequest.providerRequestId).toBe("raw-provider-request-123");
    expect(storedRequest.documentUrl).toBeUndefined();
    expect(storedRequest.providerAccessUrlExpiresAt).toBe("2026-01-01T04:00:00.000Z");
    expect(storedRequest.documentId).toBe("ldoc_1");
    expect(storedRequest.documentHash).toBe("doc_hash");
    expect(storedRequest.manifestHash).toBe("manifest_hash");
    expect(snapshot.providerRequestRef).toMatch(/^boldsign_ref_/);
    expect(JSON.stringify(snapshot)).not.toContain("raw-provider-request-123");
    expect(JSON.stringify(storedRequest)).not.toContain("https://signed.example.com");
    expect(JSON.stringify(storedRequest)).not.toContain("X-Goog-Signature");
    expect(writeCanonicalEventMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "signing_sent",
        metadata: expect.objectContaining({
          providerDispatchMode: "sandbox",
          providerDispatchStatus: "accepted",
          providerTestMode: true,
          documentId: "ldoc_1",
          documentHash: "doc_hash",
          manifestHash: "manifest_hash",
          jurisdictionCode: "CA_NS",
          templateVersion: "ca-ns-primary-lease-draft-v1",
        }),
      })
    );
    expect(JSON.stringify(writeCanonicalEventMock.mock.calls)).not.toContain("raw-provider-request-123");
    expect(JSON.stringify(writeCanonicalEventMock.mock.calls)).not.toContain("https://signed.example.com");
  });

  it("rejects webhook signature failures without writing events", async () => {
    process.env.SIGNING_PROVIDER_WEBHOOK_SECRET = "expected";
    const { processSigningWebhook, sendLeaseForSignature } = await import("../signing/leaseSigningService");
    await sendLeaseForSignature({
      leaseId: "lease-1",
      landlordId: "landlord-1",
      lease: { startDate: "2026-01-01" },
      tenantEmails: ["tenant@example.com"],
    });
    writeCanonicalEventMock.mockClear();

    await expect(
      processSigningWebhook({
        providerId: "mock",
        headers: { "x-mock-signing-secret": "wrong" },
        body: { providerRequestId: "mock_request", eventId: "evt_signed", type: "signed" },
      })
    ).rejects.toMatchObject({ message: "webhook_validation_failed", status: 400 });

    expect(ensureCollection("leaseSigningEvents").size).toBe(1);
    expect(writeCanonicalEventMock).not.toHaveBeenCalled();
  });

  it("acknowledges verified provider account callback tests without signing events", async () => {
    const { signingProviderRegistry } = await import("../signing/providers");
    signingProviderRegistry.register("boldsign", {
      getProviderId: () => "boldsign",
      getName: () => "Account callback test provider",
      isConfigured: () => true,
      sendForSignature: async () => {
        throw new Error("not_used");
      },
      getSigningUrl: async () => null,
      cancelRequest: async () => true,
      downloadSignedDocument: async () => null,
      verifyWebhookSignature: async () => true,
      parseWebhookPayload: async () => ({
        providerRequestId: null,
        providerEventId: "evt_callback_test_raw",
        providerEventType: "callback_test",
        type: "sent",
        occurredAt: "2026-01-02T00:00:00.000Z",
        accountCallback: true,
      }),
    });
    const { processSigningWebhook } = await import("../signing/leaseSigningService");

    await expect(processSigningWebhook({ providerId: "boldsign", headers: {}, body: { event: { event_type: "callback_test" } } })).resolves.toEqual({});

    const deadLetters = Array.from(ensureCollection("leaseSigningWebhookDeadLetters").values());
    expect(deadLetters).toHaveLength(1);
    expect(deadLetters[0]).toEqual(
      expect.objectContaining({
        providerId: "boldsign",
        status: "account_callback_acknowledged",
        providerEventType: "callback_test",
        rawIdsIncluded: false,
        payloadIncluded: false,
      })
    );
    expect(JSON.stringify(deadLetters)).not.toContain("evt_callback_test_raw");
    expect(ensureCollection("leaseSigningEvents").size).toBe(0);
    expect(writeCanonicalEventMock).not.toHaveBeenCalled();
  });

  it("returns Dropbox Sign account callback acknowledgement text without writing success events", async () => {
    const { signingProviderRegistry } = await import("../signing/providers");
    signingProviderRegistry.register("dropbox_sign", {
      getProviderId: () => "dropbox_sign",
      getName: () => "Dropbox Sign test provider",
      isConfigured: () => true,
      sendForSignature: async () => {
        throw new Error("not_used");
      },
      getSigningUrl: async () => null,
      cancelRequest: async () => true,
      downloadSignedDocument: async () => null,
      verifyWebhookSignature: async () => true,
      parseWebhookPayload: async () => ({
        providerRequestId: null,
        providerEventId: "evt_callback_test_raw",
        providerEventType: "callback_test",
        type: "sent",
        occurredAt: "2026-01-02T00:00:00.000Z",
        accountCallback: true,
      }),
    });
    const { processSigningWebhook } = await import("../signing/leaseSigningService");

    await expect(processSigningWebhook({ providerId: "dropbox_sign", headers: {}, body: { event: { event_type: "callback_test" } } })).resolves.toEqual({
      providerResponseText: "Hello API Event Received",
    });

    const deadLetters = Array.from(ensureCollection("leaseSigningWebhookDeadLetters").values());
    expect(deadLetters).toHaveLength(1);
    expect(deadLetters[0]).toEqual(expect.objectContaining({ status: "account_callback_acknowledged", payloadIncluded: false }));
    expect(ensureCollection("leaseSigningEvents").size).toBe(0);
    expect(writeCanonicalEventMock).not.toHaveBeenCalled();
  });

  it("acknowledges verified provider callbacks that do not correlate to a local request", async () => {
    const { signingProviderRegistry } = await import("../signing/providers");
    signingProviderRegistry.register("boldsign", {
      getProviderId: () => "boldsign",
      getName: () => "Unknown request provider",
      isConfigured: () => true,
      sendForSignature: async () => {
        throw new Error("not_used");
      },
      getSigningUrl: async () => null,
      cancelRequest: async () => true,
      downloadSignedDocument: async () => null,
      verifyWebhookSignature: async () => true,
      parseWebhookPayload: async () => ({
        providerRequestId: "raw-provider-request-missing",
        providerEventId: "evt_missing_request_raw",
        providerEventType: "signature_request_sent",
        type: "sent",
        occurredAt: "2026-01-02T00:00:00.000Z",
      }),
    });
    const { processSigningWebhook } = await import("../signing/leaseSigningService");

    await expect(processSigningWebhook({ providerId: "boldsign", headers: {}, body: { signature_request: {} } })).resolves.toEqual({});

    const deadLetters = Array.from(ensureCollection("leaseSigningWebhookDeadLetters").values());
    expect(deadLetters).toHaveLength(1);
    expect(deadLetters[0]).toEqual(
      expect.objectContaining({
        providerId: "boldsign",
        status: "request_not_found",
        providerRequestRef: expect.stringMatching(/^boldsign_ref_/),
        providerEventRef: expect.stringMatching(/^boldsign_ref_/),
        providerEventType: "signature_request_sent",
        rawIdsIncluded: false,
        payloadIncluded: false,
      })
    );
    expect(JSON.stringify(deadLetters)).not.toContain("raw-provider-request-missing");
    expect(JSON.stringify(deadLetters)).not.toContain("evt_missing_request_raw");
    expect(ensureCollection("leaseSigningEvents").size).toBe(0);
    expect(writeCanonicalEventMock).not.toHaveBeenCalled();
  });

  it("handles duplicate webhooks idempotently and maps declined expired cancelled and failed events", async () => {
    const { processSigningWebhook, sendLeaseForSignature, loadLeaseSigningSnapshot } = await import("../signing/leaseSigningService");
    await sendLeaseForSignature({
      leaseId: "lease-1",
      landlordId: "landlord-1",
      lease: { startDate: "2026-01-01" },
      tenantEmails: ["tenant@example.com"],
    });
    const storedRequest = Array.from(ensureCollection("leaseSigningRequests").values())[0];

    for (const type of ["rejected", "expired", "cancelled", "failed"] as const) {
      await processSigningWebhook({
        providerId: "mock",
        headers: {},
        body: {
          providerRequestId: storedRequest.providerRequestId,
          eventId: `evt_${type}`,
          type,
          signerEmail: "tenant@example.com",
          occurredAt: `2027-01-02T00:00:0${["rejected", "expired", "cancelled", "failed"].indexOf(type)}.000Z`,
        },
      });
      await processSigningWebhook({
        providerId: "mock",
        headers: {},
        body: {
          providerRequestId: storedRequest.providerRequestId,
          eventId: `evt_${type}`,
          type,
          signerEmail: "tenant@example.com",
          occurredAt: `2027-01-02T00:00:0${["rejected", "expired", "cancelled", "failed"].indexOf(type)}.000Z`,
        },
      });
    }

    const snapshot = await loadLeaseSigningSnapshot({ leaseId: "lease-1", landlordId: "landlord-1", lease: { startDate: "2026-01-01" } });
    expect(snapshot.events.map((event) => event.type).sort()).toEqual(["cancelled", "expired", "failed", "rejected", "sent"]);
    expect(snapshot.events).toHaveLength(5);
    expect(snapshot.signingStatus).toBe("failed");
    expect(snapshot.derivedLeaseState).toBe("failed");
  });

  it("stores signed document storage metadata and returns a fresh signed URL without persisting it", async () => {
    const { signingProviderRegistry } = await import("../signing/providers");
    signingProviderRegistry.register("boldsign", {
      getProviderId: () => "boldsign",
      getName: () => "Boldsign download provider",
      isConfigured: () => true,
      sendForSignature: async () => ({
        providerRequestId: "raw-provider-request-download",
        dispatchMode: "sandbox",
        dispatchStatus: "accepted",
        providerTestMode: true,
      }),
      getSigningUrl: async () => null,
      cancelRequest: async () => true,
      downloadSignedDocument: async () => ({
        fileName: "signed lease.pdf",
        contentType: "application/pdf",
        buffer: Buffer.from("signed-pdf"),
      }),
      verifyWebhookSignature: async () => true,
      parseWebhookPayload: async () => ({
        providerRequestId: "raw-provider-request-download",
        providerEventId: "evt_signed_download",
        type: "signed",
        occurredAt: "2026-01-02T00:00:00.000Z",
      }),
    });
    process.env.SIGNING_PROVIDER = "boldsign";
    const { downloadSignedLease, sendLeaseForSignature } = await import("../signing/leaseSigningService");
    await sendLeaseForSignature({
      leaseId: "lease-1",
      landlordId: "landlord-1",
      lease: { startDate: "2026-01-01" },
      providerDocumentUrl: "https://example.com/primary.pdf",
      tenantEmails: ["tenant@example.com"],
    });
    const [[requestId]] = Array.from(ensureCollection("leaseSigningRequests").entries());
    ensureCollection("leaseSigningRequests").get(requestId).currentSigningStatus = "signed";
    ensureCollection("leaseSigningEvents").set("event-signed-download", {
      requestId,
      leaseId: "lease-1",
      landlordId: "landlord-1",
      providerId: "boldsign",
      providerRequestRef: "boldsign_ref_safe",
      type: "signed",
      actorRole: "provider",
      occurredAt: "2027-01-02T00:00:00.000Z",
    });

    const snapshot = await downloadSignedLease({ leaseId: "lease-1", landlordId: "landlord-1", lease: { startDate: "2026-01-01" } });
    const replay = await downloadSignedLease({ leaseId: "lease-1", landlordId: "landlord-1", lease: { startDate: "2026-01-01" } });
    const storedRequest = Array.from(ensureCollection("leaseSigningRequests").values())[0];

    expect(snapshot.documentUrl).toContain("https://signed.example/lease-signing/");
    expect(replay.documentUrl).toBe(snapshot.documentUrl);
    expect(uploadBufferToGcsMock).toHaveBeenCalledTimes(1);
    expect(storedRequest.signedDocument).toEqual(
      expect.objectContaining({
        bucket: "bucket",
        path: expect.stringContaining("signed-lease.pdf"),
        contentType: "application/pdf",
        internalReferenceOnly: true,
      })
    );
    expect(storedRequest.signedDocumentUrl).toBeNull();
    expect(storedRequest.signedDocumentHash).toMatch(/^[a-f0-9]{64}$/);
    expect(JSON.stringify(storedRequest)).not.toContain("https://signed.example/");
    expect(JSON.stringify(storedRequest)).not.toContain("X-Goog");
    expect(JSON.stringify(snapshot)).not.toContain("raw-provider-request-download");
  });

  it("returns fresh signed document URLs from stored metadata and collapses duplicate signed events in projections", async () => {
    const { loadLeaseSigningSnapshot } = await import("../signing/leaseSigningService");
    ensureCollection("leaseSigningRequests").set("request-1", {
      leaseId: "lease-1",
      landlordId: "landlord-1",
      providerId: "mock",
      providerRequestId: "raw-provider-request-duplicate",
      providerRequestRef: "mock_ref_safe",
      currentSigningStatus: "signed",
      signedDocument: {
        bucket: "bucket",
        path: "lease-signing/landlord/request-1/signed.pdf",
        internalReferenceOnly: true,
      },
      signedDocumentUrl: "https://storage.googleapis.com/bucket/lease-signing/landlord/request-1/signed.pdf?X-Goog-Signature=stale",
      signedDocumentHash: "signed_hash",
      signedDocumentStoredAt: "2026-01-02T00:10:00.000Z",
      sentAt: "2026-01-01T00:00:00.000Z",
    });
    ensureCollection("leaseSigningEvents").set("event-sent", {
      requestId: "request-1",
      leaseId: "lease-1",
      landlordId: "landlord-1",
      type: "sent",
      actorRole: "landlord",
      occurredAt: "2026-01-01T00:00:00.000Z",
    });
    ensureCollection("leaseSigningEvents").set("event-signed-1", {
      requestId: "request-1",
      leaseId: "lease-1",
      landlordId: "landlord-1",
      type: "signed",
      actorRole: "provider",
      occurredAt: "2026-01-02T00:00:00.000Z",
    });
    ensureCollection("leaseSigningEvents").set("event-signed-2", {
      requestId: "request-1",
      leaseId: "lease-1",
      landlordId: "landlord-1",
      type: "signed",
      actorRole: "provider",
      occurredAt: "2026-01-02T00:05:00.000Z",
    });

    const snapshot = await loadLeaseSigningSnapshot({ leaseId: "lease-1", landlordId: "landlord-1", lease: { startDate: "2026-01-01" } });

    expect(snapshot.documentUrl).toBe("https://signed.example/lease-signing/landlord/request-1/signed.pdf");
    expect(snapshot.signedAt).toBe("2026-01-02T00:05:00.000Z");
    expect(snapshot.events.map((event) => event.type)).toEqual(["sent", "signed"]);
    expect(snapshot.events.find((event) => event.type === "signed")?.occurredAt).toBe("2026-01-02T00:05:00.000Z");
    expect(JSON.stringify(snapshot)).not.toContain("X-Goog-Signature");
    expect(JSON.stringify(snapshot)).not.toContain("raw-provider-request-duplicate");
  });

  it("converts legacy persisted signed URLs into internal signed document metadata on download", async () => {
    const { downloadSignedLease } = await import("../signing/leaseSigningService");
    ensureCollection("leaseSigningRequests").set("request-legacy", {
      leaseId: "lease-legacy",
      landlordId: "landlord-1",
      providerId: "mock",
      providerRequestId: "raw-provider-request-legacy",
      providerRequestRef: "mock_ref_safe",
      currentSigningStatus: "signed",
      signedDocumentUrl:
        "https://storage.googleapis.com/signed-lease-documents/lease-signing/landlord/request-legacy/signed.pdf?X-Goog-Signature=expired",
      signedDocumentHash: "legacy_hash",
      signedDocumentStoredAt: "2026-01-02T00:10:00.000Z",
      sentAt: "2026-01-01T00:00:00.000Z",
    });
    ensureCollection("leaseSigningEvents").set("event-signed-legacy", {
      requestId: "request-legacy",
      leaseId: "lease-legacy",
      landlordId: "landlord-1",
      type: "signed",
      actorRole: "provider",
      occurredAt: "2026-01-02T00:00:00.000Z",
    });

    const snapshot = await downloadSignedLease({ leaseId: "lease-legacy", landlordId: "landlord-1", lease: { startDate: "2026-01-01" } });
    const storedRequest = ensureCollection("leaseSigningRequests").get("request-legacy");

    expect(snapshot.documentUrl).toBe("https://signed.example/lease-signing/landlord/request-legacy/signed.pdf");
    expect(storedRequest.signedDocument).toEqual({
      bucket: "signed-lease-documents",
      path: "lease-signing/landlord/request-legacy/signed.pdf",
      internalReferenceOnly: true,
    });
    expect(storedRequest.signedDocumentUrl).toBeNull();
    expect(JSON.stringify(snapshot)).not.toContain("X-Goog-Signature=expired");
    expect(JSON.stringify(storedRequest)).not.toContain("X-Goog-Signature=expired");
  });

  it("rejects generic application and non-signing URLs as legacy signed-document proof", async () => {
    const { getSignedLeaseDocumentDownload, loadLeaseSigningSnapshot } = await import("../signing/leaseSigningService");
    ensureCollection("leaseSigningRequests").set("request-invalid-legacy", {
      leaseId: "lease-invalid-legacy", landlordId: "landlord-1", providerId: "mock",
      currentSigningStatus: "signed", signedDocumentUrl: "https://app.rentchain.ai/leases",
    });
    ensureCollection("leaseSigningEvents").set("event-invalid-legacy", {
      requestId: "request-invalid-legacy", type: "signed", actorRole: "provider", occurredAt: "2027-01-02T00:00:00.000Z",
    });
    const snapshot = await loadLeaseSigningSnapshot({ leaseId: "lease-invalid-legacy", landlordId: "landlord-1", lease: {} });
    const download = await getSignedLeaseDocumentDownload({ leaseId: "lease-invalid-legacy", landlordId: "landlord-1" });
    expect(snapshot.signedDocumentAvailable).toBe(false);
    expect(snapshot.viewSignedDocumentAllowed).toBe(false);
    expect(download.documentUrl).toBeNull();
  });

  it("resolves current state to pending after resending a cancelled signing request", async () => {
    const { cancelLeaseSigning, loadLeaseSigningSnapshot, sendLeaseForSignature } = await import("../signing/leaseSigningService");
    const lease = { startDate: "2026-01-01", documentUrl: "https://example.com/lease.pdf" };

    const initial = await sendLeaseForSignature({
      leaseId: "lease-1",
      landlordId: "landlord-1",
      lease,
      tenantEmails: ["tenant@example.com"],
    });
    expect(initial.signingStatus).toBe("pending_signature");

    const cancelled = await cancelLeaseSigning({
      leaseId: "lease-1",
      landlordId: "landlord-1",
      lease,
    });
    expect(cancelled.signingStatus).toBe("cancelled");

    const resent = await sendLeaseForSignature({
      leaseId: "lease-1",
      landlordId: "landlord-1",
      lease,
      tenantEmails: ["tenant@example.com"],
    });
    const snapshot = await loadLeaseSigningSnapshot({
      leaseId: "lease-1",
      landlordId: "landlord-1",
      lease,
    });

    expect(resent.signingStatus).toBe("pending_signature");
    expect(resent.derivedLeaseState).toBe("pending_signature");
    expect(snapshot.signingStatus).toBe("pending_signature");
    expect(snapshot.derivedLeaseState).toBe("pending_signature");
    expect(snapshot.events.map((event) => event.type)).toEqual(["sent", "cancelled", "sent"]);
    expect(Array.from(ensureCollection("leaseSigningRequests").values())[0]).toEqual(
      expect.objectContaining({
        currentSigningStatus: "pending_signature",
      })
    );
  });

  it("uses event chronology so an older arrival cannot regress current lifecycle state", async () => {
    const { processSigningWebhook, sendLeaseForSignature, loadLeaseSigningSnapshot } = await import("../signing/leaseSigningService");
    const sent = await sendLeaseForSignature({
      leaseId: "lease-order",
      landlordId: "landlord-1",
      lease: { startDate: "2026-01-01" },
      tenantEmails: ["tenant@example.com"],
    });
    const request = ensureCollection("leaseSigningRequests").get(String(sent.signingRequestId));
    await processSigningWebhook({ providerId: "mock", headers: {}, body: {
      providerRequestId: request.providerRequestId, eventId: "evt_failed_newer", type: "failed", occurredAt: "2027-02-02T00:00:00.000Z",
    } });
    await processSigningWebhook({ providerId: "mock", headers: {}, body: {
      providerRequestId: request.providerRequestId, eventId: "evt_signed_older", type: "signed", occurredAt: "2027-02-01T00:00:00.000Z",
    } });

    const snapshot = await loadLeaseSigningSnapshot({ leaseId: "lease-order", landlordId: "landlord-1", lease: {} });
    expect(snapshot.signingStatus).toBe("failed");
    expect(snapshot.hasEverBeenSigned).toBe(true);
    expect(snapshot.signedDocumentState).toBe("unavailable");
    expect(snapshot.signedDocumentRecoveryAction).toBe("admin_review");
    expect(snapshot.reminderEligible).toBe(false);
    expect(ensureCollection("leaseSigningRequests").get(String(sent.signingRequestId)).currentSigningStatus).toBe("failed");

    const second = await sendLeaseForSignature({
      leaseId: "lease-order-signed", landlordId: "landlord-1", lease: {}, tenantEmails: ["tenant@example.com"],
    });
    const secondRequest = ensureCollection("leaseSigningRequests").get(String(second.signingRequestId));
    await processSigningWebhook({ providerId: "mock", headers: {}, body: {
      providerRequestId: secondRequest.providerRequestId, eventId: "evt_signed_newer", type: "signed", occurredAt: "2027-04-02T00:00:00.000Z",
    } });
    await processSigningWebhook({ providerId: "mock", headers: {}, body: {
      providerRequestId: secondRequest.providerRequestId, eventId: "evt_viewed_older", type: "viewed", occurredAt: "2027-04-01T00:00:00.000Z",
    } });
    const signedSnapshot = await loadLeaseSigningSnapshot({ leaseId: "lease-order-signed", landlordId: "landlord-1", lease: {} });
    expect(signedSnapshot.signingStatus).toBe("signed");
    expect(signedSnapshot.reminderEligible).toBe(false);
  });

  it("keeps a durable signed artifact retrievable after a later terminal anomaly", async () => {
    const { downloadSignedLease, getSignedLeaseDocumentDownload, loadLeaseSigningSnapshot } = await import("../signing/leaseSigningService");
    ensureCollection("leaseSigningRequests").set("request-terminal", {
      leaseId: "lease-terminal", landlordId: "landlord-1", providerId: "mock", providerRequestId: "raw-terminal",
      providerRequestRef: "mock_ref_safe", currentSigningStatus: "cancelled",
      signedDocument: { bucket: "bucket", path: "lease-signing/safe/request-terminal/signed.pdf", internalReferenceOnly: true },
    });
    ensureCollection("leaseSigningEvents").set("terminal-signed", {
      requestId: "request-terminal", type: "signed", actorRole: "provider", occurredAt: "2027-01-01T00:00:00.000Z",
    });
    ensureCollection("leaseSigningEvents").set("terminal-cancelled", {
      requestId: "request-terminal", type: "cancelled", actorRole: "provider", occurredAt: "2027-01-02T00:00:00.000Z",
    });

    const snapshot = await loadLeaseSigningSnapshot({ leaseId: "lease-terminal", landlordId: "landlord-1", lease: {} });
    const getDownload = await getSignedLeaseDocumentDownload({ leaseId: "lease-terminal", landlordId: "landlord-1" });
    const postDownload = await downloadSignedLease({ leaseId: "lease-terminal", landlordId: "landlord-1", lease: {} });
    expect(snapshot.signingStatus).toBe("cancelled");
    expect(snapshot.signedDocumentState).toBe("available");
    expect(snapshot.viewSignedDocumentAllowed).toBe(true);
    expect(getDownload.documentUrl).toContain("request-terminal/signed.pdf");
    expect(postDownload.documentUrl).toContain("request-terminal/signed.pdf");
    expect(uploadBufferToGcsMock).not.toHaveBeenCalled();
  });

  it("surfaces provider persistence failure with deterministic recovery state", async () => {
    const { signingProviderRegistry } = await import("../signing/providers");
    signingProviderRegistry.register("boldsign", {
      getProviderId: () => "boldsign", getName: () => "Unavailable document provider", isConfigured: () => true,
      sendForSignature: async () => ({ providerRequestId: "raw-failure", dispatchStatus: "accepted" }),
      getSigningUrl: async () => null, cancelRequest: async () => true, downloadSignedDocument: async () => null,
      verifyWebhookSignature: async () => true,
      parseWebhookPayload: async () => ({ providerRequestId: "raw-failure", providerEventId: "evt-failure-signed", type: "signed", occurredAt: "2027-03-01T00:00:00.000Z" }),
    });
    process.env.SIGNING_PROVIDER = "boldsign";
    const { downloadSignedLease, processSigningWebhook, sendLeaseForSignature, loadLeaseSigningSnapshot } = await import("../signing/leaseSigningService");
    await sendLeaseForSignature({ leaseId: "lease-failure", landlordId: "landlord-1", lease: {}, providerDocumentUrl: "https://example.com/lease.pdf", tenantEmails: ["tenant@example.com"] });
    await processSigningWebhook({ providerId: "boldsign", headers: {}, body: {} });
    await expect(downloadSignedLease({ leaseId: "lease-failure", landlordId: "landlord-1", lease: {} }))
      .rejects.toMatchObject({ message: "signed_document_persistence_failed", status: 503 });
    const snapshot = await loadLeaseSigningSnapshot({ leaseId: "lease-failure", landlordId: "landlord-1", lease: {} });
    expect(snapshot.signedDocumentState).toBe("persistence_failed");
    expect(snapshot.signedDocumentRecoveryAction).toBe("retry_download");
    expect(snapshot.viewSignedDocumentAllowed).toBe(false);
  });

  it("makes reminder eligibility provider-neutral and pending-only", async () => {
    const { loadLeaseSigningSnapshot } = await import("../signing/leaseSigningService");
    for (const status of ["pending_signature", "signed", "cancelled", "expired", "rejected", "failed"] as const) {
      const leaseId = `lease-reminder-${status}`;
      ensureCollection("leaseSigningRequests").set(`request-reminder-${status}`, {
        leaseId, landlordId: "landlord-1", providerId: "mock", currentSigningStatus: status,
      });
      const snapshot = await loadLeaseSigningSnapshot({ leaseId, landlordId: "landlord-1", lease: {} });
      expect(snapshot.reminderEligible).toBe(status === "pending_signature");
    }
  });
});
