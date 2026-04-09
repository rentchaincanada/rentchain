import { beforeEach, describe, expect, it, vi } from "vitest";

type StoredDoc = { id: string; data: any };

const { dbMock, resetDb, seedDoc, getDoc } = vi.hoisted(() => {
  const collections = new Map<string, Map<string, StoredDoc>>();
  let autoId = 0;

  function ensureCollection(name: string) {
    if (!collections.has(name)) collections.set(name, new Map());
    return collections.get(name)!;
  }

  function clone<T>(value: T): T {
    return JSON.parse(JSON.stringify(value));
  }

  function seedDoc(name: string, id: string, data: any) {
    ensureCollection(name).set(id, { id, data: clone(data) });
  }

  function getDoc(name: string, id: string) {
    const doc = ensureCollection(name).get(id);
    return doc ? clone(doc.data) : null;
  }

  return {
    resetDb() {
      collections.clear();
      autoId = 0;
    },
    seedDoc,
    getDoc,
    dbMock: {
      collection(name: string) {
        return {
          doc(id?: string) {
            const docId = id || `auto-${++autoId}`;
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
  };
});

vi.mock("../../config/firebase", () => ({
  db: dbMock,
}));

describe("identityOracleService", () => {
  beforeEach(() => {
    resetDb();
  });

  it("normalizes and persists an Ontario pin with a province namespace", async () => {
    seedDoc("properties", "prop-on-1", {
      rc_prop_id: "rc_prop_1",
      province: "ON",
      municipality: "Toronto",
    });

    const { runIdentityOracle } = await import("../identityOracle/identityOracleService");
    const result = await runIdentityOracle({
      propertyId: "prop-on-1",
      identifier: "12345-6789",
      identifierType: "pin",
      actorType: "system",
      actorId: "job-1",
    });

    expect(result.run.identifierType).toBe("pin");
    expect(result.run.namespaceKey).toBe("ca-on:pin");
    expect(result.run.normalizedIdentifier).toBe("123456789");
    expect(result.run.syntaxResult.status).toBe("valid");
    expect(getDoc("identity_oracle_runs", result.run.id)).toEqual(
      expect.objectContaining({
        propertyId: "prop-on-1",
        namespaceKey: "ca-on:pin",
        normalizedIdentifier: "123456789",
      })
    );
    expect(getDoc("property_identity_profiles", "prop-on-1")).toEqual(
      expect.objectContaining({
        latestRunId: result.run.id,
        namespaceKey: "ca-on:pin",
        syntaxStatus: "valid",
      })
    );
  });

  it("normalizes and persists a Nova Scotia pid with a province namespace", async () => {
    seedDoc("properties", "prop-ns-1", {
      rc_prop_id: "rc_prop_2",
      province: "NS",
      municipality: "Halifax",
    });

    const { runIdentityOracle } = await import("../identityOracle/identityOracleService");
    const result = await runIdentityOracle({
      propertyId: "prop-ns-1",
      identifier: "1234-5678",
      identifierType: "pid",
    });

    expect(result.run.identifierType).toBe("pid");
    expect(result.run.namespaceKey).toBe("ca-ns:pid");
    expect(result.run.normalizedIdentifier).toBe("12345678");
    expect(result.profile.identifiers["ca-ns:pid"]).toEqual(
      expect.objectContaining({
        normalizedIdentifier: "12345678",
        syntaxStatus: "valid",
      })
    );
  });

  it("records invalid syntax runs without mutating unrelated state", async () => {
    seedDoc("properties", "prop-on-2", {
      province: "ON",
      municipality: "Ottawa",
    });

    const { runIdentityOracle } = await import("../identityOracle/identityOracleService");
    const result = await runIdentityOracle({
      propertyId: "prop-on-2",
      identifier: "12345",
    });

    expect(result.run.syntaxResult).toEqual({
      status: "invalid",
      ok: false,
      reason: "ontario_pin_must_have_9_digits",
      normalizedIdentifier: null,
    });
    expect(getDoc("property_identity_profiles", "prop-on-2")).toEqual(
      expect.objectContaining({
        syntaxStatus: "invalid",
      })
    );
    expect(getDoc("leases", "prop-on-2")).toBeNull();
  });
});
