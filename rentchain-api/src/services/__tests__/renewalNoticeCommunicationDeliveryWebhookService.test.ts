import crypto from "crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { collections, dbMock } = vi.hoisted(() => {
  const collections = new Map<string, Map<string, any>>();
  let autoId = 0;

  function ensureCollection(name: string) {
    if (!collections.has(name)) collections.set(name, new Map<string, any>());
    return collections.get(name)!;
  }

  function refFor(name: string, id?: string) {
    const docId = id || `${name}_${++autoId}`;
    return {
      id: docId,
      get: async () => ({
        id: docId,
        exists: ensureCollection(name).has(docId),
        data: () => ensureCollection(name).get(docId),
      }),
      set: async (value: any, options?: { merge?: boolean }) => {
        const current = ensureCollection(name).get(docId) || {};
        ensureCollection(name).set(docId, options?.merge ? { ...current, ...value } : value);
      },
    };
  }

  function queryFor(name: string, filters: Array<[string, unknown]> = [], max?: number) {
    return {
      where(field: string, _op: string, value: unknown) {
        return queryFor(name, [...filters, [field, value]], max);
      },
      limit(value: number) {
        return queryFor(name, filters, value);
      },
      async get() {
        const docs = Array.from(ensureCollection(name).entries())
          .filter(([, data]) => filters.every(([field, value]) => data?.[field] === value))
          .slice(0, max || Number.MAX_SAFE_INTEGER)
          .map(([id, data]) => ({ id, data: () => data }));
        return { empty: docs.length === 0, docs };
      },
    };
  }

  const dbMock = {
    collection: (name: string) => ({
      doc: (id?: string) => refFor(name, id),
      where(field: string, op: string, value: unknown) {
        return queryFor(name).where(field, op, value);
      },
    }),
    batch: () => {
      const ops: Array<() => Promise<void>> = [];
      return {
        set(ref: any, value: any, options?: { merge?: boolean }) {
          ops.push(() => ref.set(value, options));
        },
        async commit() {
          for (const op of ops) await op();
        },
      };
    },
  };

  return { collections, dbMock };
});

vi.mock("../../firebase", () => ({ db: dbMock }));

const signingKey = "mailgun-signing-secret";
const now = new Date("2026-07-13T12:00:00.000Z");

function seedDoc(collectionName: string, id: string, data: any) {
  if (!collections.has(collectionName)) collections.set(collectionName, new Map());
  collections.get(collectionName)!.set(id, data);
}

function communication(overrides: Record<string, any> = {}) {
  return {
    communicationId: "rnc_test",
    leaseId: "lease-1",
    landlordId: "landlord-1",
    tenantId: "tenant-1",
    propertyId: "property-1",
    unitId: "unit-1",
    snapshotId: "snapshot-1",
    approvalDecisionItemId: "decision-1",
    idempotencyKeyHash: "hash",
    subject: "Renewal details",
    recipientEmail: "hello+tenant@rentchain.ai",
    bodyHash: "body-hash",
    status: "email_sent",
    deliveryStatus: "accepted_for_sending",
    deliveryStatusUpdatedAt: "2026-07-13T11:00:00.000Z",
    deliveryStatusSource: "send_response",
    deliveryStatusReason: "mailgun_accepted",
    deliveryEventIds: [],
    lastProviderEventAt: "2026-07-13T11:00:00.000Z",
    provider: "mailgun",
    providerMessageId: "<message-1@mg.example.com>",
    attemptedAt: "2026-07-13T10:59:00.000Z",
    sentAt: "2026-07-13T11:00:00.000Z",
    failedAt: null,
    tenantNotified: true,
    noticeServed: false,
    legalServiceEstablished: false,
    noLegalServiceClaim: true,
    confirmation: {
      confirmationAccepted: true,
      recipientReviewed: true,
      bodyReviewed: true,
      legalServiceAcknowledged: true,
      noLegalServiceClaim: true,
    },
    actor: { id: "landlord-1", email: "landlord@example.com" },
    source: "renewal_notice_communication_send_api",
    createdAt: "2026-07-13T10:59:00.000Z",
    updatedAt: "2026-07-13T11:00:00.000Z",
    auditEventIds: [],
    canonicalEventIds: [],
    ...overrides,
  };
}

function signedBody(eventData: Record<string, any>, token = "token-1", timestamp = "1783944000") {
  const signature = crypto.createHmac("sha256", signingKey).update(`${timestamp}${token}`).digest("hex");
  return {
    signature: { timestamp, token, signature },
    "event-data": eventData,
  };
}

function eventData(overrides: Record<string, any> = {}) {
  return {
    id: "evt-1",
    event: "delivered",
    timestamp: 1783944000,
    "user-variables": { communicationId: "rnc_test" },
    message: { headers: { "message-id": "message-1@mg.example.com" } },
    "raw-private-provider-payload": "must-not-project",
    ...overrides,
  };
}

async function handle(body: any) {
  const { handleMailgunRenewalCommunicationWebhook } = await import("../renewalNoticeCommunicationDeliveryWebhookService");
  return handleMailgunRenewalCommunicationWebhook({
    body,
    signingKey,
    now,
    replayWindowSeconds: 900,
  });
}

async function handleWithOptions(body: any, options: { replayWindowSeconds?: number; now?: Date } = {}) {
  const { handleMailgunRenewalCommunicationWebhook } = await import("../renewalNoticeCommunicationDeliveryWebhookService");
  return handleMailgunRenewalCommunicationWebhook({
    body,
    signingKey,
    now: options.now || now,
    replayWindowSeconds: options.replayWindowSeconds,
  });
}

describe("Mailgun renewal communication delivery webhooks", () => {
  beforeEach(() => {
    collections.clear();
    vi.clearAllMocks();
    seedDoc("renewalNoticeCommunications", "rnc_test", communication());
  });

  it("accepts a valid signature and updates a matching communication to delivered", async () => {
    const before = collections.get("renewalNoticeCommunications")?.get("rnc_test");
    const result = await handle(signedBody(eventData()));

    expect(result).toEqual(expect.objectContaining({ ok: true, matched: true, updated: true, deliveryStatus: "delivered" }));
    const record = collections.get("renewalNoticeCommunications")?.get("rnc_test");
    expect(record).toEqual(
      expect.objectContaining({
        deliveryStatus: "delivered",
        deliveryStatusSource: "mailgun_webhook",
        deliveryStatusReason: "mailgun_event_delivered",
        providerMessageId: "<message-1@mg.example.com>",
        noticeServed: false,
        legalServiceEstablished: false,
        noLegalServiceClaim: true,
      })
    );
    expect(record).toEqual(
      expect.objectContaining({
        communicationId: before.communicationId,
        leaseId: before.leaseId,
        landlordId: before.landlordId,
        tenantId: before.tenantId,
        propertyId: before.propertyId,
        unitId: before.unitId,
        snapshotId: before.snapshotId,
        approvalDecisionItemId: before.approvalDecisionItemId,
        idempotencyKeyHash: before.idempotencyKeyHash,
        subject: before.subject,
        recipientEmail: before.recipientEmail,
        bodyHash: before.bodyHash,
        status: before.status,
        attemptedAt: before.attemptedAt,
        sentAt: before.sentAt,
        failedAt: before.failedAt,
        tenantNotified: before.tenantNotified,
      })
    );
    expect(collections.get("events")?.size).toBe(1);
    expect(collections.get("canonicalEvents")?.size).toBe(1);
    expect(JSON.stringify(Array.from(collections.values()).map((items) => Array.from(items.values())))).not.toContain(
      "must-not-project"
    );
    expect(collections.get("leaseNotices")).toBeUndefined();
    expect(collections.get("leases")).toBeUndefined();
  });

  it("rejects missing, invalid, and stale signatures", async () => {
    const missing = await handle({ "event-data": eventData() });
    expect(missing).toEqual({ ok: false, statusCode: 401, error: "MAILGUN_WEBHOOK_SIGNATURE_REQUIRED" });

    const invalid = await handle({
      ...signedBody(eventData(), "token-2"),
      signature: { timestamp: "1783944000", token: "token-2", signature: "bad" },
    });
    expect(invalid).toEqual({ ok: false, statusCode: 401, error: "MAILGUN_WEBHOOK_SIGNATURE_INVALID" });

    const stale = await handle(signedBody(eventData(), "token-3", "1000"));
    expect(stale).toEqual({ ok: false, statusCode: 401, error: "MAILGUN_WEBHOOK_SIGNATURE_STALE" });
  });

  it.each([
    ["timestamp", { token: "token", signature: "abc" }],
    ["token", { timestamp: "1783944000", signature: "abc" }],
    ["signature", { timestamp: "1783944000", token: "token" }],
  ])("rejects missing signature.%s without processing", async (_field, signature) => {
    const result = await handle({ signature, "event-data": eventData() });

    expect(result).toEqual({ ok: false, statusCode: 401, error: "MAILGUN_WEBHOOK_SIGNATURE_REQUIRED" });
    expect(collections.get("communicationProviderEventReceipts")).toBeUndefined();
    expect(collections.get("events")).toBeUndefined();
    expect(collections.get("canonicalEvents")).toBeUndefined();
  });

  it("rejects non-numeric, far-future, and invalid-format signatures safely", async () => {
    const nonNumeric = await handle({
      ...signedBody(eventData(), "token-nonnumeric", "not-a-time"),
      signature: { timestamp: "not-a-time", token: "token-nonnumeric", signature: "abc123" },
    });
    expect(nonNumeric).toEqual({ ok: false, statusCode: 401, error: "MAILGUN_WEBHOOK_SIGNATURE_INVALID" });

    const future = await handle(signedBody(eventData(), "token-future", "9999999999"));
    expect(future).toEqual({ ok: false, statusCode: 401, error: "MAILGUN_WEBHOOK_SIGNATURE_STALE" });

    const invalidHex = await handle({
      ...signedBody(eventData(), "token-invalid-format"),
      signature: { timestamp: "1783944000", token: "token-invalid-format", signature: "not-hex-signature" },
    });
    expect(invalidHex).toEqual({ ok: false, statusCode: 401, error: "MAILGUN_WEBHOOK_SIGNATURE_INVALID" });
    expect(collections.get("communicationProviderEventReceipts")).toBeUndefined();
  });

  it("uses the default replay window when none is supplied", async () => {
    const staleByDefault = await handleWithOptions(signedBody(eventData(), "token-default-window", "1000"));

    expect(staleByDefault).toEqual({ ok: false, statusCode: 401, error: "MAILGUN_WEBHOOK_SIGNATURE_STALE" });
  });

  it("rejects a valid signature with missing event-data without creating receipts", async () => {
    const timestamp = "1783944000";
    const token = "token-no-event-data";
    const signature = crypto.createHmac("sha256", signingKey).update(`${timestamp}${token}`).digest("hex");
    const result = await handle({ signature: { timestamp, token, signature } });

    expect(result).toEqual({ ok: false, statusCode: 400, error: "MAILGUN_WEBHOOK_EVENT_DATA_REQUIRED" });
    expect(collections.get("communicationProviderEventReceipts")).toBeUndefined();
    expect(collections.get("events")).toBeUndefined();
    expect(collections.get("canonicalEvents")).toBeUndefined();
  });

  it("treats duplicate provider events as idempotent without duplicating audit events", async () => {
    const body = signedBody(eventData({ id: "evt-dupe" }), "dupe-token");
    const first = await handle(body);
    const second = await handle(body);

    expect(first).toEqual(expect.objectContaining({ ok: true, updated: true }));
    expect(second).toEqual(expect.objectContaining({ ok: true, duplicate: true, updated: false }));
    expect(collections.get("events")?.size).toBe(1);
    expect(collections.get("canonicalEvents")?.size).toBe(1);
  });

  it.each([
    ["failed", "permanent", "bounced", "mailgun_event_failed_permanent"],
    ["failed", "temporary", "deferred", "mailgun_event_failed_temporary"],
    ["complained", undefined, "complained", "mailgun_event_complained"],
  ])("maps %s/%s to %s without legal-service state", async (event, severity, status, reason) => {
    const body = signedBody(eventData({ id: `evt-${status}`, event, severity }), `token-${status}`);
    const result = await handle(body);

    expect(result).toEqual(expect.objectContaining({ ok: true, updated: true, deliveryStatus: status }));
    const record = collections.get("renewalNoticeCommunications")?.get("rnc_test");
    expect(record).toEqual(
      expect.objectContaining({
        deliveryStatus: status,
        deliveryStatusReason: reason,
        noticeServed: false,
        legalServiceEstablished: false,
      })
    );
  });

  it("does not let accepted events downgrade delivered or complaint states", async () => {
    seedDoc("renewalNoticeCommunications", "rnc_test", communication({ deliveryStatus: "delivered" }));
    const deliveredNoop = await handle(signedBody(eventData({ id: "evt-accepted", event: "accepted" }), "accepted-token"));
    expect(deliveredNoop).toEqual(
      expect.objectContaining({ ok: true, matched: true, updated: false, ignoredReason: "delivery_status_precedence_noop" })
    );
    expect(collections.get("renewalNoticeCommunications")?.get("rnc_test").deliveryStatus).toBe("delivered");

    seedDoc("renewalNoticeCommunications", "rnc_test", communication({ deliveryStatus: "complained" }));
    const complainedNoop = await handle(signedBody(eventData({ id: "evt-accepted-2", event: "accepted" }), "accepted-token-2"));
    expect(complainedNoop).toEqual(expect.objectContaining({ ok: true, updated: false }));
    expect(collections.get("renewalNoticeCommunications")?.get("rnc_test").deliveryStatus).toBe("complained");
  });

  it("matches by provider message id when the custom communication id is absent", async () => {
    const body = signedBody(
      eventData({
        id: "evt-message-id",
        "user-variables": {},
        message: { headers: { "message-id": "message-1@mg.example.com" } },
      }),
      "message-token"
    );
    const result = await handle(body);

    expect(result).toEqual(expect.objectContaining({ ok: true, matched: true, updated: true, communicationId: "rnc_test" }));
  });

  it("prefers communicationId over providerMessageId when both are present", async () => {
    seedDoc(
      "renewalNoticeCommunications",
      "rnc_other",
      communication({
        communicationId: "rnc_other",
        deliveryStatus: "accepted_for_sending",
        providerMessageId: "<conflicting-message@mg.example.com>",
      })
    );
    const body = signedBody(
      eventData({
        id: "evt-priority",
        "user-variables": { communicationId: "rnc_test" },
        message: { headers: { "message-id": "conflicting-message@mg.example.com" } },
      }),
      "priority-token"
    );

    const result = await handle(body);

    expect(result).toEqual(expect.objectContaining({ ok: true, matched: true, updated: true, communicationId: "rnc_test" }));
    expect(collections.get("renewalNoticeCommunications")?.get("rnc_test")).toEqual(
      expect.objectContaining({ deliveryStatus: "delivered" })
    );
    expect(collections.get("renewalNoticeCommunications")?.get("rnc_other")).toEqual(
      expect.objectContaining({ deliveryStatus: "accepted_for_sending" })
    );
  });

  it("does not update communications when both correlation fields are missing", async () => {
    const before = { ...collections.get("renewalNoticeCommunications")?.get("rnc_test") };
    const body = signedBody(
      eventData({
        id: "evt-no-correlation",
        "user-variables": {},
        message: { headers: {} },
      }),
      "no-correlation-token"
    );

    const result = await handle(body);

    expect(result).toEqual(
      expect.objectContaining({
        ok: true,
        matched: false,
        updated: false,
        ignoredReason: "communication_not_found",
      })
    );
    expect(collections.get("renewalNoticeCommunications")?.get("rnc_test")).toEqual(before);
    const receipts = Array.from((collections.get("communicationProviderEventReceipts") || new Map()).values());
    expect(receipts[0]).toEqual(expect.objectContaining({ reconciliationState: "unmatched" }));
    expect(collections.get("events")).toBeUndefined();
    expect(collections.get("canonicalEvents")).toBeUndefined();
  });

  it("does not update communications when providerMessageId matches multiple records", async () => {
    seedDoc(
      "renewalNoticeCommunications",
      "rnc_other",
      communication({
        communicationId: "rnc_other",
        providerMessageId: "<message-1@mg.example.com>",
      })
    );
    const beforeFirst = { ...collections.get("renewalNoticeCommunications")?.get("rnc_test") };
    const beforeSecond = { ...collections.get("renewalNoticeCommunications")?.get("rnc_other") };
    const body = signedBody(
      eventData({
        id: "evt-ambiguous",
        "user-variables": {},
        message: { headers: { "message-id": "message-1@mg.example.com" } },
      }),
      "ambiguous-token"
    );

    const result = await handle(body);

    expect(result).toEqual(
      expect.objectContaining({
        ok: true,
        matched: false,
        updated: false,
        ignoredReason: "ambiguous_provider_message_id",
      })
    );
    expect(collections.get("renewalNoticeCommunications")?.get("rnc_test")).toEqual(beforeFirst);
    expect(collections.get("renewalNoticeCommunications")?.get("rnc_other")).toEqual(beforeSecond);
    const receipts = Array.from((collections.get("communicationProviderEventReceipts") || new Map()).values());
    expect(receipts[0]).toEqual(expect.objectContaining({ reconciliationState: "ambiguous" }));
    expect(collections.get("events")).toBeUndefined();
    expect(collections.get("canonicalEvents")).toBeUndefined();
  });

  it("records unmatched provider events safely without updating communication records", async () => {
    collections.get("renewalNoticeCommunications")?.delete("rnc_test");
    const result = await handle(signedBody(eventData({ id: "evt-unmatched" }), "unmatched-token"));

    expect(result).toEqual(
      expect.objectContaining({
        ok: true,
        matched: false,
        updated: false,
        ignoredReason: "communication_not_found",
      })
    );
    const receipts = Array.from((collections.get("communicationProviderEventReceipts") || new Map()).values());
    expect(receipts[0]).toEqual(expect.objectContaining({ reconciliationState: "unmatched" }));
    expect(collections.get("events")).toBeUndefined();
  });

  it("ignores unsupported open/click-style events for v1", async () => {
    const result = await handle(signedBody(eventData({ id: "evt-opened", event: "opened" }), "opened-token"));

    expect(result).toEqual(
      expect.objectContaining({
        ok: true,
        matched: false,
        updated: false,
        ignoredReason: "unsupported_event:opened",
      })
    );
    expect(collections.get("renewalNoticeCommunications")?.get("rnc_test").deliveryStatus).toBe("accepted_for_sending");
  });
});
