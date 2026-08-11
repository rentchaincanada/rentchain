import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { classifyPr1516Request, handlePr1516NoticesQaProxy, PR1516_QA } from "../../server/pr1516NoticesQaProxy";

function req(url: string, method = "GET", headers: Record<string, string> = {}) {
  return { url, method, headers };
}

function recorder() {
  return {
    statusCode: 200, body: undefined as any, headers: new Map<string, unknown>(),
    setHeader(name: string, value: unknown) { this.headers.set(name.toLowerCase(), value); },
    status(code: number) { this.statusCode = code; return this; },
    json(body: unknown) { this.body = body; return this; },
    send(body: unknown) { this.body = body; return this; },
  };
}

function dependencies() {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const fetchImpl = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input); calls.push({ url, init });
    if (url.includes("sts.googleapis.com")) return new Response(JSON.stringify({ access_token: "access", token_type: "Bearer", expires_in: 300 }), { status: 200 });
    if (url.includes("iamcredentials.googleapis.com")) return new Response(JSON.stringify({ token: "header.identity.signature" }), { status: 200 });
    return new Response(JSON.stringify({ ok: true, notices: [] }), { status: 200, headers: { "content-type": "application/json" } });
  });
  return { calls, fetchImpl: fetchImpl as typeof fetch, getVercelOidcToken: vi.fn(async () => "header.oidc.signature") };
}

describe("PR #1516 read-only Notices proxy", () => {
  beforeEach(() => { process.env.VERCEL_ENV = "preview"; process.env.VERCEL_GIT_COMMIT_REF = PR1516_QA.branch; });
  afterEach(() => { delete process.env.VERCEL_ENV; delete process.env.VERCEL_GIT_COMMIT_REF; vi.restoreAllMocks(); });

  it.each([
    "/api/pr1516-notices/api/landlord/notices?limit=50",
    "/api/pr1516-notices/api/landlord/notices/recipients?propertyIds=qa-pr1516-property-a,qa-pr1516-property-b",
    `/api/pr1516-notices/api/landlord/notices/notice_${"a".repeat(64)}`,
    "/api/pr1516-notices/api/properties?status=active",
    "/api/pr1516-notices/api/me",
  ])("allows exact read %s", (url) => expect(classifyPr1516Request(req(url))).toMatchObject({ allowed: true }));

  it("accepts only Vercel's exact catch-all routing parameter", () => {
    expect(classifyPr1516Request(req("/api/pr1516-notices/api/landlord/notices?limit=50&path=api%2Flandlord%2Fnotices"))).toMatchObject({ allowed: true });
    expect(classifyPr1516Request(req("/api/pr1516-notices/api/landlord/notices?limit=50&path=api%2Fproperties"))).toMatchObject({ allowed: false });
  });

  it.each([
    "/api/pr1516-notices/api/admin/users",
    "/api/pr1516-notices/api/landlord/notices?limit=500",
    "/api/pr1516-notices/api/landlord/notices/recipients?propertyIds=qa-pr1516-property-foreign",
    "/api/pr1516-notices/api/landlord/notices/recipients?propertyIds=qa-pr1516-property-a&unitIds=foreign-unit",
    "/api/pr1516-notices/https://production.invalid",
  ])("denies unknown or caller-selected read %s", (url) => expect(classifyPr1516Request(req(url))).toMatchObject({ allowed: false, status: 404 }));

  it.each(["POST", "PUT", "PATCH", "DELETE"])("denies %s before token acquisition", async (method) => {
    const deps = dependencies(); const res = recorder();
    await handlePr1516NoticesQaProxy(req("/api/pr1516-notices/api/landlord/notices", method), res, deps);
    expect(res.statusCode).toBe(405); expect(deps.getVercelOidcToken).not.toHaveBeenCalled(); expect(deps.fetchImpl).not.toHaveBeenCalled();
  });

  it("fails closed outside the exact Preview branch", async () => {
    process.env.VERCEL_GIT_COMMIT_REF = "main"; const deps = dependencies(); const res = recorder();
    await handlePr1516NoticesQaProxy(req("/api/pr1516-notices/api/landlord/notices"), res, deps);
    expect(res.statusCode).toBe(403); expect(deps.fetchImpl).not.toHaveBeenCalled();
  });

  it("uses only the fixed target and server-owned identity headers", async () => {
    const deps = dependencies(); const res = recorder();
    await handlePr1516NoticesQaProxy(req("/api/pr1516-notices/api/landlord/notices/recipients?propertyIds=qa-pr1516-property-a,qa-pr1516-property-b", "GET", { authorization: "Bearer browser", "x-backend-url": "https://production.invalid", "x-rentchain-preview-qa-identity": "foreign" }), res, deps);
    expect(res.statusCode).toBe(200);
    const upstream = deps.calls.at(-1)!;
    expect(upstream.url).toBe(`${PR1516_QA.serviceUrl}/api/landlord/notices/recipients?propertyIds=qa-pr1516-property-a%2Cqa-pr1516-property-b`);
    expect(upstream.init?.headers).toMatchObject({ "x-rentchain-preview-qa-identity": PR1516_QA.selector });
    expect(JSON.stringify(upstream.init?.headers)).not.toContain("browser");
    expect(JSON.stringify(res.body)).not.toContain("identity.signature");
  });

  it("sanitizes WIF failure and never falls back", async () => {
    const res = recorder(); const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ error: "secret-token" }), { status: 403 }));
    await handlePr1516NoticesQaProxy(req("/api/pr1516-notices/api/landlord/notices"), res, { fetchImpl: fetchImpl as typeof fetch, getVercelOidcToken: vi.fn(async () => "header.secret.signature") });
    expect(res.statusCode).toBe(502); expect(res.body).toEqual({ ok: false, error: "PR1516_QA_STS_FAILED" });
    expect(JSON.stringify(res.body)).not.toContain("secret");
  });
});
