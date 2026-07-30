import {
  acquireVercelOidcToken,
  exchangeVercelToken,
  generateCloudRunIdToken,
  PreviewAuthBridgeError,
  type PreviewAuthConfig,
} from "./previewAuthBridge.js";

export const PREVIEW_PROXY_CONFIG = {
  projectNumber: "501298948635",
  workloadIdentityPoolId: "vercel-preview-proxy",
  workloadIdentityProviderId: "vercel-preview",
  serviceAccountEmail:
    "vercel-preview-proxy@rentchain-preview.iam.gserviceaccount.com",
  cloudRunServiceUrl:
    "https://rentchain-preview-backend-glistw4pya-nn.a.run.app",
} as const;

const PROVIDER_PATH =
  `projects/${PREVIEW_PROXY_CONFIG.projectNumber}/locations/global/` +
  `workloadIdentityPools/${PREVIEW_PROXY_CONFIG.workloadIdentityPoolId}/` +
  `providers/${PREVIEW_PROXY_CONFIG.workloadIdentityProviderId}`;

export const PREVIEW_PROXY_AUTH_CONFIG: PreviewAuthConfig = {
  vercelOidcTokenAudience: `https://iam.googleapis.com/${PROVIDER_PATH}`,
  googleStsAudience: `//iam.googleapis.com/${PROVIDER_PATH}`,
  cloudRunIdTokenAudience: PREVIEW_PROXY_CONFIG.cloudRunServiceUrl,
  serviceAccountEmail: PREVIEW_PROXY_CONFIG.serviceAccountEmail,
  cloudRunServiceUrl: PREVIEW_PROXY_CONFIG.cloudRunServiceUrl,
  expectedSpikeCommit: "",
};

export const PREVIEW_PROXY_BODY_LIMIT_BYTES = 16 * 1024;
export const PREVIEW_PROXY_TOKEN_TIMEOUT_MS = 5_000;
export const PREVIEW_PROXY_UPSTREAM_TIMEOUT_MS = 10_000;

const ROUTE_METHODS = new Map<string, ReadonlySet<string>>([
  ["/api/auth/login", new Set(["POST"])],
  ["/api/auth/logout", new Set(["POST"])],
  ["/api/me", new Set(["GET"])],
  ["/api/auth/me", new Set(["GET"])],
]);

const RESPONSE_HEADERS = new Set([
  "cache-control",
  "content-type",
  "x-request-id",
  "x-route-source",
]);

type FetchLike = typeof fetch;
type GetVercelOidcTokenLike = (options: { audience: string }) => Promise<string>;

export type PreviewBackendProxyDependencies = {
  fetchImpl?: FetchLike;
  getVercelOidcToken?: GetVercelOidcTokenLike;
  tokenTimeoutMs?: number;
  upstreamTimeoutMs?: number;
};

class PreviewBackendProxyError extends Error {
  constructor(
    readonly code: string,
    readonly status: number,
  ) {
    super(code);
    this.name = "PreviewBackendProxyError";
  }
}

function jsonError(res: any, status: number, code: string) {
  res.setHeader("cache-control", "no-store");
  return res.status(status).json({ ok: false, error: code });
}

function rawRequestPath(req: any): { path: string; query: string } {
  const requestUrl = typeof req?.url === "string" ? req.url : "";
  const queryIndex = requestUrl.indexOf("?");
  return {
    path: queryIndex >= 0 ? requestUrl.slice(0, queryIndex) : requestUrl,
    query: queryIndex >= 0 ? requestUrl.slice(queryIndex + 1) : "",
  };
}

export function resolvePreviewBackendPath(req: any): {
  backendPath: string;
  query: string;
} {
  const { path, query } = rawRequestPath(req);
  const prefix = "/api/preview-backend/";

  if (!path.startsWith(prefix) || path.startsWith(`${prefix}/`)) {
    throw new PreviewBackendProxyError("PREVIEW_PROXY_ROUTE_NOT_ALLOWED", 404);
  }

  const rawSuffix = path.slice(prefix.length);
  if (
    !rawSuffix ||
    rawSuffix.includes("\\") ||
    rawSuffix.includes("\0") ||
    /%2f|%5c/i.test(rawSuffix) ||
    /%(?![0-9a-f]{2})/i.test(rawSuffix)
  ) {
    throw new PreviewBackendProxyError("PREVIEW_PROXY_ROUTE_NOT_ALLOWED", 404);
  }

  let decodedSuffix = "";
  try {
    decodedSuffix = decodeURIComponent(rawSuffix);
  } catch {
    throw new PreviewBackendProxyError("PREVIEW_PROXY_ROUTE_NOT_ALLOWED", 404);
  }

  const segments = decodedSuffix.split("/");
  if (
    segments.some((segment) => !segment || segment === "." || segment === "..") ||
    decodedSuffix.includes("\\") ||
    decodedSuffix.startsWith("/") ||
    decodedSuffix.toLowerCase().startsWith("api/preview-backend/")
  ) {
    throw new PreviewBackendProxyError("PREVIEW_PROXY_ROUTE_NOT_ALLOWED", 404);
  }

  const backendPath = `/${decodedSuffix}`;
  if (!ROUTE_METHODS.has(backendPath)) {
    throw new PreviewBackendProxyError("PREVIEW_PROXY_ROUTE_NOT_ALLOWED", 404);
  }

  return { backendPath, query };
}

function assertMethod(backendPath: string, method: string) {
  if (!ROUTE_METHODS.get(backendPath)?.has(method)) {
    throw new PreviewBackendProxyError("PREVIEW_PROXY_METHOD_NOT_ALLOWED", 405);
  }
}

function requestBody(req: any, method: string): BodyInit | undefined {
  if (method === "GET") return undefined;

  const declaredLength = Number(req?.headers?.["content-length"] || 0);
  if (
    Number.isFinite(declaredLength) &&
    declaredLength > PREVIEW_PROXY_BODY_LIMIT_BYTES
  ) {
    throw new PreviewBackendProxyError("PREVIEW_PROXY_BODY_TOO_LARGE", 413);
  }

  const input = req?.body;
  if (input == null) return undefined;

  let body: string | Uint8Array;
  if (typeof input === "string") {
    const contentType = String(req?.headers?.["content-type"] || "").toLowerCase();
    if (contentType.includes("application/json")) {
      try {
        JSON.parse(input);
      } catch {
        throw new PreviewBackendProxyError("PREVIEW_PROXY_BODY_INVALID", 400);
      }
    }
    body = input;
  } else if (ArrayBuffer.isView(input)) {
    body = new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
  } else if (input instanceof ArrayBuffer) {
    body = new Uint8Array(input);
  } else {
    try {
      body = JSON.stringify(input);
    } catch {
      throw new PreviewBackendProxyError("PREVIEW_PROXY_BODY_INVALID", 400);
    }
  }

  const byteLength =
    typeof body === "string" ? Buffer.byteLength(body, "utf8") : body.byteLength;
  if (byteLength > PREVIEW_PROXY_BODY_LIMIT_BYTES) {
    throw new PreviewBackendProxyError("PREVIEW_PROXY_BODY_TOO_LARGE", 413);
  }
  return body;
}

function upstreamHeaders(req: any, googleIdToken: string): Record<string, string> {
  const headers: Record<string, string> = {
    "X-Serverless-Authorization": `Bearer ${googleIdToken}`,
  };

  for (const name of ["accept", "authorization", "content-type", "x-request-id"]) {
    const value = req?.headers?.[name];
    if (typeof value === "string" && value) headers[name] = value;
  }
  return headers;
}

async function withTimeout<T>(
  timeoutMs: number,
  code: string,
  operation: (signal: AbortSignal) => Promise<T>,
): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await operation(controller.signal);
  } catch (error) {
    if (controller.signal.aborted) {
      throw new PreviewBackendProxyError(code, 504);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function timedFetch(fetchImpl: FetchLike, timeoutMs: number, code: string): FetchLike {
  return ((input: RequestInfo | URL, init?: RequestInit) =>
    withTimeout(timeoutMs, code, (signal) =>
      fetchImpl(input, { ...init, signal }),
    )) as FetchLike;
}

function mapTokenError(error: unknown): PreviewBackendProxyError {
  if (error instanceof PreviewBackendProxyError) return error;
  if (error instanceof PreviewAuthBridgeError) {
    if (error.code.startsWith("STS_")) {
      return new PreviewBackendProxyError("GOOGLE_STS_EXCHANGE_FAILED", 502);
    }
    if (error.code.startsWith("IAM_")) {
      return new PreviewBackendProxyError("GOOGLE_ID_TOKEN_FAILED", 502);
    }
  }
  return new PreviewBackendProxyError("PREVIEW_BACKEND_UNAVAILABLE", 502);
}

export async function handlePreviewBackendProxy(
  req: any,
  res: any,
  dependencies: PreviewBackendProxyDependencies = {},
) {
  if (process.env.VERCEL_ENV !== "preview") {
    return jsonError(res, 403, "PREVIEW_PROXY_ENVIRONMENT_REJECTED");
  }

  let route: { backendPath: string; query: string };
  let method: string;
  let body: BodyInit | undefined;
  try {
    route = resolvePreviewBackendPath(req);
    method = String(req?.method || "GET").toUpperCase();
    assertMethod(route.backendPath, method);
    body = requestBody(req, method);
  } catch (error) {
    if (error instanceof PreviewBackendProxyError) {
      if (error.status === 405) res.setHeader("allow", "GET, POST");
      return jsonError(res, error.status, error.code);
    }
    return jsonError(res, 400, "PREVIEW_PROXY_BODY_INVALID");
  }

  const fetchImpl = dependencies.fetchImpl ?? fetch;
  const tokenTimeoutMs =
    dependencies.tokenTimeoutMs ?? PREVIEW_PROXY_TOKEN_TIMEOUT_MS;
  const stsFetch = timedFetch(
    fetchImpl,
    tokenTimeoutMs,
    "GOOGLE_STS_EXCHANGE_FAILED",
  );
  const iamFetch = timedFetch(
    fetchImpl,
    tokenTimeoutMs,
    "GOOGLE_ID_TOKEN_FAILED",
  );

  let vercelOidcToken: string;
  let googleIdToken: string;
  try {
    vercelOidcToken = await acquireVercelOidcToken(
      PREVIEW_PROXY_AUTH_CONFIG,
      dependencies.getVercelOidcToken,
    );
    if (!vercelOidcToken) {
      throw new PreviewBackendProxyError("VERCEL_OIDC_TOKEN_UNAVAILABLE", 502);
    }
  } catch {
    return jsonError(res, 502, "VERCEL_OIDC_TOKEN_UNAVAILABLE");
  }

  try {
    const federatedAccessToken = await exchangeVercelToken(
      vercelOidcToken,
      PREVIEW_PROXY_AUTH_CONFIG,
      stsFetch,
    );
    googleIdToken = await generateCloudRunIdToken(
      federatedAccessToken,
      PREVIEW_PROXY_AUTH_CONFIG,
      PREVIEW_PROXY_AUTH_CONFIG.cloudRunIdTokenAudience,
      iamFetch,
    );
  } catch (error) {
    const mapped = mapTokenError(error);
    return jsonError(res, mapped.status, mapped.code);
  }

  const targetUrl =
    `${PREVIEW_PROXY_CONFIG.cloudRunServiceUrl}${route.backendPath}` +
    (route.query ? `?${route.query}` : "");

  try {
    const upstream = await withTimeout(
      dependencies.upstreamTimeoutMs ?? PREVIEW_PROXY_UPSTREAM_TIMEOUT_MS,
      "PREVIEW_BACKEND_TIMEOUT",
      async (signal) => {
        const response = await fetchImpl(targetUrl, {
          method,
          headers: upstreamHeaders(req, googleIdToken),
          body,
          redirect: "manual",
          signal,
        });
        const responseBody = Buffer.from(await response.arrayBuffer());
        return { response, responseBody };
      },
    );

    for (const [name, value] of upstream.response.headers.entries()) {
      if (RESPONSE_HEADERS.has(name.toLowerCase())) {
        res.setHeader(name, value);
      }
    }
    res.setHeader("x-rentchain-api-proxy", "vercel-preview-backend");
    return res.status(upstream.response.status).send(upstream.responseBody);
  } catch (error) {
    const mapped =
      error instanceof PreviewBackendProxyError
        ? error
        : new PreviewBackendProxyError("PREVIEW_BACKEND_UNAVAILABLE", 502);
    return jsonError(res, mapped.status, mapped.code);
  }
}
