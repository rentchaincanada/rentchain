import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

vi.mock("./components/auth/RequireAuth", () => ({
  RequireAuth: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("./components/auth/RequireAdmin", () => ({
  RequireAdmin: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("./components/layout/LandlordNav", () => ({
  LandlordNav: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("./context/useAuth", () => ({
  useAuth: () => ({
    user: { id: "landlord_1", role: "landlord", landlordId: "landlord_1" },
    token: "test-token",
    isLoading: false,
    ready: true,
    authStatus: "authed",
  }),
}));

import App from "./App";

describe("Routes: /automation/timeline", () => {
  it("renders the Automation Timeline shell and does not fall through to NotFound", async () => {
    render(
      <MemoryRouter initialEntries={["/automation/timeline"]}>
        <App />
      </MemoryRouter>
    );

    expect(await screen.findByRole("heading", { name: /^Automation Timeline$/i })).toBeInTheDocument();
    expect(screen.queryByText(/Page not found/i)).not.toBeInTheDocument();
  });
});
