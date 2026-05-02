import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider, useAuth } from "../AuthContext";
import { TOKEN_KEY } from "../../lib/authToken";

vi.mock("../../api/baseUrl", () => ({
  getApiBaseUrl: () => "https://rentchain.test",
}));

vi.mock("../../lib/firebaseAuthToken", () => ({
  getFirebaseIdToken: vi.fn(async () => null),
  warnIfFirebaseDomainMismatch: vi.fn(),
}));

const demoUser = {
  id: "demo-landlord",
  email: "demo@rentchain.dev",
  role: "landlord",
  landlordId: "demo-landlord",
  plan: "elite",
};

function DemoLoginHarness() {
  const auth = useAuth();
  return React.createElement(
    "div",
    null,
    React.createElement("button", { onClick: () => void auth.loginDemo("elite") }, "Login demo"),
    React.createElement("div", { "data-testid": "token" }, auth.token || ""),
    React.createElement("div", { "data-testid": "email" }, auth.user?.email || "")
  );
}

describe("AuthContext demo login", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  it("calls the demo login endpoint without a password and stores the returned token", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === "https://rentchain.test/api/auth/login/demo") {
        expect(init?.method).toBe("POST");
        expect(init?.body).toBeUndefined();
        expect(new Headers(init?.headers).get("x-rentchain-plan")).toBe("elite");
        return new Response(JSON.stringify({ token: "demo.token.value", user: demoUser }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }

      if (url === "https://rentchain.test/api/me") {
        expect(new Headers(init?.headers).get("authorization")).toBe("Bearer demo.token.value");
        return new Response(JSON.stringify({ user: demoUser }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }

      throw new Error(`Unexpected request: ${url}`);
    });
    global.fetch = fetchMock as any;

    render(
      React.createElement(
        AuthProvider,
        null,
        React.createElement(DemoLoginHarness)
      )
    );

    fireEvent.click(screen.getByRole("button", { name: "Login demo" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("https://rentchain.test/api/auth/login/demo", expect.any(Object)));
    await waitFor(() => expect(screen.getByTestId("email")).toHaveTextContent("demo@rentchain.dev"));

    expect(fetchMock).not.toHaveBeenCalledWith(
      "https://rentchain.test/api/auth/login",
      expect.objectContaining({ body: expect.stringContaining("demo") })
    );
    expect(window.localStorage.getItem(TOKEN_KEY)).toBe("demo.token.value");
    expect(window.sessionStorage.getItem(TOKEN_KEY)).toBe("demo.token.value");
    expect(screen.getByTestId("token")).toHaveTextContent("demo.token.value");
  });
});
