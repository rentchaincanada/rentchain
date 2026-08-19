import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  handlePreviewBackendProxy,
  PREVIEW_PROXY_CONFIG,
  type PreviewBackendProxyDependencies,
} from "../../server/previewBackendProxy";

const authMocks = vi.hoisted(() => ({
  getAuthToken: vi.fn(() => "application-session-token"),
  getFirebaseIdToken: vi.fn(async () => null),
}));

vi.mock("@/lib/authToken", () => ({
  getAuthToken: authMocks.getAuthToken,
  getTenantToken: vi.fn(() => null),
}));

vi.mock("@/lib/firebaseAuthToken", () => ({
  getFirebaseIdToken: authMocks.getFirebaseIdToken,
  warnIfFirebaseDomainMismatch: vi.fn(),
}));

function token(payload: string) {
  return `header.${payload}.signature`;
}

function jsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function proxyResponseRecorder() {
  const headers = new Headers();
  return {
    statusCode: 200,
    body: undefined as unknown,
    headers,
    setHeader(name: string, value: string | string[]) {
      headers.set(name, Array.isArray(value) ? value.join(", ") : value);
    },
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(body: unknown) {
      this.body = body;
      return this;
    },
    send(body: unknown) {
      this.body = body;
      return this;
    },
  };
}

describe("first-party lease mutation through the Preview proxy", () => {
  const originalVercelEnv = process.env.VERCEL_ENV;
  const originalPreviewBackendTarget = process.env.PREVIEW_BACKEND_TARGET;
  const originalFetch = global.fetch;

  beforeEach(() => {
    process.env.VERCEL_ENV = "preview";
    delete process.env.PREVIEW_BACKEND_TARGET;
    vi.stubEnv("VITE_DEPLOY_ENV", "preview");
    vi.stubEnv("VITE_API_BASE_URL", "/api/preview-backend");
    authMocks.getAuthToken.mockClear();
    authMocks.getFirebaseIdToken.mockClear();
  });

  afterEach(() => {
    if (originalVercelEnv == null) delete process.env.VERCEL_ENV;
    else process.env.VERCEL_ENV = originalVercelEnv;
    if (originalPreviewBackendTarget == null) delete process.env.PREVIEW_BACKEND_TARGET;
    else process.env.PREVIEW_BACKEND_TARGET = originalPreviewBackendTarget;
    global.fetch = originalFetch;
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("preserves createLease's caller-owned key through same-origin resolution to Cloud Run", async () => {
    const cloudRunRequests: Array<{ url: string; init?: RequestInit }> = [];
    const infrastructureFetch = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
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
      cloudRunRequests.push({ url, init });
      return jsonResponse({ lease: { id: "synthetic-lease" }, leaseStart: { canonicalOutcome: "occupancy_effective" } }, 201);
    });
    const dependencies: PreviewBackendProxyDependencies = {
      fetchImpl: infrastructureFetch as typeof fetch,
      getVercelOidcToken: vi.fn(async () => token("vercel-oidc")),
    };
    const sameOriginRequests: string[] = [];

    global.fetch = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      sameOriginRequests.push(url);
      const incomingHeaders = Object.fromEntries(new Headers(init?.headers).entries());
      const req = {
        url,
        method: init?.method || "GET",
        headers: incomingHeaders,
        body: init?.body,
        query: { path: url.split("?")[0].split("/").slice(3) },
      };
      const res = proxyResponseRecorder();

      await handlePreviewBackendProxy(req, res, dependencies);

      const body = Buffer.isBuffer(res.body)
        ? res.body
        : JSON.stringify(res.body ?? null);
      return new Response(body, { status: res.statusCode, headers: res.headers });
    }) as typeof fetch;

    const { createLease } = await import("../api/leasesApi");
    await createLease(
      {
        tenantId: "synthetic-tenant",
        propertyId: "synthetic-property",
        unitNumber: "101",
        monthlyRent: 1800,
        startDate: "2026-09-01",
      },
      "d3-end-to-end-key-001",
    );

    expect(sameOriginRequests).toEqual(["/api/preview-backend/api/leases"]);
    expect(cloudRunRequests).toHaveLength(1);
    expect(cloudRunRequests[0].url).toBe(`${PREVIEW_PROXY_CONFIG.cloudRunServiceUrl}/api/leases`);
    const outgoingHeaders = new Headers(cloudRunRequests[0].init?.headers);
    expect(outgoingHeaders.get("idempotency-key")).toBe("d3-end-to-end-key-001");
    expect(outgoingHeaders.get("authorization")).toBe("Bearer application-session-token");
    expect(outgoingHeaders.get("x-serverless-authorization")).toBe(
      `Bearer ${token("google-id-token")}`,
    );
    expect(outgoingHeaders.get("x-request-id")).toBeNull();
  });
});
