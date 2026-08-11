import { describe, expect, it, vi } from "vitest";
import {
  PREVIEW_API_BASE_URL,
  PR1512_NOTICES_QA_API_BASE_URL,
  PRODUCTION_API_BASE_URL,
  PreviewApiRouteUnavailableError,
  assertPreviewBrowserRequestAvailable,
  isPreviewAuthPath,
  isPreviewAuthRequest,
  isPr1512QaReadRequest,
  resolveConfiguredApiBase,
} from "./baseUrl";

const production = {
  apiBaseUrl: PRODUCTION_API_BASE_URL,
  deployEnv: "production",
  isDevelopment: false,
};

describe("resolveConfiguredApiBase", () => {
  it("accepts the exact Preview classification and proxy base", () => {
    expect(
      resolveConfiguredApiBase({
        apiBaseUrl: PREVIEW_API_BASE_URL,
        deployEnv: "preview",
        isDevelopment: false,
      })
    ).toBe(PREVIEW_API_BASE_URL);
  });

  it("preserves the Production HTTPS base", () => {
    expect(resolveConfiguredApiBase(production)).toBe(PRODUCTION_API_BASE_URL);
  });

  it("accepts the exact PR #1512 Preview-only proxy base", () => {
    expect(resolveConfiguredApiBase({ apiBaseUrl: PR1512_NOTICES_QA_API_BASE_URL, deployEnv: "preview", isDevelopment: false })).toBe(PR1512_NOTICES_QA_API_BASE_URL);
  });

  it.each([
    [PREVIEW_API_BASE_URL, "production"],
    [PREVIEW_API_BASE_URL, ""],
    [PRODUCTION_API_BASE_URL, "preview"],
    [PRODUCTION_API_BASE_URL, "staging"],
  ])("rejects contradictory base %s and environment %s", (apiBaseUrl, deployEnv) => {
    expect(() =>
      resolveConfiguredApiBase({ apiBaseUrl, deployEnv, isDevelopment: false })
    ).toThrow();
  });

  it.each([
    "/",
    "/api",
    "/api/preview-backend/",
    "/api/preview-backend/extra",
    "api/preview-backend",
    "//example.com",
    "\\api\\preview-backend",
    "/api/preview%2dbackend",
    "/api/preview-backend?x=1",
    "/api/preview-backend#fragment",
  ])("rejects unauthorized relative base %s", (apiBaseUrl) => {
    expect(() =>
      resolveConfiguredApiBase({ apiBaseUrl, deployEnv: "preview", isDevelopment: false })
    ).toThrow();
  });

  it("preserves documented local HTTP behavior without using the Preview proxy", () => {
    expect(
      resolveConfiguredApiBase({
        apiBaseUrl: "http://localhost:8080",
        deployEnv: "development",
        isDevelopment: true,
      })
    ).toBe("http://localhost:8080");
  });
});

describe("PR #1512 QA read scope", () => {
  it.each([
    ["/api/me", "GET"],
    ["/api/properties?status=active", "GET"],
    ["/api/landlord/notices?limit=50", "GET"],
    ["/api/landlord/notices/recipients?propertyId=fixed", "GET"],
    [`/api/landlord/notices/notice_${"a".repeat(64)}`, "GET"],
  ])("allows %s with %s", (path, method) => expect(isPr1512QaReadRequest(path, method)).toBe(true));

  it.each([["/api/landlord/notices", "POST"], ["/api/admin/users", "GET"], ["/api/properties", "DELETE"]])(
    "rejects %s with %s", (path, method) => expect(isPr1512QaReadRequest(path, method)).toBe(false),
  );
});

describe("Preview auth path scope", () => {
  it.each([
    ["/api/auth/login", "POST"],
    ["/api/auth/logout", "POST"],
    ["/api/me", "GET"],
    ["/api/auth/me", "GET"],
  ])("allows %s with %s", (path, method) => {
    expect(isPreviewAuthRequest(path, method)).toBe(true);
  });

  it.each([
    ["/api/auth/login", "GET"],
    ["/api/auth/logout", "GET"],
    ["/api/me", "POST"],
    ["/api/auth/me", "POST"],
  ])("rejects %s with %s", (path, method) => {
    expect(isPreviewAuthPath(path)).toBe(true);
    expect(isPreviewAuthRequest(path, method)).toBe(false);
  });

  it.each([
    "/api/auth/signup",
    "/api/auth/login/demo",
    "/api/tenant/me",
    "/api/properties",
  ])("does not repoint unrelated path %s", (path) => {
    expect(isPreviewAuthPath(path)).toBe(false);
  });
});

describe("Preview browser dispatch guard", () => {
  it("allows only exact same-origin authorized proxy operations", () => {
    vi.stubEnv("VITE_DEPLOY_ENV", "preview");
    vi.stubEnv("VITE_API_BASE_URL", PREVIEW_API_BASE_URL);
    try {
      expect(() =>
        assertPreviewBrowserRequestAvailable(
          "/api/preview-backend/api/auth/login",
          "POST"
        )
      ).not.toThrow();
      expect(() =>
        assertPreviewBrowserRequestAvailable("/api/properties", "GET")
      ).toThrow(PreviewApiRouteUnavailableError);
      expect(() =>
        assertPreviewBrowserRequestAvailable(
          `${PRODUCTION_API_BASE_URL}/api/properties`,
          "GET"
        )
      ).toThrow(PreviewApiRouteUnavailableError);
    } finally {
      vi.unstubAllEnvs();
    }
  });
});
