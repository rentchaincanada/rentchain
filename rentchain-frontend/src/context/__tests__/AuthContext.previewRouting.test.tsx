import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider, useAuth } from "../AuthContext";

vi.mock("../../lib/firebaseAuthToken", () => ({
  getFirebaseIdToken: vi.fn(async () => null),
  awaitFirebaseAuthReady: vi.fn(async () => ({ ready: true, user: null })),
  warnIfFirebaseDomainMismatch: vi.fn(),
}));

const PRODUCTION_API =
  "https://rentchain-landlord-api-cyaabkl54a-uc.a.run.app";
const PREVIEW_PROXY = "/api/preview-backend";
const TEST_TOKEN = "header.payload.signature";
const testUser = {
  id: "preview-landlord",
  email: "preview@example.test",
  role: "landlord",
};

function AuthLifecycleHarness() {
  const auth = useAuth();
  return (
    <div>
      <button onClick={() => void auth.login("preview@example.test", "test-password")}>
        Login
      </button>
      <button onClick={() => void auth.logout()}>Logout</button>
      <div data-testid="ready">{String(auth.ready)}</div>
      <div data-testid="email">{auth.user?.email || ""}</div>
      <div data-testid="status">{auth.authStatus}</div>
    </div>
  );
}

describe("AuthContext Preview routing isolation", () => {
  beforeEach(() => {
    vi.stubEnv("VITE_DEPLOY_ENV", "preview");
    vi.stubEnv("VITE_API_BASE_URL", PREVIEW_PROXY);
    window.history.replaceState({}, "", "/login");
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("keeps the real login, session fallback, and logout lifecycle off Production", async () => {
    const captured: Array<{ url: string; init: RequestInit }> = [];
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
      const url = String(input);
      captured.push({ url, init });

      if (url === `${PREVIEW_PROXY}/api/auth/login`) {
        return new Response(JSON.stringify({ token: TEST_TOKEN, user: testUser }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      if (url === `${PREVIEW_PROXY}/api/me`) {
        return new Response(JSON.stringify({ error: "fallback required" }), {
          status: 401,
          headers: { "content-type": "application/json" },
        });
      }
      if (url === `${PREVIEW_PROXY}/api/auth/me`) {
        return new Response(JSON.stringify({ user: testUser }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      if (url === `${PREVIEW_PROXY}/api/auth/logout`) {
        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      throw new Error(`Unexpected request: ${url}`);
    });
    global.fetch = fetchMock as typeof fetch;

    render(
      <AuthProvider>
        <AuthLifecycleHarness />
      </AuthProvider>
    );

    await waitFor(() => expect(screen.getByTestId("ready")).toHaveTextContent("true"));
    expect(captured).toEqual([]);

    fireEvent.click(screen.getByRole("button", { name: "Login" }));
    await waitFor(() =>
      expect(screen.getByTestId("email")).toHaveTextContent("preview@example.test")
    );

    fireEvent.click(screen.getByRole("button", { name: "Logout" }));
    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("guest"));
    await waitFor(() => expect(captured).toHaveLength(4));

    expect(
      captured.map(({ url, init }) => [String(init.method || "GET").toUpperCase(), url])
    ).toEqual([
      ["POST", `${PREVIEW_PROXY}/api/auth/login`],
      ["GET", `${PREVIEW_PROXY}/api/me`],
      ["GET", `${PREVIEW_PROXY}/api/auth/me`],
      ["POST", `${PREVIEW_PROXY}/api/auth/logout`],
    ]);

    const productionCalls = captured.filter(({ url }) => url.startsWith(PRODUCTION_API));
    for (const { url, init } of productionCalls) {
      const headers = new Headers(init.headers);
      expect(headers.has("authorization"), `Authorization leaked to ${url}`).toBe(false);
      expect(headers.get("x-rc-auth"), `Auth source leaked to ${url}`).toBeNull();
      expect(init.credentials, `Cookie credentials leaked to ${url}`).not.toBe("include");
      expect(init.body, `Request body leaked to ${url}`).toBeUndefined();
      expect(url).not.toMatch(/\/api\/(?:auth\/(?:login|logout|me)|me)(?:[/?]|$)/);
    }
    expect(productionCalls).toHaveLength(0);

    const loginCall = captured[0];
    expect(loginCall.init.body).toBe(
      JSON.stringify({ email: "preview@example.test", password: "test-password" })
    );
    expect(new Headers(captured[1].init.headers).get("authorization")).toBe(
      `Bearer ${TEST_TOKEN}`
    );
    expect(new Headers(captured[2].init.headers).get("authorization")).toBe(
      `Bearer ${TEST_TOKEN}`
    );
    expect(new Headers(captured[3].init.headers).get("authorization")).toBe(
      `Bearer ${TEST_TOKEN}`
    );
  });
});
