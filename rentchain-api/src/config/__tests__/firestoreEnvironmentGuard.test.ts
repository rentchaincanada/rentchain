import { describe, expect, it, vi } from "vitest";
import { assertSafeFirestoreEnvironment } from "../firestoreEnvironmentGuard";

function env(overrides: Record<string, string | undefined> = {}) {
  return {
    NODE_ENV: "development",
    ...overrides,
  };
}

describe("firestoreEnvironmentGuard", () => {
  it("fails startup outside production when FIRESTORE_EMULATOR_HOST is missing", () => {
    expect(() => assertSafeFirestoreEnvironment(env())).toThrow(/FIRESTORE_EMULATOR_HOST must be set/);
  });

  it("fails startup outside production when local credentials are present without override", () => {
    expect(() =>
      assertSafeFirestoreEnvironment(
        env({
          FIRESTORE_EMULATOR_HOST: "127.0.0.1:8080",
          GOOGLE_APPLICATION_CREDENTIALS: "/tmp/service-account.json",
        })
      )
    ).toThrow(/GOOGLE_APPLICATION_CREDENTIALS is prohibited/);
  });

  it("allows startup outside production when the emulator host is present", () => {
    const result = assertSafeFirestoreEnvironment(
      env({
        FIRESTORE_EMULATOR_HOST: "127.0.0.1:8080",
      })
    );

    expect(result).toMatchObject({
      environment: "development",
      mode: "emulator",
      emulatorHost: "127.0.0.1:8080",
      localProductionFirestoreOverride: false,
      googleApplicationCredentialsPresent: false,
    });
  });

  it("allows explicit local production Firestore override and emits warning", () => {
    const logger = {
      warn: vi.fn(),
    };
    const result = assertSafeFirestoreEnvironment(
      env({
        GOOGLE_APPLICATION_CREDENTIALS: "/tmp/service-account.json",
        ALLOW_LOCAL_PROD_FIRESTORE: "true",
      }),
      logger
    );

    expect(result).toMatchObject({
      environment: "development",
      mode: "local-prod-firestore-override",
      emulatorHost: null,
      localProductionFirestoreOverride: true,
      googleApplicationCredentialsPresent: true,
    });
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining("ALLOW_LOCAL_PROD_FIRESTORE=true"));
  });

  it("leaves production startup behavior unchanged", () => {
    const result = assertSafeFirestoreEnvironment(
      env({
        NODE_ENV: "production",
        GOOGLE_APPLICATION_CREDENTIALS: "/tmp/service-account.json",
      })
    );

    expect(result).toMatchObject({
      environment: "production",
      mode: "production",
      emulatorHost: null,
      localProductionFirestoreOverride: false,
      googleApplicationCredentialsPresent: true,
    });
  });
});
