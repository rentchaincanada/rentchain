import { beforeEach, describe, expect, it, vi } from "vitest";

const { fakeDb, resetFakeDb, seedDoc } = vi.hoisted(() => {
  const store = new Map<string, Map<string, any>>();

  function ensureCollection(name: string) {
    if (!store.has(name)) store.set(name, new Map());
    return store.get(name)!;
  }

  function matches(doc: any, filters: Array<{ field: string; op: string; value: any }>) {
    return filters.every(({ field, op, value }) => {
      const actual = doc?.data?.[field];
      if (op === "==") return actual === value;
      return false;
    });
  }

  function makeQuery(name: string, filters: Array<{ field: string; op: string; value: any }> = []) {
    return {
      where: (field: string, op: string, value: any) => makeQuery(name, [...filters, { field, op, value }]),
      get: async () => {
        const docs = Array.from(ensureCollection(name).values())
          .filter((doc) => matches(doc, filters))
          .map((doc) => ({ id: doc.id, exists: true, data: () => doc.data }));
        return { docs, empty: docs.length === 0, size: docs.length };
      },
      doc: (id: string) => makeDoc(name, id),
    };
  }

  function makeDoc(name: string, id: string) {
    const col = ensureCollection(name);
    return {
      id,
      get: async () => {
        const entry = col.get(id);
        return { id, exists: Boolean(entry), data: () => entry?.data };
      },
      set: async (data: any) => {
        col.set(id, { id, data });
      },
    };
  }

  return {
    resetFakeDb: () => store.clear(),
    seedDoc: (collection: string, id: string, data: any) => ensureCollection(collection).set(id, { id, data }),
    fakeDb: {
      collection: (name: string) => ({
        where: (field: string, op: string, value: any) => makeQuery(name, [{ field, op, value }]),
        get: async () => makeQuery(name).get(),
        doc: (id: string) => makeDoc(name, id),
      }),
    },
  };
});

let mockUser: any;

vi.mock("../../firebase", () => ({
  db: fakeDb,
}));

vi.mock("../../middleware/requireAuth", () => ({
  requireAuth: (req: any, res: any, next: any) => {
    if (!mockUser) return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });
    req.user = mockUser;
    return next();
  },
}));

vi.mock("../../middleware/requireLandlord", () => ({
  requireLandlord: (req: any, res: any, next: any) => {
    const role = String(req.user?.role || "").trim().toLowerCase();
    const landlordId = req.user?.landlordId || req.user?.id;
    if (role !== "landlord" && role !== "admin") return res.status(403).json({ ok: false, error: "Forbidden" });
    if (!landlordId) return res.status(401).json({ ok: false, error: "Missing landlord context" });
    req.user.landlordId = landlordId;
    return next();
  },
}));

async function invokeRouter(router: any, options: { method: string; url: string; user?: Record<string, unknown> | null }) {
  return await new Promise<{ status: number; body: any }>((resolve, reject) => {
    const [path, queryString] = options.url.split("?");
    const query = new URLSearchParams(queryString || "");
    mockUser = options.user ?? mockUser;
    const req: any = {
      method: options.method,
      url: options.url,
      originalUrl: options.url,
      path,
      user: mockUser,
      body: {},
      query: Object.fromEntries(query.entries()),
      params: {},
      headers: {},
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
    };
    router.handle(req, res, (error: any) => {
      if (error) reject(error);
    });
  });
}

describe("landlordAuditComplianceRoutes", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    resetFakeDb();
    mockUser = { id: "landlord-1", landlordId: "landlord-1", role: "landlord", email: "landlord@example.com" };
  });

  it("returns landlord-scoped readiness without certification or filing flags", async () => {
    seedDoc("properties", "prop-1", { landlordId: "landlord-1", status: "active", unitsCount: 1 });
    seedDoc("properties", "prop-other", { landlordId: "landlord-2", status: "active", unitsCount: 99 });
    seedDoc("leases", "lease-1", { landlordId: "landlord-1", propertyId: "prop-1", unitId: "unit-1", status: "active" });
    seedDoc("rentPayments", "rent-1", { landlordId: "landlord-1", leaseId: "lease-1", status: "paid" });
    seedDoc("events", "event-1", { landlordId: "landlord-1", domain: "lease", type: "lease.updated" });
    seedDoc("events", "policy-1", { landlordId: "landlord-1", domain: "policy", type: "policy.evaluated" });
    const router = (await import("../landlordAuditComplianceRoutes")).default;

    const res = await invokeRouter(router, { method: "GET", url: "/audit-compliance/readiness" });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.readiness).toEqual(
      expect.objectContaining({
        manualOnly: true,
        certificationIssued: false,
        externalFilingEnabled: false,
        automatedReportingEnabled: false,
      })
    );
    expect(res.body.readiness.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ checkKey: "property_identity_present", status: "passed" }),
        expect.objectContaining({ checkKey: "external_submission_disabled", status: "passed" }),
        expect.objectContaining({ checkKey: "automated_reporting_disabled", status: "passed" }),
      ])
    );
    expect(JSON.stringify(res.body.readiness)).not.toContain("prop-other");
  });

  it("returns deterministic blocked readiness when property context is missing", async () => {
    const router = (await import("../landlordAuditComplianceRoutes")).default;

    const res = await invokeRouter(router, { method: "GET", url: "/audit-compliance/readiness" });

    expect(res.status).toBe(200);
    expect(res.body.readiness.status).toBe("blocked");
    expect(res.body.readiness.checks).toEqual(
      expect.arrayContaining([expect.objectContaining({ checkKey: "property_identity_present", status: "blocked" })])
    );
  });

  it("blocks non-landlord users", async () => {
    const router = (await import("../landlordAuditComplianceRoutes")).default;

    const res = await invokeRouter(router, {
      method: "GET",
      url: "/audit-compliance/readiness",
      user: { id: "tenant-1", role: "tenant" },
    });

    expect(res.status).toBe(403);
  });
});
