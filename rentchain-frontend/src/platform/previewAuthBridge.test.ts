import { describe, expect, it } from "vitest";

import {
  PreviewAuthBridgeError,
  readPreviewAuthConfig,
  runPreviewAuthBridge,
} from "../../api/previewAuthBridge";

const config = {
  gcpAudience: "provider-audience",
  serviceAccountEmail: "preview-invoker@example.invalid",
  cloudRunServiceUrl: "https://bounded-oidc-hello.example.invalid",
  expectedSpikeCommit: "expected-commit",
};

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("preview auth bridge", () => {
  it("returns only whitelisted hello evidence after the three server-side calls", async () => {
    const requests: Array<{ url: string; init?: RequestInit }> = [];
    const fetchImpl = async (url: string | URL | Request, init?: RequestInit) => {
      requests.push({ url: String(url), init });
      if (requests.length === 1) return jsonResponse({ access_token: "federated-token" });
      if (requests.length === 2) return jsonResponse({ token: "google-id-token" });
      return jsonResponse({
        ok: true,
        service: "bounded-oidc-hello",
        commitSha: "expected-commit",
        revision: "bounded-oidc-hello-00001-test",
        timestamp: "2026-07-20T12:00:00.000Z",
        ignored: "not projected",
      });
    };

    const result = await runPreviewAuthBridge({
      config,
      vercelOidcToken: "vercel-token",
      fetchImpl: fetchImpl as typeof fetch,
    });

    expect(result).toEqual({
      ok: true,
      service: "bounded-oidc-hello",
      commitSha: "expected-commit",
      revision: "bounded-oidc-hello-00001-test",
      timestamp: "2026-07-20T12:00:00.000Z",
    });
    expect(requests.map(({ url }) => url)).toEqual([
      "https://sts.googleapis.com/v1/token",
      "https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/preview-invoker%40example.invalid:generateIdToken",
      "https://bounded-oidc-hello.example.invalid",
    ]);
    expect(String(requests[0].init?.body)).toContain("subject_token=vercel-token");
    expect(requests[1].init?.headers).toEqual({
      Authorization: "Bearer federated-token",
      "Content-Type": "application/json",
    });
    expect(requests[2].init?.headers).toEqual({ Authorization: "Bearer google-id-token" });
  });

  it("proves an intentionally wrong audience is denied without returning a token", async () => {
    const requests: Array<{ init?: RequestInit }> = [];
    const fetchImpl = async (_url: string | URL | Request, init?: RequestInit) => {
      requests.push({ init });
      if (requests.length === 1) return jsonResponse({ access_token: "federated-token" });
      if (requests.length === 2) return jsonResponse({ token: "wrong-audience-id-token" });
      return jsonResponse({}, 403);
    };

    const result = await runPreviewAuthBridge({
      config,
      vercelOidcToken: "vercel-token",
      wrongAudience: true,
      fetchImpl: fetchImpl as typeof fetch,
    });

    expect(result).toEqual({ ok: true, test: "wrong-audience", denied: true, status: 403 });
    expect(requests[1].init?.body).toBe(
      JSON.stringify({ audience: "https://wrong-audience.invalid", includeEmail: false }),
    );
  });

  it("fails closed with sanitized errors for every remote boundary", async () => {
    await expect(
      runPreviewAuthBridge({
        config,
        vercelOidcToken: "vercel-token",
        fetchImpl: (async () => jsonResponse({ secret: "not surfaced" }, 403)) as typeof fetch,
      }),
    ).rejects.toMatchObject({ code: "STS_EXCHANGE_DENIED", status: 403 });
  });

  it("rejects incomplete configuration without echoing values", () => {
    expect(() => readPreviewAuthConfig({ GCP_AUDIENCE: "provider-audience" })).toThrow(
      new PreviewAuthBridgeError("CONFIG_MISSING_SERVICEACCOUNTEMAIL", 500),
    );
  });

  it("fails closed when Cloud Run evidence does not match the expected commit", async () => {
    let requestCount = 0;
    const fetchImpl = async () => {
      requestCount += 1;
      if (requestCount === 1) return jsonResponse({ access_token: "federated-token" });
      if (requestCount === 2) return jsonResponse({ token: "google-id-token" });
      return jsonResponse({
        ok: true,
        service: "bounded-oidc-hello",
        commitSha: "unexpected-commit",
        revision: "revision",
        timestamp: "timestamp",
      });
    };

    await expect(
      runPreviewAuthBridge({
        config,
        vercelOidcToken: "vercel-token",
        fetchImpl: fetchImpl as typeof fetch,
      }),
    ).rejects.toMatchObject({ code: "CLOUD_RUN_EVIDENCE_MISMATCH" });
  });
});
