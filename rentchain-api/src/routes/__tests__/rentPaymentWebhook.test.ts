import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  store,
  ensureCollection,
  constructEventMock,
  docRef,
  normalizeRentPaymentProviderEventMock,
  deriveRentPaymentReconciliationMock,
  buildProviderWebhookIdempotencyKeyMock,
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
    normalizeRentPaymentProviderEventMock: vi.fn((input: any) => ({
      provider: "stripe",
      providerEventId: input.providerEventId || input.rawEvent?.id || null,
      providerPaymentId: input.providerPaymentId || null,
      providerSessionId: input.providerSessionId || null,
      rawStatus: "paid",
      normalizedStatus: "confirmed",
      purpose: input.purpose || null,
      amount: 180000,
      currency: "CAD",
      metadata: input.rawEvent?.data?.object?.metadata || null,
    })),
    deriveRentPaymentReconciliationMock: vi.fn(() => ({
      reconciliationStatus: "reconciled",
      reasons: ["provider_confirmed_amount_currency_match"],
      automationEligible: true,
      requiresManualReview: false,
    })),
    buildProviderWebhookIdempotencyKeyMock: vi.fn(
      (input: any) => `provider_event:${input.provider}:${input.providerEventId}`
    ),
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
    normalizeRentPaymentProviderEventMock.mockImplementation((input: any) => ({
      provider: "stripe",
      providerEventId: input.providerEventId || input.rawEvent?.id || null,
      providerPaymentId: input.providerPaymentId || null,
      providerSessionId: input.providerSessionId || null,
      rawStatus: "paid",
      normalizedStatus: "confirmed",
      purpose: input.purpose || null,
      amount: 180000,
      currency: "CAD",
      metadata: input.rawEvent?.data?.object?.metadata || null,
    }));
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

    const canonicalEvents = Array.from(ensureCollection("canonicalEvents").values());
    expect(canonicalEvents.filter((event: any) => event.type === "rent_payment.paid")).toHaveLength(1);
    expect(JSON.stringify(canonicalEvents[0] || {})).not.toContain("card");
    expect(JSON.stringify(canonicalEvents[0] || {})).not.toContain("receipt");
    expect(JSON.stringify(canonicalEvents[0] || {})).not.toContain("@");
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

    const canonicalEvents = Array.from(ensureCollection("canonicalEvents").values());
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
  });
});
