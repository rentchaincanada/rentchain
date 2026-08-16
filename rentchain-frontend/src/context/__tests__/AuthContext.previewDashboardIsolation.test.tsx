import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "../../components/ui/ToastProvider";
import { AuthProvider } from "../AuthContext";

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

describe("Preview login-to-dashboard isolation", () => {
  beforeEach(() => {
    vi.stubEnv("VITE_DEPLOY_ENV", "preview");
    vi.stubEnv("VITE_API_BASE_URL", PREVIEW_PROXY);
    window.localStorage.clear();
    window.sessionStorage.clear();
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("mounts the dashboard with every application loader on the same-origin proxy", async () => {
    const [{ default: DashboardPage }, { LoginPage }] = await Promise.all([
      import("../../pages/DashboardPage"),
      import("../../pages/LoginPage"),
    ]);
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
        return new Response(JSON.stringify({ user: testUser }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: "synthetic-unavailable" }), {
        status: 503,
        headers: { "content-type": "application/json" },
      });
    });
    global.fetch = fetchMock as typeof fetch;

    render(
      <ToastProvider>
        <AuthProvider>
          <MemoryRouter initialEntries={["/login"]}>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/dashboard" element={<DashboardPage />} />
            </Routes>
          </MemoryRouter>
        </AuthProvider>
      </ToastProvider>
    );

    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "preview@example.test" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "test-password" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByTestId("dashboard-operational-grid")).toBeInTheDocument();
    await waitFor(() => expect(captured.length).toBeGreaterThan(2));
    expect(captured).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ url: `${PREVIEW_PROXY}/api/auth/login` }),
        expect.objectContaining({ url: `${PREVIEW_PROXY}/api/me` }),
      ])
    );

    for (const { url } of captured) {
      expect(url.startsWith(PREVIEW_PROXY)).toBe(true);
      expect(url.startsWith(PRODUCTION_API)).toBe(false);
      expect(url).not.toContain(".run.app");
    }
  });
});
