import { afterEach, describe, expect, it, vi } from "vitest";
import { classifyG1cIdentityRequest, G1C_IDENTITY_QA, handleG1cIdentityQaProxy } from "../../server/g1cIdentityQaProxy";

function response() {
  return { statusCode: 200, body: undefined as any, headers: new Map<string, string>(), setHeader(name: string, value: string) { this.headers.set(name.toLowerCase(), value); }, status(code: number) { this.statusCode = code; return this; }, json(value: any) { this.body = value; return this; }, send(value: any) { this.body = value; return this; } };
}
const request = (url: string, method = "GET", body?: Buffer) => ({ url, method, body, headers: { "content-type": "application/json", authorization: "Bearer browser-value", "x-backend-url": "https://production.invalid" } });

describe("G1C identity QA proxy", () => {
  afterEach(() => vi.unstubAllEnvs());
  it.each([
    ["GET", "/api/g1c-identity/api/tenant/identity-documents/status"],
    ["GET", "/api/g1c-identity/api/tenant/identity-documents"],
    ["POST", "/api/g1c-identity/api/tenant/identity-documents/consent"],
    ["POST", "/api/g1c-identity/api/tenant/identity-documents"],
    ["POST", "/api/g1c-identity/api/tenant/identity-documents/123e4567-e89b-42d3-a456-426614174000/access"],
    ["DELETE", "/api/g1c-identity/api/tenant/identity-documents/123e4567-e89b-42d3-a456-426614174000"],
  ])("allows only %s %s", (method, url) => expect(classifyG1cIdentityRequest(request(url, method)).allowed).toBe(true));

  it.each([
    ["POST", "/api/g1c-identity/api/tenant/identity-documents/status"],
    ["GET", "/api/g1c-identity/api/tenant/identity-documents/arbitrary/access"],
    ["GET", "/api/g1c-identity/api/admin/users"],
    ["GET", "/api/g1c-identity/https://production.invalid"],
  ])("rejects %s %s", (method, url) => expect(classifyG1cIdentityRequest(request(url, method)).allowed).toBe(false));

  it("injects fixed server-owned identity and target", async () => {
    vi.stubEnv("VERCEL_ENV", "preview");
    vi.stubEnv("VERCEL_GIT_COMMIT_REF", G1C_IDENTITY_QA.branch);
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ access_token: "access", expires_in: 300, token_type: "Bearer" }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ token: "header.identity.signature" }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true, data: [] }), { status: 200, headers: { "content-type": "application/json" } }));
    const res = response();
    await handleG1cIdentityQaProxy(request("/api/g1c-identity/api/tenant/identity-documents"), res, { fetchImpl, getVercelOidcToken: async () => "oidc" });
    const [target, init] = fetchImpl.mock.calls[2];
    expect(target).toBe(`${G1C_IDENTITY_QA.serviceUrl}/api/tenant/identity-documents`);
    expect(init.headers["x-rentchain-preview-qa-identity"]).toBe("qa-g1c-tenant");
    expect(init.headers.authorization).toBeUndefined();
    expect(JSON.stringify(init.headers)).not.toContain("browser-value");
    expect(JSON.stringify(target)).not.toContain("production.invalid");
  });
});
