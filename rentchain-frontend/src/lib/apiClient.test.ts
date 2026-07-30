import { afterEach, describe, expect, it, vi } from "vitest";
import {
  PREVIEW_API_BASE_URL,
  PREVIEW_API_ROUTE_NOT_AVAILABLE,
  PRODUCTION_API_BASE_URL,
  PreviewApiRouteUnavailableError,
} from "../api/baseUrl";
import * as authToken from "./authToken";
import * as firebaseAuthToken from "./firebaseAuthToken";
import {
  apiFetch,
  isAccidentalSameOriginApiUrl,
  isAuthorizedPreviewProxyUrl,
  resolveApiUrl,
} from "./apiClient";

afterEach(() => {
  vi.unstubAllEnvs();
});

function usePreviewEnvironment() {
  vi.stubEnv("VITE_DEPLOY_ENV", "preview");
  vi.stubEnv("VITE_API_BASE_URL", PREVIEW_API_BASE_URL);
}

describe("resolveApiUrl", () => {
  it.each([
    ["/api/auth/login", "POST", "/api/preview-backend/api/auth/login"],
    ["/api/auth/logout", "POST", "/api/preview-backend/api/auth/logout"],
    ["/api/me", "GET", "/api/preview-backend/api/me"],
    ["/api/auth/me", "GET", "/api/preview-backend/api/auth/me"],
  ])("routes Preview auth %s %s through the same-origin proxy", (path, method, expected) => {
    usePreviewEnvironment();
    expect(resolveApiUrl(path, method)).toBe(expected);
  });

  it.each([
    ["/api/auth/login", "GET"],
    ["/api/auth/logout", "GET"],
    ["/api/me", "POST"],
    ["/api/auth/me", "POST"],
  ])("fails closed for unauthorized Preview auth operation %s %s", (path, method) => {
    usePreviewEnvironment();
    expect(() => resolveApiUrl(path, method)).toThrow(PreviewApiRouteUnavailableError);
  });

  it("preserves query strings without duplicating the proxy prefix", () => {
    usePreviewEnvironment();
    expect(resolveApiUrl("/api/me?refresh=1")).toBe(
      "/api/preview-backend/api/me?refresh=1"
    );
  });

  it("rejects an already-prefixed path instead of duplicating the proxy prefix", () => {
    usePreviewEnvironment();
    expect(() => resolveApiUrl("/api/preview-backend/api/me")).toThrow(
      "Preview proxy paths must be resolved"
    );
  });

  it("fails closed for unrelated Preview calls", () => {
    usePreviewEnvironment();
    expect(() => resolveApiUrl("/api/properties")).toThrow(
      "not available in the current Preview environment"
    );
  });

  it.each([
    "/api/properties",
    "/api/tenants",
    "/api/applications",
    "/api/work-orders",
    "/api/landlord/portfolio-status-financial",
    "/api/landlord/decision-queue",
    "/api/landlord/inbox",
  ])("rejects unsupported Preview request %s before credentials or fetch", async (path) => {
    usePreviewEnvironment();
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const firebaseSpy = vi.spyOn(firebaseAuthToken, "getFirebaseIdToken");
    const bearerSpy = vi.spyOn(authToken, "getAuthToken");

    await expect(apiFetch(path, { method: "GET" })).rejects.toMatchObject({
      code: PREVIEW_API_ROUTE_NOT_AVAILABLE,
      path,
      method: "GET",
      message: "This operation is not available in the current Preview environment.",
    });

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(firebaseSpy).not.toHaveBeenCalled();
    expect(bearerSpy).not.toHaveBeenCalled();
  });

  it("preserves normal Production URL construction", () => {
    vi.stubEnv("VITE_DEPLOY_ENV", "production");
    vi.stubEnv("VITE_API_BASE_URL", PRODUCTION_API_BASE_URL);
    expect(resolveApiUrl("/api/me")).toBe(`${PRODUCTION_API_BASE_URL}/api/me`);
  });

  it("rejects accidental same-origin API routing in Production", () => {
    vi.stubEnv("VITE_DEPLOY_ENV", "production");
    vi.stubEnv("VITE_API_BASE_URL", "/api");
    expect(() => resolveApiUrl("/api/me")).toThrow();
  });

  it("distinguishes the authorized proxy from accidental same-origin API routing", () => {
    expect(
      isAuthorizedPreviewProxyUrl("/api/preview-backend/api/auth/login")
    ).toBe(true);
    expect(
      isAccidentalSameOriginApiUrl("/api/preview-backend/api/auth/login")
    ).toBe(false);
    expect(isAccidentalSameOriginApiUrl("/api/auth/login")).toBe(true);
  });
});
