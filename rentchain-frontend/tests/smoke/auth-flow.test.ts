import { describe, expect, it } from "vitest";

type StorageOrigin = {
  origin: string;
  localStorage?: Array<{ name: string; value: string }>;
  sessionStorage?: Array<{ name: string; value: string }>;
};

type StorageState = {
  cookies?: unknown[];
  origins?: StorageOrigin[];
};

const requiredRoleStateKeys = [
  "QA_ADMIN_STORAGE_STATE",
  "QA_LANDLORD_STORAGE_STATE",
  "QA_TENANT_STORAGE_STATE",
] as const;

function validateStorageState(state: StorageState) {
  const origins = Array.isArray(state.origins) ? state.origins : [];
  const serialized = JSON.stringify(origins);
  return {
    hasOrigins: origins.length > 0,
    hasStoredSession:
      serialized.includes("rentchain_auth_token") ||
      serialized.includes("rentchain_tenant_token") ||
      serialized.includes("firebase"),
    hasCookies: Array.isArray(state.cookies),
  };
}

describe("authenticated smoke storage state contract", () => {
  it("documents required role storage state inputs", () => {
    expect(requiredRoleStateKeys).toEqual([
      "QA_ADMIN_STORAGE_STATE",
      "QA_LANDLORD_STORAGE_STATE",
      "QA_TENANT_STORAGE_STATE",
    ]);
  });

  it("accepts Playwright storage state with persisted session material", () => {
    const state: StorageState = {
      cookies: [],
      origins: [
        {
          origin: "https://preview.example.test",
          localStorage: [{ name: "rentchain_auth_token", value: "header.payload.signature" }],
          sessionStorage: [{ name: "debugAuthStoredAt", value: "1760000000000" }],
        },
      ],
    };

    expect(validateStorageState(state)).toEqual({
      hasOrigins: true,
      hasStoredSession: true,
      hasCookies: true,
    });
  });

  it("rejects empty storage state as unauthenticated smoke setup", () => {
    expect(validateStorageState({ cookies: [], origins: [] })).toEqual({
      hasOrigins: false,
      hasStoredSession: false,
      hasCookies: true,
    });
  });
});
