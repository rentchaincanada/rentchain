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

vi.mock("../../../firebase", () => ({
  db: dbMock,
}));

import { PAYMENT_INTENTS_COLLECTION, upsertPaymentIntent } from "../paymentIntents";
import {
  resolvePaymentIntentByLeaseContext,
  resolvePaymentIntentByMetadata,
  resolvePaymentIntentByRentPaymentId,
} from "../paymentIntentResolver";

describe("payment intent lease linking", () => {
  beforeEach(() => {
    collections.clear();
  });

  it("creates PaymentIntent records with lease and rentPayment linkage", async () => {
    const result = await upsertPaymentIntent({
      landlordId: "landlord-1",
      tenantId: "tenant-1",
      propertyId: "property-1",
      unitId: "unit-1",
      leaseId: "lease-1",
      rentPaymentId: "rp-1",
      purpose: "rent",
      amountCents: 180000,
      currency: "cad",
      source: "rent_payment_checkout",
      now: "2026-05-05T12:00:00.000Z",
    });

    expect(result.paymentIntent).toEqual(
      expect.objectContaining({
        leaseId: "lease-1",
        rentPaymentId: "rp-1",
        propertyId: "property-1",
        unitId: "unit-1",
        tenantId: "tenant-1",
      })
    );
  });

  it("resolves PaymentIntent by metadata, rentPaymentId, and lease context", async () => {
    const result = await upsertPaymentIntent({
      landlordId: "landlord-1",
      tenantId: "tenant-1",
      propertyId: "property-1",
      unitId: "unit-1",
      leaseId: "lease-1",
      rentPaymentId: "rp-1",
      purpose: "rent",
      amountCents: 180000,
      currency: "cad",
      source: "rent_payment_checkout",
      now: "2026-05-05T12:00:00.000Z",
    });

    await upsertPaymentIntent({
      landlordId: "landlord-1",
      tenantId: "tenant-2",
      propertyId: "property-1",
      unitId: "unit-2",
      leaseId: "lease-2",
      rentPaymentId: "rp-2",
      purpose: "rent",
      amountCents: 190000,
      currency: "cad",
      source: "rent_payment_checkout",
      now: "2026-05-05T12:01:00.000Z",
    });

    await expect(
      resolvePaymentIntentByMetadata({
        metadata: {
          paymentIntentId: result.paymentIntent.paymentIntentId,
        },
      })
    ).resolves.toEqual(expect.objectContaining({ paymentIntentId: result.paymentIntent.paymentIntentId }));
    await expect(resolvePaymentIntentByRentPaymentId({ rentPaymentId: "rp-1" })).resolves.toEqual(
      expect.objectContaining({ paymentIntentId: result.paymentIntent.paymentIntentId })
    );
    await expect(
      resolvePaymentIntentByLeaseContext({
        context: {
          landlordId: "landlord-1",
          tenantId: "tenant-1",
          propertyId: "property-1",
          unitId: "unit-1",
          leaseId: "lease-1",
          amountCents: 180000,
          currency: "cad",
        },
      })
    ).resolves.toEqual(expect.objectContaining({ paymentIntentId: result.paymentIntent.paymentIntentId }));
  });

  it("keeps duplicate checkout linkage on one deterministic PaymentIntent", async () => {
    const first = await upsertPaymentIntent({
      landlordId: "landlord-1",
      tenantId: "tenant-1",
      propertyId: "property-1",
      unitId: "unit-1",
      leaseId: "lease-1",
      rentPaymentId: "rp-1",
      purpose: "rent",
      amountCents: 180000,
      currency: "cad",
      source: "rent_payment_checkout",
    });
    const second = await upsertPaymentIntent({
      landlordId: "landlord-1",
      tenantId: "tenant-1",
      propertyId: "property-1",
      unitId: "unit-1",
      leaseId: "lease-1",
      rentPaymentId: "rp-2",
      purpose: "rent",
      amountCents: 180000,
      currency: "cad",
      source: "rent_payment_checkout",
    });

    expect(second.paymentIntent.paymentIntentId).toBe(first.paymentIntent.paymentIntentId);
    expect(second.paymentIntent.rentPaymentId).toBe("rp-2");
    expect(collections.get(PAYMENT_INTENTS_COLLECTION)?.size).toBe(1);
  });
});

