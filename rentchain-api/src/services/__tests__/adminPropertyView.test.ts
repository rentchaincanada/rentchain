import { beforeEach, describe, expect, it } from "vitest";

const { fakeDb, resetFakeDb, seedDoc } = (() => {
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
        return { docs, empty: docs.length === 0, size: docs.length, forEach: (fn: any) => docs.forEach(fn) };
      },
    };
  }

  return {
    resetFakeDb: () => store.clear(),
    seedDoc: (name: string, id: string, data: any) => ensureCollection(name).set(id, { id, data }),
    fakeDb: {
      collection: (name: string) => ({
        where: (field: string, op: string, value: any) => makeQuery(name, [{ field, op, value }]),
        get: async () => makeQuery(name).get(),
      }),
    },
  };
})();

describe("adminPropertyView", () => {
  beforeEach(() => {
    resetFakeDb();
    seedDoc("properties", "prop-1", {
      name: "Coburg Rd",
      addressLine1: "123 Coburg Rd",
      city: "Halifax",
      province: "NS",
      postalCode: "B3H 1Y5",
      ownerUserId: "owner-1",
      landlordId: "landlord-1",
      managerUserIds: ["manager-1"],
      createdAt: "2026-03-01T00:00:00.000Z",
      updatedAt: "2026-03-05T00:00:00.000Z",
    });
    seedDoc("properties", "prop-2", {
      name: "Summit",
      addressLine1: "88 Summit Ave",
      city: "Toronto",
      province: "ON",
      postalCode: "M5V 1A1",
      ownerUserId: "",
      landlordId: "landlord-2",
      managerUserIds: [],
      createdAt: "2026-03-02T00:00:00.000Z",
      updatedAt: "2026-03-04T00:00:00.000Z",
    });
    seedDoc("properties", "prop-3", {
      name: "Orphan Property",
      addressLine1: "1 Unknown St",
      city: "Montreal",
      province: "QC",
      postalCode: "H1H 1H1",
      ownerUserId: "",
      landlordId: "",
      managerUserIds: [],
      createdAt: "2026-03-03T00:00:00.000Z",
      updatedAt: "2026-03-03T00:00:00.000Z",
    });
    seedDoc("units", "unit-1", { propertyId: "prop-1", occupancyStatus: "occupied" });
    seedDoc("units", "unit-2", { propertyId: "prop-1", occupancyStatus: "vacant" });
    seedDoc("units", "unit-3", { propertyId: "prop-2", occupancyStatus: "occupied" });
  });

  it("returns only safe admin property view fields with counts", async () => {
    const { listAdminProperties } = await import("../admin/adminPropertyView");
    const result = await listAdminProperties({ firestore: fakeDb as any, page: 1, pageSize: 25 });

    expect(result.items[0]).toEqual(
      expect.objectContaining({
        id: expect.any(String),
        name: expect.anything(),
        ownerUserId: expect.anything(),
        landlordId: expect.anything(),
        managerUserIds: expect.any(Array),
        unitCount: expect.any(Number),
        occupiedUnitCount: expect.any(Number),
        vacantUnitCount: expect.any(Number),
        integrity: expect.any(Object),
      })
    );
    expect(result.items[0]).not.toHaveProperty("internalNotes");
  });

  it("filters by search and province", async () => {
    const { listAdminProperties } = await import("../admin/adminPropertyView");
    const result = await listAdminProperties({
      firestore: fakeDb as any,
      q: "coburg",
      province: "NS",
      page: 1,
      pageSize: 25,
    });

    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.id).toBe("prop-1");
  });

  it("filters by integrity states", async () => {
    const { listAdminProperties } = await import("../admin/adminPropertyView");
    const missingOwner = await listAdminProperties({ firestore: fakeDb as any, integrity: "missingOwner", page: 1, pageSize: 25 });
    const orphaned = await listAdminProperties({ firestore: fakeDb as any, integrity: "orphaned", page: 1, pageSize: 25 });

    expect(missingOwner.items.map((item) => item.id).sort()).toEqual(["prop-2", "prop-3"]);
    expect(orphaned.items.map((item) => item.id)).toEqual(["prop-3"]);
  });

  it("supports sort and pagination", async () => {
    const { listAdminProperties } = await import("../admin/adminPropertyView");
    const result = await listAdminProperties({
      firestore: fakeDb as any,
      sortBy: "name",
      sortDir: "asc",
      page: 2,
      pageSize: 1,
    });

    expect(result.total).toBe(3);
    expect(result.page).toBe(2);
    expect(result.pageSize).toBe(1);
    expect(result.hasMore).toBe(true);
    expect(result.items[0]?.name).toBe("Orphan Property");
  });
});
