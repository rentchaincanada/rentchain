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

export const PREVIEW_BACKEND_TARGET_KEYS = {
  permanent: "permanent",
  pr1555: "pr1555-c99145e5",
  pr1561: "pr1561-d3-cert",
  pr1565: "pr1565-tenant-lease-cert",
  pr1566: "pr1566-multiple-current-cert",
  pr1567: "pr1567-review-needed-cert",
  pr1568: "pr1568-renewal-continuity-cert",
  pr1569: "pr1569-onboarding-occupancy-cert",
  pr1570: "pr1570-occupancy-start-cert",
  pr1573: "pr1573-tenant-lifecycle-cert",
  pr1576: "pr1576-context-mismatch-cert",
} as const;

export type PreviewBackendTarget = {
  key: string;
  cloudRunServiceUrl: string;
  cloudRunIdTokenAudience: string;
  temporary: boolean;
};

const PREVIEW_BACKEND_TARGETS: Record<string, PreviewBackendTarget> = {
  [PREVIEW_BACKEND_TARGET_KEYS.permanent]: {
    key: PREVIEW_BACKEND_TARGET_KEYS.permanent,
    cloudRunServiceUrl: PREVIEW_PROXY_CONFIG.cloudRunServiceUrl,
    cloudRunIdTokenAudience: PREVIEW_PROXY_CONFIG.cloudRunServiceUrl,
    temporary: false,
  },
  [PREVIEW_BACKEND_TARGET_KEYS.pr1555]: {
    key: PREVIEW_BACKEND_TARGET_KEYS.pr1555,
    cloudRunServiceUrl:
      "https://rentchain-pr1555-qa-c99145e5-glistw4pya-nn.a.run.app",
    cloudRunIdTokenAudience:
      "https://rentchain-pr1555-qa-c99145e5-glistw4pya-nn.a.run.app",
    temporary: true,
  },
  [PREVIEW_BACKEND_TARGET_KEYS.pr1561]: {
    key: PREVIEW_BACKEND_TARGET_KEYS.pr1561,
    cloudRunServiceUrl:
      "https://rentchain-pr1561-qa-6256460c-glistw4pya-nn.a.run.app",
    cloudRunIdTokenAudience:
      "https://rentchain-pr1561-qa-6256460c-glistw4pya-nn.a.run.app",
    temporary: true,
  },
  [PREVIEW_BACKEND_TARGET_KEYS.pr1565]: {
    key: PREVIEW_BACKEND_TARGET_KEYS.pr1565,
    cloudRunServiceUrl:
      "https://rentchain-pr1565-qa-tenantlease-glistw4pya-nn.a.run.app",
    cloudRunIdTokenAudience:
      "https://rentchain-pr1565-qa-tenantlease-glistw4pya-nn.a.run.app",
    temporary: true,
  },
  [PREVIEW_BACKEND_TARGET_KEYS.pr1566]: {
    key: PREVIEW_BACKEND_TARGET_KEYS.pr1566,
    cloudRunServiceUrl:
      "https://rentchain-pr1566-qa-multicurrent-glistw4pya-nn.a.run.app",
    cloudRunIdTokenAudience:
      "https://rentchain-pr1566-qa-multicurrent-glistw4pya-nn.a.run.app",
    temporary: true,
  },
  [PREVIEW_BACKEND_TARGET_KEYS.pr1567]: {
    key: PREVIEW_BACKEND_TARGET_KEYS.pr1567,
    cloudRunServiceUrl:
      "https://rentchain-pr1567-qa-reviewneeded-glistw4pya-nn.a.run.app",
    cloudRunIdTokenAudience:
      "https://rentchain-pr1567-qa-reviewneeded-glistw4pya-nn.a.run.app",
    temporary: true,
  },
  [PREVIEW_BACKEND_TARGET_KEYS.pr1568]: {
    key: PREVIEW_BACKEND_TARGET_KEYS.pr1568,
    cloudRunServiceUrl:
      "https://rentchain-pr1568-qa-renewal-glistw4pya-nn.a.run.app",
    cloudRunIdTokenAudience:
      "https://rentchain-pr1568-qa-renewal-glistw4pya-nn.a.run.app",
    temporary: true,
  },
  [PREVIEW_BACKEND_TARGET_KEYS.pr1569]: {
    key: PREVIEW_BACKEND_TARGET_KEYS.pr1569,
    cloudRunServiceUrl:
      "https://rentchain-pr1569-qa-onboarding-glistw4pya-nn.a.run.app",
    cloudRunIdTokenAudience:
      "https://rentchain-pr1569-qa-onboarding-glistw4pya-nn.a.run.app",
    temporary: true,
  },
  [PREVIEW_BACKEND_TARGET_KEYS.pr1570]: {
    key: PREVIEW_BACKEND_TARGET_KEYS.pr1570,
    cloudRunServiceUrl:
      "https://rentchain-pr1570-qa-occupancy-start-glistw4pya-nn.a.run.app",
    cloudRunIdTokenAudience:
      "https://rentchain-pr1570-qa-occupancy-start-glistw4pya-nn.a.run.app",
    temporary: true,
  },
  [PREVIEW_BACKEND_TARGET_KEYS.pr1573]: {
    key: PREVIEW_BACKEND_TARGET_KEYS.pr1573,
    cloudRunServiceUrl:
      "https://rentchain-pr1573-qa-tenant-lifecycle-glistw4pya-nn.a.run.app",
    cloudRunIdTokenAudience:
      "https://rentchain-pr1573-qa-tenant-lifecycle-glistw4pya-nn.a.run.app",
    temporary: true,
  },
  [PREVIEW_BACKEND_TARGET_KEYS.pr1576]: {
    key: PREVIEW_BACKEND_TARGET_KEYS.pr1576,
    cloudRunServiceUrl:
      "https://rentchain-pr1576-qa-context-mismatch-501298948635.northamerica-northeast1.run.app",
    cloudRunIdTokenAudience:
      "https://rentchain-pr1576-qa-context-mismatch-501298948635.northamerica-northeast1.run.app",
    temporary: true,
  },
};

export function assertPreviewBackendTarget(
  target: PreviewBackendTarget,
  environment: string,
): void {
  const expected = PREVIEW_BACKEND_TARGETS[target.key];
  if (
    !expected ||
    target.cloudRunServiceUrl !== expected.cloudRunServiceUrl ||
    target.cloudRunIdTokenAudience !== expected.cloudRunIdTokenAudience ||
    target.cloudRunServiceUrl !== target.cloudRunIdTokenAudience ||
    target.temporary !== expected.temporary ||
    (target.temporary && environment !== "preview")
  ) {
    throw new Error("PREVIEW_PROXY_TARGET_REJECTED");
  }
}

export function resolvePreviewBackendTarget(input: {
  vercelEnvironment: unknown;
  targetKey: unknown;
}): PreviewBackendTarget {
  const environment = typeof input.vercelEnvironment === "string"
    ? input.vercelEnvironment.trim()
    : "";
  const hasExplicitTarget = input.targetKey !== undefined && input.targetKey !== null;
  const key = hasExplicitTarget && typeof input.targetKey === "string"
    ? input.targetKey.trim()
    : PREVIEW_BACKEND_TARGET_KEYS.permanent;
  const target = PREVIEW_BACKEND_TARGETS[key];

  if (!key || !target) {
    throw new Error("PREVIEW_PROXY_TARGET_REJECTED");
  }
  assertPreviewBackendTarget(target, environment);
  return target;
}

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

function previewAuthConfigForTarget(target: PreviewBackendTarget): PreviewAuthConfig {
  return {
    ...PREVIEW_PROXY_AUTH_CONFIG,
    cloudRunIdTokenAudience: target.cloudRunIdTokenAudience,
    cloudRunServiceUrl: target.cloudRunServiceUrl,
  };
}

export const PREVIEW_PROXY_BODY_LIMIT_BYTES = 10 * 1024 * 1024;
export const PREVIEW_PROXY_TOKEN_TIMEOUT_MS = 5_000;
export const PREVIEW_PROXY_UPSTREAM_TIMEOUT_MS = 10_000;

const ALLOWED_METHODS = new Set(["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE"]);

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
  if (!backendPath.startsWith("/api/")) {
    throw new PreviewBackendProxyError("PREVIEW_PROXY_ROUTE_NOT_ALLOWED", 404);
  }

  return { backendPath, query };
}

function assertMethod(backendPath: string, method: string) {
  if (!backendPath.startsWith("/api/") || !ALLOWED_METHODS.has(method)) {
    throw new PreviewBackendProxyError("PREVIEW_PROXY_METHOD_NOT_ALLOWED", 405);
  }
}

async function requestBody(req: any, method: string): Promise<BodyInit | undefined> {
  if (method === "GET" || method === "HEAD") return undefined;

  const declaredLength = Number(req?.headers?.["content-length"] || 0);
  if (
    Number.isFinite(declaredLength) &&
    declaredLength > PREVIEW_PROXY_BODY_LIMIT_BYTES
  ) {
    throw new PreviewBackendProxyError("PREVIEW_PROXY_BODY_TOO_LARGE", 413);
  }

  const input = req?.body;
  if (input == null && req && typeof req[Symbol.asyncIterator] === "function") {
    const chunks: Buffer[] = [];
    let byteLength = 0;
    for await (const chunk of req) {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      byteLength += buffer.byteLength;
      if (byteLength > PREVIEW_PROXY_BODY_LIMIT_BYTES) {
        throw new PreviewBackendProxyError("PREVIEW_PROXY_BODY_TOO_LARGE", 413);
      }
      chunks.push(buffer);
    }
    return chunks.length ? Buffer.concat(chunks) : undefined;
  }
  if (input == null) return undefined;

  let body: string | ArrayBuffer;
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
    body = Uint8Array.from(
      new Uint8Array(input.buffer, input.byteOffset, input.byteLength),
    ).buffer;
  } else if (input instanceof ArrayBuffer) {
    body = input.slice(0);
  } else if (Buffer.isBuffer(input)) {
    body = Uint8Array.from(input).buffer;
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

  for (const name of ["accept", "authorization", "content-type", "idempotency-key", "x-request-id"]) {
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

  let target: PreviewBackendTarget;
  try {
    target = resolvePreviewBackendTarget({
      vercelEnvironment: process.env.VERCEL_ENV,
      targetKey: process.env.PREVIEW_BACKEND_TARGET,
    });
  } catch {
    return jsonError(res, 502, "PREVIEW_PROXY_TARGET_REJECTED");
  }
  const authConfig = previewAuthConfigForTarget(target);

  let route: { backendPath: string; query: string };
  let method: string;
  let body: BodyInit | undefined;
  try {
    route = resolvePreviewBackendPath(req);
    method = String(req?.method || "GET").toUpperCase();
    assertMethod(route.backendPath, method);
    body = await requestBody(req, method);
  } catch (error) {
    if (error instanceof PreviewBackendProxyError) {
      if (error.status === 405) {
        res.setHeader("allow", Array.from(ALLOWED_METHODS).join(", "));
      }
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
      authConfig,
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
      authConfig,
      stsFetch,
    );
    googleIdToken = await generateCloudRunIdToken(
      federatedAccessToken,
      authConfig,
      authConfig.cloudRunIdTokenAudience,
      iamFetch,
    );
  } catch (error) {
    const mapped = mapTokenError(error);
    return jsonError(res, mapped.status, mapped.code);
  }

  const targetUrl =
    `${target.cloudRunServiceUrl}${route.backendPath}` +
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
