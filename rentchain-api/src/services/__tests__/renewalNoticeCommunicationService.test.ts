import { beforeEach, describe, expect, it, vi } from "vitest";

const { collections, dbMock, sendEmailMock, lookupUserEmailMock } = vi.hoisted(() => {
  const collections = new Map<string, Map<string, any>>();
  let autoId = 0;

  function ensureCollection(name: string) {
    if (!collections.has(name)) collections.set(name, new Map<string, any>());
    return collections.get(name)!;
  }

  const dbMock = {
    collection: (name: string) => ({
      doc: (id?: string) => {
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

  return {
    collections,
    dbMock,
    sendEmailMock: vi.fn(async () => ({
      provider: "mailgun",
      providerMessageId: "<provider-message@mg.example.com>",
      providerResponseId: "<provider-message@mg.example.com>",
    })),
    lookupUserEmailMock: vi.fn(async () => "tenant@example.com"),
  };
});

vi.mock("../../firebase", () => ({ db: dbMock }));
vi.mock("../emailService", () => ({ sendEmail: sendEmailMock }));
vi.mock("../leaseNoticeWorkflowService", () => ({ lookupUserEmail: lookupUserEmailMock }));

function seedDoc(collectionName: string, id: string, data: any) {
  if (!collections.has(collectionName)) collections.set(collectionName, new Map());
  collections.get(collectionName)!.set(id, data);
}

function baseLease(overrides: Record<string, unknown> = {}) {
  return {
    id: "lease-1",
    landlordId: "landlord-1",
    tenantId: "tenant-1",
    propertyId: "property-1",
    unitId: "unit-1",
    propertyLabel: "Harbour View",
    propertyAddress: "12 Harbour Road",
    unitLabel: "Unit 101",
    status: "active",
    leaseType: "fixed_term",
    province: "NS",
    leaseStartDate: "2026-01-01",
    leaseEndDate: "2026-12-31",
    currentRent: 1850,
    currency: "CAD",
    ...overrides,
  } as any;
}

function baseSnapshot(overrides: Record<string, unknown> = {}) {
  return {
    snapshotId: "snapshot-1",
    leaseId: "lease-1",
    landlordId: "landlord-1",
    tenantId: "tenant-1",
    propertyId: "property-1",
    unitId: "unit-1",
    propertyUnitLabel: "Harbour View · Unit 101",
    generatedDraftText: "Hello Jane,\n\nThe new fixed term would begin on January 1, 2027.",
    generatedAt: "2026-07-11T12:00:00.000Z",
    savedAt: "2026-07-11T12:01:00.000Z",
    source: "renewal_notice_draft",
    status: "draft_saved",
    emailSent: false,
    noticeServed: false,
    tenantNotified: false,
    ...overrides,
  };
}

function baseDecision(overrides: Record<string, unknown> = {}) {
  return {
    id: "decision-1",
    landlordId: "landlord-1",
    sourceType: "renewal_notice_send_review",
    sourceId: "lease:lease-1:renewal_notice_send_review",
    sourceRoute: "/leases/lease-1/workflows/notice",
    status: "approved",
    leaseId: "lease-1",
    propertyId: "property-1",
    tenantId: "tenant-1",
    sourceSnapshot: { draftSnapshotId: "snapshot-1", leaseId: "lease-1" },
    metadata: { draftSnapshotId: "snapshot-1" },
    ...overrides,
  };
}

const confirmationPayload = {
  snapshotId: "snapshot-1",
  approvalDecisionItemId: "decision-1",
  confirmationAccepted: true,
  recipientReviewed: true,
  bodyReviewed: true,
  legalServiceAcknowledged: true,
  noLegalServiceClaim: true,
  idempotencyKey: "idem-1",
};

async function send(overrides: Record<string, unknown> = {}) {
  const { sendRenewalNoticeCommunication } = await import("../renewalNoticeCommunicationService");
  return sendRenewalNoticeCommunication({
    leaseId: "lease-1",
    landlordId: "landlord-1",
    actorId: "landlord-1",
    actorEmail: "manager@example.com",
    lease: baseLease(),
    input: { ...confirmationPayload, ...overrides },
  });
}

describe("sendRenewalNoticeCommunication", () => {
  beforeEach(() => {
    collections.clear();
    vi.clearAllMocks();
    lookupUserEmailMock.mockResolvedValue("tenant@example.com");
    sendEmailMock.mockResolvedValue({
      provider: "mailgun",
      providerMessageId: "<provider-message@mg.example.com>",
      providerResponseId: "<provider-message@mg.example.com>",
    });
    seedDoc("renewalNoticeDraftSnapshots", "snapshot-1", baseSnapshot());
    seedDoc("landlordDecisionQueueItems", "decision-1", baseDecision());
  });

  it("sends from the saved snapshot after approval and confirmation without creating notices or lease lifecycle changes", async () => {
    const result = await send();

    expect(result).toEqual(
      expect.objectContaining({
        ok: true,
        status: "email_sent",
        deliveryStatus: "accepted_for_sending",
        providerMessageId: "<provider-message@mg.example.com>",
        noticeServed: false,
        tenantNotified: true,
        legalServiceEstablished: false,
        noLegalServiceClaim: true,
      })
    );
    expect(sendEmailMock).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "tenant@example.com",
        subject: "Renewal details for Harbour View · Unit 101",
        text: expect.stringContaining("The new fixed term would begin"),
        metadata: expect.objectContaining({
          communicationId: expect.stringMatching(/^rnc_/),
          workflow: "renewal_notice_communication",
        }),
      })
    );
    expect(sendEmailMock.mock.calls[0]?.[0]?.metadata).not.toHaveProperty("leaseId");
    expect(sendEmailMock.mock.calls[0]?.[0]?.metadata).not.toHaveProperty("tenantEmail");
    const communications = Array.from((collections.get("renewalNoticeCommunications") || new Map()).values());
    expect(communications).toHaveLength(1);
    expect(communications[0]).toEqual(
      expect.objectContaining({
        leaseId: "lease-1",
        landlordId: "landlord-1",
        snapshotId: "snapshot-1",
        approvalDecisionItemId: "decision-1",
        status: "email_sent",
        deliveryStatus: "accepted_for_sending",
        deliveryStatusSource: "send_response",
        deliveryStatusReason: "mailgun_accepted",
        providerMessageId: "<provider-message@mg.example.com>",
        tenantNotified: true,
        noticeServed: false,
        legalServiceEstablished: false,
      })
    );
    expect(collections.get("leaseNotices")).toBeUndefined();
    expect(collections.get("leases")).toBeUndefined();
  });

  it.each([
    ["confirmationAccepted", "RENEWAL_NOTICE_CONFIRMATION_ACCEPTED_REQUIRED"],
    ["recipientReviewed", "RENEWAL_NOTICE_RECIPIENT_REVIEWED_REQUIRED"],
    ["bodyReviewed", "RENEWAL_NOTICE_BODY_REVIEWED_REQUIRED"],
    ["legalServiceAcknowledged", "RENEWAL_NOTICE_LEGAL_SERVICE_ACKNOWLEDGED_REQUIRED"],
    ["noLegalServiceClaim", "RENEWAL_NOTICE_NO_LEGAL_SERVICE_CLAIM_REQUIRED"],
  ])("requires %s before attempting send", async (field, error) => {
    const result = await send({ [field]: false });

    expect(result).toEqual(
      expect.objectContaining({
        ok: false,
        statusCode: 400,
        error,
        details: expect.arrayContaining([field]),
      })
    );
    expect(sendEmailMock).not.toHaveBeenCalled();
  });

  it.each([
    ["snapshotId", "RENEWAL_NOTICE_SNAPSHOT_ID_REQUIRED"],
    ["approvalDecisionItemId", "RENEWAL_NOTICE_APPROVAL_DECISION_ITEM_ID_REQUIRED"],
  ])("requires %s before attempting send", async (field, error) => {
    const result = await send({ [field]: "" });

    expect(result).toEqual(
      expect.objectContaining({
        ok: false,
        statusCode: 400,
        error,
        details: expect.arrayContaining([field]),
      })
    );
    expect(sendEmailMock).not.toHaveBeenCalled();
  });

  it("requires an idempotency key", async () => {
    const result = await send({ idempotencyKey: "" });

    expect(result).toEqual(
      expect.objectContaining({
        ok: false,
        statusCode: 400,
        error: "RENEWAL_NOTICE_IDEMPOTENCY_KEY_REQUIRED",
        details: expect.arrayContaining(["idempotencyKey"]),
      })
    );
    expect(sendEmailMock).not.toHaveBeenCalled();
  });

  it("rejects missing or mismatched snapshots", async () => {
    const missing = await send({ snapshotId: "missing-snapshot" });
    expect(missing).toEqual(expect.objectContaining({ ok: false, statusCode: 404, error: "RENEWAL_NOTICE_DRAFT_SNAPSHOT_NOT_FOUND" }));

    seedDoc("renewalNoticeDraftSnapshots", "snapshot-2", baseSnapshot({ snapshotId: "snapshot-2", leaseId: "lease-2" }));
    const mismatch = await send({ snapshotId: "snapshot-2", idempotencyKey: "idem-2" });
    expect(mismatch).toEqual(expect.objectContaining({ ok: false, statusCode: 403, error: "RENEWAL_NOTICE_DRAFT_SNAPSHOT_SCOPE_MISMATCH" }));
  });

  it("rejects missing, unapproved, wrong-source, or snapshot-mismatched approval decisions", async () => {
    const missing = await send({ approvalDecisionItemId: "missing-decision" });
    expect(missing).toEqual(expect.objectContaining({ ok: false, statusCode: 404, error: "RENEWAL_NOTICE_APPROVAL_DECISION_NOT_FOUND" }));

    seedDoc("landlordDecisionQueueItems", "decision-open", baseDecision({ id: "decision-open", status: "open" }));
    const notApproved = await send({ approvalDecisionItemId: "decision-open", idempotencyKey: "idem-2" });
    expect(notApproved).toEqual(expect.objectContaining({ ok: false, statusCode: 409, error: "RENEWAL_NOTICE_APPROVAL_DECISION_NOT_APPROVED" }));

    seedDoc("landlordDecisionQueueItems", "decision-source", baseDecision({ id: "decision-source", sourceType: "payment_readiness" }));
    const wrongSource = await send({ approvalDecisionItemId: "decision-source", idempotencyKey: "idem-3" });
    expect(wrongSource).toEqual(expect.objectContaining({ ok: false, statusCode: 400, error: "RENEWAL_NOTICE_APPROVAL_DECISION_SOURCE_TYPE_INVALID" }));

    seedDoc("landlordDecisionQueueItems", "decision-snapshot", baseDecision({ id: "decision-snapshot", metadata: { draftSnapshotId: "other" } }));
    const mismatch = await send({ approvalDecisionItemId: "decision-snapshot", idempotencyKey: "idem-4" });
    expect(mismatch).toEqual(expect.objectContaining({ ok: false, statusCode: 409, error: "RENEWAL_NOTICE_APPROVAL_SNAPSHOT_MISMATCH" }));
  });

  it("requires a tenant email before calling the provider", async () => {
    lookupUserEmailMock.mockResolvedValue(null);
    const result = await send();

    expect(result).toEqual(expect.objectContaining({ ok: false, statusCode: 400, error: "RENEWAL_NOTICE_TENANT_EMAIL_REQUIRED" }));
    expect(sendEmailMock).not.toHaveBeenCalled();
  });

  it("returns an idempotent response without sending a duplicate email", async () => {
    const first = await send();
    const second = await send();

    expect(first.ok).toBe(true);
    expect(second).toEqual(expect.objectContaining({ ok: true, idempotent: true, communicationId: (first as any).communicationId }));
    expect(sendEmailMock).toHaveBeenCalledTimes(1);
  });

  it("stores a failed communication safely when the provider rejects the email", async () => {
    sendEmailMock.mockRejectedValue(new Error("mailgun_send_failed:500"));
    const result = await send();

    expect(result).toEqual(
      expect.objectContaining({
        ok: false,
        statusCode: 502,
        error: "RENEWAL_NOTICE_EMAIL_SEND_FAILED",
        status: "email_failed",
        deliveryStatus: "failed",
        tenantNotified: false,
        noticeServed: false,
        legalServiceEstablished: false,
      })
    );
    const communications = Array.from((collections.get("renewalNoticeCommunications") || new Map()).values());
    expect(communications[0]).toEqual(
      expect.objectContaining({
        status: "email_failed",
        deliveryStatus: "failed",
        deliveryStatusSource: "send_response",
        deliveryStatusReason: "mailgun_send_failed:500",
        tenantNotified: false,
        noticeServed: false,
        legalServiceEstablished: false,
        errorCode: "EMAIL_SEND_FAILED",
      })
    );
    expect(collections.get("leaseNotices")).toBeUndefined();
    expect(collections.get("leases")).toBeUndefined();
  });

  it("writes landlord-visible audit and canonical events for attempted and final states", async () => {
    await send();

    const legacyEvents = Array.from((collections.get("events") || new Map()).values());
    const canonicalEvents = Array.from((collections.get("canonicalEvents") || new Map()).values());
    expect(legacyEvents.map((event: any) => event.type)).toEqual([
      "renewal_notice_send_confirmed",
      "renewal_notice_email_send_attempted",
      "renewal_notice_email_sent",
    ]);
    expect(canonicalEvents.map((event: any) => event.type)).toEqual([
      "renewal_notice_send_confirmed",
      "renewal_notice_email_send_attempted",
      "renewal_notice_email_sent",
    ]);
    expect(canonicalEvents[2]).toEqual(
      expect.objectContaining({
        visibility: "landlord",
        summary: "Renewal tenant communication email sent. Not served; legal service not established.",
        metadata: expect.objectContaining({
          deliveryStatus: "accepted_for_sending",
          deliveryStatusSource: "send_response",
          providerMessageId: "<provider-message@mg.example.com>",
          tenantNotified: true,
          noticeServed: false,
          legalServiceEstablished: false,
        }),
      })
    );
  });
});
