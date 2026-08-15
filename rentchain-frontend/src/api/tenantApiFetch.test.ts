import { beforeEach, describe, expect, it, vi } from "vitest";

import { G1C_QA_PRINCIPAL, G1C_QA_SCOPE, G1C_QA_SESSION_KEY } from "../platform/g1cQaSession";

const mocks = vi.hoisted(() => ({
  apiBaseUrl: "https://rentchain-landlord-api-cyaabkl54a-uc.a.run.app",
  getTenantToken: vi.fn(() => "tenant-token"),
}));

vi.mock("./config", () => ({ get API_BASE_URL() { return mocks.apiBaseUrl; } }));
vi.mock("../lib/tenantAuth", () => ({ getTenantToken: mocks.getTenantToken }));

import { G1cQaTenantApiSuppressedError, tenantApiFetch } from "./tenantApiFetch";

function setSession(scope = G1C_QA_SCOPE, principalId = G1C_QA_PRINCIPAL) {
  window.sessionStorage.setItem(G1C_QA_SESSION_KEY, JSON.stringify({ scope, session: { principalId } }));
}

describe("tenant API browser routing", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    window.sessionStorage.clear();
    mocks.apiBaseUrl = "https://rentchain-landlord-api-cyaabkl54a-uc.a.run.app";
  });

  it.each([
    "/tenant/workspace",
    "/tenant/communication/summary",
    "/tenant/me",
    "/tenant/messages",
    "https://arbitrary-backend.example/api/tenant/workspace",
  ])("suppresses %s before any browser request in the exact G1C session", async (path) => {
    setSession();
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    await expect(tenantApiFetch(path)).rejects.toBeInstanceOf(G1cQaTenantApiSuppressedError);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("preserves normal Production tenant API resolution", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "content-type": "application/json" } }),
    );

    await tenantApiFetch("/tenant/workspace");

    expect(fetchSpy).toHaveBeenCalledWith(
      "https://rentchain-landlord-api-cyaabkl54a-uc.a.run.app/api/tenant/workspace",
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: "Bearer tenant-token" }) }),
    );
  });

  it.each([
    ["other-preview-scope", G1C_QA_PRINCIPAL],
    [G1C_QA_SCOPE, "qa-g1c-foreign-tenant"],
  ])("does not suppress unrelated Preview session %s / %s", async (scope, principalId) => {
    setSession(scope, principalId);
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "content-type": "application/json" } }),
    );

    await tenantApiFetch("/tenant/workspace");
    expect(fetchSpy).toHaveBeenCalledOnce();
  });

  it("provides a global zero-direct-run.app guard for fixed G1C browser traffic", async () => {
    setSession();
    const applicationRequests: string[] = [];
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      applicationRequests.push(String(input));
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    });

    await Promise.allSettled([
      tenantApiFetch("/tenant/workspace"),
      tenantApiFetch("/tenant/communication/summary"),
      tenantApiFetch("/tenant/maintenance-requests"),
      tenantApiFetch("/tenant/notices"),
      tenantApiFetch("/tenant/profile"),
    ]);

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(applicationRequests.filter((url) => new URL(url).hostname.endsWith(".run.app"))).toEqual([]);
  });
});
