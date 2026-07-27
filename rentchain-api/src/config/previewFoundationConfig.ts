import { PREVIEW_PROJECT, PRODUCTION_PROJECT, getConfiguredProjectId, getRuntimeEnvironment } from "./runtimeEnvironment";

type PreviewFoundationEnv = NodeJS.ProcessEnv | Record<string, string | undefined>;

export type PreviewFoundationConfig = {
  environment: string;
  datastoreEnabled: boolean;
  authenticationEnabled: boolean;
  authenticationConfigured: boolean;
  authenticationOperationallyVerified: false;
  projectId: string;
  databaseId: string;
  firebaseApiKeyPresent: boolean;
};

function value(env: PreviewFoundationEnv, name: string): string {
  return String(env[name] || "").trim();
}

function enabled(env: PreviewFoundationEnv, name: string): boolean {
  return value(env, name).toLowerCase() === "true";
}

export function getPreviewFoundationConfig(
  env: PreviewFoundationEnv = process.env
): PreviewFoundationConfig {
  const environment = getRuntimeEnvironment(env as NodeJS.ProcessEnv);
  const projectId = getConfiguredProjectId(env as NodeJS.ProcessEnv);
  const datastoreEnabled = enabled(env, "FIRESTORE_ENABLED");
  const authenticationEnabled = enabled(env, "PREVIEW_AUTH_ENABLED");
  const databaseId = value(env, "FIRESTORE_DATABASE_ID");
  const firebaseProjectId = value(env, "FIREBASE_PROJECT_ID");

  if (environment !== "preview") {
    return {
      environment,
      datastoreEnabled,
      authenticationEnabled,
      authenticationConfigured: false,
      authenticationOperationallyVerified: false,
      projectId,
      databaseId,
      firebaseApiKeyPresent: Boolean(value(env, "FIREBASE_API_KEY")),
    };
  }

  if (projectId !== PREVIEW_PROJECT) {
    throw new Error("[preview-foundation] Preview must target rentchain-preview.");
  }
  if (firebaseProjectId === PRODUCTION_PROJECT) {
    throw new Error("[preview-foundation] Preview rejects the production Firebase project.");
  }
  if (datastoreEnabled && databaseId !== "(default)") {
    throw new Error("[preview-foundation] Preview Firestore database must be explicitly set to (default).");
  }
  if (authenticationEnabled) {
    if (firebaseProjectId !== PREVIEW_PROJECT) {
      throw new Error("[preview-foundation] Preview authentication must explicitly target rentchain-preview.");
    }
    if (!value(env, "FIREBASE_API_KEY")) {
      throw new Error("[preview-foundation] Preview authentication requires its isolated FIREBASE_API_KEY.");
    }
  }

  return {
    environment,
    datastoreEnabled,
    authenticationEnabled,
    authenticationConfigured:
      authenticationEnabled &&
      firebaseProjectId === PREVIEW_PROJECT &&
      Boolean(value(env, "FIREBASE_API_KEY")),
    authenticationOperationallyVerified: false,
    projectId,
    databaseId,
    firebaseApiKeyPresent: Boolean(value(env, "FIREBASE_API_KEY")),
  };
}
