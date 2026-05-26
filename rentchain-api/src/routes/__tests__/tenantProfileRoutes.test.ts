import { beforeEach, describe, expect, it, vi } from "vitest";

const collections = new Map<string, Map<string, any>>();

function ensureCollection(name: string) {
  if (!collections.has(name)) collections.set(name, new Map<string, any>());
  return collections.get(name)!;
}

function clone<T>(value: T): T {
  return value === undefined ? value : JSON.parse(JSON.stringify(value));
}

function applyFilters(rows: Array<[string, any]>, filters: Array<{ field: string; op: string; value: any }>) {
  return rows.filter(([, data]) =>
    filters.every((filter) => {
      const current = data?.[filter.field];
      if (filter.op === "==") return current === filter.value;
      if (filter.op === "array-contains") return Array.isArray(current) && current.includes(filter.value);
      return false;
    })
  );
}

function createQuery(name: string, filters: Array<{ field: string; op: string; value: any }> = []) {
  const api: any = {
    where(field: string, op: string, value: any) {
      return createQuery(name, [...filters, { field, op, value }]);
    },
    orderBy() {
      return api;
    },
    limit(count: number) {
      return {
        get: async () => {
          const docs = applyFilters(Array.from(ensureCollection(name).entries()), filters)
            .slice(0, count)
            .map(([id, data]) => ({ id, exists: true, data: () => clone(data) }));
          return { docs, empty: docs.length === 0 };
        },
      };
    },
    async get() {
      const docs = applyFilters(Array.from(ensureCollection(name).entries()), filters).map(([id, data]) => ({
        id,
        exists: true,
        data: () => clone(data),
      }));
      return { docs, empty: docs.length === 0 };
    },
  };
  return api;
}

const dbMock = {
  collection: (name: string) => ({
    doc: (id?: string) => {
      const docId = id || `doc_${ensureCollection(name).size + 1}`;
      return {
        id: docId,
        get: async () => ({
          id: docId,
          exists: ensureCollection(name).has(docId),
          data: () => clone(ensureCollection(name).get(docId)),
        }),
        set: async (value: any, opts?: { merge?: boolean }) => {
          const current = ensureCollection(name).get(docId) || {};
          ensureCollection(name).set(docId, opts?.merge ? { ...current, ...clone(value) } : clone(value));
        },
      };
    },
    where: (field: string, op: string, value: any) => createQuery(name, [{ field, op, value }]),
  }),
};

vi.mock("../../config/firebase", () => ({
  db: dbMock,
  FieldValue: {
    serverTimestamp: () => "__server_timestamp__",
  },
}));

vi.mock("../../middleware/authMiddleware", () => ({
  authenticateJwt: (req: any, _res: any, next: any) => {
    const header = String(req.headers["x-test-user"] || "").trim();
    if (header) req.user = JSON.parse(header);
    next();
  },
}));

async function invokeRouter(router: any, options: {
  method: string;
  url: string;
  body?: any;
  headers?: Record<string, string>;
}) {
  return await new Promise<{ status: number; body: any }>((resolve, reject) => {
    const req: any = {
      method: options.method,
      url: options.url,
      originalUrl: options.url,
      path: options.url,
      body: options.body ?? {},
      headers: options.headers ?? {},
      query: {},
      params: {},
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
    router.handle(req, res, (error: any) => {
      if (error) reject(error);
    });
  });
}

describe("tenant profile route", () => {
  beforeEach(() => {
    collections.clear();
    ensureCollection("properties").set("prop-1", {
      rc_prop_id: "rc-prop-1",
      landlordId: "landlord-1",
      street1: "123 Main St",
      city: "Halifax",
      province: "NS",
      postalCode: "B3H1A1",
      internalSecret: "private",
    });
    ensureCollection("applications").set("app-1", {
      applicantEmail: "tenant@example.com",
      applicantName: "Taylor Tenant",
      firstName: "Taylor",
      lastName: "Tenant",
      phone: "9025551234",
      propertyId: "prop-1",
      status: "submitted",
      missingSteps: ["upload_id"],
      nextActions: ["upload government id"],
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-03T00:00:00.000Z",
      sin: "123-45-6789",
      documentRefs: ["doc-1"],
      applicantProfile: {
        currentAddress: {
          line1: "55 Brunswick St",
          line2: "Apt 7",
          city: "Halifax",
          provinceState: "NS",
          postalCode: "B3J2G5",
          country: "CA",
        },
        timeAtCurrentAddressMonths: 26,
        currentRentAmountCents: 185000,
        employment: {
          employerName: "Harbour Design",
          jobTitle: "Designer",
          incomeAmountCents: 520000,
          incomeFrequency: "monthly",
          monthsAtJob: 18,
        },
        workReference: {
          name: "Morgan Manager",
          phone: "9025550199",
        },
        signature: {
          type: "typed",
          typedName: "Taylor Tenant",
        },
        applicantNotes: "private note",
      },
      nextOfKin: {
        name: "Jamie Tenant",
        relationship: "Sibling",
        phone: "9025550175",
        address: "99 Willow St",
      },
      consent: {
        creditConsent: true,
      },
      applicationConsent: {
        accepted: true,
      },
      screeningSummary: {
        score: 700,
      },
      coApplicant: {
        firstName: "Hidden",
        lastName: "Person",
      },
      currentLeaseStatus: {
        landlordAware: "no",
        reasonForMoving: "private",
      },
    });
    ensureCollection("leases").set("lease-1", {
      tenantId: "tenant-1",
      propertyId: "prop-1",
      unitId: "unit-1",
      status: "active",
      startDate: "2026-02-01",
      endDate: "2027-01-31",
      monthlyRent: 1800,
      confidentialNotes: "private",
    });
    ensureCollection("units").set("unit-1", {
      propertyId: "prop-1",
      unitNumber: "6",
      internalUnitNotes: "private",
    });
    ensureCollection("tenants").set("tenant-1", {
      fullName: "Taylor Tenant",
      email: "tenant@example.com",
      phone: "902-555-0100",
      unitId: "unit-1",
      internalRiskScore: 900,
    });
    ensureCollection("screening_requests").set("screen-1", {
      applicantTenantId: "tenant-1",
      latestResultId: "result-1",
      status: "completed",
      updatedAt: "2026-01-04T00:00:00.000Z",
    });
    ensureCollection("screening_results").set("result-1", {
      status: "completed",
      identityVerified: true,
      rawPayloadRef: "secret/path",
      updatedAt: "2026-01-05T00:00:00.000Z",
    });
  });

  it("rejects unauthorized tenant profile access", async () => {
    const router = (await import("../tenantPortalRoutes")).default;
    const res = await invokeRouter(router, { method: "GET", url: "/profile" });
    expect(res.status).toBe(401);
  });

  it("rejects unauthorized tenant application reuse access", async () => {
    const router = (await import("../tenantPortalRoutes")).default;
    const res = await invokeRouter(router, { method: "GET", url: "/application-reuse" });
    expect(res.status).toBe(401);
  });

  it("returns only safe projected tenant profile fields", async () => {
    const router = (await import("../tenantPortalRoutes")).default;
    const res = await invokeRouter(router, {
      method: "GET",
      url: "/profile",
      headers: {
        "x-test-user": JSON.stringify({
          id: "user-1",
          email: "tenant@example.com",
          role: "tenant",
          tenantId: "tenant-1",
          leaseId: "lease-1",
        }),
      },
    });

    expect(res.status).toBe(200);
    expect(res.body?.data?.profile?.displayName).toBe("Taylor Tenant");
    expect(res.body?.data?.profile?.email).toBe("tenant@example.com");
    expect(res.body?.data?.profile?.phone).toBe("902-555-0100");
    expect(res.body?.data?.profile?.property?.street1).toBe("123 Main St");
    expect(res.body?.data?.profile?.unit).toEqual({ unitId: "unit-1", label: "6" });
    expect(res.body?.data?.profile?.property?.internalSecret).toBeUndefined();
    expect(res.body?.data?.profile?.unit?.internalUnitNotes).toBeUndefined();
    expect(res.body?.data?.profile?.application?.sin).toBeUndefined();
    expect(res.body?.data?.profile?.lease?.confidentialNotes).toBeUndefined();
    expect(res.body?.data?.identity?.identityVerification?.status).toBe("verified");
    expect(res.body?.data?.identity?.documentChecklist?.[0]?.code).toBe("upload_id");
    expect(JSON.stringify(res.body)).not.toContain("rawPayloadRef");
    expect(JSON.stringify(res.body)).not.toContain("internalRiskScore");
  });

  it("returns only whitelisted tenant application reuse fields", async () => {
    const router = (await import("../tenantPortalRoutes")).default;
    const res = await invokeRouter(router, {
      method: "GET",
      url: "/application-reuse",
      headers: {
        "x-test-user": JSON.stringify({
          id: "user-1",
          email: "tenant@example.com",
          role: "tenant",
          tenantId: "tenant-1",
          leaseId: "lease-1",
        }),
      },
    });

    expect(res.status).toBe(200);
    expect(res.body?.data).toEqual({
      applicant: {
        firstName: "Taylor",
        lastName: "Tenant",
        email: "tenant@example.com",
        phone: "9025551234",
      },
      currentAddress: {
        line1: "55 Brunswick St",
        line2: "Apt 7",
        city: "Halifax",
        provinceState: "NS",
        postalCode: "B3J2G5",
        country: "CA",
      },
      timeAtCurrentAddressMonths: 26,
      currentRentAmountCents: 185000,
      employment: {
        employerName: "Harbour Design",
        jobTitle: "Designer",
        incomeAmountCents: 520000,
        incomeFrequency: "monthly",
        monthsAtJob: 18,
      },
      workReference: {
        name: "Morgan Manager",
        phone: "9025550199",
      },
      nextOfKin: {
        name: "Jamie Tenant",
        relationship: "Sibling",
        phone: "9025550175",
        address: "99 Willow St",
      },
    });
    expect(JSON.stringify(res.body)).not.toContain("applicantNotes");
    expect(JSON.stringify(res.body)).not.toContain("signature");
    expect(JSON.stringify(res.body)).not.toContain("consent");
    expect(JSON.stringify(res.body)).not.toContain("screeningSummary");
    expect(JSON.stringify(res.body)).not.toContain("coApplicant");
    expect(JSON.stringify(res.body)).not.toContain("reasonForMoving");
    expect(JSON.stringify(res.body)).not.toContain("documentRefs");
    expect(JSON.stringify(res.body)).not.toContain("sin");
  });

  it("returns a safe empty tenant application reuse payload when no reusable profile exists", async () => {
    ensureCollection("applications").clear();
    ensureCollection("tenants").set("tenant-1", {
      fullName: "Taylor Tenant",
      email: "tenant@example.com",
      phone: "902-555-0100",
    });

    const router = (await import("../tenantPortalRoutes")).default;
    const res = await invokeRouter(router, {
      method: "GET",
      url: "/application-reuse",
      headers: {
        "x-test-user": JSON.stringify({
          id: "user-1",
          email: "tenant@example.com",
          role: "tenant",
          tenantId: "tenant-1",
          leaseId: "lease-1",
        }),
      },
    });

    expect(res.status).toBe(200);
    expect(res.body?.data).toEqual({
      applicant: {
        firstName: "Taylor",
        lastName: "Tenant",
        email: "tenant@example.com",
        phone: "902-555-0100",
      },
      currentAddress: null,
      timeAtCurrentAddressMonths: null,
      currentRentAmountCents: null,
      employment: null,
      workReference: null,
      nextOfKin: null,
    });
  });

  it("keeps safe unit display labels when the context unit value is already a unit number", async () => {
    ensureCollection("leases").set("lease-display-unit", {
      tenantId: "tenant-display-unit",
      propertyId: "prop-1",
      unitNumber: "6",
      status: "active",
      startDate: "2026-02-01",
      endDate: "2027-01-31",
      monthlyRent: 1800,
    });
    ensureCollection("tenants").set("tenant-display-unit", {
      fullName: "Unit Number Tenant",
      email: "display-unit@example.com",
      phone: "902-555-0101",
      propertyId: "prop-1",
      leaseId: "lease-display-unit",
      unit: "6",
    });

    const router = (await import("../tenantPortalRoutes")).default;
    const res = await invokeRouter(router, {
      method: "GET",
      url: "/profile",
      headers: {
        "x-test-user": JSON.stringify({
          id: "user-display-unit",
          email: "display-unit@example.com",
          role: "tenant",
          tenantId: "tenant-display-unit",
        }),
      },
    });

    expect(res.status).toBe(200);
    expect(res.body?.data?.profile?.unit?.label).toBe("6");
    expect(res.body?.data?.profile?.unit?.unitId).toBeNull();
    expect(JSON.stringify(res.body)).not.toContain("internalUnitNotes");
  });
});
