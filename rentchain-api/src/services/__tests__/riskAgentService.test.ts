import { beforeEach, describe, expect, it, vi } from "vitest";

type StoredDoc = { id: string; data: any };

const state = vi.hoisted(() => ({
  collections: new Map<string, Map<string, StoredDoc>>(),
}));

function resetDb() {
  state.collections = new Map();
}

function ensureCollection(name: string) {
  if (!state.collections.has(name)) state.collections.set(name, new Map());
  return state.collections.get(name)!;
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

function seedDoc(name: string, id: string, data: any) {
  ensureCollection(name).set(id, { id, data: clone(data) });
}

vi.mock("../../config/firebase", () => ({
  db: {
    collection(name: string) {
      return {
        doc(id?: string) {
          const docId = id || `auto-${ensureCollection(name).size + 1}`;
          return {
            id: docId,
            async get() {
              const stored = ensureCollection(name).get(docId);
              return {
                id: docId,
                exists: Boolean(stored),
                data: () => (stored ? clone(stored.data) : undefined),
              };
            },
            async set(payload: any, options?: { merge?: boolean }) {
              const existing = ensureCollection(name).get(docId);
              const next =
                options?.merge && existing
                  ? { ...clone(existing.data), ...clone(payload) }
                  : clone(payload);
              ensureCollection(name).set(docId, { id: docId, data: next });
            },
          };
        },
        where(field: string, op: string, value: any) {
          return {
            limit(count: number) {
              return {
                async get() {
                  const docs = Array.from(ensureCollection(name).values())
                    .filter((entry) => {
                      const current = entry.data?.[field];
                      if (op === "==") return current === value;
                      if (op === "array-contains") return Array.isArray(current) && current.includes(value);
                      return false;
                    })
                    .slice(0, count)
                    .map((entry) => ({
                      id: entry.id,
                      exists: true,
                      data: () => clone(entry.data),
                    }));
                  return { docs, empty: docs.length === 0 };
                },
              };
            },
          };
        },
      };
    },
  },
}));

vi.mock("../ledgerEventsFirestoreService", () => ({
  listLedgerEventsV2: vi.fn(async () => ({
    items: [{ id: "evt-1", tenantId: "tenant-1", type: "late_payment" }],
  })),
}));

vi.mock("../tenantSignalsService", () => ({
  computeTenantSignals: vi.fn(() => ({
    latePaymentsCount: 1,
  })),
}));

describe("riskAgentService", () => {
  beforeEach(() => {
    resetDb();

    seedDoc("rentalApplications", "app-1", {
      landlordId: "landlord-1",
      propertyId: "prop-1",
      tenantId: "tenant-1",
      requestedRent: 1800,
      monthlyIncome: 5200,
      status: "IN_REVIEW",
      applicant: {
        firstName: "Jordan",
        lastName: "Lee",
        email: "jordan@example.com",
      },
      applicantProfile: {
        currentAddress: {
          line1: "123 Main St",
          city: "Halifax",
          provinceState: "NS",
          postalCode: "B3H1A1",
          country: "CA",
        },
        timeAtCurrentAddressMonths: 18,
        currentRentAmountCents: 170000,
        employment: {
          employerName: "Harbour Labs",
          jobTitle: "Designer",
          incomeAmountCents: 520000,
          incomeFrequency: "monthly",
          monthsAtJob: 14,
        },
        workReference: {
          name: "Taylor Grant",
          phone: "555-555-0100",
        },
        signature: {
          type: "typed",
          signedAt: "2026-03-18T10:00:00.000Z",
        },
      },
      applicationConsent: {
        acceptedAt: "2026-03-18T10:00:00.000Z",
        version: "v1.0",
      },
      screeningStatus: "complete",
      screeningProvider: "TransUnion",
      screeningResultId: "screening-result-1",
      screeningResultSummary: {
        overall: "pass",
        scoreBand: "B",
      },
    });

    seedDoc("screeningResults", "screening-result-1", {
      status: "completed",
      identityVerified: true,
    });

    seedDoc("leases", "lease-1", {
      tenantId: "tenant-1",
      propertyId: "prop-1",
      status: "draft",
    });

    seedDoc("payments", "payment-1", {
      tenantId: "tenant-1",
      amount: 1800,
    });
  });

  it("persists a structured run and latest snapshot", async () => {
    const { evaluateApplicationRisk, getLatestApplicationRisk } = await import("../riskAgent/riskAgentService");

    const result = await evaluateApplicationRisk({ applicationId: "app-1" });

    expect(result.run.version).toBe("risk-v1");
    expect(typeof result.run.score).toBe("number");
    expect(Array.isArray(result.run.factors)).toBe(true);
    expect(Array.isArray(result.run.flags)).toBe(true);
    expect(Array.isArray(result.run.recommendations)).toBe(true);

    const latest = await getLatestApplicationRisk({ applicationId: "app-1" });
    expect(latest?.latestRunId).toBe(result.run.id);
    expect(latest?.applicationId).toBe("app-1");
  });

  it("includes version, score, factors, flags, and recommendations in the stored output", async () => {
    const { evaluateApplicationRisk } = await import("../riskAgent/riskAgentService");

    const result = await evaluateApplicationRisk({ applicationId: "app-1" });

    expect(result.latest).toEqual(
      expect.objectContaining({
        version: "risk-v1",
        score: expect.any(Number),
        factors: expect.any(Array),
        flags: expect.any(Array),
        recommendations: expect.any(Array),
      })
    );
  });
});
