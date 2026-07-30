import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiFetch } from "./apiFetch";

const mocks = vi.hoisted(() => ({
  getAuthToken: vi.fn(() => null),
  getTenantToken: vi.fn(() => null),
  getFirebaseIdToken: vi.fn(async () => null),
}));

vi.mock("../lib/authToken", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../lib/authToken")>()),
  getAuthToken: mocks.getAuthToken,
  getTenantToken: mocks.getTenantToken,
}));

vi.mock("../lib/firebaseAuthToken", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../lib/firebaseAuthToken")>()),
  getFirebaseIdToken: mocks.getFirebaseIdToken,
}));

const PRODUCTION_API =
  "https://rentchain-landlord-api-cyaabkl54a-uc.a.run.app";

describe("legacy apiFetch URL parity", () => {
  beforeEach(() => {
    vi.stubEnv("VITE_DEPLOY_ENV", "production");
    vi.stubEnv("VITE_API_BASE_URL", PRODUCTION_API);
    mocks.getAuthToken.mockClear();
    mocks.getTenantToken.mockClear();
    mocks.getFirebaseIdToken.mockClear();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it.each([
    ["/api/example", `${PRODUCTION_API}/api/example`],
    ["api/example", `${PRODUCTION_API}/api/example`],
    ["/example", `${PRODUCTION_API}/api/example`],
    ["example", `${PRODUCTION_API}/api/example`],
    ["/api/api/example", `${PRODUCTION_API}/api/example`],
    ["api/api/example", `${PRODUCTION_API}/api/example`],
    [`${PRODUCTION_API}/api/example`, `${PRODUCTION_API}/api/example`],
  ])("preserves Production resolution for %s", async (input, expected) => {
    const fetchMock = vi.fn(async () =>
      new Response("{}", {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    );
    global.fetch = fetchMock as typeof fetch;
    await apiFetch(input);
    expect(fetchMock).toHaveBeenCalledWith(
      expected,
      expect.objectContaining({ credentials: "include" })
    );
  });

  it.each([
    "/api/api/auth/login",
    "api/api/auth/login",
    "/api/properties",
  ])("rejects malformed or unsupported Preview input %s before credentials", async (input) => {
    vi.stubEnv("VITE_DEPLOY_ENV", "preview");
    vi.stubEnv("VITE_API_BASE_URL", "/api/preview-backend");
    const fetchMock = vi.fn();
    global.fetch = fetchMock as typeof fetch;

    await expect(apiFetch(input, { method: "POST" })).rejects.toMatchObject({
      code: "PREVIEW_API_ROUTE_NOT_AVAILABLE",
    });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(mocks.getFirebaseIdToken).not.toHaveBeenCalled();
    expect(mocks.getAuthToken).not.toHaveBeenCalled();
  });

  it("does not duplicate the Preview proxy prefix", async () => {
    vi.stubEnv("VITE_DEPLOY_ENV", "preview");
    vi.stubEnv("VITE_API_BASE_URL", "/api/preview-backend");
    const fetchMock = vi.fn(async () =>
      new Response("{}", {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    );
    global.fetch = fetchMock as typeof fetch;

    await apiFetch("/api/auth/login", { method: "POST" });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/preview-backend/api/auth/login",
      expect.any(Object)
    );
    expect(String(fetchMock.mock.calls[0][0])).not.toContain("/api/api/");
  });
});
