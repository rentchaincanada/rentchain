import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  handlePr1525ReadinessQaProxy,
  PR1525_READINESS_QA,
} from "../../server/pr1525ReadinessQaProxy";

function recorder() {
  return {
    statusCode: 200,
    body: undefined as any,
    headers: new Map<string, unknown>(),
    setHeader(name: string, value: unknown) {
      this.headers.set(name.toLowerCase(), value);
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

function dependencies() {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const fetchImpl = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, init });
    if (url.includes("sts.googleapis.com")) {
      return new Response(
        JSON.stringify({ access_token: "access", token_type: "Bearer", expires_in: 300 }),
        { status: 200 },
      );
    }
    if (url.includes("iamcredentials.googleapis.com")) {
      return new Response(JSON.stringify({ token: "header.identity.signature" }), { status: 200 });
    }
    return new Response(JSON.stringify({ ok: true, service: "rentchain-pr1525-attachments-qa-d4fe051b" }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  });
  return {
    calls,
    fetchImpl: fetchImpl as typeof fetch,
    getVercelOidcToken: vi.fn(async () => "header.oidc.signature"),
  };
}

describe("PR #1525 readiness QA proxy", () => {
  beforeEach(() => {
    process.env.VERCEL_ENV = "preview";
    process.env.VERCEL_GIT_COMMIT_REF = PR1525_READINESS_QA.branch;
  });

  afterEach(() => {
    delete process.env.VERCEL_ENV;
    delete process.env.VERCEL_GIT_COMMIT_REF;
    vi.restoreAllMocks();
  });

  it("uses only the fixed isolated health target and keeps credentials server-side", async () => {
    const deps = dependencies();
    const res = recorder();
    await handlePr1525ReadinessQaProxy(
      { method: "GET", headers: { authorization: "Bearer browser", "x-backend-url": "https://production.invalid" } },
      res,
      deps,
    );

    expect(res.statusCode).toBe(200);
    const upstream = deps.calls.at(-1)!;
    expect(upstream.url).toBe(`${PR1525_READINESS_QA.serviceUrl}/health`);
    expect(upstream.init?.headers).toMatchObject({
      "X-Serverless-Authorization": "Bearer header.identity.signature",
    });
    expect(JSON.stringify(upstream.init?.headers)).not.toContain("browser");
    expect(JSON.stringify(res.body)).not.toContain("identity.signature");
    expect(res.headers.get("x-rentchain-api-proxy")).toBe("pr1525-readiness-qa");
  });

  it.each(["POST", "PUT", "PATCH", "DELETE"])("rejects %s before token acquisition", async (method) => {
    const deps = dependencies();
    const res = recorder();
    await handlePr1525ReadinessQaProxy({ method }, res, deps);
    expect(res.statusCode).toBe(405);
    expect(deps.getVercelOidcToken).not.toHaveBeenCalled();
    expect(deps.fetchImpl).not.toHaveBeenCalled();
  });

  it("fails closed outside the exact Preview branch", async () => {
    process.env.VERCEL_GIT_COMMIT_REF = "main";
    const deps = dependencies();
    const res = recorder();
    await handlePr1525ReadinessQaProxy({ method: "GET" }, res, deps);
    expect(res.statusCode).toBe(403);
    expect(deps.fetchImpl).not.toHaveBeenCalled();
  });

  it("sanitizes WIF failure and never falls back", async () => {
    const res = recorder();
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ error: "secret-token" }), { status: 403 }));
    await handlePr1525ReadinessQaProxy(
      { method: "GET" },
      res,
      {
        fetchImpl: fetchImpl as typeof fetch,
        getVercelOidcToken: vi.fn(async () => "header.secret.signature"),
      },
    );
    expect(res.statusCode).toBe(502);
    expect(res.body).toEqual({ ok: false, error: "PR1525_READINESS_STS_FAILED" });
    expect(JSON.stringify(res.body)).not.toContain("secret");
  });
});
