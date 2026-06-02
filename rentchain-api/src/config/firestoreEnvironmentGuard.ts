type FirestoreGuardEnv = NodeJS.ProcessEnv | Record<string, string | undefined>;

export type FirestoreEnvironmentGuardResult = {
  environment: string;
  mode: "production" | "emulator" | "local-prod-firestore-override";
  emulatorHost: string | null;
  localProductionFirestoreOverride: boolean;
  googleApplicationCredentialsPresent: boolean;
};

type GuardLogger = Pick<typeof console, "warn">;

function envValue(env: FirestoreGuardEnv, key: string): string {
  return String(env[key] || "").trim();
}

function normalizedEnvironment(env: FirestoreGuardEnv): string {
  return envValue(env, "NODE_ENV").toLowerCase() || "development";
}

function isTrue(value: string): boolean {
  return value.toLowerCase() === "true";
}

export function assertSafeFirestoreEnvironment(
  env: FirestoreGuardEnv = process.env,
  logger: GuardLogger = console
): FirestoreEnvironmentGuardResult {
  const environment = normalizedEnvironment(env);
  const emulatorHost = envValue(env, "FIRESTORE_EMULATOR_HOST");
  const googleApplicationCredentials = envValue(env, "GOOGLE_APPLICATION_CREDENTIALS");
  const localProductionFirestoreOverride = isTrue(envValue(env, "ALLOW_LOCAL_PROD_FIRESTORE"));

  if (environment === "production") {
    return {
      environment,
      mode: "production",
      emulatorHost: emulatorHost || null,
      localProductionFirestoreOverride,
      googleApplicationCredentialsPresent: Boolean(googleApplicationCredentials),
    };
  }

  if (localProductionFirestoreOverride) {
    logger.warn(
      [
        "[firestore-guard] ALLOW_LOCAL_PROD_FIRESTORE=true is enabled.",
        "Local or test startup may use non-emulator Firestore credentials.",
        "Use only for explicit operator-approved diagnostics.",
      ].join(" ")
    );
    return {
      environment,
      mode: "local-prod-firestore-override",
      emulatorHost: emulatorHost || null,
      localProductionFirestoreOverride,
      googleApplicationCredentialsPresent: Boolean(googleApplicationCredentials),
    };
  }

  const failures: string[] = [];
  if (!emulatorHost) {
    failures.push("FIRESTORE_EMULATOR_HOST must be set for local, development, and test startup.");
  }
  if (googleApplicationCredentials) {
    failures.push(
      "GOOGLE_APPLICATION_CREDENTIALS is prohibited outside production unless ALLOW_LOCAL_PROD_FIRESTORE=true is explicitly set."
    );
  }

  if (failures.length > 0) {
    throw new Error(
      [
        "[firestore-guard] Unsafe Firestore environment.",
        ...failures,
        "Start the local emulator with `npm --prefix rentchain-api run emulator:firestore` and run backend commands with emulator scripts.",
      ].join(" ")
    );
  }

  return {
    environment,
    mode: "emulator",
    emulatorHost,
    localProductionFirestoreOverride,
    googleApplicationCredentialsPresent: false,
  };
}
