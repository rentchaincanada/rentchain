import { beforeEach, describe, expect, it, vi } from "vitest";

const { collections, dbMock } = vi.hoisted(() => {
  const collections = new Map<string, Map<string, any>>();

  function ensureCollection(name: string) {
    if (!collections.has(name)) collections.set(name, new Map<string, any>());
    return collections.get(name)!;
  }

  function docRef(name: string, id: string) {
    return {
      async get() {
        const data = ensureCollection(name).get(id);
        return {
          exists: Boolean(data),
          data: () => data,
        };
      },
      async set(payload: Record<string, unknown>, options?: { merge?: boolean }) {
        const existing = ensureCollection(name).get(id) || {};
        ensureCollection(name).set(id, options?.merge ? { ...existing, ...payload } : payload);
      },
    };
  }

  return {
    collections,
    dbMock: {
      collection: (name: string) => ({
        doc: (id: string) => docRef(name, id),
        where: (field: string, op: string, value: unknown) => ({
          limit: (count: number) => ({
            async get() {
              const docs = Array.from(ensureCollection(name).entries())
                .filter(([, data]) => (op === "==" ? data?.[field] === value : false))
                .slice(0, count)
                .map(([id, data]) => ({
                  id,
                  data: () => data,
                }));
              return { empty: docs.length === 0, docs };
            },
          }),
        }),
      }),
    },
  };
});

vi.mock("../../../config/firebase", () => ({
  db: dbMock,
}));

import {
  buildPaymentIntentId,
  findPaymentIntentByRentPaymentId,
  linkPaymentIntentProviderReference,
  PAYMENT_INTENTS_COLLECTION,
  updatePaymentIntentFromProviderSignal,
  upsertPaymentIntent,
} from "../paymentIntents";

const baseIntentInput = {
  landlordId: "landlord-1",
  tenantId: "tenant-1",
  propertyId: "property-1",
  unitId: "unit-1",
  leaseId: "lease-1",
  rentPaymentId: "rp-1",
  purpose: "rent" as const,
  amountCents: 180000,
  currency: "cad",
  source: "rent_payment_checkout" as const,
  now: "2026-05-05T12:00:00.000Z",
};

describe("paymentIntents", () => {
  beforeEach(() => {
    collections.clear();
  });

  it("builds deterministic rent PaymentIntent IDs from obligation fields", () => {
    const first = buildPaymentIntentId(baseIntentInput);
    const second = buildPaymentIntentId({
      ...baseIntentInput,
      rentPaymentId: "rp-retry",
    });

    expect(first).toMatch(/^pi_rent_[a-f0-9]{32}$/);
    expect(second).toBe(first);
  });

  it("creates and upserts duplicate rent PaymentIntents without duplicate records", async () => {
    const first = await upsertPaymentIntent(baseIntentInput);
    const duplicate = await upsertPaymentIntent({
      ...baseIntentInput,
      rentPaymentId: "rp-2",
      now: "2026-05-05T12:05:00.000Z",
    });

    expect(first.created).toBe(true);
    expect(duplicate.created).toBe(false);
    expect(duplicate.paymentIntent.paymentIntentId).toBe(first.paymentIntent.paymentIntentId);
    expect(duplicate.paymentIntent.rentPaymentId).toBe("rp-2");
    expect(duplicate.paymentIntent.amountCents).toBe(180000);
    expect(duplicate.paymentIntent.currency).toBe("cad");
    expect(duplicate.paymentIntent.status).toBe("ready");
    expect(duplicate.paymentIntent.lifecycleState).toBe("complete");
    expect(collections.get(PAYMENT_INTENTS_COLLECTION)?.size).toBe(1);
  });

  it("links provider session references without storing raw provider payloads", async () => {
    const created = await upsertPaymentIntent(baseIntentInput);
    const linked = await linkPaymentIntentProviderReference({
      paymentIntentId: created.paymentIntent.paymentIntentId,
      provider: "stripe",
      providerSessionId: "cs_test_1",
      providerPaymentId: "pi_test_1",
      now: "2026-05-05T12:01:00.000Z",
    });

    expect(linked).toEqual(
      expect.objectContaining({
        paymentIntentId: created.paymentIntent.paymentIntentId,
        provider: "stripe",
        providerSessionId: "cs_test_1",
        providerPaymentId: "pi_test_1",
        status: "provider_session_created",
      })
    );
    expect(JSON.stringify(linked)).not.toContain("checkout.session");
    expect(JSON.stringify(linked)).not.toContain("card");
  });

  it("marks incomplete rent PaymentIntent data for review", async () => {
    const result = await upsertPaymentIntent({
      purpose: "rent",
      rentPaymentId: "rp-review",
      amountCents: 180000,
      source: "rent_payment_checkout",
      now: "2026-05-05T12:00:00.000Z",
    });

    expect(result.paymentIntent).toEqual(
      expect.objectContaining({
        status: "manual_review_required",
        lifecycleState: "requires_review",
        requiresReview: true,
      })
    );
  });

  it("finds intents by rentPaymentId and updates provider signal status", async () => {
    const created = await upsertPaymentIntent(baseIntentInput);
    const found = await findPaymentIntentByRentPaymentId({ rentPaymentId: "rp-1" });
    const updated = await updatePaymentIntentFromProviderSignal({
      rentPaymentId: "rp-1",
      provider: "stripe",
      providerSessionId: "cs_test_1",
      providerPaymentId: "pi_test_1",
      normalizedStatus: "confirmed",
      now: "2026-05-05T12:02:00.000Z",
    });

    expect(found?.paymentIntentId).toBe(created.paymentIntent.paymentIntentId);
    expect(updated).toEqual(
      expect.objectContaining({
        paymentIntentId: created.paymentIntent.paymentIntentId,
        status: "confirmed",
        providerSessionId: "cs_test_1",
        providerPaymentId: "pi_test_1",
      })
    );
  });
});
