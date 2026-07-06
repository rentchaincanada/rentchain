import { beforeEach, describe, expect, it, vi } from "vitest";

type StoredDoc = { id: string; data: Record<string, any> };

const { dbMock, resetDb, seedDoc } = vi.hoisted(() => {
  const collections = new Map<string, Map<string, StoredDoc>>();

  function ensureCollection(name: string) {
    if (!collections.has(name)) collections.set(name, new Map<string, StoredDoc>());
    return collections.get(name)!;
  }

  function buildSnapshot(entries: StoredDoc[]) {
    const docs = entries.map((entry) => ({
      id: entry.id,
      data: () => entry.data,
    }));
    return { docs, empty: docs.length === 0, size: docs.length };
  }

  function queryCollection(name: string, filters: Array<{ field: string; value: any }> = [], limitCount?: number) {
    const execute = () => {
      const entries = Array.from(ensureCollection(name).values()).filter((entry) =>
        filters.every((filter) => entry.data?.[filter.field] === filter.value)
      );
      return buildSnapshot(limitCount == null ? entries : entries.slice(0, limitCount));
    };
    return {
      where(field: string, op: string, value: any) {
        if (op !== "==") throw new Error(`Unsupported test operator ${op}`);
        return queryCollection(name, [...filters, { field, value }], limitCount);
      },
      limit(count: number) {
        return queryCollection(name, filters, count);
      },
      get: async () => execute(),
      doc(id: string) {
        return {
          id,
          get: async () => {
            const entry = ensureCollection(name).get(id);
            return {
              id,
              exists: Boolean(entry),
              data: () => entry?.data,
            };
          },
          set: async (payload: any, options?: { merge?: boolean }) => {
            const col = ensureCollection(name);
            const current = col.get(id)?.data || {};
            col.set(id, { id, data: options?.merge ? { ...current, ...(payload || {}) } : payload });
          },
        };
      },
    };
  }

  return {
    dbMock: {
      collection: (name: string) => queryCollection(name),
    },
    resetDb: () => collections.clear(),
    seedDoc: (collectionName: string, id: string, data: Record<string, any>) => {
      ensureCollection(collectionName).set(id, { id, data });
    },
  };
});

vi.mock("../../firebase", () => ({ db: dbMock }));

vi.mock("../../middleware/authMiddleware", () => ({
  authenticateJwt: (req: any, _res: any, next: any) => {
    const token = String(req.headers?.authorization || "").replace(/^Bearer\s+/i, "").trim().toLowerCase();
    if (token === "admin") {
      req.user = { id: "admin-1", landlordId: "admin-1", role: "admin" };
      return next();
    }
    if (token === "other-landlord") {
      req.user = { id: "landlord-2", landlordId: "landlord-2", role: "landlord" };
      return next();
    }
    if (token === "tenant") {
      req.user = { id: "tenant-1", role: "tenant" };
      return next();
    }
    req.user = { id: "landlord-1", landlordId: "landlord-1", role: "landlord" };
    return next();
  },
}));

async function invokeRouter(options: { method: string; url: string; authorization?: string }) {
  const router = (await import("../verifiedScreeningRoutes")).default;
  return await new Promise<{ status: number; body: any }>((resolve, reject) => {
    const [path, queryString] = options.url.split("?");
    const query = new URLSearchParams(queryString || "");
    const req: any = {
      method: options.method,
      url: options.url,
      originalUrl: options.url,
      path,
      params: {},
      query: Object.fromEntries(query.entries()),
      headers: options.authorization ? { authorization: options.authorization } : {},
      body: {},
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
        this.headers[String(name).toLowerCase()] = value;
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

function seedVerifiedScreening(id: string, overrides: Record<string, any> = {}) {
  seedDoc("verifiedScreeningQueue", id, {
    landlordId: "landlord-1",
    applicationId: "app_raw_123",
    orderId: "order_raw_123",
    providerRef: "provider_ref_raw_123",
    propertyId: "property_raw_123",
    unitId: "unit_raw_123",
    storagePath: "gs://bucket/raw-screening.pdf",
    notesInternal: "Internal-only support note",
    reviewer: { email: "reviewer@example.test" },
    applicant: { name: "Phil Jones", email: "phil@example.test" },
    createdAt: Date.UTC(2026, 5, 1, 12, 0),
    updatedAt: Date.UTC(2026, 5, 1, 12, 30),
    status: "IN_PROGRESS",
    serviceLevel: "VERIFIED_AI",
    aiIncluded: true,
    scoreAddOn: false,
    totalAmountCents: 4999,
    currency: "CAD",
    completedAt: null,
    resultSummary: "Screening is underway.",
    recommendation: null,
    ...overrides,
  });
}

describe("verifiedScreeningRoutes", () => {
  beforeEach(() => {
    resetDb();
  });

  it("returns a landlord-scoped safe verified-screening list without support identifiers", async () => {
    seedVerifiedScreening("queue_doc_raw_1");
    seedVerifiedScreening("queue_doc_other", {
      landlordId: "landlord-2",
      applicationId: "other_app_raw",
      orderId: "other_order_raw",
      applicant: { name: "Other Applicant", email: "other@example.test" },
    });

    const res = await invokeRouter({
      method: "GET",
      url: "/landlord/verified-screenings",
      authorization: "Bearer landlord",
    });

    expect(res.status).toBe(200);
    expect(res.body?.ok).toBe(true);
    expect(res.body?.data).toHaveLength(1);
    expect(res.body.data[0]).toMatchObject({
      id: "verified-screening-1",
      applicant: { name: "Phil Jones", email: "phil@example.test" },
      status: "IN_PROGRESS",
      serviceLevel: "VERIFIED_AI",
      totalAmountCents: 4999,
      currency: "CAD",
    });

    const publicPayload = JSON.stringify(res.body.data[0]);
    expect(publicPayload).not.toContain("queue_doc_raw_1");
    expect(publicPayload).not.toContain("landlord-1");
    expect(publicPayload).not.toContain("app_raw_123");
    expect(publicPayload).not.toContain("order_raw_123");
    expect(publicPayload).not.toContain("provider_ref_raw_123");
    expect(publicPayload).not.toContain("property_raw_123");
    expect(publicPayload).not.toContain("unit_raw_123");
    expect(publicPayload).not.toContain("gs://bucket/raw-screening.pdf");
    expect(publicPayload).not.toContain("Internal-only support note");
    expect(publicPayload).not.toContain("reviewer@example.test");
    expect(publicPayload).not.toContain("other_app_raw");
  });

  it("rejects non-landlord users on the landlord verified-screenings route", async () => {
    const res = await invokeRouter({
      method: "GET",
      url: "/landlord/verified-screenings",
      authorization: "Bearer tenant",
    });

    expect(res.status).toBe(403);
    expect(res.body?.error).toBe("FORBIDDEN");
  });

  it("preserves admin support identifiers on the admin verified-screenings route", async () => {
    seedVerifiedScreening("queue_doc_raw_1");

    const res = await invokeRouter({
      method: "GET",
      url: "/admin/verified-screenings",
      authorization: "Bearer admin",
    });

    expect(res.status).toBe(200);
    expect(res.body?.data?.[0]).toMatchObject({
      id: "queue_doc_raw_1",
      landlordId: "landlord-1",
      applicationId: "app_raw_123",
      orderId: "order_raw_123",
      propertyId: "property_raw_123",
      unitId: "unit_raw_123",
      notesInternal: "Internal-only support note",
    });
  });
});
