import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildRegistrySubmissionDraftV2 } from "../../services/registry/halifaxRegistrySubmissionService";
import { resolveRegistrySchemaForProperty } from "../../services/registry/schemas/registrySchemaResolver";

type StoredDoc = { id: string; data: any };

const { dbMock, resetDb, seedDoc } = vi.hoisted(() => {
  const collections = new Map<string, Map<string, StoredDoc>>();
  let autoId = 0;

  function ensureCollection(name: string) {
    if (!collections.has(name)) collections.set(name, new Map());
    return collections.get(name)!;
  }

  function applyMerge(existing: any, payload: any) {
    const next = { ...(existing || {}) };
    for (const [k, v] of Object.entries(payload || {})) {
      if (v && typeof v === "object" && (v as any).__op === "inc") {
        next[k] = Number(next[k] || 0) + Number((v as any).n || 0);
      } else {
        next[k] = v;
      }
    }
    return next;
  }

  function buildQuery(name: string, filters: Array<{ field: string; op: string; value: any }> = []) {
    let limitCount: number | null = null;
    const matchesFilter = (entry: StoredDoc, filter: { field: string; op: string; value: any }) => {
      if (filter.op === "==") return entry.data?.[filter.field] === filter.value;
      if (filter.op === "array-contains") {
        return Array.isArray(entry.data?.[filter.field]) && entry.data?.[filter.field].includes(filter.value);
      }
      return true;
    };
    return {
      where: (field: string, op: string, value: any) =>
        buildQuery(name, [...filters, { field, op, value }]),
      orderBy: (_field: string, _dir?: "asc" | "desc") => buildQuery(name, filters),
      limit: (n: number) => {
        limitCount = n;
        return {
          get: async () => {
            const col = ensureCollection(name);
            let rows = Array.from(col.values());
            rows = rows.filter((entry) => filters.every((f) => matchesFilter(entry, f)));
            if (limitCount !== null) rows = rows.slice(0, limitCount);
            return {
              empty: rows.length === 0,
              size: rows.length,
              docs: rows.map((r) => ({ id: r.id, data: () => r.data })),
            };
          },
        };
      },
      get: async () => {
        const col = ensureCollection(name);
        let rows = Array.from(col.values());
        rows = rows.filter((entry) => filters.every((f) => matchesFilter(entry, f)));
        return {
          empty: rows.length === 0,
          size: rows.length,
          docs: rows.map((r) => ({ id: r.id, data: () => r.data })),
        };
      },
    };
  }

  const dbMock = {
    collection: (name: string) => ({
      doc: (id?: string) => {
        const col = ensureCollection(name);
        const docId = id || `auto_${++autoId}`;
        return {
          id: docId,
          get: async () => {
            const existing = col.get(docId);
            return {
              id: docId,
              exists: Boolean(existing),
              data: () => existing?.data,
            };
          },
          set: async (payload: any, options?: { merge?: boolean }) => {
            if (options?.merge) {
              const existing = col.get(docId)?.data || {};
              col.set(docId, { id: docId, data: applyMerge(existing, payload) });
              return;
            }
            col.set(docId, { id: docId, data: payload });
          },
          update: async (payload: any) => {
            const existing = col.get(docId)?.data || {};
            col.set(docId, { id: docId, data: applyMerge(existing, payload) });
          },
        };
      },
      where: (field: string, op: string, value: any) => buildQuery(name, [{ field, op, value }]),
      orderBy: (field: string, dir?: "asc" | "desc") => buildQuery(name).orderBy(field, dir),
    }),
    runTransaction: async (cb: any) => {
      const tx = {
        set: (ref: any, payload: any, options?: { merge?: boolean }) => ref.set(payload, options),
        update: (ref: any, payload: any) => ref.update(payload),
      };
      await cb(tx);
    },
    batch: () => {
      const ops: Array<() => Promise<void>> = [];
      return {
        set: (ref: any, payload: any, options?: { merge?: boolean }) => {
          ops.push(() => ref.set(payload, options));
        },
        commit: async () => {
          for (const op of ops) await op();
        },
      };
    },
  };

  return {
    dbMock,
    resetDb: () => {
      collections.clear();
      autoId = 0;
    },
    seedDoc: (collection: string, id: string, data: any) => {
      ensureCollection(collection).set(id, { id, data });
    },
  };
});

const registryMocks = vi.hoisted(() => ({
  ensureRegistrySource: vi.fn(),
  getPropertyRegistryProjection: vi.fn(),
  upsertPropertyRegistryProjection: vi.fn(),
}));

vi.mock("../../entitlements/entitlements.middleware", () => ({
  requireCapability: () => (_req: any, _res: any, next: any) => next(),
}));

vi.mock("../../middleware/requireAuth", () => ({
  requireAuth: (req: any, _res: any, next: any) => next(),
}));

vi.mock("../../middleware/requireAuthz", () => ({
  requirePermission: () => (_req: any, _res: any, next: any) => next(),
}));

vi.mock("../../config/firebase", () => ({
  db: dbMock,
  FieldValue: {
    increment: (n: number) => ({ __op: "inc", n }),
    serverTimestamp: () => Date.now(),
  },
}));

vi.mock("../../services/registry/registryImportService", () => ({
  ensureRegistrySource: registryMocks.ensureRegistrySource,
}));

vi.mock("../../services/registry/registryStatusProjectionService", async () => {
  const actual = await vi.importActual<typeof import("../../services/registry/registryStatusProjectionService")>(
    "../../services/registry/registryStatusProjectionService"
  );
  return {
    ...actual,
    getPropertyRegistryProjection: registryMocks.getPropertyRegistryProjection,
    upsertPropertyRegistryProjection: registryMocks.upsertPropertyRegistryProjection,
  };
});

async function createApp() {
  const router = (await import("../propertiesRoutes")).default;
  const app = express();
  app.use(express.json());
  app.use((req: any, _res: any, next: any) => {
    req.user = {
      id: "landlord-1",
      landlordId: "landlord-1",
      role: "landlord",
      plan: "pro",
      capabilities: ["registry_filing_access", "registry_attempts_history"],
    };
    next();
  });
  app.use("/api/properties", router);
  return app;
}

async function createAppForUser(user: Record<string, unknown>) {
  const router = (await import("../propertiesRoutes")).default;
  const app = express();
  app.use(express.json());
  app.use((req: any, _res: any, next: any) => {
    req.user = user;
    next();
  });
  app.use("/api/properties", router);
  return app;
}

async function createAdminApp(user: Record<string, unknown>) {
  const router = (await import("../adminPropertiesRoutes")).default;
  const app = express();
  app.use(express.json());
  app.use((req: any, _res: any, next: any) => {
    req.user = user;
    next();
  });
  app.use("/api/admin", router);
  return app;
}

function buildSubmissionDraft(property: Record<string, any>) {
  const schema = resolveRegistrySchemaForProperty(property);
  return buildRegistrySubmissionDraftV2({
    schema,
    draftId: `${property.id}__${schema.sourceKey}`,
    propertyId: property.id,
    landlordId: "landlord-1",
    fieldValues: {
      siteAddress: {
        line1: property.addressLine1,
        line2: null,
        city: property.city,
        province: property.province,
        postalCode: property.postalCode,
        country: property.country || "Canada",
      },
      propertyIdentifierPid: "PID-123",
      owner: {
        name: "Jordan Harbour",
        company: "Harbour Holdings Ltd.",
        email: "owner@example.com",
        phone: "902-555-0101",
        address: {
          line1: "55 Owner Lane",
          line2: null,
          city: "Halifax",
          province: "NS",
          postalCode: "B3H 2B2",
          country: "Canada",
        },
      },
      primaryContactSameAsOwner: true,
      primaryContact: {
        name: "Jordan Harbour",
        company: "Harbour Holdings Ltd.",
        email: "owner@example.com",
        phone: "902-555-0101",
        address: {
          line1: "55 Owner Lane",
          line2: null,
          city: "Halifax",
          province: "NS",
          postalCode: "B3H 2B2",
          country: "Canada",
        },
      },
      moreThanFiveBuildings: false,
      buildings: [
        {
          id: "building-1",
          primaryAddress: {
            line1: property.addressLine1,
            line2: null,
            city: property.city,
            province: property.province,
            postalCode: property.postalCode,
            country: property.country || "Canada",
          },
          hasAlternateContact: null,
          alternateContact: {
            name: null,
            company: null,
            email: null,
            phone: null,
            address: {
              line1: null,
              line2: null,
              city: null,
              province: null,
              postalCode: null,
              country: "Canada",
            },
          },
          hasAdditionalCivicAddress: null,
          additionalCivicAddress: null,
          rentalUnitTypes: ["Apartment(s)"],
          otherRentalUnitType: null,
          residentialUnitsRented: 8,
          shortTermRentalUnits: 0,
          buildingType: "Apartment building",
          otherBuildingType: null,
          totalResidentialUnits: 8,
          hasCommercialUnits: false,
          amenities: ["Laundry"],
          fireLifeSafetySystems: ["Smoke alarm(s)"],
          accessibilityFeatures: [],
          yearConstructed: 1998,
          notes: null,
        },
      ],
      propertyDescription: "Ready for filing",
    },
    fieldMeta: {},
    consent: {
      preparationAuthorized: true,
      preparationAuthorizedAt: "2026-04-05T00:00:00.000Z",
      preparationAuthorizedBy: "landlord-1",
      declarationsConfirmed: true,
      declarationsConfirmedAt: "2026-04-05T00:01:00.000Z",
      declarationsConfirmedBy: "landlord-1",
      finalReviewConfirmed: false,
      finalReviewConfirmedAt: null,
    },
    declarations: {
      acknowledged: true,
      maintenancePlanConfirmed: true,
      ownerDeclarationConfirmed: true,
      informationAccurateConfirmed: true,
    },
    status: "ready",
    updatedBy: "landlord-1",
  });
}

describe("properties routes publish + defaults", () => {
  beforeEach(() => {
    vi.resetModules();
    resetDb();
    registryMocks.ensureRegistrySource.mockResolvedValue({
      source: {
        sourceKey: "halifax_r400",
        sourceLabel: "Halifax Residential Rental Registry",
        jurisdictionProvince: "NS",
        jurisdictionMunicipality: "Halifax",
      },
    });
    registryMocks.getPropertyRegistryProjection.mockResolvedValue(null);
    registryMocks.upsertPropertyRegistryProjection.mockResolvedValue({
      id: "halifax_r400_prop-1",
      propertyId: "prop-1",
      sourceKey: "halifax_r400",
      jurisdictionProvince: "NS",
      jurisdictionMunicipality: "Halifax",
      registryStatus: "not_found",
      registryRecordId: null,
      registrationNumber: null,
      pid: null,
      matchedAt: null,
      matchConfidence: null,
      summary: "No public registry match found.",
      recommendedAction: "Review property details.",
      lastSourceRefreshAt: null,
      lastEvaluatedAt: "2026-04-01T00:00:00.000Z",
      createdAt: "2026-04-01T00:00:00.000Z",
      updatedAt: "2026-04-01T00:00:00.000Z",
    });
  });

  it("creates properties as DRAFT with screeningRequiredBeforeApproval=true", async () => {
    const app = await createApp();
    const res = await request(app).post("/api/properties").send({
      addressLine1: "123 Main St",
      city: "Halifax",
      province: "NS",
      totalUnits: 0,
    });

    expect(res.status).toBe(201);
    expect(res.body?.status).toBe("DRAFT");
    expect(res.body?.portfolioStatus).toBe("active");
    expect(res.body?.screeningRequiredBeforeApproval).toBe(true);
    expect(res.body?.publishedAt).toBeNull();
  });

  it("creates properties without a pid by default", async () => {
    const app = await createApp();
    const res = await request(app).post("/api/properties").send({
      addressLine1: "123 Main St",
      city: "Halifax",
      province: "NS",
      totalUnits: 1,
    });

    expect(res.status).toBe(201);
    expect(res.body?.pid).toBeNull();
  });

  it("creates properties with a normalized pid", async () => {
    const app = await createApp();
    const res = await request(app).post("/api/properties").send({
      addressLine1: "456 Main St",
      city: "Halifax",
      province: "NS",
      totalUnits: 1,
      pid: " ab-123_cd ",
    });

    expect(res.status).toBe(201);
    expect(res.body?.pid).toBe("AB-123_CD");
  });

  it("rejects malformed pid values during create", async () => {
    const app = await createApp();
    const res = await request(app).post("/api/properties").send({
      addressLine1: "789 Main St",
      city: "Halifax",
      province: "NS",
      totalUnits: 1,
      pid: "BAD PID!",
    });

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({
      error: "invalid_pid",
    });
  });

  it("excludes archived properties by default and returns them when filtered", async () => {
    seedDoc("properties", "prop-active", {
      landlordId: "landlord-1",
      name: "Active Property",
      createdAt: "2026-03-01T00:00:00.000Z",
      portfolioStatus: "active",
    });
    seedDoc("properties", "prop-archived", {
      landlordId: "landlord-1",
      name: "Archived Property",
      createdAt: "2026-03-02T00:00:00.000Z",
      portfolioStatus: "archived",
    });

    const app = await createApp();
    const activeRes = await request(app).get("/api/properties");
    const archivedRes = await request(app).get("/api/properties?status=archived");

    expect(activeRes.status).toBe(200);
    expect(activeRes.body.items).toHaveLength(1);
    expect(activeRes.body.items[0]?.id).toBe("prop-active");

    expect(archivedRes.status).toBe(200);
    expect(archivedRes.body.items).toHaveLength(1);
    expect(archivedRes.body.items[0]?.id).toBe("prop-archived");
  });

  it("returns only landlord A owned and managed properties on the landlord endpoint", async () => {
    seedDoc("properties", "prop-a-owned", {
      landlordId: "landlord-a",
      ownerUserId: "landlord-a",
      name: "A Owned",
      createdAt: "2026-03-01T00:00:00.000Z",
      portfolioStatus: "active",
    });
    seedDoc("properties", "prop-a-managed", {
      landlordId: "landlord-z",
      ownerUserId: "landlord-z",
      managerUserIds: ["landlord-a"],
      name: "A Managed",
      createdAt: "2026-03-02T00:00:00.000Z",
      portfolioStatus: "active",
    });
    seedDoc("properties", "prop-b-owned", {
      landlordId: "landlord-b",
      ownerUserId: "landlord-b",
      name: "B Owned",
      createdAt: "2026-03-03T00:00:00.000Z",
      portfolioStatus: "active",
    });

    const app = await createAppForUser({ id: "landlord-a", landlordId: "landlord-a", role: "landlord" });
    const res = await request(app).get("/api/properties");

    expect(res.status).toBe(200);
    expect(res.body.items.map((item: any) => item.id).sort()).toEqual(["prop-a-managed", "prop-a-owned"]);
  });

  it("does not allow landlord query params to widen access to another landlord's properties", async () => {
    seedDoc("properties", "prop-a-owned", {
      landlordId: "landlord-a",
      ownerUserId: "landlord-a",
      name: "A Owned",
      createdAt: "2026-03-01T00:00:00.000Z",
      portfolioStatus: "active",
    });
    seedDoc("properties", "prop-b-owned", {
      landlordId: "landlord-b",
      ownerUserId: "landlord-b",
      name: "B Owned",
      createdAt: "2026-03-03T00:00:00.000Z",
      portfolioStatus: "active",
    });

    const app = await createAppForUser({ id: "landlord-a", landlordId: "landlord-a", role: "landlord" });
    const res = await request(app).get("/api/properties?landlordId=landlord-b");

    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0]?.id).toBe("prop-a-owned");
  });

  it("does not automatically widen landlord endpoint results for admin-role users", async () => {
    seedDoc("properties", "prop-admin-owned", {
      landlordId: "admin-1",
      ownerUserId: "admin-1",
      name: "Admin Owned",
      createdAt: "2026-03-01T00:00:00.000Z",
      portfolioStatus: "active",
    });
    seedDoc("properties", "prop-other", {
      landlordId: "landlord-b",
      ownerUserId: "landlord-b",
      name: "Other",
      createdAt: "2026-03-03T00:00:00.000Z",
      portfolioStatus: "active",
    });

    const app = await createAppForUser({ id: "admin-1", landlordId: "admin-1", role: "admin" });
    const res = await request(app).get("/api/properties");

    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0]?.id).toBe("prop-admin-owned");
  });

  it("allows system admin users to access the dedicated admin property list", async () => {
    seedDoc("properties", "prop-a", {
      landlordId: "landlord-a",
      ownerUserId: "landlord-a",
      name: "A Owned",
      createdAt: "2026-03-01T00:00:00.000Z",
      portfolioStatus: "active",
    });
    seedDoc("properties", "prop-b", {
      landlordId: "landlord-b",
      ownerUserId: "landlord-b",
      name: "B Owned",
      createdAt: "2026-03-03T00:00:00.000Z",
      portfolioStatus: "active",
    });

    const app = await createAdminApp({
      id: "admin-1",
      landlordId: "admin-1",
      role: "admin",
      permissions: ["system.admin"],
      revokedPermissions: [],
    });
    const res = await request(app).get("/api/admin/properties");

    expect(res.status).toBe(200);
    expect(res.body.items.map((item: any) => item.id).sort()).toEqual(["prop-a", "prop-b"]);
  });

  it("archives a property without deleting related records", async () => {
    seedDoc("properties", "prop-archive", {
      landlordId: "landlord-1",
      name: "Archive Me",
      portfolioStatus: "active",
    });
    seedDoc("units", "unit-archive", {
      landlordId: "landlord-1",
      propertyId: "prop-archive",
      unitNumber: "10",
    });

    const app = await createApp();
    const res = await request(app).post("/api/properties/prop-archive/archive").send({});

    expect(res.status).toBe(200);
    expect(res.body?.property?.portfolioStatus).toBe("archived");

    const activeRes = await request(app).get("/api/properties");
    const archivedRes = await request(app).get("/api/properties?status=archived");

    expect(activeRes.body.items).toHaveLength(0);
    expect(archivedRes.body.items).toHaveLength(1);
    expect(archivedRes.body.items[0]?.id).toBe("prop-archive");
  });

  it("returns units_required when publishing with no units", async () => {
    seedDoc("properties", "prop-1", {
      landlordId: "landlord-1",
      name: "Test Property",
      status: "DRAFT",
    });
    const app = await createApp();
    const res = await request(app).post("/api/properties/prop-1/publish").send({});

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({
      ok: false,
      error: "units_required",
    });
  });

  it("publishes when at least one unit exists", async () => {
    seedDoc("properties", "prop-2", {
      landlordId: "landlord-1",
      name: "Test Property 2",
      status: "DRAFT",
    });
    seedDoc("units", "unit-1", {
      landlordId: "landlord-1",
      propertyId: "prop-2",
      unitNumber: "101",
    });

    const app = await createApp();
    const res = await request(app).post("/api/properties/prop-2/publish").send({});

    expect(res.status).toBe(200);
    expect(res.body?.ok).toBe(true);
    expect(res.body?.property?.status).toBe("PUBLISHED");
    expect(typeof res.body?.property?.publishedAt).toBe("number");
  });

  it("updates property pid later through patch", async () => {
    seedDoc("properties", "prop-pid-update", {
      landlordId: "landlord-1",
      name: "PID Later",
      addressLine1: "10 Updated St",
      city: "Halifax",
      province: "NS",
    });

    const app = await createApp();
    const res = await request(app).patch("/api/properties/prop-pid-update").send({
      pid: "ns_123-77",
    });

    expect(res.status).toBe(200);
    expect(res.body?.property?.pid).toBe("NS_123-77");
  });

  it("suppresses the pid prompt when the property already has a pid", async () => {
    seedDoc("properties", "prop-has-pid", {
      landlordId: "landlord-1",
      name: "Matched",
      addressLine1: "1 Registry St",
      city: "Halifax",
      province: "NS",
      pid: "1234567",
    });
    registryMocks.getPropertyRegistryProjection.mockResolvedValue({
      id: "halifax_r400_prop-has-pid",
      propertyId: "prop-has-pid",
      sourceKey: "halifax_r400",
      jurisdictionProvince: "NS",
      jurisdictionMunicipality: "Halifax",
      registryStatus: "verified",
      registryRecordId: "reg-1",
      registrationNumber: "REG-1",
      pid: "1234567",
      matchedAt: "2026-04-01T00:00:00.000Z",
      matchConfidence: 1,
      summary: "Verified",
      recommendedAction: "No action needed.",
      lastSourceRefreshAt: "2026-04-01T00:00:00.000Z",
      lastEvaluatedAt: "2026-04-01T00:00:00.000Z",
      createdAt: "2026-04-01T00:00:00.000Z",
      updatedAt: "2026-04-01T00:00:00.000Z",
    });

    const app = await createApp();
    const res = await request(app).get("/api/properties/prop-has-pid/registry-status");

    expect(res.status).toBe(200);
    expect(res.body?.pidPrompt).toMatchObject({
      propertyPidMissing: false,
      registryPidAvailable: true,
      pidPromptEligible: false,
      pidPromptMessage: null,
    });
  });

  it("returns pid prompt data when the property pid is missing and registry pid exists", async () => {
    seedDoc("properties", "prop-missing-pid", {
      landlordId: "landlord-1",
      name: "Missing PID",
      addressLine1: "2 Registry St",
      city: "Halifax",
      province: "NS",
    });
    registryMocks.getPropertyRegistryProjection.mockResolvedValue({
      id: "halifax_r400_prop-missing-pid",
      propertyId: "prop-missing-pid",
      sourceKey: "halifax_r400",
      jurisdictionProvince: "NS",
      jurisdictionMunicipality: "Halifax",
      registryStatus: "manual_review",
      registryRecordId: "reg-2",
      registrationNumber: "REG-2",
      pid: "7654321",
      matchedAt: null,
      matchConfidence: 0.8,
      summary: "Manual review in progress",
      recommendedAction: "No action needed.",
      lastSourceRefreshAt: "2026-04-01T00:00:00.000Z",
      lastEvaluatedAt: "2026-04-01T00:00:00.000Z",
      createdAt: "2026-04-01T00:00:00.000Z",
      updatedAt: "2026-04-01T00:00:00.000Z",
    });

    const app = await createApp();
    const res = await request(app).get("/api/properties/prop-missing-pid/registry-status");

    expect(res.status).toBe(200);
    expect(res.body?.pidPrompt).toMatchObject({
      propertyPidMissing: true,
      registryPidAvailable: true,
      pidPromptEligible: true,
      registryPid: "7654321",
    });
    expect(String(res.body?.pidPrompt?.pidPromptMessage || "")).toContain("Property PID missing");
  });

  it("suppresses the pid prompt when no registry pid exists", async () => {
    seedDoc("properties", "prop-no-registry-pid", {
      landlordId: "landlord-1",
      name: "No Registry PID",
      addressLine1: "3 Registry St",
      city: "Halifax",
      province: "NS",
    });
    registryMocks.getPropertyRegistryProjection.mockResolvedValue({
      id: "halifax_r400_prop-no-registry-pid",
      propertyId: "prop-no-registry-pid",
      sourceKey: "halifax_r400",
      jurisdictionProvince: "NS",
      jurisdictionMunicipality: "Halifax",
      registryStatus: "manual_review",
      registryRecordId: "reg-3",
      registrationNumber: "REG-3",
      pid: null,
      matchedAt: null,
      matchConfidence: 0.72,
      summary: "Manual review in progress",
      recommendedAction: "No action needed.",
      lastSourceRefreshAt: "2026-04-01T00:00:00.000Z",
      lastEvaluatedAt: "2026-04-01T00:00:00.000Z",
      createdAt: "2026-04-01T00:00:00.000Z",
      updatedAt: "2026-04-01T00:00:00.000Z",
    });

    const app = await createApp();
    const res = await request(app).get("/api/properties/prop-no-registry-pid/registry-status");

    expect(res.status).toBe(200);
    expect(res.body?.pidPrompt).toMatchObject({
      propertyPidMissing: true,
      registryPidAvailable: false,
      pidPromptEligible: false,
    });
  });

  it("loads Halifax submission assistant data with property and owner prefills", async () => {
    seedDoc("properties", "prop-submission", {
      landlordId: "landlord-1",
      ownerUserId: "landlord-1",
      name: "Harbour View",
      pid: "PID-123",
      addressLine1: "12 Wharf Street",
      city: "Halifax",
      province: "NS",
      postalCode: "B3H 1A1",
      country: "Canada",
      totalUnits: 8,
      createdAt: "2026-04-05T00:00:00.000Z",
    });
    seedDoc("landlords", "landlord-1", {
      email: "owner@example.com",
      contactName: "Jordan Harbour",
      phone: "902-555-0101",
    });

    const app = await createApp();
    const res = await request(app).get("/api/properties/prop-submission/registry-submission/halifax");

    expect(res.status).toBe(200);
    expect(res.body?.submission?.fieldValues?.siteAddress?.line1).toBe("12 Wharf Street");
    expect(res.body?.submission?.fieldValues?.propertyIdentifierPid).toBe("PID-123");
    expect(res.body?.submission?.fieldValues?.owner?.email).toBe("owner@example.com");
    expect(Array.isArray(res.body?.fieldMap)).toBe(true);
  });

  it("saves Halifax submission assistant answers and returns readiness", async () => {
    seedDoc("properties", "prop-submission-save", {
      landlordId: "landlord-1",
      ownerUserId: "landlord-1",
      name: "Harbour View",
      addressLine1: "12 Wharf Street",
      city: "Halifax",
      province: "NS",
      postalCode: "B3H 1A1",
      country: "Canada",
      totalUnits: 8,
      createdAt: "2026-04-05T00:00:00.000Z",
    });
    seedDoc("landlords", "landlord-1", {
      email: "owner@example.com",
      contactName: "Jordan Harbour",
      phone: "902-555-0101",
      mailingAddressLine1: "55 Owner Lane",
      mailingCity: "Halifax",
      mailingProvince: "NS",
      mailingPostalCode: "B3H 2B2",
      mailingCountry: "Canada",
    });

    const app = await createApp();
    const res = await request(app).put("/api/properties/prop-submission-save/registry-submission/halifax").send({
      fieldValues: {
        primaryContactSameAsOwner: true,
        moreThanFiveBuildings: false,
        buildings: [
          {
            id: "building-1",
            primaryAddress: {
              line1: "12 Wharf Street",
              line2: "",
              city: "Halifax",
              province: "NS",
              postalCode: "B3H 1A1",
              country: "Canada",
            },
            rentalUnitTypes: ["Apartment(s)"],
            residentialUnitsRented: 8,
            shortTermRentalUnits: 0,
            buildingType: "Apartment building",
            totalResidentialUnits: 8,
            hasCommercialUnits: false,
          },
        ],
      },
      declarations: {
        acknowledged: true,
        maintenancePlanConfirmed: true,
        ownerDeclarationConfirmed: true,
        informationAccurateConfirmed: true,
      },
    });

    expect(res.status).toBe(200);
    expect(res.body?.submission?.declarations?.acknowledged).toBe(true);
    expect(res.body?.submission?.fieldValues?.buildings?.[0]?.buildingType).toBe("Apartment building");
    expect(typeof res.body?.submission?.validation?.readinessScore).toBe("number");
  });

  it("creates a ready package and filing request from the canonical draft", async () => {
    const app = await createApp();
    seedDoc("properties", "prop-1", {
      landlordId: "landlord-1",
      addressLine1: "12 Wharf Street",
      city: "Halifax",
      province: "NS",
      postalCode: "B3H 1A1",
      country: "Canada",
      totalUnits: 8,
    });
    const draft = buildSubmissionDraft({
      id: "prop-1",
      addressLine1: "12 Wharf Street",
      city: "Halifax",
      province: "NS",
      postalCode: "B3H 1A1",
      country: "Canada",
      totalUnits: 8,
    });
    seedDoc("propertyRegistrySubmissions", draft.draftId, draft);

    const readyRes = await request(app).post("/api/properties/prop-1/registry-submission/ready").send({});
    expect(readyRes.status).toBe(200);
    expect(readyRes.body.ready.schemaVersion).toBe(3);
    expect(readyRes.body.ready.status).toBe("ready_to_file");

    const requestRes = await request(app).post("/api/properties/prop-1/registry-submission/filing-request").send({});
    expect(requestRes.status).toBe(200);
    expect(requestRes.body.request.adapterKey).toBe("halifax_rental_registry_manual_portal_v1");
    expect(requestRes.body.request.status).toBe("ready_to_file");
  });

  it("blocks filing workflow actions for free-tier users while leaving draft prep available", async () => {
    seedDoc("properties", "prop-free", {
      landlordId: "landlord-1",
      addressLine1: "12 Wharf Street",
      city: "Halifax",
      province: "NS",
      postalCode: "B3H 1A1",
      country: "Canada",
      pid: "PID-123",
      createdAt: "2026-04-05T00:00:00.000Z",
      updatedAt: "2026-04-05T00:00:00.000Z",
    });

    const submission = buildSubmissionDraft({
      id: "prop-free",
      addressLine1: "12 Wharf Street",
      city: "Halifax",
      province: "NS",
      postalCode: "B3H 1A1",
      country: "Canada",
    });
    seedDoc("propertyRegistrySubmissions", submission.draftId, submission);

    const app = await createAppForUser({
      id: "landlord-1",
      landlordId: "landlord-1",
      role: "landlord",
      plan: "free",
      capabilities: [],
    });

    const exportRes = await request(app).get("/api/properties/prop-free/registry-submission/export");
    expect(exportRes.status).toBe(200);

    const readyRes = await request(app).post("/api/properties/prop-free/registry-submission/ready").send({});
    expect(readyRes.status).toBe(200);

    const requestRes = await request(app).post("/api/properties/prop-free/registry-submission/filing-request").send({});
    expect(requestRes.status).toBe(403);
    expect(requestRes.body).toMatchObject({
      error: "upgrade_required",
      requiredCapability: "registry_filing_access",
      requiredPlan: "pro",
    });
  });

  it("blocks filing attempts history for users without the history capability", async () => {
    seedDoc("properties", "prop-history", {
      landlordId: "landlord-1",
      addressLine1: "12 Wharf Street",
      city: "Halifax",
      province: "NS",
      postalCode: "B3H 1A1",
      country: "Canada",
      pid: "PID-123",
      createdAt: "2026-04-05T00:00:00.000Z",
      updatedAt: "2026-04-05T00:00:00.000Z",
    });

    const submission = buildSubmissionDraft({
      id: "prop-history",
      addressLine1: "12 Wharf Street",
      city: "Halifax",
      province: "NS",
      postalCode: "B3H 1A1",
      country: "Canada",
    });
    seedDoc("propertyRegistrySubmissions", submission.draftId, submission);

    const app = await createAppForUser({
      id: "landlord-1",
      landlordId: "landlord-1",
      role: "landlord",
      plan: "starter",
      capabilities: [],
    });

    const res = await request(app).get("/api/properties/prop-history/registry-submission/filing-attempts");
    expect(res.status).toBe(403);
    expect(res.body).toMatchObject({
      error: "upgrade_required",
      requiredCapability: "registry_attempts_history",
    });
  });

  it("persists filing lifecycle transitions and exposes filing status in registry-status", async () => {
    const app = await createApp();
    seedDoc("properties", "prop-1", {
      landlordId: "landlord-1",
      addressLine1: "12 Wharf Street",
      city: "Halifax",
      province: "NS",
      postalCode: "B3H 1A1",
      country: "Canada",
      totalUnits: 8,
    });
    const draft = buildSubmissionDraft({
      id: "prop-1",
      addressLine1: "12 Wharf Street",
      city: "Halifax",
      province: "NS",
      postalCode: "B3H 1A1",
      country: "Canada",
      totalUnits: 8,
    });
    seedDoc("propertyRegistrySubmissions", draft.draftId, draft);

    await request(app).post("/api/properties/prop-1/registry-submission/ready").send({});
    await request(app).post("/api/properties/prop-1/registry-submission/filing-request").send({});
    const patchRes = await request(app)
      .patch("/api/properties/prop-1/registry-submission/filing-request")
      .send({
        status: "filed_pending_confirmation",
        note: "Submitted through Halifax portal.",
        referenceNumbers: [{ type: "submission_id", value: "SUB-12345" }],
      });

    expect(patchRes.status).toBe(200);
    expect(patchRes.body.filing.currentStatus).toBe("filed_pending_confirmation");
    expect(patchRes.body.filing.result.referenceNumbers[0].value).toBe("SUB-12345");

    const statusRes = await request(app).get("/api/properties/prop-1/registry-status");
    expect(statusRes.status).toBe(200);
    expect(statusRes.body.filing.currentStatus).toBe("filed_pending_confirmation");
  });

  it("lists filing attempts newest-first and preserves prior attempts when retrying a rejected attempt", async () => {
    const app = await createApp();
    seedDoc("properties", "prop-1", {
      landlordId: "landlord-1",
      addressLine1: "12 Wharf Street",
      city: "Halifax",
      province: "NS",
      postalCode: "B3H 1A1",
      country: "Canada",
      totalUnits: 8,
    });
    const draft = buildSubmissionDraft({
      id: "prop-1",
      addressLine1: "12 Wharf Street",
      city: "Halifax",
      province: "NS",
      postalCode: "B3H 1A1",
      country: "Canada",
      totalUnits: 8,
    });
    seedDoc("propertyRegistrySubmissions", draft.draftId, draft);

    await request(app).post("/api/properties/prop-1/registry-submission/ready").send({});
    const requestRes = await request(app).post("/api/properties/prop-1/registry-submission/filing-request").send({});
    expect(requestRes.status).toBe(200);

    const rejectRes = await request(app)
      .patch("/api/properties/prop-1/registry-submission/filing-request")
      .send({
        attemptId: requestRes.body.request.attemptId,
        status: "rejected",
        note: "Municipality requested corrections.",
        referenceNumbers: [{ type: "external_reference", value: "RJ-22" }],
      });
    expect(rejectRes.status).toBe(200);
    expect(rejectRes.body.filing.latestAttempt.status).toBe("rejected");

    const retryRes = await request(app)
      .post("/api/properties/prop-1/registry-submission/filing-attempts/retry")
      .send({ attemptId: requestRes.body.request.attemptId });
    expect(retryRes.status).toBe(200);
    expect(retryRes.body.attempt.attemptNumber).toBe(2);
    expect(retryRes.body.attempt.status).toBe("ready_to_file");
    expect(retryRes.body.request.attemptId).toBe(retryRes.body.attempt.attemptId);

    const historyRes = await request(app).get("/api/properties/prop-1/registry-submission/filing-attempts");
    expect(historyRes.status).toBe(200);
    expect(historyRes.body.attempts).toHaveLength(2);
    expect(historyRes.body.attempts[0].attemptNumber).toBe(2);
    expect(historyRes.body.attempts[1].attemptNumber).toBe(1);
    expect(historyRes.body.latestAttempt.attemptId).toBe(retryRes.body.attempt.attemptId);

    const statusRes = await request(app).get("/api/properties/prop-1/registry-status");
    expect(statusRes.status).toBe(200);
    expect(statusRes.body.filing.currentStatus).toBe("ready_to_file");
    expect(statusRes.body.filing.latestAttempt.attemptNumber).toBe(2);
  });

  it("blocks retry when the ready package is stale relative to the draft", async () => {
    const app = await createApp();
    seedDoc("properties", "prop-1", {
      landlordId: "landlord-1",
      addressLine1: "12 Wharf Street",
      city: "Halifax",
      province: "NS",
      postalCode: "B3H 1A1",
      country: "Canada",
      totalUnits: 8,
    });
    const draft = buildSubmissionDraft({
      id: "prop-1",
      addressLine1: "12 Wharf Street",
      city: "Halifax",
      province: "NS",
      postalCode: "B3H 1A1",
      country: "Canada",
      totalUnits: 8,
    });
    seedDoc("propertyRegistrySubmissions", draft.draftId, draft);

    await request(app).post("/api/properties/prop-1/registry-submission/ready").send({});
    const requestRes = await request(app).post("/api/properties/prop-1/registry-submission/filing-request").send({});
    await request(app)
      .patch("/api/properties/prop-1/registry-submission/filing-request")
      .send({
        attemptId: requestRes.body.request.attemptId,
        status: "failed",
        note: "Portal timeout.",
      });

    seedDoc("propertyRegistrySubmissions", draft.draftId, {
      ...draft,
      timestamps: {
        ...draft.timestamps,
        updatedAt: "2026-04-07T00:00:00.000Z",
      },
    });

    const retryRes = await request(app)
      .post("/api/properties/prop-1/registry-submission/filing-attempts/retry")
      .send({ attemptId: requestRes.body.request.attemptId });

    expect(retryRes.status).toBe(400);
    expect(String(retryRes.body.message || "")).toContain("Regenerate the ready package");
  });

  it("does not allow retrying a confirmed attempt", async () => {
    const app = await createApp();
    seedDoc("properties", "prop-1", {
      landlordId: "landlord-1",
      addressLine1: "12 Wharf Street",
      city: "Halifax",
      province: "NS",
      postalCode: "B3H 1A1",
      country: "Canada",
      totalUnits: 8,
    });
    const draft = buildSubmissionDraft({
      id: "prop-1",
      addressLine1: "12 Wharf Street",
      city: "Halifax",
      province: "NS",
      postalCode: "B3H 1A1",
      country: "Canada",
      totalUnits: 8,
    });
    seedDoc("propertyRegistrySubmissions", draft.draftId, draft);

    await request(app).post("/api/properties/prop-1/registry-submission/ready").send({});
    const requestRes = await request(app).post("/api/properties/prop-1/registry-submission/filing-request").send({});
    await request(app)
      .patch("/api/properties/prop-1/registry-submission/filing-request")
      .send({
        attemptId: requestRes.body.request.attemptId,
        status: "filed_confirmed",
        note: "Confirmed by Halifax.",
        referenceNumbers: [{ type: "submission_id", value: "SUB-12345" }],
      });

    const retryRes = await request(app)
      .post("/api/properties/prop-1/registry-submission/filing-attempts/retry")
      .send({ attemptId: requestRes.body.request.attemptId });

    expect(retryRes.status).toBe(400);
    expect(String(retryRes.body.message || "")).toContain("cannot be retried");
  });
});
