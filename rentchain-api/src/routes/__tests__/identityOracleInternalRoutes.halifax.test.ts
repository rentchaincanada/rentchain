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

function seedDoc(name: string, id: string, data: any) {
  ensureCollection(name).set(id, { id, data: clone(data) });
}

function getDoc(name: string, id: string) {
  const stored = ensureCollection(name).get(id);
  return stored ? clone(stored.data) : null;
}

vi.mock("../../firebase", () => ({
  db: {
    collection(name: string) {
      return {
        doc(id?: string) {
          const docId = id || `auto-${ensureCollection(name).size + 1}`;
          return {
            id: docId,
            async get() {
              const stored = ensureCollection(name).get(docId);
              return {
                id: docId,
                exists: Boolean(stored),
                data: () => (stored ? clone(stored.data) : undefined),
              };
            },
            async set(payload: any, options?: { merge?: boolean }) {
              const existing = ensureCollection(name).get(docId);
              const next =
                options?.merge && existing
                  ? { ...clone(existing.data), ...clone(payload) }
                  : clone(payload);
              ensureCollection(name).set(docId, { id: docId, data: next });
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

async function invokeRouter(params: {
  method: string;
  url: string;
  headers?: Record<string, string>;
  body?: any;
}) {
  const router = (await import("../identityOracleInternalRoutes")).default;
  return await new Promise<{ statusCode: number; body: any }>((resolve, reject) => {
    const req: any = {
      method: params.method,
      url: params.url,
      headers: params.headers || {},
      body: params.body,
    };
    const res: any = {
      statusCode: 200,
      payload: undefined,
      status(code: number) {
        this.statusCode = code;
        return this;
      },
      json(payload: any) {
        this.payload = payload;
        resolve({ statusCode: this.statusCode, body: payload });
        return this;
      },
    };

    router.handle(req, res, (err: any) => {
      if (err) reject(err);
      else resolve({ statusCode: res.statusCode, body: res.payload });
    });
  });
}

describe("identityOracleInternalRoutes Halifax execution", () => {
  beforeEach(async () => {
    resetDb();
    process.env.INTERNAL_JOB_TOKEN = "secret-token";
    const { __resetHalifaxR400SourceClientCacheForTests } = await import("../../services/identityOracle/clients/halifaxR400SourceClient");
    __resetHalifaxR400SourceClientCacheForTests();
  });

  it("returns a standardized Halifax-backed VERIFIED_MATCH contract and writes audit/profile state", async () => {
    seedDoc("properties", "prop-halifax-1", {
      rc_prop_id: "rc_prop_halifax_1",
      province: "NS",
      municipality: "Halifax",
      addressLine1: "10 Example Street",
      city: "Halifax",
      postalCode: "B3H1A1",
      pid: "40123456",
    });
    seedDoc("registrySources", "halifax_r400", {
      active: true,
    });
    seedDoc("registryRecordsNormalized", "record-1", {
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
    });

    const res = await invokeRouter({
      method: "POST",
      url: "/identity-oracle/run",
      headers: { "x-internal-job-token": "secret-token" },
      body: {
        propertyId: "prop-halifax-1",
        identifier: "40123456",
        identifierType: "pid",
        province: "NS",
        municipality: "Halifax",
        source: "halifax_r400",
      },
    });

    expect(res.statusCode).toBe(200);
    expect(res.body?.ok).toBe(true);
    expect(res.body?.run?.verificationStatus).toBe("VERIFIED_MATCH");
    expect(res.body?.run?.sourceType).toBe("OPEN_DATASET");
    expect(res.body?.run?.namespaceKey).toBe("NS:PVSC:40123456");
    expect(res.body?.run?.relatedNamespaces).toContain("NS:HRM:REH-2024-001");

    const runDoc = getDoc("identity_oracle_runs", String(res.body?.run?.id || ""));
    expect(runDoc).toEqual(
      expect.objectContaining({
        propertyId: "prop-halifax-1",
        verificationStatus: "VERIFIED_MATCH",
        sourceType: "OPEN_DATASET",
        sourceKey: "halifax_r400",
        namespaceKey: "NS:PVSC:40123456",
      })
    );

    const profileDoc = getDoc("property_identity_profiles", "prop-halifax-1");
    expect(profileDoc).toEqual(
      expect.objectContaining({
        latestRunId: res.body?.run?.id,
        identifierType: "pid",
      })
    );
    expect(profileDoc?.identifiers?.["NS:PVSC:40123456"]?.verificationStatus).toBe("VERIFIED_MATCH");
  });

  it("preserves internal route protection for Halifax-backed execution", async () => {
    const res = await invokeRouter({
      method: "POST",
      url: "/identity-oracle/run",
      body: {
        propertyId: "prop-halifax-1",
        identifier: "40123456",
        identifierType: "pid",
        province: "NS",
        municipality: "Halifax",
        source: "halifax_r400",
      },
    });

    expect(res.statusCode).toBe(401);
  });

  it("does not affect NS syntax-only behavior when external verification is not requested", async () => {
    seedDoc("properties", "prop-halifax-2", {
      rc_prop_id: "rc_prop_halifax_2",
      province: "NS",
      municipality: "Halifax",
      addressLine1: "15 Syntax Street",
      city: "Halifax",
      postalCode: "B3H1A2",
    });

    const res = await invokeRouter({
      method: "POST",
      url: "/identity-oracle/run",
      headers: { "x-internal-job-token": "secret-token" },
      body: {
        propertyId: "prop-halifax-2",
        identifier: "40123456",
        identifierType: "pid",
        province: "NS",
        municipality: "Halifax",
      },
    });

    expect(res.statusCode).toBe(200);
    expect(res.body?.run?.verificationStatus).toBe("SYNTAX_ONLY");
    expect(res.body?.run?.sourceKey).toBeNull();
    expect(res.body?.run?.namespaceKey).toBe("ca-ns:pid");
  });

  it("does not affect Ontario syntax-only behavior", async () => {
    seedDoc("properties", "prop-on-1", {
      rc_prop_id: "rc_prop_on_1",
      province: "ON",
      municipality: "Toronto",
      addressLine1: "20 Ontario Street",
      city: "Toronto",
      postalCode: "M5V1A1",
    });

    const res = await invokeRouter({
      method: "POST",
      url: "/identity-oracle/run",
      headers: { "x-internal-job-token": "secret-token" },
      body: {
        propertyId: "prop-on-1",
        identifier: "12345-6789",
        identifierType: "pin",
        province: "ON",
        municipality: "Toronto",
      },
    });

    expect(res.statusCode).toBe(200);
    expect(res.body?.run?.verificationStatus).toBe("SYNTAX_ONLY");
    expect(res.body?.run?.namespaceKey).toBe("ca-on:pin");
    expect(res.body?.run?.sourceKey).toBeNull();
  });
});
