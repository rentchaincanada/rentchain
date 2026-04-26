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
  return router;
}

async function invokeRouter(router: any, options: { method: string; url: string; body?: any; headers?: Record<string, string> }) {
  return await new Promise<{ status: number; body: any }>((resolve, reject) => {
    const req: any = {
      method: options.method,
      url: options.url,
      originalUrl: options.url,
      path: options.url,
      body: options.body ?? {},
      headers: options.headers ?? {},
      get(name: string) {
        return this.headers[String(name).toLowerCase()];
      },
      header(name: string) {
        return this.get(name);
      },
      params: {},
      query: {},
      ip: "127.0.0.1",
    };
    const res: any = {
      statusCode: 200,
      headers: {} as Record<string, string>,
      setHeader(name: string, value: string) {
        this.headers[name.toLowerCase()] = value;
      },
      status(code: number) {
        this.statusCode = code;
        return this;
      },
      json(payload: any) {
        resolve({ status: this.statusCode, body: payload });
        return this;
      },
      send(payload: any) {
        resolve({ status: this.statusCode, body: payload });
        return this;
      },
    };
    router.handle(req, res, (error: any) => {
      if (error) reject(error);
    });
  });
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
    const router = await createApp();
    const res = await invokeRouter(router, {
      method: "POST",
      url: "/rental-applications",
      body:
      buildBody({
        currentLeaseStatus: {
          hasActiveLease: true,
          leaseEndDate: "2026-09-01",
          landlordAware: "no",
          reasonForMoving: "Need more space",
        },
      }),
    });

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
    const router = await createApp();
    const res = await invokeRouter(router, {
      method: "POST",
      url: "/rental-applications",
      body: buildBody(),
    });

    expect(res.status).toBe(200);
    const rentalApplications = savedDocs.get("rentalApplications");
    const stored = Array.from(rentalApplications?.values() || [])[0]?.data;
    expect(stored.currentLeaseStatus).toBeNull();
  });

  it("stores only safe partial progress metadata", async () => {
    const router = await createApp();
    const res = await invokeRouter(router, {
      method: "PATCH",
      url: "/application-links/public-token/progress",
      body: {
        partialProgress: {
          status: "in_progress",
          completionPercent: 62,
          currentStep: "employment",
          completedSections: ["personal_info", "residential_history"],
          missingSections: ["employment", "references_assets", "consent"],
          hasCoApplicant: false,
          viewingChoice: "already_viewed",
        },
      },
    });

    expect(res.status).toBe(200);
    const stored = savedDocs.get("applicationLinks")?.get("link-1")?.data;
    expect(stored.partialProgress).toMatchObject({
      status: "in_progress",
      completionPercent: 62,
      currentStep: "employment",
      completedSections: ["personal_info", "residential_history"],
      missingSections: ["employment", "references_assets", "consent"],
      hasCoApplicant: false,
      viewingChoice: "already_viewed",
    });
    expect(stored.partialProgress.startedAt).toBeTypeOf("number");
    expect(stored.partialProgress.lastActivityAt).toBeTypeOf("number");
    expect(stored.partialProgress.reminderEligibleAt).toBeTypeOf("number");
    expect(stored.partialProgress.applicant).toBeUndefined();
  });

  it("rejects unsafe partial progress fields", async () => {
    const router = await createApp();
    const res = await invokeRouter(router, {
      method: "PATCH",
      url: "/application-links/public-token/progress",
      body: {
        partialProgress: {
          status: "in_progress",
          completionPercent: 40,
          currentStep: "employment",
          completedSections: ["personal_info"],
          missingSections: ["employment"],
          hasCoApplicant: false,
          viewingChoice: "already_viewed",
          applicant: { firstName: "Jordan" },
        },
      },
    });

    expect(res.status).toBe(400);
    expect(res.body?.error).toBe("INVALID_PARTIAL_PROGRESS_FIELDS");
  });

  it("marks the application link partial progress as submitted on final submit", async () => {
    const router = await createApp();
    const res = await invokeRouter(router, {
      method: "POST",
      url: "/rental-applications",
      body: buildBody(),
    });

    expect(res.status).toBe(200);
    const stored = savedDocs.get("applicationLinks")?.get("link-1")?.data;
    expect(stored.partialProgress).toMatchObject({
      status: "submitted",
      completionPercent: 100,
      currentStep: null,
      missingSections: [],
      hasCoApplicant: false,
    });
    expect(stored.partialProgress.submittedAt).toBeTypeOf("number");
  });
});
