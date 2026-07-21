import { describe, expect, it } from "vitest";

import {
  acquireVercelOidcToken,
  PreviewAuthBridgeError,
  readPreviewAuthConfig,
  runPreviewAuthBridge,
} from "../../server/previewAuthBridge";

const config = {
  vercelOidcTokenAudience: "https://iam.googleapis.com/provider-resource",
  googleStsAudience: "//iam.googleapis.com/provider-resource",
  cloudRunIdTokenAudience: "https://bounded-oidc-hello.example.invalid",
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
  it("keeps the three audience domains explicit and non-interchangeable", async () => {
    const derived = readPreviewAuthConfig({
      GCP_PROJECT_NUMBER: "1089948756798",
      GCP_WORKLOAD_IDENTITY_POOL_ID: "vercel-preview-spike",
      GCP_WORKLOAD_IDENTITY_PROVIDER_ID: "vercel-preview",
      GCP_SERVICE_ACCOUNT_EMAIL: "preview-invoker@example.invalid",
      CLOUD_RUN_SERVICE_URL: "https://bounded-oidc-hello.example.invalid/",
      EXPECTED_SPIKE_COMMIT: "expected-commit",
    });
    const getTokenCalls: Array<{ audience: string }> = [];

    await acquireVercelOidcToken(derived, async (options) => {
      getTokenCalls.push(options);
      return "vercel-token";
    });

    expect(getTokenCalls).toEqual([{ audience: derived.vercelOidcTokenAudience }]);
    expect(derived.vercelOidcTokenAudience).toBe(
      "https://iam.googleapis.com/projects/1089948756798/locations/global/workloadIdentityPools/vercel-preview-spike/providers/vercel-preview",
    );
    expect(derived.googleStsAudience).toBe(
      "//iam.googleapis.com/projects/1089948756798/locations/global/workloadIdentityPools/vercel-preview-spike/providers/vercel-preview",
    );
    expect(derived.cloudRunIdTokenAudience).toBe(
      "https://bounded-oidc-hello.example.invalid",
    );
    expect(new Set([
      derived.vercelOidcTokenAudience,
      derived.googleStsAudience,
      derived.cloudRunIdTokenAudience,
    ]).size).toBe(3);
  });

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
    expect(String(requests[0].init?.body)).toContain(
      "audience=%2F%2Fiam.googleapis.com%2Fprovider-resource",
    );
    expect(requests[1].init?.headers).toEqual({
      Authorization: "Bearer federated-token",
      "Content-Type": "application/json",
    });
    expect(requests[1].init?.body).toBe(
      JSON.stringify({
        audience: "https://bounded-oidc-hello.example.invalid",
        includeEmail: false,
      }),
    );
    expect(requests[2].init?.headers).toEqual({ Authorization: "Bearer google-id-token" });
    expect(JSON.stringify(result)).not.toContain("vercel-token");
    expect(JSON.stringify(result)).not.toContain("federated-token");
    expect(JSON.stringify(result)).not.toContain("google-id-token");
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
        fetchImpl: (async () =>
          jsonResponse(
            {
              error: "invalid_target",
              error_description: "The audience is invalid; token-value-must-not-surface",
            },
            400,
          )) as typeof fetch,
      }),
    ).rejects.toMatchObject({
      code: "STS_EXCHANGE_DENIED",
      status: 400,
      googleErrorCode: "invalid_target",
      safeDescription: "Google rejected the configured audience.",
    });

    let requestCount = 0;
    await expect(
      runPreviewAuthBridge({
        config,
        vercelOidcToken: "vercel-token",
        fetchImpl: (async () => {
          requestCount += 1;
          if (requestCount === 1) return jsonResponse({ access_token: "federated-token" });
          return jsonResponse(
            {
              error: {
                status: "PERMISSION_DENIED",
                message:
                  "Permission 'iam.serviceAccounts.getOpenIdToken' denied; raw-token-must-not-surface",
              },
            },
            403,
          );
        }) as typeof fetch,
      }),
    ).rejects.toMatchObject({
      code: "IAM_ID_TOKEN_DENIED",
      status: 403,
      googleErrorCode: "PERMISSION_DENIED",
      safeDescription: "Google denied the requested permission.",
      deniedPermission: "iam.serviceAccounts.getOpenIdToken",
    });
  });

  it("rejects incomplete configuration without echoing values", () => {
    expect(() => readPreviewAuthConfig({ GCP_PROJECT_NUMBER: "1089948756798" })).toThrow(
      new PreviewAuthBridgeError("CONFIG_MISSING_WORKLOADIDENTITYPOOLID", 500),
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
