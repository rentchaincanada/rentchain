import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { dbMock, resetDb, seedDoc } = vi.hoisted(() => {
  const collections = new Map<string, Map<string, { id: string; data: any }>>();

  function ensureCollection(name: string) {
    if (!collections.has(name)) collections.set(name, new Map());
    return collections.get(name)!;
  }

  const dbMock = {
    collection: (name: string) => ({
      doc: (id: string) => {
        const col = ensureCollection(name);
        return {
          id,
          get: async () => {
            const existing = col.get(id);
            return {
              id,
              exists: Boolean(existing),
              data: () => existing?.data,
            };
          },
        };
      },
    }),
  };

  return {
    dbMock,
    resetDb: () => collections.clear(),
    seedDoc: (collection: string, id: string, data: any) => {
      ensureCollection(collection).set(id, { id, data });
    },
  };
});

vi.mock("../../firebase", () => ({
  db: dbMock,
  FieldValue: {
    increment: (n: number) => ({ __op: "inc", n }),
    serverTimestamp: () => Date.now(),
  },
}));

vi.mock("../../middleware/requireAuth", () => ({
  requireAuth: (req: any, _res: any, next: any) => {
    req.user = { id: "landlord-1", landlordId: "landlord-1", role: "landlord", plan: "starter" };
    next();
  },
}));

vi.mock("../../imports/unitConflictCheck", () => ({
  fetchExistingUnitNumbersForProperty: vi.fn(async () => new Set<string>()),
}));

async function createPropertiesApp() {
  const router = (await import("../propertiesRoutes")).default;
  const app = express();
  app.use(express.json());
  app.use("/api/properties", router);
  return app;
}

async function createUnitImportApp() {
  const router = (await import("../unitImportRoutes")).default;
  const app = express();
  app.use(express.json());
  app.use("/api/properties/:propertyId/units", router);
  return app;
}

describe("unit CSV preview routes", () => {
  beforeEach(() => {
    vi.resetModules();
    resetDb();
  });

  it("previews property creation CSV without mutating a property", async () => {
    const app = await createPropertiesApp();

    const res = await request(app).post("/api/properties/units/csv-preview").send({
      csvText: "unitNumber,marketRent,beds,baths,sqft,status\n101,1850,1,1,610,vacant",
    });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.preview.rows[0]).toMatchObject({
      row: 2,
      status: "valid",
      data: { unitNumber: "101", rent: 1850, bedrooms: 1, bathrooms: 1, sqft: 610, status: "vacant" },
    });
  });

  it("previews Numbers-style CSV through the property creation route", async () => {
    const app = await createPropertiesApp();

    const res = await request(app).post("/api/properties/units/csv-preview").send({
      csvText: '\uFEFFunitNumber,marketRent,beds,baths,sqft,status\r101,"$1,850",1,1,610,vacant\r102,1\u00A0650,0,1,450,leased',
    });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.preview.rows).toEqual([
      expect.objectContaining({
        row: 2,
        status: "valid",
        data: expect.objectContaining({ unitNumber: "101", rent: 1850, status: "vacant" }),
      }),
      expect.objectContaining({
        row: 3,
        status: "valid",
        data: expect.objectContaining({ unitNumber: "102", rent: 1650, status: "occupied" }),
      }),
    ]);
  });

  it("previews property unit table CSV through the property-scoped route", async () => {
    seedDoc("properties", "prop-1", { landlordId: "landlord-1" });
    const app = await createUnitImportApp();

    const res = await request(app).post("/api/properties/prop-1/units/csv-parse").send({
      csvText: "unitNumber,marketRent,privateColumn\n101,1850,secret",
    });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(false);
    expect(res.body.headers.unknown).toEqual(["privateColumn"]);
    expect(res.body.preview.errors).toEqual([
      expect.objectContaining({ code: "HEADER_UNKNOWN", field: "privateColumn" }),
    ]);
  });

  it("accepts occupied metadata headers through the property-scoped route", async () => {
    seedDoc("properties", "prop-1", { landlordId: "landlord-1" });
    const app = await createUnitImportApp();

    const res = await request(app).post("/api/properties/prop-1/units/csv-parse").send({
      csvText: "unitNumber,marketRent,beds,baths,sqft,status,occupantName,leaseEndDate\n301,2100,2,1,850,occupied,Jane Tenant,2027-06-10",
    });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.headers.unknown).toEqual([]);
    expect(res.body.headers.expected).toEqual(
      expect.arrayContaining(["unitNumber", "marketRent", "beds", "baths", "sqft", "status", "occupantName", "leaseEndDate"])
    );
    expect(res.body.preview.errors).toEqual([]);
    expect(res.body.preview.rows[0]).toMatchObject({
      row: 2,
      status: "valid",
      data: expect.objectContaining({
        unitNumber: "301",
        status: "occupied",
        occupantName: "Jane Tenant",
        leaseEndDate: "2027-06-10",
      }),
    });
  });

  it("previews Numbers-style CSV through the property-scoped route", async () => {
    seedDoc("properties", "prop-1", { landlordId: "landlord-1" });
    const app = await createUnitImportApp();

    const csvText = Buffer.from("\uFEFFunitNumber,marketRent,beds\r101,1850,1", "utf16le").toString("utf8");
    const res = await request(app).post("/api/properties/prop-1/units/csv-parse").send({ csvText });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.preview.rows[0]).toMatchObject({
      row: 2,
      status: "valid",
      data: { unitNumber: "101", rent: 1850, bedrooms: 1 },
    });
  });
});
