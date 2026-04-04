import { beforeEach, describe, expect, it, vi } from "vitest";

type DocData = Record<string, any>;

const state = vi.hoisted(() => ({
  collections: new Map<string, Map<string, DocData>>(),
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

function buildQuery(collectionName: string, filters: Array<{ field: string; value: any }> = []) {
  return {
    where(field: string, _op: string, value: any) {
      return buildQuery(collectionName, [...filters, { field, value }]);
    },
    async get() {
      const docs = Array.from(ensureCollection(collectionName).entries())
        .map(([id, data]) => ({ id, data: () => clone(data) }))
        .filter((doc) => filters.every((filter) => String(doc.data()?.[filter.field] ?? "") === String(filter.value ?? "")));
      return { docs };
    },
  };
}

vi.mock("../../config/firebase", () => ({
  db: {
    collection(name: string) {
      return {
        where(field: string, op: string, value: any) {
          return buildQuery(name, [{ field, value }]);
        },
      };
    },
  },
}));

describe("registryMatchingService", () => {
  beforeEach(() => {
    resetDb();
  });

  it("matches by exact PID using supported internal PID fields", async () => {
    const { HalifaxR400Adapter } = await import("../registry/adapters/HalifaxR400Adapter");
    const { evaluateRegistryMatch } = await import("../registry/registryMatchingService");

    ensureCollection("properties").set("prop-1", {
      id: "prop-1",
      name: "Summit Building",
      addressLine1: "6420 Summit Street",
      city: "Halifax",
      province: "NS",
      postalCode: "B3L 1S1",
      metadata: { pid: "1234567" },
    });

    const match = await evaluateRegistryMatch({
      adapter: new HalifaxR400Adapter(),
      record: {
        id: "norm-1",
        importBatchId: "import-1",
        sourceKey: "halifax_r400",
        jurisdictionCountry: "CA",
        jurisdictionProvince: "NS",
        jurisdictionMunicipality: "Halifax",
        registryCategory: "rental_registry",
        registryRecordId: "reg-1",
        registrationNumber: "REG-1",
        pid: "1234567",
        addressRaw: "6420 SUMMIT STREET,HALIFAX,B3L 1S1",
        primaryAddressCandidate: "6420 summit st halifax ns b3l 1s1",
        addressCandidates: ["6420 summit st halifax ns b3l 1s1"],
        addressNormalized: "6420 summit st halifax ns b3l 1s1",
        postalCode: "B3L1S1",
        rentalUnitTypeRaw: null,
        rentalUnitTypeNormalized: null,
        buildingTypeRaw: null,
        buildingTypeNormalized: null,
        registeredUnits: 4,
        numberOfFloors: 3,
        sharedFacilities: null,
        registrationStatusRaw: "Y",
        registrationStatusNormalized: "registered",
        registrationIssuedAt: null,
        lat: null,
        lng: null,
        sourceConfidence: 0.94,
        internalDiagnostics: {
          unmatchedReasons: [],
          pidSourceFieldsChecked: ["pid", "metadata.pid"],
          addressCandidateCount: 1,
        },
        importedAt: "2026-04-04T00:00:00.000Z",
        updatedAt: "2026-04-04T00:00:00.000Z",
      },
    });

    expect(match.matchMethod).toBe("pid_exact");
    expect(match.matchStatus).toBe("matched");
    expect(match.propertyId).toBe("prop-1");
  });

  it("falls through safely when a source PID is present but no property PID matches", async () => {
    const { HalifaxR400Adapter } = await import("../registry/adapters/HalifaxR400Adapter");
    const { evaluateRegistryMatch } = await import("../registry/registryMatchingService");

    ensureCollection("properties").set("prop-1", {
      id: "prop-1",
      name: "Summit Building",
      addressLine1: "10 Other Street",
      city: "Halifax",
      province: "NS",
      postalCode: "B3L 1S1",
    });

    const match = await evaluateRegistryMatch({
      adapter: new HalifaxR400Adapter(),
      record: {
        id: "norm-2",
        importBatchId: "import-1",
        sourceKey: "halifax_r400",
        jurisdictionCountry: "CA",
        jurisdictionProvince: "NS",
        jurisdictionMunicipality: "Halifax",
        registryCategory: "rental_registry",
        registryRecordId: "reg-2",
        registrationNumber: "REG-2",
        pid: "9999999",
        addressRaw: "6420 SUMMIT STREET,HALIFAX,B3L 1S1",
        primaryAddressCandidate: "6420 summit st halifax ns b3l 1s1",
        addressCandidates: ["6420 summit st halifax ns b3l 1s1"],
        addressNormalized: "6420 summit st halifax ns b3l 1s1",
        postalCode: "B3L1S1",
        rentalUnitTypeRaw: null,
        rentalUnitTypeNormalized: null,
        buildingTypeRaw: null,
        buildingTypeNormalized: null,
        registeredUnits: 4,
        numberOfFloors: 3,
        sharedFacilities: null,
        registrationStatusRaw: "Y",
        registrationStatusNormalized: "registered",
        registrationIssuedAt: null,
        lat: null,
        lng: null,
        sourceConfidence: 0.94,
        internalDiagnostics: {
          unmatchedReasons: [],
          pidSourceFieldsChecked: ["pid", "metadata.pid"],
          addressCandidateCount: 1,
        },
        importedAt: "2026-04-04T00:00:00.000Z",
        updatedAt: "2026-04-04T00:00:00.000Z",
      },
    });

    expect(match.matchStatus === "unmatched" || match.matchStatus === "possible_match").toBe(true);
    expect(match.mismatchReasons).toContain("no_pid_match");
  });

  it("normalizes Halifax multi-address rows into multiple address candidates", async () => {
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
      startedAt: "2026-04-04T00:00:00.000Z",
      completedAt: null,
      createdBy: "admin-1",
      createdAt: "2026-04-04T00:00:00.000Z",
    };

    const raw = adapter.mapRawRow(
      {
        OBJECTID: "1",
        "Registration Number": "REG-3",
        PID: "2222222",
        Address: "6420 SUMMIT STREET,6428 SUMMIT STREET,HALIFAX,B3L 1S1",
      },
      0,
      { importRecord, source, importedAt: "2026-04-04T00:00:00.000Z" }
    );
    const normalized = adapter.normalizeRawRow(raw, {
      importRecord,
      source,
      importedAt: "2026-04-04T00:00:00.000Z",
    });

    expect(normalized.addressCandidates).toEqual(
      expect.arrayContaining([
        expect.stringContaining("6420 summit st"),
        expect.stringContaining("6428 summit st"),
      ])
    );
    expect(normalized.internalDiagnostics?.addressCandidateCount).toBe(2);
  });

  it("uses a multi-address exact candidate to produce a strong match", async () => {
    const { HalifaxR400Adapter } = await import("../registry/adapters/HalifaxR400Adapter");
    const { evaluateRegistryMatch } = await import("../registry/registryMatchingService");

    ensureCollection("properties").set("prop-2", {
      id: "prop-2",
      name: "6428 Summit",
      addressLine1: "6428 Summit Street",
      city: "Halifax",
      province: "NS",
      postalCode: "B3L 1S1",
    });

    const match = await evaluateRegistryMatch({
      adapter: new HalifaxR400Adapter(),
      record: {
        id: "norm-3",
        importBatchId: "import-1",
        sourceKey: "halifax_r400",
        jurisdictionCountry: "CA",
        jurisdictionProvince: "NS",
        jurisdictionMunicipality: "Halifax",
        registryCategory: "rental_registry",
        registryRecordId: "reg-3",
        registrationNumber: "REG-3",
        pid: null,
        addressRaw: "6420 SUMMIT STREET,6428 SUMMIT STREET,HALIFAX,B3L 1S1",
        primaryAddressCandidate: "6420 summit st halifax ns b3l 1s1",
        addressCandidates: [
          "6420 summit st halifax ns b3l 1s1",
          "6428 summit st halifax ns b3l 1s1",
        ],
        addressNormalized: "6420 summit st halifax ns b3l 1s1",
        postalCode: "B3L1S1",
        rentalUnitTypeRaw: null,
        rentalUnitTypeNormalized: null,
        buildingTypeRaw: null,
        buildingTypeNormalized: null,
        registeredUnits: 2,
        numberOfFloors: 2,
        sharedFacilities: null,
        registrationStatusRaw: "Y",
        registrationStatusNormalized: "registered",
        registrationIssuedAt: null,
        lat: null,
        lng: null,
        sourceConfidence: 0.94,
        internalDiagnostics: {
          unmatchedReasons: [],
          pidSourceFieldsChecked: [],
          addressCandidateCount: 2,
        },
        importedAt: "2026-04-04T00:00:00.000Z",
        updatedAt: "2026-04-04T00:00:00.000Z",
      },
    });

    expect(match.propertyId).toBe("prop-2");
    expect(match.matchStatus === "matched" || match.matchStatus === "mismatch").toBe(true);
  });

  it("keeps ambiguous multi-address rows out of unsafe verified matches", async () => {
    const { HalifaxR400Adapter } = await import("../registry/adapters/HalifaxR400Adapter");
    const { evaluateRegistryMatch } = await import("../registry/registryMatchingService");

    ensureCollection("properties").set("prop-2", {
      id: "prop-2",
      name: "6420 Summit",
      addressLine1: "6420 Summit Street",
      city: "Halifax",
      province: "NS",
      postalCode: "B3L 1S1",
    });
    ensureCollection("properties").set("prop-3", {
      id: "prop-3",
      name: "6428 Summit",
      addressLine1: "6428 Summit Street",
      city: "Halifax",
      province: "NS",
      postalCode: "B3L 1S1",
    });

    const match = await evaluateRegistryMatch({
      adapter: new HalifaxR400Adapter(),
      record: {
        id: "norm-4",
        importBatchId: "import-1",
        sourceKey: "halifax_r400",
        jurisdictionCountry: "CA",
        jurisdictionProvince: "NS",
        jurisdictionMunicipality: "Halifax",
        registryCategory: "rental_registry",
        registryRecordId: "reg-4",
        registrationNumber: "REG-4",
        pid: null,
        addressRaw: "6420 SUMMIT STREET,6428 SUMMIT STREET,HALIFAX,B3L 1S1",
        primaryAddressCandidate: "6420 summit st halifax ns b3l 1s1",
        addressCandidates: [
          "6420 summit st halifax ns b3l 1s1",
          "6428 summit st halifax ns b3l 1s1",
        ],
        addressNormalized: "6420 summit st halifax ns b3l 1s1",
        postalCode: "B3L1S1",
        rentalUnitTypeRaw: null,
        rentalUnitTypeNormalized: null,
        buildingTypeRaw: null,
        buildingTypeNormalized: null,
        registeredUnits: 2,
        numberOfFloors: 2,
        sharedFacilities: null,
        registrationStatusRaw: "Y",
        registrationStatusNormalized: "registered",
        registrationIssuedAt: null,
        lat: null,
        lng: null,
        sourceConfidence: 0.94,
        internalDiagnostics: {
          unmatchedReasons: [],
          pidSourceFieldsChecked: [],
          addressCandidateCount: 2,
        },
        importedAt: "2026-04-04T00:00:00.000Z",
        updatedAt: "2026-04-04T00:00:00.000Z",
      },
    });

    expect(match.matchStatus).toBe("possible_match");
    expect(match.mismatchReasons).toContain("ambiguous_multi_address");
  });
});
