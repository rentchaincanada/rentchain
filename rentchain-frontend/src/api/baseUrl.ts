export const PREVIEW_DEPLOY_ENV = "preview";
export const PRODUCTION_DEPLOY_ENV = "production";
export const PREVIEW_API_BASE_URL = "/api/preview-backend";
export const PRODUCTION_API_BASE_URL =
  "https://rentchain-landlord-api-cyaabkl54a-uc.a.run.app";
export const PREVIEW_API_ROUTE_NOT_AVAILABLE = "PREVIEW_API_ROUTE_NOT_AVAILABLE";

const PREVIEW_AUTH_OPERATIONS = new Map([
  ["/api/auth/login", "POST"],
  ["/api/auth/logout", "POST"],
  ["/api/me", "GET"],
  ["/api/auth/me", "GET"],
]);

let warnedMissing = false;

type ApiEnvironment = {
  apiBaseUrl: unknown;
  deployEnv: unknown;
  isDevelopment: boolean;
};

export class PreviewApiRouteUnavailableError extends Error {
  readonly code = PREVIEW_API_ROUTE_NOT_AVAILABLE;
  readonly path: string;
  readonly method: string;

  constructor(path: string, method: string) {
    super("This operation is not available in the current Preview environment.");
    this.name = "PreviewApiRouteUnavailableError";
    this.path = normalizeBackendPath(path);
    this.method = String(method || "GET").trim().toUpperCase();
  }
}

function readEnvironment(): ApiEnvironment {
  return {
    apiBaseUrl: (import.meta as any)?.env?.VITE_API_BASE_URL,
    deployEnv: (import.meta as any)?.env?.VITE_DEPLOY_ENV,
    isDevelopment: Boolean((import.meta as any)?.env?.DEV),
  };
}

function normalizeBackendPath(input: string): string {
  const path = String(input || "").split(/[?#]/, 1)[0];
  const withSlash = path.startsWith("/") ? path : `/${path}`;
  return withSlash.startsWith("/api/") ? withSlash : `/api${withSlash}`;
}

export function isPreviewAuthPath(input: string): boolean {
  return PREVIEW_AUTH_OPERATIONS.has(normalizeBackendPath(input));
}

export function isPreviewAuthRequest(input: string, method = "GET"): boolean {
  return (
    PREVIEW_AUTH_OPERATIONS.get(normalizeBackendPath(input)) ===
    String(method || "GET").trim().toUpperCase()
  );
}

export function resolveConfiguredApiBase({
  apiBaseUrl,
  deployEnv,
  isDevelopment,
}: ApiEnvironment): string {
  const rawBase = typeof apiBaseUrl === "string" ? apiBaseUrl.trim() : "";
  const rawDeployEnv = typeof deployEnv === "string" ? deployEnv.trim() : "";

  if (!rawBase) {
    throw new Error("VITE_API_BASE_URL is not configured");
  }

  if (rawDeployEnv === PREVIEW_DEPLOY_ENV) {
    if (rawBase !== PREVIEW_API_BASE_URL) {
      throw new Error(
        "Preview API configuration is invalid: use the authorized same-origin proxy"
      );
    }
    return PREVIEW_API_BASE_URL;
  }

  if (rawDeployEnv && rawDeployEnv !== PRODUCTION_DEPLOY_ENV && rawDeployEnv !== "development") {
    throw new Error("VITE_DEPLOY_ENV is not recognized");
  }

  if (rawBase === PREVIEW_API_BASE_URL) {
    throw new Error("The Preview API proxy requires VITE_DEPLOY_ENV=preview");
  }

  if (rawBase.startsWith("/") || rawBase.startsWith("\\") || rawBase.startsWith("//")) {
    throw new Error("VITE_API_BASE_URL contains an unauthorized relative value");
  }

  let parsed: URL;
  try {
    parsed = new URL(rawBase);
  } catch {
    throw new Error("VITE_API_BASE_URL must be an absolute URL");
  }

  if (parsed.search || parsed.hash || parsed.username || parsed.password) {
    throw new Error("VITE_API_BASE_URL contains unsupported URL components");
  }

  if (rawDeployEnv === PRODUCTION_DEPLOY_ENV && parsed.protocol !== "https:") {
    throw new Error("Production VITE_API_BASE_URL must use HTTPS");
  }

  if (!isDevelopment && parsed.protocol !== "https:") {
    throw new Error("VITE_API_BASE_URL must use HTTPS outside local development");
  }

  if (isDevelopment && !["http:", "https:"].includes(parsed.protocol)) {
    throw new Error("Development VITE_API_BASE_URL must use HTTP or HTTPS");
  }

  return rawBase.replace(/\/$/, "").replace(/\/api$/i, "");
}

export function getApiBaseUrl(): string {
  try {
    return resolveConfiguredApiBase(readEnvironment());
  } catch (error) {
    if ((import.meta as any)?.env?.PROD) {
      if (!warnedMissing) {
        warnedMissing = true;
        console.error("[api] API environment configuration is invalid.");
      }
    }
    throw error;
  }
}

export function getApiBaseUrlForRequest(input: string, method = "GET"): string {
  const configuredBase = getApiBaseUrl();
  if (configuredBase !== PREVIEW_API_BASE_URL) return configuredBase;
  if (isPreviewAuthRequest(input, method)) return PREVIEW_API_BASE_URL;
  throw new PreviewApiRouteUnavailableError(input, method);
}

export function getApiBaseUrlForPath(input: string): string {
  return getApiBaseUrlForRequest(input, "GET");
}

export function assertPreviewBrowserRequestAvailable(inputUrl: string, method = "GET"): void {
  const environment = readEnvironment();
  if (
    typeof environment.deployEnv !== "string" ||
    environment.deployEnv.trim() !== PREVIEW_DEPLOY_ENV
  ) {
    return;
  }

  const rawUrl = String(inputUrl || "").trim();
  const origin =
    typeof window !== "undefined" && window.location?.origin
      ? window.location.origin
      : "https://preview.invalid";
  let parsed: URL;
  try {
    parsed = new URL(rawUrl, origin);
  } catch {
    throw new PreviewApiRouteUnavailableError(rawUrl, method);
  }

  const isProductionApi = rawUrl.startsWith(PRODUCTION_API_BASE_URL);
  const isSameOriginApi = parsed.origin === origin && parsed.pathname.startsWith("/api/");
  if (!isProductionApi && !isSameOriginApi) return;

  const prefix = `${PREVIEW_API_BASE_URL}/`;
  if (parsed.origin === origin && parsed.pathname.startsWith(prefix)) {
    const backendPath = parsed.pathname.slice(PREVIEW_API_BASE_URL.length);
    if (isPreviewAuthRequest(backendPath, method)) return;
    throw new PreviewApiRouteUnavailableError(backendPath, method);
  }

  throw new PreviewApiRouteUnavailableError(parsed.pathname, method);
}

export function debugApiBase(): { raw?: string; deployEnv?: string; normalized: string } {
  const environment = readEnvironment();
  return {
    raw: typeof environment.apiBaseUrl === "string" ? environment.apiBaseUrl : undefined,
    deployEnv: typeof environment.deployEnv === "string" ? environment.deployEnv : undefined,
    normalized: getApiBaseUrl(),
  };
}
