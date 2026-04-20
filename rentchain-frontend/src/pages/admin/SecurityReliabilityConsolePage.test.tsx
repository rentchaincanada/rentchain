import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import SecurityReliabilityConsolePage from "./SecurityReliabilityConsolePage";

vi.mock("../../context/useAuth", () => ({
  useAuth: () => ({
    user: { id: "admin_1", role: "admin" },
    token: "test-token",
    isLoading: false,
    ready: true,
    authStatus: "authed",
  }),
}));

vi.mock("../../components/layout/MacShell", () => ({
  MacShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

describe("SecurityReliabilityConsolePage", () => {
  it("renders the internal ops console structure and key sections", () => {
    render(
      <MemoryRouter>
        <SecurityReliabilityConsolePage />
      </MemoryRouter>
    );

    expect(screen.getByText(/Security & Reliability Console/i)).toBeInTheDocument();
    expect(screen.getByText(/v1 manual status model/i)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Infrastructure/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Deployments/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Reliability & Debugging/i })).toBeInTheDocument();
    expect(screen.getByText(/^Stripe dashboard$/i)).toBeInTheDocument();
    expect(screen.getByText(/^Mailgun dashboard$/i)).toBeInTheDocument();
    expect(screen.getByText(/No secret values are displayed here/i)).toBeInTheDocument();
  });
});
