import fs from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  handlePreviewBackendProxy,
  PREVIEW_PROXY_AUTH_CONFIG,
  PREVIEW_PROXY_BODY_LIMIT_BYTES,
  PREVIEW_PROXY_CONFIG,
  resolvePreviewBackendPath,
} from "../../server/previewBackendProxy";

function token(payload = "payload") {
  return `header.${payload}.signature`;
}

function jsonResponse(payload: unknown, status = 200, headers?: HeadersInit) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
}

function responseRecorder() {
  const headers = new Map<string, string | string[]>();
  return {
    statusCode: 200,
    body: undefined as unknown,
    headers,
    setHeader: vi.fn((name: string, value: string | string[]) => {
      headers.set(name.toLowerCase(), value);
    }),
    status: vi.fn(function status(this: any, code: number) {
      this.statusCode = code;
      return this;
    }),
    json: vi.fn(function json(this: any, body: unknown) {
      this.body = body;
      return this;
    }),
    send: vi.fn(function send(this: any, body: unknown) {
      this.body = body;
      return this;
    }),
  };
}

function request(
  url: string,
  method: string,
  overrides: Record<string, unknown> = {},
) {
  return {
    url,
    method,
    headers: {},
    query: { path: url.split("?")[0].split("/").slice(3) },
    ...overrides,
  };
}

function successfulDependencies(upstreamStatus = 200) {
  const requests: Array<{ url: string; init?: RequestInit }> = [];
  const fetchImpl = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    requests.push({ url, init });
    if (url === "https://sts.googleapis.com/v1/token") {
      return jsonResponse({
        access_token: "federated-access-token",
        token_type: "Bearer",
        expires_in: 3600,
      });
    }
    if (url.startsWith("https://iamcredentials.googleapis.com/")) {
      return jsonResponse({ token: token("google-id-token") });
    }
    return jsonResponse(
      { ok: upstreamStatus < 400, error: upstreamStatus === 401 ? "UNAUTHORIZED" : undefined },
      upstreamStatus,
      { "x-request-id": "request-1" },
    );
  });
  return {
    requests,
    dependencies: {
      fetchImpl: fetchImpl as typeof fetch,
      getVercelOidcToken: vi.fn(async () => token("vercel-oidc")),
    },
  };
}

describe("Preview backend proxy", () => {
  const originalVercelEnv = process.env.VERCEL_ENV;

  beforeEach(() => {
    process.env.VERCEL_ENV = "preview";
    vi.restoreAllMocks();
  });

  afterEach(() => {
    if (originalVercelEnv == null) delete process.env.VERCEL_ENV;
    else process.env.VERCEL_ENV = originalVercelEnv;
  });

  it("accepts only Preview and rejects Production or Development", async () => {
    for (const environment of ["production", "development"]) {
      process.env.VERCEL_ENV = environment;
      const res = responseRecorder();
      await handlePreviewBackendProxy(
        request("/api/preview-backend/api/auth/login", "POST"),
        res,
        successfulDependencies().dependencies,
      );
      expect(res.statusCode).toBe(403);
      expect(res.body).toEqual({
        ok: false,
        error: "PREVIEW_PROXY_ENVIRONMENT_REJECTED",
      });
    }

    process.env.VERCEL_ENV = "preview";
    const { dependencies } = successfulDependencies();
    const res = responseRecorder();
    await handlePreviewBackendProxy(
      request("/api/preview-backend/api/auth/login", "POST"),
      res,
      dependencies,
    );
    expect(res.statusCode).toBe(200);
  });

  it.each([
    ["/api/preview-backend/api/auth/login", "POST", "/api/auth/login"],
    ["/api/preview-backend/api/auth/logout", "POST", "/api/auth/logout"],
    ["/api/preview-backend/api/me", "GET", "/api/me"],
    ["/api/preview-backend/api/auth/me", "GET", "/api/auth/me"],
  ])("allows exact auth route %s", (url, method, expected) => {
    expect(resolvePreviewBackendPath(request(url, method))).toEqual({
      backendPath: expected,
      query: "",
    });
  });

  it.each([
    "/api/preview-backend/api/admin/users",
    "/api/preview-backend/api/auth/signup",
    "/api/preview-backend/api/auth/login/extra",
    "/api/preview-backend/api/preview-backend/api/auth/login",
    "/api/preview-backend//api/auth/login",
    "/api/preview-backend/https://example.invalid",
    "/api/preview-backend/%2F%2Fevil.invalid",
    "/api/preview-backend/api/auth/%",
  ])("rejects unknown or malformed path %s", (url) => {
    expect(() => resolvePreviewBackendPath(request(url, "GET"))).toThrow(
      "PREVIEW_PROXY_ROUTE_NOT_ALLOWED",
    );
  });

  it.each([
    "/api/preview-backend/../api/auth/login",
    "/api/preview-backend/%2e%2e/api/auth/login",
    "/api/preview-backend/api/auth/%2e%2e/login",
    "/api/preview-backend/api%2fauth%2flogin",
    "/api/preview-backend/api%5cauth%5clogin",
  ])("rejects traversal path %s", (url) => {
    expect(() => resolvePreviewBackendPath(request(url, "POST"))).toThrow(
      "PREVIEW_PROXY_ROUTE_NOT_ALLOWED",
    );
  });

  it("rejects unsupported methods", async () => {
    const res = responseRecorder();
    await handlePreviewBackendProxy(
      request("/api/preview-backend/api/auth/login", "GET"),
      res,
      successfulDependencies().dependencies,
    );
    expect(res.statusCode).toBe(405);
    expect(res.body).toEqual({
      ok: false,
      error: "PREVIEW_PROXY_METHOD_NOT_ALLOWED",
    });
  });

  it("uses exact identity constants and preserves application authorization separately", async () => {
    const { requests, dependencies } = successfulDependencies();
    const res = responseRecorder();
    await handlePreviewBackendProxy(
      request("/api/preview-backend/api/me?source=smoke", "GET", {
        headers: {
          authorization: "Bearer application-session-token",
          "x-vercel-oidc-token": "must-not-forward",
          cookie: "session=must-not-forward",
          host: "preview.example.vercel.app",
        },
      }),
      res,
      dependencies,
    );

    expect(PREVIEW_PROXY_AUTH_CONFIG.vercelOidcTokenAudience).toBe(
      "https://iam.googleapis.com/projects/501298948635/locations/global/workloadIdentityPools/vercel-preview-proxy/providers/vercel-preview",
    );
    expect(PREVIEW_PROXY_AUTH_CONFIG.googleStsAudience).toBe(
      "//iam.googleapis.com/projects/501298948635/locations/global/workloadIdentityPools/vercel-preview-proxy/providers/vercel-preview",
    );
    expect(PREVIEW_PROXY_CONFIG.serviceAccountEmail).toBe(
      "vercel-preview-proxy@rentchain-preview.iam.gserviceaccount.com",
    );
    expect(PREVIEW_PROXY_AUTH_CONFIG.cloudRunIdTokenAudience).toBe(
      "https://rentchain-preview-backend-glistw4pya-nn.a.run.app",
    );
    expect(requests[1].url).toBe(
      "https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/vercel-preview-proxy%40rentchain-preview.iam.gserviceaccount.com:generateIdToken",
    );
    expect(requests[1].init?.body).toBe(
      JSON.stringify({
        audience: PREVIEW_PROXY_CONFIG.cloudRunServiceUrl,
        includeEmail: false,
      }),
    );
    expect(requests[2].url).toBe(
      `${PREVIEW_PROXY_CONFIG.cloudRunServiceUrl}/api/me?source=smoke`,
    );
    expect(requests[2].init?.headers).toMatchObject({
      authorization: "Bearer application-session-token",
      "X-Serverless-Authorization": `Bearer ${token("google-id-token")}`,
    });
    expect(JSON.stringify(requests[2].init?.headers)).not.toContain("must-not-forward");
  });

  it("returns sanitized token-boundary errors", async () => {
    const res = responseRecorder();
    await handlePreviewBackendProxy(
      request("/api/preview-backend/api/auth/login", "POST"),
      res,
      {
        getVercelOidcToken: vi.fn(async () => token("secret-vercel-token")),
        fetchImpl: vi.fn(async () =>
          jsonResponse(
            {
              error: "invalid_target",
              error_description: "secret-vercel-token secret-google-token",
            },
            400,
          ),
        ) as typeof fetch,
      },
    );
    expect(res.statusCode).toBe(502);
    expect(res.body).toEqual({ ok: false, error: "GOOGLE_STS_EXCHANGE_FAILED" });
    expect(JSON.stringify(res.body)).not.toContain("secret");
  });

  it("preserves upstream invalid-credential 401 responses", async () => {
    const { dependencies } = successfulDependencies(401);
    const res = responseRecorder();
    await handlePreviewBackendProxy(
      request("/api/preview-backend/api/auth/login", "POST", {
        headers: { "content-type": "application/json" },
        body: { email: "preview@example.invalid", password: "invalid" },
      }),
      res,
      dependencies,
    );
    expect(res.statusCode).toBe(401);
    expect(Buffer.isBuffer(res.body)).toBe(true);
    expect(JSON.parse((res.body as Buffer).toString("utf8"))).toMatchObject({
      error: "UNAUTHORIZED",
    });
  });

  it("returns a controlled timeout without retrying the upstream request", async () => {
    const { requests, dependencies } = successfulDependencies();
    const upstreamFetch = dependencies.fetchImpl;
    dependencies.fetchImpl = vi.fn(async (input, init) => {
      if (String(input).startsWith(PREVIEW_PROXY_CONFIG.cloudRunServiceUrl)) {
        return new Promise((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () =>
            reject(new DOMException("Aborted", "AbortError")),
          );
        });
      }
      return upstreamFetch(input, init);
    }) as typeof fetch;

    const res = responseRecorder();
    await handlePreviewBackendProxy(
      request("/api/preview-backend/api/me", "GET"),
      res,
      { ...dependencies, upstreamTimeoutMs: 5 },
    );
    expect(res.statusCode).toBe(504);
    expect(res.body).toEqual({ ok: false, error: "PREVIEW_BACKEND_TIMEOUT" });
    expect(
      requests.filter(({ url }) =>
        url.startsWith(PREVIEW_PROXY_CONFIG.cloudRunServiceUrl),
      ),
    ).toHaveLength(0);
  });

  it("enforces the auth request body limit before token acquisition", async () => {
    const getVercelOidcToken = vi.fn(async () => token("vercel"));
    const res = responseRecorder();
    await handlePreviewBackendProxy(
      request("/api/preview-backend/api/auth/login", "POST", {
        body: "x".repeat(PREVIEW_PROXY_BODY_LIMIT_BYTES + 1),
      }),
      res,
      { ...successfulDependencies().dependencies, getVercelOidcToken },
    );
    expect(res.statusCode).toBe(413);
    expect(getVercelOidcToken).not.toHaveBeenCalled();
  });

  it("rejects malformed JSON before token acquisition", async () => {
    const getVercelOidcToken = vi.fn(async () => token("vercel"));
    const res = responseRecorder();
    await handlePreviewBackendProxy(
      request("/api/preview-backend/api/auth/login", "POST", {
        headers: { "content-type": "application/json" },
        body: "{\"email\":",
      }),
      res,
      { ...successfulDependencies().dependencies, getVercelOidcToken },
    );
    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({ ok: false, error: "PREVIEW_PROXY_BODY_INVALID" });
    expect(getVercelOidcToken).not.toHaveBeenCalled();
  });

  it("keeps the production rewrite unchanged and relies on the dedicated filesystem Function", () => {
    const frontendRoot = path.resolve(process.cwd());
    const vercelConfig = JSON.parse(
      fs.readFileSync(path.join(frontendRoot, "vercel.json"), "utf8"),
    );
    expect(
      vercelConfig.rewrites.find((rewrite: { source: string }) =>
        rewrite.source === "/api/:path*"),
    ).toEqual({
      source: "/api/:path*",
      destination:
        "https://rentchain-landlord-api-cyaabkl54a-uc.a.run.app/api/:path*",
    });
    expect(
      fs.existsSync(path.join(frontendRoot, "api/preview-backend/[...path].ts")),
    ).toBe(true);
  });

  it("does not introduce the Preview Cloud Run URL into browser source", () => {
    const sourceRoot = path.resolve(process.cwd(), "src");
    const files = fs
      .readdirSync(sourceRoot, { recursive: true })
      .filter(
        (entry) =>
          /\.(ts|tsx|js|jsx)$/.test(String(entry)) &&
          !/(\.test\.|\.spec\.|__tests__)/.test(String(entry)),
      );
    const browserSource = files
      .map((entry) => fs.readFileSync(path.join(sourceRoot, String(entry)), "utf8"))
      .join("\n");
    expect(browserSource).not.toContain(PREVIEW_PROXY_CONFIG.cloudRunServiceUrl);
  });
});
