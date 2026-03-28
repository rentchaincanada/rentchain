import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

type StoredDoc = { id: string; data: any };

const { dbMock, resetDb, seedCollection, savedDocs } = vi.hoisted(() => {
  const collections = new Map<string, Map<string, StoredDoc>>();
  let generatedId = 0;

  function ensureCollection(name: string) {
    if (!collections.has(name)) collections.set(name, new Map());
    return collections.get(name)!;
  }

  return {
    dbMock: {
      collection: (name: string) => ({
        where: (field: string, _op: string, value: any) => ({
          limit: (_count: number) => ({
            async get() {
              const docs = Array.from(ensureCollection(name).values())
                .filter((entry) => entry.data?.[field] === value)
                .map((entry) => ({
                  id: entry.id,
                  data: () => entry.data,
                }));
              return {
                empty: docs.length === 0,
                docs,
              };
            },
          }),
        }),
        doc: (id?: string) => {
          const resolvedId = id || `generated-${++generatedId}`;
          return {
            id: resolvedId,
            async get() {
              const entry = ensureCollection(name).get(resolvedId);
              return {
                id: resolvedId,
                exists: Boolean(entry),
                data: () => entry?.data,
              };
            },
            async set(payload: any, options?: { merge?: boolean }) {
              const col = ensureCollection(name);
              if (options?.merge && col.has(resolvedId)) {
                const existing = col.get(resolvedId)!;
                col.set(resolvedId, { id: resolvedId, data: { ...(existing.data || {}), ...(payload || {}) } });
                return;
              }
              col.set(resolvedId, { id: resolvedId, data: payload || {} });
            },
          };
        },
      }),
    },
    resetDb: () => {
      collections.clear();
      generatedId = 0;
    },
    seedCollection: (name: string, id: string, data: any) => {
      ensureCollection(name).set(id, { id, data });
    },
    savedDocs: collections,
  };
});

vi.mock("../../config/firebase", () => ({ db: dbMock }));
vi.mock("../../middleware/rateLimit", () => ({
  rateLimitPublicApply: (_req: any, _res: any, next: any) => next(),
}));

async function createApp() {
  const router = (await import("../publicApplicationLinksRoutes")).default;
  const app = express();
  app.use(express.json());
  app.use("/public", router);
  return app;
}

function buildBody(overrides: Record<string, any> = {}) {
  return {
    token: "public-token",
    applicant: {
      firstName: "Jordan",
      lastName: "Lee",
      email: "jordan@example.com",
      dob: "1990-01-01",
    },
    residentialHistory: [{ address: "123 King St" }],
    consent: {
      creditConsent: true,
      referenceConsent: true,
      acceptedAt: Date.now(),
    },
    applicantProfile: {
      currentAddress: {
        line1: "123 King St",
        city: "Halifax",
        provinceState: "NS",
        postalCode: "B3H1A1",
      },
      timeAtCurrentAddressMonths: 18,
      currentRentAmountCents: 180000,
      employment: {
        employerName: "Harbour Labs",
        jobTitle: "Designer",
        incomeAmountCents: 720000,
        incomeFrequency: "monthly",
        monthsAtJob: 12,
      },
      workReference: {
        name: "Taylor Grant",
        phone: "5555550100",
      },
      signature: {
        type: "typed",
        typedName: "Jordan Lee",
        typedAcknowledge: true,
        signedAt: "2026-03-18T10:00:00.000Z",
      },
    },
    applicationConsent: {
      version: "v1.0",
      accepted: true,
      acceptedAt: "2026-03-18T10:00:00.000Z",
    },
    ...overrides,
  };
}

describe("publicApplicationLinksRoutes", () => {
  beforeEach(async () => {
    resetDb();
    const { createHash } = await import("crypto");
    const tokenHash = createHash("sha256").update("public-token").digest("hex");
    seedCollection("applicationLinks", "link-1", {
      tokenHash,
      status: "ACTIVE",
      expiresAt: Date.now() + 60_000,
      landlordId: "landlord-1",
      propertyId: "property-1",
      unitId: "unit-1",
    });
  });

  it("persists currentLeaseStatus on application create", async () => {
    const app = await createApp();
    const res = await request(app).post("/public/rental-applications").send(
      buildBody({
        currentLeaseStatus: {
          hasActiveLease: true,
          leaseEndDate: "2026-09-01",
          landlordAware: "no",
          reasonForMoving: "Need more space",
        },
      })
    );

    expect(res.status).toBe(200);
    const rentalApplications = savedDocs.get("rentalApplications");
    const stored = Array.from(rentalApplications?.values() || [])[0]?.data;
    expect(stored.currentLeaseStatus).toEqual({
      hasActiveLease: true,
      leaseEndDate: "2026-09-01",
      landlordAware: "no",
      reasonForMoving: "Need more space",
    });
  });

  it("accepts older applications that omit currentLeaseStatus", async () => {
    const app = await createApp();
    const res = await request(app).post("/public/rental-applications").send(buildBody());

    expect(res.status).toBe(200);
    const rentalApplications = savedDocs.get("rentalApplications");
    const stored = Array.from(rentalApplications?.values() || [])[0]?.data;
    expect(stored.currentLeaseStatus).toBeNull();
  });
});
