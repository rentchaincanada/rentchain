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

function listDocs(name: string) {
  return Array.from(ensureCollection(name).values()).map((entry) => clone({ id: entry.id, ...entry.data }));
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

vi.mock("../../middleware/requireLandlord", () => ({
  requireLandlord: (req: any, res: any, next: any) => {
    const header = String(req.headers["x-test-user"] || "").trim();
    if (!header) {
      return res.status(401).json({ ok: false, error: "Unauthorized" });
    }
    req.user = JSON.parse(header);
    next();
  },
}));

vi.mock("../../services/ledgerEventsFirestoreService", () => ({
  listLedgerEventsV2: vi.fn(async () => ({
    items: [{ id: "evt-1", tenantId: "tenant-1", type: "late_payment" }],
  })),
}));

vi.mock("../../services/tenantSignalsService", () => ({
  computeTenantSignals: vi.fn(() => ({
    latePaymentsCount: 1,
  })),
}));

describe("riskAgentRoutes", () => {
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

  async function invokeRouter(options: {
    method: string;
    url: string;
    headers?: Record<string, string>;
    body?: any;
  }) {
    const router = (await import("../riskAgentRoutes")).default;
    return await new Promise<{ status: number; body: any }>((resolve, reject) => {
      const req: any = {
        method: options.method,
        url: options.url,
        originalUrl: options.url,
        path: options.url,
        headers: options.headers || {},
        body: options.body || {},
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
          resolve({ status: this.statusCode, body: payload });
          return this;
        },
      };

      router.handle(req, res, (err: any) => {
        if (err) reject(err);
      });
    });
  }

  it("rejects unauthorized access", async () => {
    const res = await invokeRouter({
      method: "POST",
      url: "/risk-agent/applications/app-1/evaluate",
      body: {},
    });
    expect(res.status).toBe(401);
  });

  it("returns a structured landlord-safe risk result and persists it", async () => {
    const res = await invokeRouter({
      method: "POST",
      url: "/risk-agent/applications/app-1/evaluate",
      headers: {
        "x-test-user": JSON.stringify({
          id: "landlord-1",
          landlordId: "landlord-1",
          role: "landlord",
        }),
      },
      body: {},
    });

    expect(res.status).toBe(200);
    expect(res.body?.run?.version).toBe("risk-v1");
    expect(typeof res.body?.run?.score).toBe("number");
    expect(Array.isArray(res.body?.run?.factors)).toBe(true);

    const latestRes = await invokeRouter({
      method: "GET",
      url: "/risk-agent/applications/app-1/latest",
      headers: {
        "x-test-user": JSON.stringify({
          id: "landlord-1",
          landlordId: "landlord-1",
          role: "landlord",
        }),
      },
    });

    expect(latestRes.status).toBe(200);
    expect(latestRes.body?.latest?.latestRunId).toBe(res.body?.run?.id);
  });

  it("rejects landlord access to another landlord's application", async () => {
    const res = await invokeRouter({
      method: "GET",
      url: "/risk-agent/applications/app-1/latest",
      headers: {
        "x-test-user": JSON.stringify({
          id: "landlord-2",
          landlordId: "landlord-2",
          role: "landlord",
        }),
      },
    });

    expect(res.status).toBe(403);
  });

  it("stores a decision audit record without mutating application status", async () => {
    const res = await invokeRouter({
      method: "POST",
      url: "/risk-agent/applications/app-1/decision",
      headers: {
        "x-test-user": JSON.stringify({
          id: "landlord-1",
          landlordId: "landlord-1",
          role: "landlord",
        }),
      },
      body: {
        decision: "request_info",
        notes: "Need one more paystub before deciding.",
      },
    });

    expect(res.status).toBe(200);
    expect(res.body?.decision).toEqual(
      expect.objectContaining({
        applicationId: "app-1",
        decision: "request_info",
        notes: "Need one more paystub before deciding.",
        userId: "landlord-1",
      })
    );

    const decisions = listDocs("risk_agent_decisions");
    expect(decisions).toHaveLength(1);
    expect(decisions[0]).toEqual(
      expect.objectContaining({
        applicationId: "app-1",
        decision: "request_info",
        notes: "Need one more paystub before deciding.",
      })
    );

    const application = ensureCollection("rentalApplications").get("app-1")?.data;
    expect(application?.status).toBe("IN_REVIEW");
  });

  it("rejects unauthorized decision audit access", async () => {
    const res = await invokeRouter({
      method: "POST",
      url: "/risk-agent/applications/app-1/decision",
      body: {
        decision: "approve",
      },
    });

    expect(res.status).toBe(401);
  });
});
