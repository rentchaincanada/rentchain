import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createGovernedFetch, installPreviewFetchGuard } from "./previewFetchGuard";

const ORIGIN = window.location.origin;
const PROXY = `${ORIGIN}/api/preview-backend`;
const PRODUCTION_API = "https://rentchain-landlord-api-cyaabkl54a-uc.a.run.app";

describe("Preview governed fetch", () => {
  beforeEach(() => {
    vi.stubEnv("VITE_DEPLOY_ENV", "preview");
    vi.stubEnv("VITE_API_BASE_URL", "/api/preview-backend");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  function setup(apiBaseUrl = "/api/preview-backend") {
    const originalFetch = vi.fn(async () => new Response(null, { status: 204 }));
    const getAuthToken = vi.fn(() => "stored.preview.token");
    const governedFetch = createGovernedFetch(originalFetch as typeof fetch, {
      getAuthToken,
      apiBaseUrl,
      browserOrigin: ORIGIN,
      deployEnv: String(import.meta.env.VITE_DEPLOY_ENV || ""),
      isDevelopment: false,
    });
    return { originalFetch, getAuthToken, governedFetch };
  }

  it("uses Request methods and gives init.method browser override precedence", async () => {
    const { originalFetch, governedFetch } = setup();
    const post = new Request(`${PROXY}/api/auth/login`, { method: "POST" });
    const get = new Request(`${PROXY}/api/auth/login`, { method: "GET" });

    await governedFetch(post);
    await governedFetch(get, { method: "POST" });

    expect(
      new Headers(originalFetch.mock.calls[0][1]?.headers).get("authorization")
    ).toBe("Bearer stored.preview.token");
    expect(originalFetch.mock.calls[0][0]).toBe(post);
    expect(originalFetch.mock.calls[1][0]).toBe(get);
    expect(originalFetch.mock.calls[1][1]?.method).toBe("POST");
  });

  it("rejects raw same-origin API paths but permits method overrides inside the proxy", async () => {
    const { originalFetch, getAuthToken, governedFetch } = setup();
    expect(() =>
      governedFetch(new Request(`${ORIGIN}/api/auth/login`, { method: "POST" }))
    ).toThrow(expect.objectContaining({ code: "PREVIEW_API_ROUTE_NOT_AVAILABLE" }));
    await governedFetch(
      new Request(`${PROXY}/api/auth/login`, { method: "POST" }),
      { method: "GET" }
    );
    expect(getAuthToken).toHaveBeenCalledOnce();
    expect(originalFetch).toHaveBeenCalledOnce();
  });

  it.each([
    "/assets/index.js",
    "/manifest.webmanifest",
    "/sw.js",
    "/favicon.ico",
    "https://fonts.googleapis.com/css2",
    "https://www.gstatic.com/example",
    "https://identitytoolkit.googleapis.com/v1/accounts:lookup",
    "https://api.stripe.com/v1/payment_methods",
    "https://vercel.live/_next-live/feedback",
  ])("passes non-API traffic through unchanged: %s", async (input) => {
    const { originalFetch, getAuthToken, governedFetch } = setup();
    await governedFetch(input);
    expect(originalFetch).toHaveBeenCalledOnce();
    expect(originalFetch).toHaveBeenCalledWith(input, undefined);
    expect(getAuthToken).not.toHaveBeenCalled();
  });

  it("blocks unsupported relative and Production APIs without consuming the body", async () => {
    const { originalFetch, getAuthToken, governedFetch } = setup();
    const request = new Request(`${ORIGIN}/api/properties`, {
      method: "POST",
      body: "must-not-be-consumed",
    });
    expect(() => governedFetch(request)).toThrow(
      expect.objectContaining({ code: "PREVIEW_API_ROUTE_NOT_AVAILABLE" })
    );
    expect(() =>
      governedFetch(`${PRODUCTION_API}/api/properties`)
    ).toThrow(expect.objectContaining({ code: "PREVIEW_API_ROUTE_NOT_AVAILABLE" }));
    expect(request.bodyUsed).toBe(false);
    expect(getAuthToken).not.toHaveBeenCalled();
    expect(originalFetch).not.toHaveBeenCalled();
  });

  it("passes application API paths and lets the backend authorize each method", async () => {
    const { originalFetch, governedFetch } = setup();
    await governedFetch("/api/preview-backend/api/auth/login", { method: "POST" });
    await governedFetch("/api/preview-backend/api/me", { method: "GET" });
    await governedFetch("/api/preview-backend/api/auth/login", { method: "GET" });
    await governedFetch("/api/preview-backend/api/me", { method: "POST" });
    expect(originalFetch).toHaveBeenCalledTimes(4);
  });

  it("attaches the token only to relative or exact same-origin Preview proxy URLs", async () => {
    const { originalFetch, getAuthToken, governedFetch } = setup();

    await governedFetch("/api/preview-backend/api/auth/login", { method: "POST" });
    await governedFetch(`${PROXY}/api/auth/login`, { method: "POST" });

    expect(getAuthToken).toHaveBeenCalledTimes(2);
    for (const call of originalFetch.mock.calls) {
      expect(new Headers(call[1]?.headers).get("authorization")).toBe(
        "Bearer stored.preview.token"
      );
    }
  });

  it.each([
    "https://evil.example/api/preview-backend/api/me",
    "https://evil.example/api/auth/login",
    "https://preview.example.vercel.app.evil.example/api/preview-backend/api/me",
    "https://evil.example/path?next=/api/preview-backend/api/me",
  ])("never classifies deceptive third-party URL as Preview API: %s", async (input) => {
    const { originalFetch, getAuthToken, governedFetch } = setup();
    await governedFetch(input);

    expect(originalFetch).toHaveBeenCalledOnce();
    expect(originalFetch).toHaveBeenCalledWith(input, undefined);
    expect(getAuthToken).not.toHaveBeenCalled();
    expect(originalFetch.mock.calls[0][1]).toBeUndefined();
  });

  it("allows same-origin product API paths and attaches application credentials", async () => {
    const { originalFetch, getAuthToken, governedFetch } = setup();
    await governedFetch("/api/preview-backend/api/properties", { method: "GET" });
    expect(getAuthToken).toHaveBeenCalledOnce();
    expect(originalFetch).toHaveBeenCalledOnce();
  });

  it.each(["production", "development"])("does not apply Preview blocking in %s", async (env) => {
    vi.stubEnv("VITE_DEPLOY_ENV", env);
    vi.stubEnv("VITE_API_BASE_URL", PRODUCTION_API);
    const { originalFetch, governedFetch } = setup(PRODUCTION_API);
    await governedFetch("/api/properties");
    expect(originalFetch).toHaveBeenCalledOnce();
  });

  describe("legacy Production token parity", () => {
    beforeEach(() => {
      vi.stubEnv("VITE_DEPLOY_ENV", "production");
      vi.stubEnv("VITE_API_BASE_URL", PRODUCTION_API);
    });

    it.each(["/api/me", "/assets/legacy-relative.js"])(
      "attaches the stored token to relative request %s",
      async (input) => {
        const { originalFetch, governedFetch } = setup(PRODUCTION_API);
        await governedFetch(input);
        const forwarded = originalFetch.mock.calls[0][1];
        expect(new Headers(forwarded?.headers).get("authorization")).toBe(
          "Bearer stored.preview.token"
        );
      }
    );

    it("attaches to configured absolute API URLs but not unrelated third parties", async () => {
      const { originalFetch, governedFetch } = setup(PRODUCTION_API);
      await governedFetch(`${PRODUCTION_API}/api/me`);
      expect(
        new Headers(originalFetch.mock.calls[0][1]?.headers).get("authorization")
      ).toBe("Bearer stored.preview.token");

      originalFetch.mockClear();
      await governedFetch("https://fonts.googleapis.com/css2");
      expect(originalFetch).toHaveBeenCalledWith(
        "https://fonts.googleapis.com/css2",
        undefined
      );
    });

    it("preserves existing Authorization and init.headers precedence for Request objects", async () => {
      const { originalFetch, governedFetch } = setup(PRODUCTION_API);
      const request = new Request(`${PRODUCTION_API}/api/me`, {
        headers: { Authorization: "Bearer request-token", "x-request": "request" },
      });
      await governedFetch(request, {
        headers: { Authorization: "Bearer init-token", "x-init": "init" },
      });
      const headers = new Headers(originalFetch.mock.calls[0][1]?.headers);
      expect(headers.get("authorization")).toBe("Bearer init-token");
      expect(headers.get("x-init")).toBe("init");
      expect(headers.get("x-request")).toBeNull();
    });

    it("passes through unchanged when no stored token exists", async () => {
      const originalFetch = vi.fn(async () => new Response(null, { status: 204 }));
      const governedFetch = createGovernedFetch(originalFetch as typeof fetch, {
        getAuthToken: vi.fn(() => null),
        apiBaseUrl: PRODUCTION_API,
        browserOrigin: ORIGIN,
        deployEnv: "production",
        isDevelopment: false,
      });
      await governedFetch("/api/me");
      expect(originalFetch).toHaveBeenCalledWith("/api/me", undefined);
    });
  });

  it("installs once and retains the first native fetch reference", async () => {
    const nativeFetch = vi.fn(async () => new Response(null, { status: 204 }));
    const windowLike = { fetch: nativeFetch as typeof fetch };
    const dependencies = {
      getAuthToken: vi.fn(() => null),
      apiBaseUrl: "/api/preview-backend",
      browserOrigin: ORIGIN,
      deployEnv: "preview",
      isDevelopment: false,
    };
    const first = installPreviewFetchGuard(windowLike, dependencies);
    const second = installPreviewFetchGuard(windowLike, dependencies);
    expect(second).toBe(first);
    await second("/assets/index.js");
    expect(nativeFetch).toHaveBeenCalledOnce();
  });
});
