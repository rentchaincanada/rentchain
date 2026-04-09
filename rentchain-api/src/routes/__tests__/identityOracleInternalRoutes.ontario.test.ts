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

function seedDoc(name: string, id: string, data: any) {
  ensureCollection(name).set(id, { id, data: clone(data) });
}

function getDoc(name: string, id: string) {
  const stored = ensureCollection(name).get(id);
  return stored ? clone(stored.data) : null;
}

vi.mock("../../config/firebase", () => ({
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
      };
    },
  },
}));

const { halifaxLookupMock } = vi.hoisted(() => ({
  halifaxLookupMock: vi.fn(async () => ({
    ok: true,
    sourceType: "OPEN_DATASET",
    sourceKey: "halifax_r400",
    sourceLabel: "HRM Halifax Residential Rental Registry R-400",
    health: "healthy",
    issues: [],
    records: [],
  })),
}));

vi.mock("../../services/identityOracle/clients/halifaxR400SourceClient", () => ({
  lookupHalifaxR400ByPid: halifaxLookupMock,
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

describe("identityOracleInternalRoutes Ontario execution", () => {
  beforeEach(() => {
    resetDb();
    halifaxLookupMock.mockClear();
    process.env.INTERNAL_JOB_TOKEN = "secret-token";
    process.env.IDENTITY_ORACLE_ON_GATEWAY_POLICY = "enabled";
    process.env.IDENTITY_ORACLE_ON_USAGE_GATE = "allow";
    process.env.ONTARIO_GATEWAY_MODE = "stub";
    process.env.ONTARIO_GATEWAY_STUB_RESPONSE_JSON = JSON.stringify({
      records: [
        {
          gatewayPropertyId: "gw-1",
          pin: "123456789",
          addressLine1: "10 Ontario Street",
          city: "Toronto",
          province: "ON",
          postalCode: "M5V1A1",
          registrationNumber: "101260418",
          confidenceHint: 0.93,
        },
      ],
    });
  });

  it("returns a standardized Ontario-backed VERIFIED_MATCH contract and writes audit/profile state", async () => {
    seedDoc("properties", "prop-on-1", {
      rc_prop_id: "rc_prop_on_1",
      province: "ON",
      municipality: "Toronto",
      addressLine1: "10 Ontario Street",
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
        source: "ontario_gateway",
      },
    });

    expect(res.statusCode).toBe(200);
    expect(res.body?.run?.verificationStatus).toBe("VERIFIED_MATCH");
    expect(res.body?.run?.sourceType).toBe("PAID_GATEWAY");
    expect(res.body?.run?.namespaceKey).toBe("ON:GATEWAY:123456789");
    expect(res.body?.run?.policyGate?.allowed).toBe(true);
    expect(res.body?.run?.usageGate?.allowed).toBe(true);

    const runDoc = getDoc("identity_oracle_runs", String(res.body?.run?.id || ""));
    expect(runDoc).toEqual(
      expect.objectContaining({
        verificationStatus: "VERIFIED_MATCH",
        sourceType: "PAID_GATEWAY",
        sourceKey: "ontario_gateway",
      })
    );

    const profileDoc = getDoc("property_identity_profiles", "prop-on-1");
    expect(profileDoc?.identifiers?.["ON:GATEWAY:123456789"]?.verificationStatus).toBe("VERIFIED_MATCH");
  });

  it("falls back safely when policy denies external verification", async () => {
    process.env.IDENTITY_ORACLE_ON_GATEWAY_POLICY = "disabled";
    seedDoc("properties", "prop-on-2", {
      rc_prop_id: "rc_prop_on_2",
      province: "ON",
      municipality: "Toronto",
      addressLine1: "20 Ontario Street",
      city: "Toronto",
      postalCode: "M5V1A2",
    });

    const res = await invokeRouter({
      method: "POST",
      url: "/identity-oracle/run",
      headers: { "x-internal-job-token": "secret-token" },
      body: {
        propertyId: "prop-on-2",
        identifier: "12345-6789",
        identifierType: "pin",
        province: "ON",
        municipality: "Toronto",
        source: "ontario_gateway",
      },
    });

    expect(res.statusCode).toBe(200);
    expect(res.body?.run?.verificationStatus).toBe("SYNTAX_ONLY");
    expect(res.body?.run?.policyGate?.allowed).toBe(false);
  });

  it("falls back safely when the usage gate denies external verification", async () => {
    process.env.IDENTITY_ORACLE_ON_USAGE_GATE = "deny";
    seedDoc("properties", "prop-on-3", {
      rc_prop_id: "rc_prop_on_3",
      province: "ON",
      municipality: "Toronto",
      addressLine1: "30 Ontario Street",
      city: "Toronto",
      postalCode: "M5V1A3",
    });

    const res = await invokeRouter({
      method: "POST",
      url: "/identity-oracle/run",
      headers: { "x-internal-job-token": "secret-token" },
      body: {
        propertyId: "prop-on-3",
        identifier: "12345-6789",
        identifierType: "pin",
        province: "ON",
        municipality: "Toronto",
        source: "ontario_gateway",
      },
    });

    expect(res.statusCode).toBe(200);
    expect(res.body?.run?.verificationStatus).toBe("SYNTAX_ONLY");
    expect(res.body?.run?.usageGate?.allowed).toBe(false);
  });

  it("preserves internal route protection and NS syntax-only behavior", async () => {
    const unauthorized = await invokeRouter({
      method: "POST",
      url: "/identity-oracle/run",
      body: {
        propertyId: "prop-on-1",
        identifier: "12345-6789",
        identifierType: "pin",
        province: "ON",
        source: "ontario_gateway",
      },
    });
    expect(unauthorized.statusCode).toBe(401);

    seedDoc("properties", "prop-ns-1", {
      rc_prop_id: "rc_prop_ns_1",
      province: "NS",
      municipality: "Halifax",
      addressLine1: "40 NS Street",
      city: "Halifax",
      postalCode: "B3H1A4",
    });
    const nsRes = await invokeRouter({
      method: "POST",
      url: "/identity-oracle/run",
      headers: { "x-internal-job-token": "secret-token" },
      body: {
        propertyId: "prop-ns-1",
        identifier: "40123456",
        identifierType: "pid",
        province: "NS",
        municipality: "Halifax",
      },
    });

    expect(nsRes.statusCode).toBe(200);
    expect(nsRes.body?.run?.verificationStatus).toBe("SYNTAX_ONLY");
    expect(nsRes.body?.run?.sourceKey).toBeNull();
  });

  it("does not affect Halifax-backed verification behavior", async () => {
    seedDoc("properties", "prop-halifax-1", {
      rc_prop_id: "rc_prop_ns_hfx_1",
      province: "NS",
      municipality: "Halifax",
      addressLine1: "50 Halifax Street",
      city: "Halifax",
      postalCode: "B3H1A5",
    });
    halifaxLookupMock.mockResolvedValueOnce({
      ok: true,
      sourceType: "OPEN_DATASET",
      sourceKey: "halifax_r400",
      sourceLabel: "HRM Halifax Residential Rental Registry R-400",
      health: "healthy",
      issues: [],
      records: [],
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
    expect(res.body?.run?.sourceKey).toBe("halifax_r400");
    expect(res.body?.run?.sourceType).toBe("OPEN_DATASET");
    expect(res.body?.run?.verificationStatus).toBe("UNREGISTERED_RISK");
  });
});
