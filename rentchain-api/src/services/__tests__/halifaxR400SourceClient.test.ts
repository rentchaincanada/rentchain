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

function buildQuery(collectionName: string, filters: Array<{ field: string; value: any }> = []) {
  let queryLimit: number | null = null;
  return {
    where(field: string, _op: string, value: any) {
      return buildQuery(collectionName, [...filters, { field, value }]);
    },
    limit(n: number) {
      queryLimit = n;
      return this;
    },
    async get() {
      let docs = Array.from(ensureCollection(collectionName).entries())
        .map(([id, data]) => ({ id, data: () => clone(data.data) }))
        .filter((doc) => filters.every((filter) => String(doc.data()?.[filter.field] ?? "") === String(filter.value ?? "")));
      if (typeof queryLimit === "number") docs = docs.slice(0, queryLimit);
      return { docs };
    },
  };
}

vi.mock("../../config/firebase", () => ({
  db: {
    collection(name: string) {
      return {
        doc(id: string) {
          return {
            async get() {
              const stored = ensureCollection(name).get(id);
              return {
                id,
                exists: Boolean(stored),
                data: () => (stored ? clone(stored.data) : undefined),
              };
            },
            async set(payload: any) {
              ensureCollection(name).set(id, { id, data: clone(payload) });
            },
          };
        },
        where(field: string, _op: string, value: any) {
          return buildQuery(name, [{ field, value }]);
        },
      };
    },
  },
}));

describe("halifaxR400SourceClient", () => {
  beforeEach(async () => {
    resetDb();
    const { __resetHalifaxR400SourceClientCacheForTests } = await import("../identityOracle/clients/halifaxR400SourceClient");
    __resetHalifaxR400SourceClientCacheForTests();
  });

  it("returns healthy matching records for a PID lookup", async () => {
    ensureCollection("registryRecordsNormalized").set("record-1", {
      id: "record-1",
      data: {
        sourceKey: "halifax_r400",
        jurisdictionProvince: "NS",
        jurisdictionMunicipality: "Halifax",
        registryRecordId: "reg-1",
        registrationNumber: "REH-2024-001",
        pid: "40123456",
        addressRaw: "10 Example Street, Halifax",
        addressNormalized: "10 example st halifax ns b3h1a1",
        primaryAddressCandidate: "10 example st halifax ns b3h1a1",
        postalCode: "B3H1A1",
        registrationStatusNormalized: "registered",
        sourceConfidence: 0.94,
        updatedAt: "2026-04-10T00:00:00.000Z",
      },
    });

    const { lookupHalifaxR400ByPid } = await import("../identityOracle/clients/halifaxR400SourceClient");
    const result = await lookupHalifaxR400ByPid("40123456");

    expect(result.ok).toBe(true);
    expect(result.sourceType).toBe("OPEN_DATASET");
    expect(result.records).toHaveLength(1);
    expect(result.records[0]?.registrationNumber).toBe("REH-2024-001");
  });

  it("caches repeated identical PID lookups", async () => {
    ensureCollection("registryRecordsNormalized").set("record-cache", {
      id: "record-cache",
      data: {
        sourceKey: "halifax_r400",
        jurisdictionProvince: "NS",
        jurisdictionMunicipality: "Halifax",
        registryRecordId: "reg-cache",
        registrationNumber: "REH-CACHE-001",
        pid: "40123456",
        addressRaw: "10 Example Street, Halifax",
        addressNormalized: "10 example st halifax ns b3h1a1",
        primaryAddressCandidate: "10 example st halifax ns b3h1a1",
        postalCode: "B3H1A1",
        registrationStatusNormalized: "registered",
        sourceConfidence: 0.94,
        updatedAt: "2026-04-10T00:00:00.000Z",
      },
    });

    const { lookupHalifaxR400ByPid } = await import("../identityOracle/clients/halifaxR400SourceClient");
    const first = await lookupHalifaxR400ByPid("40123456");
    ensureCollection("registryRecordsNormalized").clear();
    const second = await lookupHalifaxR400ByPid("40123456");

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    expect(second.fromCache).toBe(true);
  });

  it("guards against malformed source records with missing critical fields", async () => {
    ensureCollection("registryRecordsNormalized").set("record-bad", {
      id: "record-bad",
      data: {
        sourceKey: "halifax_r400",
        jurisdictionProvince: "NS",
        jurisdictionMunicipality: "Halifax",
        pid: "40123456",
      },
    });

    const { lookupHalifaxR400ByPid } = await import("../identityOracle/clients/halifaxR400SourceClient");
    const result = await lookupHalifaxR400ByPid("40123456");

    expect(result.ok).toBe(false);
    expect(result.failureKind).toBe("schema_mismatch");
    expect(result.health).toBe("schema_drift_detected");
  });

  it("returns source health based on source metadata and sample fields", async () => {
    ensureCollection("registrySources").set("halifax_r400", {
      id: "halifax_r400",
      data: {
        active: true,
      },
    });
    ensureCollection("registryRecordsNormalized").set("record-health", {
      id: "record-health",
      data: {
        sourceKey: "halifax_r400",
        jurisdictionProvince: "NS",
        jurisdictionMunicipality: "Halifax",
        registryRecordId: "reg-health",
        registrationNumber: "REH-HEALTH",
        pid: "40123456",
        addressRaw: "11 Health St, Halifax",
        addressNormalized: "11 health st halifax ns b3h1a1",
        primaryAddressCandidate: "11 health st halifax ns b3h1a1",
        postalCode: "B3H1A1",
        registrationStatusNormalized: "registered",
      },
    });

    const { getHalifaxR400SourceHealth } = await import("../identityOracle/clients/halifaxR400SourceClient");
    const result = await getHalifaxR400SourceHealth();

    expect(result.health).toBe("healthy");
    expect(result.sourceType).toBe("OPEN_DATASET");
  });
});
