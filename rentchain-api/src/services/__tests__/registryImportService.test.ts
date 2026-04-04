import { beforeEach, describe, expect, it, vi } from "vitest";

type DocData = Record<string, any>;

const state = vi.hoisted(() => ({
  collections: new Map<string, Map<string, DocData>>(),
  idCounter: 0,
}));

function resetDb() {
  state.collections = new Map();
  state.idCounter = 0;
}

function ensureCollection(name: string) {
  if (!state.collections.has(name)) state.collections.set(name, new Map());
  return state.collections.get(name)!;
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

function mergeDoc(target: DocData | undefined, source: DocData, merge = false) {
  if (!merge || !target) return clone(source);
  return { ...clone(target), ...clone(source) };
}

function buildQuery(collectionName: string, filters: Array<{ field: string; value: any }> = [], orderByField?: string, orderDir: "asc" | "desc" = "asc", limitCount?: number) {
  return {
    where(field: string, _op: string, value: any) {
      return buildQuery(collectionName, [...filters, { field, value }], orderByField, orderDir, limitCount);
    },
    orderBy(field: string, dir: "asc" | "desc" = "asc") {
      return buildQuery(collectionName, filters, field, dir, limitCount);
    },
    limit(count: number) {
      return buildQuery(collectionName, filters, orderByField, orderDir, count);
    },
    async get() {
      const collection = ensureCollection(collectionName);
      let docs = Array.from(collection.entries()).map(([id, data]) => ({
        id,
        exists: true,
        data: () => clone(data),
      }));
      docs = docs.filter((doc) =>
        filters.every((filter) => String(doc.data()?.[filter.field] ?? "") === String(filter.value ?? ""))
      );
      if (orderByField) {
        docs.sort((a, b) => {
          const av = a.data()?.[orderByField];
          const bv = b.data()?.[orderByField];
          const result = String(av ?? "").localeCompare(String(bv ?? ""));
          return orderDir === "desc" ? -result : result;
        });
      }
      if (typeof limitCount === "number") docs = docs.slice(0, limitCount);
      return { docs, empty: docs.length === 0 };
    },
  };
}

const dbMock = {
  collection(name: string) {
    const collection = ensureCollection(name);
    return {
      doc(id?: string) {
        const docId = id || `doc_${++state.idCounter}`;
        return {
          id: docId,
          async get() {
            const data = collection.get(docId);
            return {
              id: docId,
              exists: !!data,
              data: () => (data ? clone(data) : undefined),
            };
          },
          async set(data: DocData, options?: { merge?: boolean }) {
            const current = collection.get(docId);
            collection.set(docId, mergeDoc(current, data, options?.merge));
          },
        };
      },
      async add(data: DocData) {
        const docId = `doc_${++state.idCounter}`;
        collection.set(docId, clone(data));
        return { id: docId };
      },
      where(field: string, _op: string, value: any) {
        return buildQuery(name, [{ field, value }]);
      },
      orderBy(field: string, dir: "asc" | "desc" = "asc") {
        return buildQuery(name, [], field, dir);
      },
      async get() {
        return buildQuery(name).get();
      },
    };
  },
};

vi.mock("../../config/firebase", () => ({
  db: dbMock,
}));

vi.mock("../../imports/firestoreBatch", () => ({
  commitInBatches: async (ops: Array<(batch: { set: (ref: any, data: any, options?: any) => void }) => void>) => {
    for (const op of ops) {
      op({
        set(ref: any, data: any, options?: any) {
          return ref.set(data, options);
        },
      });
    }
  },
}));

vi.mock("../firestorePropertiesService", () => ({
  getPropertyById: vi.fn(async () => null),
}));

describe("registryImportService", () => {
  beforeEach(() => {
    resetDb();
    vi.resetModules();
  });

  it("returns a stable empty list for imports when no records exist", async () => {
    const { listRegistryImports } = await import("../registry/registryImportService");
    await expect(listRegistryImports("halifax_r400")).resolves.toEqual([]);
  });

  it("rejects malformed property ids and missing property ids cleanly", async () => {
    const { applyRegistryMatchOverride } = await import("../registry/registryImportService");

    ensureCollection("registryRecordsNormalized").set("record-1", {
      id: "record-1",
      sourceKey: "halifax_r400",
      registryRecordId: "reg-1",
      registrationNumber: "REG-1",
      registrationStatusNormalized: "registered",
      addressRaw: "123 Example St",
      updatedAt: "2026-04-03T00:00:00.000Z",
    });

    await expect(
      applyRegistryMatchOverride({
        normalizedRecordId: "record-1",
        action: "attach",
        propertyId: "!!!",
        reason: "manual review",
        actorId: "admin-1",
      })
    ).rejects.toMatchObject({ code: "invalid_property_id", statusCode: 400 });

    await expect(
      applyRegistryMatchOverride({
        normalizedRecordId: "record-1",
        action: "attach",
        propertyId: "prop_missing_123",
        reason: "manual review",
        actorId: "admin-1",
      })
    ).rejects.toMatchObject({ code: "property_not_found", statusCode: 404 });
  });

  it("attaches, ignores, and later re-attaches a registry record while refreshing property projections", async () => {
    const { applyRegistryMatchOverride, getPropertyRegistryReview } = await import("../registry/registryImportService");

    ensureCollection("properties").set("prop-old", {
      id: "prop-old",
      landlordId: "landlord-1",
      name: "Old Halifax Property",
      addressLine1: "111 Old St",
      city: "Halifax",
      province: "NS",
    });
    ensureCollection("properties").set("prop-new", {
      id: "prop-new",
      landlordId: "landlord-2",
      name: "New Halifax Property",
      addressLine1: "222 New St",
      city: "Halifax",
      province: "NS",
    });
    ensureCollection("registryRecordsNormalized").set("record-1", {
      id: "record-1",
      importBatchId: "import-1",
      sourceKey: "halifax_r400",
      jurisdictionCountry: "CA",
      jurisdictionProvince: "NS",
      jurisdictionMunicipality: "Halifax",
      registryCategory: "rental_registry",
      registryRecordId: "reg-1",
      registrationNumber: "REG-1",
      pid: "1234567",
      addressRaw: "222 New St",
      primaryAddressCandidate: "222 new st",
      addressCandidates: ["222 new st"],
      addressNormalized: "222 new st",
      postalCode: null,
      rentalUnitTypeRaw: "Apartment",
      rentalUnitTypeNormalized: "apartment",
      buildingTypeRaw: "Apartment",
      buildingTypeNormalized: "apartment_building",
      registeredUnits: 3,
      numberOfFloors: 2,
      sharedFacilities: null,
      registrationStatusRaw: "Y",
      registrationStatusNormalized: "registered",
      registrationIssuedAt: "2026-04-01T00:00:00.000Z",
      lat: null,
      lng: null,
      sourceConfidence: 0.94,
      internalDiagnostics: {
        unmatchedReasons: [],
        pidSourceFieldsChecked: ["pid"],
        addressCandidateCount: 1,
      },
      importedAt: "2026-04-01T00:00:00.000Z",
      updatedAt: "2026-04-01T00:00:00.000Z",
    });
    ensureCollection("registryMatches").set("halifax_r400_reg-1", {
      id: "halifax_r400_reg-1",
      sourceKey: "halifax_r400",
      registryRecordId: "reg-1",
      normalizedRecordId: "record-1",
      propertyId: "prop-old",
      landlordId: "landlord-1",
      matchMethod: "manual",
      matchScore: 1,
      matchStatus: "matched",
      mismatchReasons: [],
      reviewedBy: "admin-0",
      reviewedAt: "2026-04-01T00:00:00.000Z",
      overrideReason: "seed",
      createdAt: "2026-04-01T00:00:00.000Z",
      updatedAt: "2026-04-01T00:00:00.000Z",
    });

    await applyRegistryMatchOverride({
      normalizedRecordId: "record-1",
      action: "ignore",
      reason: "ignore for review",
      actorId: "admin-1",
    });

    const oldProjection = ensureCollection("propertyRegistryStatus").get("halifax_r400_prop-old");
    expect(oldProjection?.registryStatus).toBe("not_found");

    await applyRegistryMatchOverride({
      normalizedRecordId: "record-1",
      action: "attach",
      propertyId: "prop-new",
      reason: "manual attach",
      actorId: "admin-1",
    });

    const match = ensureCollection("registryMatches").get("halifax_r400_reg-1");
    expect(match?.matchStatus).toBe("matched");
    expect(match?.propertyId).toBe("prop-new");

    const newProjection = ensureCollection("propertyRegistryStatus").get("halifax_r400_prop-new");
    expect(newProjection?.registryStatus).toBe("verified");
    expect(newProjection?.registrationNumber).toBe("REG-1");

    const auditEvents = Array.from(ensureCollection("registryAuditLog").values());
    expect(auditEvents.some((event) => event.eventType === "match_overridden" && event.propertyId === "prop-new")).toBe(true);

    const propertyReview = await getPropertyRegistryReview("prop-new");
    expect(propertyReview?.projection?.registryStatus).toBe("verified");
  });

  it("normalizes Halifax fields using the adapter contract", async () => {
    const { HalifaxR400Adapter } = await import("../registry/adapters/HalifaxR400Adapter");
    const adapter = new HalifaxR400Adapter();
    const source = adapter.getSourceDefinition();
    const importRecord = {
      id: "import-1",
      sourceKey: "halifax_r400",
      sourceFileName: "halifax.csv",
      sourceFileStoragePath: null,
      importBatchId: "import-1",
      rowCount: 1,
      parsedRowCount: 1,
      normalizedRowCount: 0,
      matchedRowCount: 0,
      unmatchedRowCount: 0,
      mismatchRowCount: 0,
      ignoredRowCount: 0,
      skippedRowCount: 0,
      status: "processing" as const,
      errorSummary: null,
      diagnostics: {
        missingPidCount: 0,
        missingAddressCount: 0,
        unsupportedStatusCount: 0,
        invalidNumericFieldCount: 0,
        duplicateRowHashCount: 0,
      },
      startedAt: "2026-04-03T00:00:00.000Z",
      completedAt: null,
      createdBy: "admin-1",
      createdAt: "2026-04-03T00:00:00.000Z",
    };
    const parsed = adapter.parse(
      'OBJECTID,Registration Number,PID,Address,Rental Unit Type,Building Type,Registered Units,Number of Floors,Shared Facilities,Registered,Date Registration Issued,GlobalID,x,y\n1,REG-22,1234567,"123 Example Street, Halifax",Apartment,Apartment,4,3,Yes,Y,2026-03-12,glob-1,-63.57,44.64'
    );
    const raw = adapter.mapRawRow(parsed[0], 0, {
      importRecord,
      source,
      importedAt: "2026-04-03T00:00:00.000Z",
    });
    const normalized = adapter.normalizeRawRow(raw, {
      importRecord,
      source,
      importedAt: "2026-04-03T00:00:00.000Z",
    });

    expect(normalized.registryRecordId).toBe("REG-22");
    expect(normalized.pid).toBe("1234567");
    expect(normalized.registrationStatusNormalized).toBe("registered");
    expect(normalized.addressNormalized).toContain("123 example st");
    expect(normalized.addressCandidates).toEqual(expect.arrayContaining([normalized.addressNormalized]));
  });
});
