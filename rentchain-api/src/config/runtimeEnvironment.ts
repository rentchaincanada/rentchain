export type RuntimeEnvironment = "production" | "preview" | "development" | "test";

const PRODUCTION_PROJECT_ID = "project-0d9658de-af29-4dc0-a99";
const PREVIEW_PROJECT_ID = "rentchain-preview";

function value(env: NodeJS.ProcessEnv, key: string): string {
  return String(env[key] || "").trim();
}

export function getRuntimeEnvironment(env: NodeJS.ProcessEnv = process.env): RuntimeEnvironment {
  const configured = value(env, "APP_ENV").toLowerCase();
  if (configured === "production" || configured === "preview" || configured === "development" || configured === "test") {
    return configured;
  }
  const nodeEnv = value(env, "NODE_ENV").toLowerCase();
  if (nodeEnv === "production") return "production";
  if (nodeEnv === "test") return "test";
  return "development";
}

export function getConfiguredProjectId(env: NodeJS.ProcessEnv = process.env): string {
  return value(env, "GOOGLE_CLOUD_PROJECT") || value(env, "GCLOUD_PROJECT") || value(env, "FIREBASE_PROJECT_ID");
}

export function assertRuntimeEnvironment(env: NodeJS.ProcessEnv = process.env): RuntimeEnvironment {
  const runtime = getRuntimeEnvironment(env);
  const projectId = getConfiguredProjectId(env);

  if (runtime === "preview") {
    if (!projectId) throw new Error("[runtime-env] APP_ENV=preview requires GOOGLE_CLOUD_PROJECT=rentchain-preview.");
    if (projectId !== PREVIEW_PROJECT_ID) {
      throw new Error("[runtime-env] Preview must target rentchain-preview and cannot target a production project.");
    }
    if (value(env, "FIREBASE_PROJECT_ID") === PRODUCTION_PROJECT_ID) {
      throw new Error("[runtime-env] Preview rejects the production Firebase project.");
    }
  }

  if (runtime === "production") {
    if (!projectId) {
      throw new Error("[runtime-env] Production requires GOOGLE_CLOUD_PROJECT to be explicitly configured.");
    }
    if (projectId !== PRODUCTION_PROJECT_ID) {
      throw new Error("[runtime-env] Production must target the approved production project.");
    }
  }

  return runtime;
}

export const PREVIEW_PROJECT = PREVIEW_PROJECT_ID;
export const PRODUCTION_PROJECT = PRODUCTION_PROJECT_ID;
