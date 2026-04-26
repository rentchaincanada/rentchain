import { beforeEach, describe, expect, it, vi } from "vitest";

const { collections, dbMock } = vi.hoisted(() => {
  const collections = new Map<string, Map<string, any>>();

  function ensureCollection(name: string) {
    if (!collections.has(name)) {
      collections.set(name, new Map<string, any>());
    }
    return collections.get(name)!;
  }

  return {
    collections,
    dbMock: {
      collection: (name: string) => ({
        doc(id: string) {
          return {
            async set(payload: any) {
              ensureCollection(name).set(id, payload);
            },
          };
        },
        async get() {
          const docs = Array.from(ensureCollection(name).entries()).map(([id, data]) => ({
            id,
            data: () => data,
          }));
          return { docs, empty: docs.length === 0, size: docs.length };
        },
      }),
    },
  };
});

vi.mock("../../config/firebase", () => ({
  db: dbMock,
}));

vi.mock("../../middleware/requireAuth", () => ({
  requireAuth: (req: any, res: any, next: any) => {
    if (!req.user) return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });
    return next();
  },
}));

async function invokeRouter(
  router: any,
  options: { method: string; url: string; user?: Record<string, unknown> | null; body?: any }
) {
  return await new Promise<{ status: number; body: any }>((resolve, reject) => {
    const [path, queryString] = options.url.split("?");
    const query = new URLSearchParams(queryString || "");
    const req: any = {
      method: options.method,
      url: options.url,
      originalUrl: options.url,
      path,
      user: options.user ?? null,
      query: Object.fromEntries(query.entries()),
      params: {},
      body: options.body || {},
      headers: {},
      get(name: string) {
        return this.headers[String(name).toLowerCase()];
      },
      header(name: string) {
        return this.get(name);
      },
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

function seedDoc(collectionName: string, id: string, data: any) {
  if (!collections.has(collectionName)) {
    collections.set(collectionName, new Map<string, any>());
  }
  collections.get(collectionName)!.set(id, { id, ...data });
}

describe("portfolioScoreHistoryRoutes", () => {
  beforeEach(() => {
    collections.clear();
  });

  it("lets an admin fetch ordered history", async () => {
    seedDoc("portfolioScoreSnapshots", "snap-1", {
      portfolioId: "portfolio-1",
      snapshotAt: "2026-04-15T12:00:00.000Z",
      score: 82,
      grade: "B",
      status: "watch",
      headline: "Current snapshot",
      componentScores: [],
      metrics: {
        totalResourcesReviewed: 1,
        triageItemCount: 0,
        criticalTriageCount: 0,
        reconciliationIssueCount: 0,
        automationSkipCount: 0,
        policyReviewCount: 0,
        blockedWorkflowCount: 0,
        maintenanceReopenCount: 0,
      },
    });
    seedDoc("portfolioScoreSnapshots", "snap-0", {
      portfolioId: "portfolio-1",
      snapshotAt: "2026-04-01T12:00:00.000Z",
      score: 78,
      grade: "C",
      status: "watch",
      headline: "Previous snapshot",
      componentScores: [],
      metrics: {
        totalResourcesReviewed: 1,
        triageItemCount: 0,
        criticalTriageCount: 0,
        reconciliationIssueCount: 0,
        automationSkipCount: 0,
        policyReviewCount: 0,
        blockedWorkflowCount: 0,
        maintenanceReopenCount: 0,
      },
    });

    const router = (await import("../portfolioScoreHistoryRoutes")).default;
    const response = await invokeRouter(router, {
      method: "GET",
      url: "/portfolio-score/history?portfolioId=portfolio-1&limit=12",
      user: { id: "admin-1", role: "admin" },
    });

    expect(response.status).toBe(200);
    expect(response.body?.history).toHaveLength(2);
    expect(response.body?.history[0]?.score).toBe(82);
  });

  it("lets an admin fetch trend and handles missing portfolioId safely", async () => {
    seedDoc("portfolioScoreSnapshots", "snap-1", {
      portfolioId: "portfolio-1",
      snapshotAt: "2026-04-15T12:00:00.000Z",
      score: 82,
      grade: "B",
      status: "watch",
      headline: "Current snapshot",
      componentScores: [{ key: "workflow_completion", normalizedScore: 82, contribution: 20.5 }],
      metrics: {
        totalResourcesReviewed: 1,
        triageItemCount: 0,
        criticalTriageCount: 0,
        reconciliationIssueCount: 0,
        automationSkipCount: 0,
        policyReviewCount: 0,
        blockedWorkflowCount: 0,
        maintenanceReopenCount: 0,
      },
    });
    seedDoc("portfolioScoreSnapshots", "snap-0", {
      portfolioId: "portfolio-1",
      snapshotAt: "2026-04-01T12:00:00.000Z",
      score: 78,
      grade: "C",
      status: "watch",
      headline: "Previous snapshot",
      componentScores: [{ key: "workflow_completion", normalizedScore: 78, contribution: 19.5 }],
      metrics: {
        totalResourcesReviewed: 1,
        triageItemCount: 0,
        criticalTriageCount: 0,
        reconciliationIssueCount: 0,
        automationSkipCount: 0,
        policyReviewCount: 0,
        blockedWorkflowCount: 0,
        maintenanceReopenCount: 0,
      },
    });

    const router = (await import("../portfolioScoreHistoryRoutes")).default;
    const trendResponse = await invokeRouter(router, {
      method: "GET",
      url: "/portfolio-score/trend?portfolioId=portfolio-1&limit=12",
      user: { id: "admin-1", role: "admin" },
    });

    expect(trendResponse.status).toBe(200);
    expect(trendResponse.body?.trend?.direction).toBe("up");

    const invalidResponse = await invokeRouter(router, {
      method: "GET",
      url: "/portfolio-score/trend",
      user: { id: "admin-1", role: "admin" },
    });
    expect(invalidResponse.status).toBe(400);
    expect(invalidResponse.body?.error).toBe("PORTFOLIO_ID_REQUIRED");
  });

  it("lets an admin create a snapshot and enforces admin-only access", async () => {
    seedDoc("rentalApplications", "app-1", {
      landlordId: "portfolio-1",
      applicantName: "Alex Applicant",
    });

    const router = (await import("../portfolioScoreHistoryRoutes")).default;
    const forbidden = await invokeRouter(router, {
      method: "POST",
      url: "/portfolio-score/snapshot",
      user: { id: "landlord-1", role: "landlord" },
      body: { portfolioId: "portfolio-1" },
    });
    expect(forbidden.status).toBe(403);

    const created = await invokeRouter(router, {
      method: "POST",
      url: "/portfolio-score/snapshot",
      user: { id: "admin-1", role: "admin" },
      body: { portfolioId: "portfolio-1" },
    });

    expect(created.status).toBe(201);
    expect(created.body?.snapshot?.portfolioId).toBe("portfolio-1");
  });
});

