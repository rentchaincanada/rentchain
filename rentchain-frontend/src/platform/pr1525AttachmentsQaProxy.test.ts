import { afterEach, describe, expect, it, vi } from "vitest";
import {
  classifyPr1525AttachmentRequest,
  handlePr1525AttachmentsQaProxy,
} from "../../server/pr1525AttachmentsQaProxy";

function req(url: string, method = "GET", headers: Record<string, string> = {}) {
  return { url, method, headers };
}

function response() {
  const headers = new Map<string, string>();
  return {
    statusCode: 200,
    body: undefined as any,
    setHeader(name: string, value: string) { headers.set(name.toLowerCase(), value); },
    status(code: number) { this.statusCode = code; return this; },
    json(value: any) { this.body = value; return this; },
    send(value: any) { this.body = value; return this; },
    headers,
  };
}

describe("PR #1525 attachment QA proxy", () => {
  const attachmentId = "123e4567-e89b-42d3-a456-426614174000";

  afterEach(() => vi.unstubAllEnvs());

  it.each([
    ["tenant", "GET", "/api/tenant/maintenance-requests/qa-pr1525-target-request/attachments"],
    ["tenant", "POST", "/api/tenant/maintenance-requests/qa-pr1525-target-request/attachments"],
    ["foreignTenant", "DELETE", `/api/tenant/maintenance-requests/qa-pr1525-target-request/attachments/${attachmentId}`],
    ["landlord", "GET", "/api/landlord/maintenance/qa-pr1525-target-request/attachments"],
    ["foreignLandlord", "GET", "/api/landlord/maintenance/qa-pr1525-foreign-request/attachments"],
  ])("allows fixed actor %s for %s", (actor, method, path) => {
    expect(classifyPr1525AttachmentRequest(req(`/api/pr1525-attachments/${actor}${path}`, method)).allowed).toBe(true);
  });

  it.each([
    "/api/pr1525-attachments/arbitrary/api/tenant/maintenance-requests/qa-pr1525-target-request/attachments",
    "/api/pr1525-attachments/tenant/api/tenant/maintenance-requests/arbitrary/attachments",
    "/api/pr1525-attachments/tenant/api/landlord/maintenance/qa-pr1525-target-request/attachments",
  ])("rejects arbitrary identity or resource input", (url) => {
    expect(classifyPr1525AttachmentRequest(req(url)).allowed).toBe(false);
  });

  it("rejects non-UUID attachment identifiers", () => {
    expect(classifyPr1525AttachmentRequest(req(
      "/api/pr1525-attachments/tenant/api/tenant/maintenance-requests/qa-pr1525-target-request/attachments/qa-pr1525-attachment-one",
      "DELETE",
    )).allowed).toBe(false);
  });

  it("maps the semantic actor to the fixed server-side selector", async () => {
    vi.stubEnv("VERCEL_ENV", "preview");
    vi.stubEnv("VERCEL_GIT_COMMIT_REF", "feat/tenant-maintenance-image-attachments-v1");
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const fetchImpl = vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url, init });
      if (url.includes("sts.googleapis.com")) return new Response(JSON.stringify({ access_token: "access" }), { status: 200 });
      if (url.includes("iamcredentials.googleapis.com")) return new Response(JSON.stringify({ token: "header.identity.signature" }), { status: 200 });
      return new Response(JSON.stringify({ ok: true, data: [] }), { status: 200, headers: { "content-type": "application/json" } });
    });
    const res = response();
    await handlePr1525AttachmentsQaProxy(
      req("/api/pr1525-attachments/tenant/api/tenant/maintenance-requests/qa-pr1525-target-request/attachments"),
      res,
      { fetchImpl, getVercelOidcToken: async () => "oidc" },
    );
    const upstream = calls.at(-1)?.init;
    expect(res.statusCode).toBe(200);
    expect(upstream?.headers).toMatchObject({ "x-rentchain-preview-qa-identity": "pr1525-tenant" });
    expect(JSON.stringify(upstream?.headers)).not.toContain("arbitrary");
  });
});
