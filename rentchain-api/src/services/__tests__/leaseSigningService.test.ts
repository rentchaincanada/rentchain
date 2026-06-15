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
    delete process.env.SIGNING_PROVIDER_API_KEY;
    delete process.env.SIGNING_PROVIDER_WEBHOOK_SECRET;
    delete process.env.SIGNING_PROVIDER_TEST_MODE;
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
    expect(snapshot.providerDispatchMode).toBe("mock");
    expect(snapshot.providerDispatchStatus).toBe("mocked_no_email");
    expect(snapshot.events.map((event) => event.type)).toEqual(["sent"]);
    expect(snapshot.events[0]).toEqual(
      expect.objectContaining({
        providerDispatchMode: "mock",
        providerDispatchStatus: "mocked_no_email",
      })
    );
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
      lease: { startDate: "2026-01-01", documentUrl: "https://example.com/lease.pdf" },
      tenantEmails: ["tenant@example.com"],
    });

    const storedRequest = Array.from(ensureCollection("leaseSigningRequests").values())[0];
    expect(storedRequest.providerRequestId).toBe("raw-provider-request-123");
    expect(snapshot.providerRequestRef).toMatch(/^boldsign_ref_/);
    expect(JSON.stringify(snapshot)).not.toContain("raw-provider-request-123");
    expect(writeCanonicalEventMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "signing_sent",
        metadata: expect.objectContaining({
          providerDispatchMode: "sandbox",
          providerDispatchStatus: "accepted",
          providerTestMode: true,
        }),
      })
    );
    expect(JSON.stringify(writeCanonicalEventMock.mock.calls)).not.toContain("raw-provider-request-123");
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

    await expect(processSigningWebhook({ providerId: "boldsign", headers: {}, body: { event: { event_type: "callback_test" } } })).resolves.toBeUndefined();

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

    await expect(processSigningWebhook({ providerId: "boldsign", headers: {}, body: { signature_request: {} } })).resolves.toBeUndefined();

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
          occurredAt: `2026-01-02T00:00:0${["rejected", "expired", "cancelled", "failed"].indexOf(type)}.000Z`,
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
          occurredAt: `2026-01-02T00:00:0${["rejected", "expired", "cancelled", "failed"].indexOf(type)}.000Z`,
        },
      });
    }

    const snapshot = await loadLeaseSigningSnapshot({ leaseId: "lease-1", landlordId: "landlord-1", lease: { startDate: "2026-01-01" } });
    expect(snapshot.events.map((event) => event.type).sort()).toEqual(["cancelled", "expired", "failed", "rejected", "sent"]);
    expect(snapshot.events).toHaveLength(5);
    expect(snapshot.signingStatus).toBe("failed");
    expect(snapshot.derivedLeaseState).toBe("failed");
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
});
