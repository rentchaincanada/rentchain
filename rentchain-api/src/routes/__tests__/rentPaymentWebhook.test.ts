import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  store,
  ensureCollection,
  constructEventMock,
  docRef,
  normalizeRentPaymentProviderEventMock,
  deriveRentPaymentReconciliationMock,
  buildProviderWebhookIdempotencyKeyMock,
  derivePaymentDuplicateSuppressionDecisionMock,
} = vi.hoisted(() => {
  const store = new Map<string, Map<string, any>>();

  function ensureCollection(name: string) {
    if (!store.has(name)) store.set(name, new Map());
    return store.get(name)!;
  }

  function docRef(collectionName: string, docId: string) {
    return {
      id: docId,
      path: `${collectionName}/${docId}`,
      get: async () => ({
        exists: ensureCollection(collectionName).has(docId),
        data: () => ensureCollection(collectionName).get(docId),
      }),
      set: async (payload: Record<string, unknown>, options?: { merge?: boolean }) => {
        const col = ensureCollection(collectionName);
        const existing = col.get(docId) || {};
        col.set(docId, options?.merge ? { ...existing, ...payload } : payload);
      },
    };
  }

  return {
    store,
    ensureCollection,
    constructEventMock: vi.fn(),
    docRef,
    normalizeRentPaymentProviderEventMock: vi.fn((input: any) => {
      const failed = String(input.rawEvent?.type || "").includes("failed");
      return {
        provider: "stripe",
        providerEventId: input.providerEventId || input.rawEvent?.id || null,
        providerPaymentId: input.providerPaymentId || null,
        providerSessionId: input.providerSessionId || null,
        rawStatus: failed ? "failed" : "paid",
        normalizedStatus: failed ? "failed" : "confirmed",
        purpose: input.purpose || null,
        amount: 180000,
        currency: "CAD",
        metadata: input.rawEvent?.data?.object?.metadata || null,
      };
    }),
    deriveRentPaymentReconciliationMock: vi.fn(() => ({
      reconciliationStatus: "reconciled",
      reasons: ["provider_confirmed_amount_currency_match"],
      automationEligible: true,
      requiresManualReview: false,
    })),
    buildProviderWebhookIdempotencyKeyMock: vi.fn(
      (input: any) => `provider_event:${input.provider}:${input.providerEventId}`
    ),
    derivePaymentDuplicateSuppressionDecisionMock: vi.fn((input: any) => ({
      shouldSuppress: input.receipt?.status === "processed" || input.receipt?.status === "ignored_duplicate",
      reason:
        input.receipt?.status === "ignored_duplicate"
          ? "provider_event_duplicate_already_recorded"
          : "provider_event_not_processed_yet",
      existingReceiptStatus: input.receipt?.status || null,
      duplicateCount: input.receipt?.duplicateCount || 0,
      safeToAcknowledge: input.receipt?.status === "processed" || input.receipt?.status === "ignored_duplicate",
      requiresManualReview: false,
    })),
  };
});

vi.mock("../../config/firebase", () => ({
  db: {
    collection: vi.fn((name: string) => ({
      doc: (id: string) => docRef(name, id),
      where: (field: string, op: string, value: any) => ({
        limit: (count: number) => ({
          get: async () => {
            const docs = Array.from(ensureCollection(name).entries())
              .filter(([, data]) => (op === "==" ? data?.[field] === value : true))
              .slice(0, count)
              .map(([id, data]) => ({
                id,
                ref: docRef(name, id),
                data: () => data,
              }));
            return { empty: docs.length === 0, docs };
          },
        }),
        get: async () => {
          const docs = Array.from(ensureCollection(name).entries())
            .filter(([, data]) => (op === "==" ? data?.[field] === value : true))
            .map(([id, data]) => ({
              id,
              ref: docRef(name, id),
              data: () => data,
            }));
          return { empty: docs.length === 0, docs };
        },
      }),
    })),
  },
}));

vi.mock("../../config/screeningConfig", () => ({
  STRIPE_WEBHOOK_SECRET: "whsec_test",
}));

vi.mock("../../services/stripeService", () => ({
  getStripeClient: () => ({
    webhooks: {
      constructEvent: constructEventMock,
    },
    checkout: {
      sessions: {
        list: vi.fn(async () => ({ data: [] })),
      },
    },
  }),
}));

vi.mock("../../lib/stripeNotConfigured", () => ({
  stripeNotConfiguredResponse: () => ({ ok: false, error: "stripe_not_configured" }),
  isStripeNotConfiguredError: () => false,
}));

vi.mock("../../services/screening/screeningOrchestrator", () => ({
  beginScreening: vi.fn(async () => ({ ok: true })),
}));

vi.mock("../../services/stripeFinalize", () => ({
  finalizeStripePayment: vi.fn(async () => ({ ok: true })),
}));

vi.mock("../../services/stripeScreeningProcessor", () => ({
  applyScreeningResultsFromOrder: vi.fn(async () => ({ ok: true })),
}));

vi.mock("../../services/screeningPaymentTransactionService", () => ({
  recordScreeningPaymentFailed: vi.fn(async () => undefined),
}));

vi.mock("../../lib/payments/paymentExecutionService", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../lib/payments/paymentExecutionService")>();
  return {
    ...actual,
    normalizeRentPaymentProviderEvent: normalizeRentPaymentProviderEventMock,
    deriveRentPaymentReconciliation: deriveRentPaymentReconciliationMock,
  };
});

vi.mock("../../lib/payments/paymentIdempotency", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../lib/payments/paymentIdempotency")>();
  return {
    ...actual,
    buildProviderWebhookIdempotencyKey: buildProviderWebhookIdempotencyKeyMock,
  };
});

vi.mock("../../lib/payments/paymentDuplicateSuppression", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../lib/payments/paymentDuplicateSuppression")>();
  return {
    ...actual,
    derivePaymentDuplicateSuppressionDecision: derivePaymentDuplicateSuppressionDecisionMock,
  };
});

async function invokeWebhook(body: string) {
  const { stripeWebhookHandler } = await import("../stripeScreeningOrdersWebhookRoutes");
  return await new Promise<{ status: number; body: any; text?: string }>((resolve, reject) => {
    const req: any = {
      body: Buffer.from(body),
      headers: {
        "stripe-signature": "t=1,v1=test",
      },
    };
    const res: any = {
      statusCode: 200,
      status(code: number) {
        this.statusCode = code;
        return this;
      },
      json(payload: any) {
        resolve({ status: this.statusCode, body: payload });
        return this;
      },
      send(payload: any) {
        resolve({ status: this.statusCode, body: null, text: String(payload || "") });
        return this;
      },
    };
    stripeWebhookHandler(req, res).catch(reject);
  });
}

describe("rent payment webhook reconciliation", () => {
  beforeEach(() => {
    store.clear();
    constructEventMock.mockReset();
    normalizeRentPaymentProviderEventMock.mockClear();
    deriveRentPaymentReconciliationMock.mockClear();
    buildProviderWebhookIdempotencyKeyMock.mockClear();
    derivePaymentDuplicateSuppressionDecisionMock.mockClear();
    normalizeRentPaymentProviderEventMock.mockImplementation((input: any) => {
      const failed = String(input.rawEvent?.type || "").includes("failed");
      return {
        provider: "stripe",
        providerEventId: input.providerEventId || input.rawEvent?.id || null,
        providerPaymentId: input.providerPaymentId || null,
        providerSessionId: input.providerSessionId || null,
        rawStatus: failed ? "failed" : "paid",
        normalizedStatus: failed ? "failed" : "confirmed",
        purpose: input.purpose || null,
        amount: 180000,
        currency: "CAD",
        metadata: input.rawEvent?.data?.object?.metadata || null,
      };
    });
    deriveRentPaymentReconciliationMock.mockReturnValue({
      reconciliationStatus: "reconciled",
      reasons: ["provider_confirmed_amount_currency_match"],
      automationEligible: true,
      requiresManualReview: false,
    });
    buildProviderWebhookIdempotencyKeyMock.mockImplementation(
      (input: any) => `provider_event:${input.provider}:${input.providerEventId}`
    );
    ensureCollection("rentPayments").set("rp-1", {
      id: "rp-1",
      leaseId: "lease-1",
      tenantId: "tenant-1",
      landlordId: "landlord-1",
      amountCents: 180000,
      currency: "cad",
      status: "checkout_created",
      processor: "stripe",
      processorCheckoutSessionId: "cs_test_1",
      processorPaymentIntentId: "pi_test_1",
      createdAt: "2026-04-27T10:00:00.000Z",
      updatedAt: "2026-04-27T10:00:00.000Z",
      paidAt: null,
    });
  });

  it("marks a rent payment paid idempotently from checkout completion metadata", async () => {
    constructEventMock.mockReturnValue({
      id: "evt_rent_paid_1",
      created: 1_714_213_200,
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_test_1",
          payment_intent: "pi_test_1",
          payment_status: "paid",
          metadata: {
            rentPaymentId: "rp-1",
            leaseId: "lease-1",
            tenantId: "tenant-1",
            landlordId: "landlord-1",
          },
        },
      },
    });

    const first = await invokeWebhook('{"id":"evt_rent_paid_1","type":"checkout.session.completed"}');
    const second = await invokeWebhook('{"id":"evt_rent_paid_1","type":"checkout.session.completed"}');

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);

    expect(normalizeRentPaymentProviderEventMock).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: "stripe",
        providerEventId: "evt_rent_paid_1",
        providerPaymentId: "pi_test_1",
        providerSessionId: "cs_test_1",
        purpose: "rent",
      })
    );
    expect(buildProviderWebhookIdempotencyKeyMock).toHaveBeenCalledWith({
      provider: "stripe",
      providerEventId: "evt_rent_paid_1",
    });
    expect(deriveRentPaymentReconciliationMock).toHaveBeenCalledWith({
      expectedIntent: expect.objectContaining({
        paymentIntentId: "rp-1",
        landlordId: "landlord-1",
        tenantId: "tenant-1",
        leaseId: "lease-1",
        amount: 180000,
        currency: "cad",
        purpose: "rent",
        provider: "stripe",
      }),
      providerSignal: expect.objectContaining({
        provider: "stripe",
        providerEventId: "evt_rent_paid_1",
      }),
    });
    expect(derivePaymentDuplicateSuppressionDecisionMock).toHaveBeenCalledTimes(2);
    expect(derivePaymentDuplicateSuppressionDecisionMock).toHaveBeenNthCalledWith(1, {
      receipt: expect.objectContaining({
        status: "received",
        duplicateCount: 0,
      }),
    });
    expect(derivePaymentDuplicateSuppressionDecisionMock).toHaveBeenNthCalledWith(2, {
      receipt: expect.objectContaining({
        status: "processed",
        duplicateCount: 0,
      }),
    });

    const stored = ensureCollection("rentPayments").get("rp-1");
    expect(stored).toEqual(
      expect.objectContaining({
        status: "paid",
        processorCheckoutSessionId: "cs_test_1",
        processorPaymentIntentId: "pi_test_1",
        paidAt: expect.any(String),
      })
    );
    expect(stored).not.toHaveProperty("reconciliationStatus");
    expect(stored).not.toHaveProperty("providerEventReceiptId");

    const receipt = ensureCollection("paymentProviderEventReceipts").get("provider_event:stripe:evt_rent_paid_1");
    expect(receipt).toEqual(
      expect.objectContaining({
        receiptId: "provider_event:stripe:evt_rent_paid_1",
        idempotencyKey: "provider_event:stripe:evt_rent_paid_1",
        provider: "stripe",
        providerEventId: "evt_rent_paid_1",
        purpose: "rent",
        subjectType: "rent_payment",
        subjectId: "rp-1",
        status: "ignored_duplicate",
        duplicateCount: 1,
        normalizedStatus: "confirmed",
        rawStatus: "paid",
      })
    );
    const reconciliationRecord = ensureCollection("paymentReconciliationRecords").get("provider_event:stripe:evt_rent_paid_1");
    expect(reconciliationRecord).toEqual(
      expect.objectContaining({
        reconciliationId: "provider_event:stripe:evt_rent_paid_1",
        provider: "stripe",
        providerEventId: "evt_rent_paid_1",
        idempotencyKey: "provider_event:stripe:evt_rent_paid_1",
        receiptId: "provider_event:stripe:evt_rent_paid_1",
        subjectType: "rent_payment",
        subjectId: "rp-1",
        purpose: "rent",
        normalizedStatus: "confirmed",
        rawStatus: "paid",
        reconciliationStatus: "reconciled",
        reasons: ["provider_confirmed_amount_currency_match"],
        requiresManualReview: false,
        automationEligible: true,
      })
    );
    expect(ensureCollection("paymentReconciliationRecords").size).toBe(1);

    const canonicalEvents = Array.from(ensureCollection("canonicalEvents").values());
    const providerSignalEvents = canonicalEvents.filter((event: any) => event.type === "payment.provider_signal_received");
    expect(providerSignalEvents).toHaveLength(2);
    expect(providerSignalEvents[0]).toEqual(
      expect.objectContaining({
        domain: "payment",
        action: "provider_signal_received",
        status: "confirmed",
        resource: expect.objectContaining({
          type: "provider_event_receipt",
          id: "provider_event:stripe:evt_rent_paid_1",
          parentType: "rent_payment",
          parentId: "rp-1",
        }),
        metadata: expect.objectContaining({
          provider: "stripe",
          providerEventId: "evt_rent_paid_1",
          idempotencyKey: "provider_event:stripe:evt_rent_paid_1",
          receiptId: "provider_event:stripe:evt_rent_paid_1",
          purpose: "rent",
          normalizedStatus: "confirmed",
          rawStatus: "paid",
          subjectType: "rent_payment",
          subjectId: "rp-1",
        }),
      })
    );
    expect(canonicalEvents.filter((event: any) => event.type === "rent_payment.paid")).toHaveLength(1);
    const rentPaidEvent = canonicalEvents.find((event: any) => event.type === "rent_payment.paid");
    expect(JSON.stringify(rentPaidEvent || {})).not.toContain("card");
    expect(JSON.stringify(rentPaidEvent || {})).not.toContain("receipt");
    expect(JSON.stringify(rentPaidEvent || {})).not.toContain("@");
  });

  it("acknowledges already-processed duplicate rent webhooks without rerunning the rent payment update", async () => {
    constructEventMock.mockReturnValue({
      id: "evt_rent_paid_1",
      created: 1_714_213_200,
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_test_1",
          payment_intent: "pi_test_1",
          payment_status: "paid",
          metadata: {
            rentPaymentId: "rp-1",
            leaseId: "lease-1",
            tenantId: "tenant-1",
            landlordId: "landlord-1",
          },
        },
      },
    });

    const first = await invokeWebhook('{"id":"evt_rent_paid_1","type":"checkout.session.completed"}');
    ensureCollection("rentPayments").set("rp-1", {
      ...ensureCollection("rentPayments").get("rp-1"),
      status: "checkout_created",
      updatedAt: "2026-04-27T10:00:00.000Z",
      paidAt: null,
    });
    const duplicate = await invokeWebhook('{"id":"evt_rent_paid_1","type":"checkout.session.completed"}');

    expect(first.status).toBe(200);
    expect(duplicate.status).toBe(200);
    expect(ensureCollection("rentPayments").get("rp-1")).toEqual(
      expect.objectContaining({
        status: "checkout_created",
        updatedAt: "2026-04-27T10:00:00.000Z",
        paidAt: null,
      })
    );
    expect(ensureCollection("paymentProviderEventReceipts").get("provider_event:stripe:evt_rent_paid_1")).toEqual(
      expect.objectContaining({
        status: "ignored_duplicate",
        duplicateCount: 1,
      })
    );
    expect(derivePaymentDuplicateSuppressionDecisionMock).toHaveBeenNthCalledWith(2, {
      receipt: expect.objectContaining({
        status: "processed",
        duplicateCount: 0,
      }),
    });
    expect(Array.from(ensureCollection("canonicalEvents").values()).filter((event: any) => event.type === "rent_payment.paid")).toHaveLength(1);
  });

  it("does not suppress duplicate rent webhooks when the previous receipt failed", async () => {
    ensureCollection("paymentProviderEventReceipts").set("provider_event:stripe:evt_rent_paid_failed_receipt", {
      receiptId: "provider_event:stripe:evt_rent_paid_failed_receipt",
      idempotencyKey: "provider_event:stripe:evt_rent_paid_failed_receipt",
      provider: "stripe",
      providerEventId: "evt_rent_paid_failed_receipt",
      purpose: "rent",
      subjectType: "rent_payment",
      subjectId: "rp-1",
      status: "failed",
      firstReceivedAt: "2026-04-27T10:00:00.000Z",
      lastSeenAt: "2026-04-27T10:00:00.000Z",
      duplicateCount: 0,
      normalizedStatus: "confirmed",
      rawStatus: "paid",
    });
    constructEventMock.mockReturnValue({
      id: "evt_rent_paid_failed_receipt",
      created: 1_714_213_200,
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_test_1",
          payment_intent: "pi_test_1",
          payment_status: "paid",
          metadata: {
            rentPaymentId: "rp-1",
          },
        },
      },
    });

    const res = await invokeWebhook('{"id":"evt_rent_paid_failed_receipt","type":"checkout.session.completed"}');

    expect(res.status).toBe(200);
    expect(derivePaymentDuplicateSuppressionDecisionMock).toHaveBeenCalledWith({
      receipt: expect.objectContaining({
        status: "failed",
        duplicateCount: 0,
      }),
    });
    expect(ensureCollection("rentPayments").get("rp-1")).toEqual(
      expect.objectContaining({
        status: "paid",
        processorCheckoutSessionId: "cs_test_1",
        processorPaymentIntentId: "pi_test_1",
      })
    );
  });

  it("updates a rent payment to failed from async payment failure metadata", async () => {
    constructEventMock.mockReturnValue({
      id: "evt_rent_failed_1",
      created: 1_714_213_200,
      type: "checkout.session.async_payment_failed",
      data: {
        object: {
          id: "cs_test_1",
          payment_intent: "pi_test_1",
          metadata: {
            rentPaymentId: "rp-1",
            leaseId: "lease-1",
            tenantId: "tenant-1",
            landlordId: "landlord-1",
          },
        },
      },
    });

    const res = await invokeWebhook('{"id":"evt_rent_failed_1","type":"checkout.session.async_payment_failed"}');

    expect(res.status).toBe(200);
    expect(normalizeRentPaymentProviderEventMock).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: "stripe",
        providerEventId: "evt_rent_failed_1",
        providerPaymentId: "pi_test_1",
        providerSessionId: "cs_test_1",
        purpose: "rent",
      })
    );
    expect(ensureCollection("rentPayments").get("rp-1")).toEqual(
      expect.objectContaining({
        status: "failed",
        processorCheckoutSessionId: "cs_test_1",
        processorPaymentIntentId: "pi_test_1",
      })
    );
    expect(ensureCollection("paymentProviderEventReceipts").get("provider_event:stripe:evt_rent_failed_1")).toEqual(
      expect.objectContaining({
        provider: "stripe",
        providerEventId: "evt_rent_failed_1",
        purpose: "rent",
        status: "processed",
        duplicateCount: 0,
        normalizedStatus: "failed",
        rawStatus: "failed",
      })
    );
    expect(ensureCollection("paymentReconciliationRecords").get("provider_event:stripe:evt_rent_failed_1")).toEqual(
      expect.objectContaining({
        reconciliationId: "provider_event:stripe:evt_rent_failed_1",
        providerEventId: "evt_rent_failed_1",
        receiptId: "provider_event:stripe:evt_rent_failed_1",
        reconciliationStatus: "reconciled",
        reasons: ["provider_confirmed_amount_currency_match"],
      })
    );

    const canonicalEvents = Array.from(ensureCollection("canonicalEvents").values());
    const providerSignalEvent = canonicalEvents.find((event: any) => event.type === "payment.provider_signal_received");
    expect(providerSignalEvent).toEqual(
      expect.objectContaining({
        status: "failed",
        metadata: expect.objectContaining({
          providerEventId: "evt_rent_failed_1",
          receiptId: "provider_event:stripe:evt_rent_failed_1",
          normalizedStatus: "failed",
          rawStatus: "failed",
        }),
      })
    );
    expect(canonicalEvents.some((event: any) => event.type === "rent_payment.failed")).toBe(true);
  });

  it("does not run rent normalization for screening checkout webhooks", async () => {
    constructEventMock.mockReturnValue({
      id: "evt_screening_paid_1",
      created: 1_714_213_200,
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_screening_1",
          payment_intent: "pi_screening_1",
          payment_status: "paid",
          client_reference_id: "order-1",
          metadata: {
            orderId: "order-1",
            applicationId: "app-1",
            landlordId: "landlord-1",
          },
        },
      },
    });

    ensureCollection("rentalApplications").set("app-1", {
      id: "app-1",
      landlordId: "landlord-1",
      screeningStatus: "pending_payment",
      screeningSessionId: "",
    });

    const res = await invokeWebhook('{"id":"evt_screening_paid_1","type":"checkout.session.completed"}');

    expect(res.status).toBe(200);
    expect(normalizeRentPaymentProviderEventMock).not.toHaveBeenCalled();
    expect(buildProviderWebhookIdempotencyKeyMock).not.toHaveBeenCalled();
    expect(deriveRentPaymentReconciliationMock).not.toHaveBeenCalled();
    expect(derivePaymentDuplicateSuppressionDecisionMock).not.toHaveBeenCalled();
    expect(Array.from(ensureCollection("paymentProviderEventReceipts").values())).toHaveLength(0);
    expect(Array.from(ensureCollection("paymentReconciliationRecords").values())).toHaveLength(0);
    expect(
      Array.from(ensureCollection("canonicalEvents").values()).some(
        (event: any) => event.type === "payment.provider_signal_received"
      )
    ).toBe(false);
  });

  it("does not run rent normalization for subscription webhooks", async () => {
    constructEventMock.mockReturnValue({
      id: "evt_subscription_1",
      created: 1_714_213_200,
      type: "customer.subscription.updated",
      data: {
        object: {
          id: "sub_1",
          customer: "cus_1",
          status: "active",
          metadata: {
            landlordId: "landlord-1",
          },
          items: {
            data: [],
          },
        },
      },
    });

    const res = await invokeWebhook('{"id":"evt_subscription_1","type":"customer.subscription.updated"}');

    expect(res.status).toBe(200);
    expect(normalizeRentPaymentProviderEventMock).not.toHaveBeenCalled();
    expect(buildProviderWebhookIdempotencyKeyMock).not.toHaveBeenCalled();
    expect(deriveRentPaymentReconciliationMock).not.toHaveBeenCalled();
    expect(derivePaymentDuplicateSuppressionDecisionMock).not.toHaveBeenCalled();
    expect(Array.from(ensureCollection("paymentProviderEventReceipts").values())).toHaveLength(0);
    expect(Array.from(ensureCollection("paymentReconciliationRecords").values())).toHaveLength(0);
    expect(
      Array.from(ensureCollection("canonicalEvents").values()).some(
        (event: any) => event.type === "payment.provider_signal_received"
      )
    ).toBe(false);
  });

  it("persists manual review reconciliation without changing webhook response or rent payment update", async () => {
    deriveRentPaymentReconciliationMock.mockReturnValueOnce({
      reconciliationStatus: "manual_review_required",
      reasons: ["missing_internal_subject_reference"],
      automationEligible: false,
      requiresManualReview: true,
    });
    constructEventMock.mockReturnValue({
      id: "evt_rent_manual_review_1",
      created: 1_714_213_200,
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_test_1",
          payment_intent: "pi_test_1",
          payment_status: "paid",
          metadata: {
            rentPaymentId: "rp-1",
          },
        },
      },
    });

    const res = await invokeWebhook('{"id":"evt_rent_manual_review_1","type":"checkout.session.completed"}');

    expect(res.status).toBe(200);
    expect(ensureCollection("rentPayments").get("rp-1")).toEqual(
      expect.objectContaining({
        status: "paid",
        processorCheckoutSessionId: "cs_test_1",
        processorPaymentIntentId: "pi_test_1",
      })
    );
    expect(ensureCollection("paymentReconciliationRecords").get("provider_event:stripe:evt_rent_manual_review_1")).toEqual(
      expect.objectContaining({
        reconciliationStatus: "manual_review_required",
        reasons: ["missing_internal_subject_reference"],
        requiresManualReview: true,
        automationEligible: false,
        receiptId: "provider_event:stripe:evt_rent_manual_review_1",
        idempotencyKey: "provider_event:stripe:evt_rent_manual_review_1",
      })
    );
    expect(ensureCollection("paymentProviderEventReceipts").get("provider_event:stripe:evt_rent_manual_review_1")).toEqual(
      expect.objectContaining({
        status: "manual_review_required",
        failureReason: "missing_internal_subject_reference",
      })
    );
  });
});
