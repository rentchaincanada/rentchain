import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import DelegatedAccessWorkspacePage from "./DelegatedAccessWorkspacePage";
import type { DelegatedAccessActiveGrant } from "../api/delegatedAccessApi";

const mocks = vi.hoisted(() => ({
  fetchMyGrants: vi.fn(),
  useAuthMock: vi.fn(),
}));

vi.mock("../api/delegatedAccessApi", async () => {
  const actual = await vi.importActual<object>("../api/delegatedAccessApi");
  return {
    ...actual,
    fetchMyDelegatedAccessGrants: mocks.fetchMyGrants,
  };
});

vi.mock("../context/useAuth", () => ({
  useAuth: mocks.useAuthMock,
}));

function grant(overrides: Partial<DelegatedAccessActiveGrant> = {}): DelegatedAccessActiveGrant {
  return {
    delegateEmail: "manager@example.com",
    role: "property_manager",
    status: "active",
    permissionScope: {
      role: "property_manager",
      workspaceScopes: ["dashboard", "operations"],
      propertyScope: { mode: "all_current_properties", propertyIds: [] },
      resourceScope: {},
      permissionFlags: ["view", "edit"],
      billingAccess: false,
      exportAccess: false,
    },
    propertyScopeSummary: "all_current_properties",
    createdAt: "2026-06-22T12:00:00.000Z",
    acceptedAt: "2026-06-22T12:00:00.000Z",
    updatedAt: "2026-06-22T12:00:00.000Z",
    revokedAt: null,
    revocationReason: null,
    ...overrides,
  };
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/delegated-access/workspace"]}>
      <DelegatedAccessWorkspacePage />
    </MemoryRouter>
  );
}

describe("DelegatedAccessWorkspacePage", () => {
  beforeEach(() => {
    mocks.useAuthMock.mockReturnValue({
      user: { id: "delegate-user-1", email: "manager@example.com", role: "delegate" },
      isLoading: false,
      ready: true,
      authStatus: "authed",
    });
    mocks.fetchMyGrants.mockResolvedValue([grant()]);
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("renders active delegated workspace assignments without owner-only labels or raw ids", async () => {
    mocks.fetchMyGrants.mockResolvedValueOnce([
      grant({
        permissionScope: {
          ...grant().permissionScope,
          propertyScope: { mode: "selected", propertyIds: ["property-raw-1"] },
        },
        propertyScopeSummary: "selected:1",
      }),
    ]);
    const { container } = renderPage();

    expect(await screen.findByRole("heading", { name: "Assigned Workspaces" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Dashboard" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Operations" })).toBeInTheDocument();
    expect(screen.getByText("Property Manager")).toBeInTheDocument();
    expect(screen.getByText("Selected properties")).toBeInTheDocument();
    expect(container).not.toHaveTextContent("property-raw-1");
    expect(container).not.toHaveTextContent("grant-internal-1");
    expect(container).not.toHaveTextContent(/billing/i);
    expect(container).not.toHaveTextContent(/settings/i);
  });

  it("shows a clear empty state when the delegate has no active grants", async () => {
    mocks.fetchMyGrants.mockResolvedValueOnce([
      grant({ status: "revoked", revokedAt: "2026-06-23T12:00:00.000Z" }),
    ]);

    renderPage();

    expect(await screen.findByText("No active delegated access")).toBeInTheDocument();
    expect(screen.getByText("There are no active workspace assignments for this account.")).toBeInTheDocument();
  });
});
