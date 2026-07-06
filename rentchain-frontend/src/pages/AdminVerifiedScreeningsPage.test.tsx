import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AdminVerifiedScreeningsPage from "./AdminVerifiedScreeningsPage";

const mocks = vi.hoisted(() => ({
  listVerifiedScreenings: vi.fn(),
  fetchVerifiedScreening: vi.fn(),
  updateVerifiedScreening: vi.fn(),
  showToast: vi.fn(),
  user: { id: "landlord-1", role: "landlord", actorRole: "landlord", email: "owner@example.test" },
}));

vi.mock("../api/adminVerifiedScreeningsApi", () => ({
  listVerifiedScreenings: mocks.listVerifiedScreenings,
  fetchVerifiedScreening: mocks.fetchVerifiedScreening,
  updateVerifiedScreening: mocks.updateVerifiedScreening,
}));

vi.mock("../context/useAuth", () => ({
  useAuth: () => ({ user: mocks.user }),
}));

vi.mock("../components/ui/ToastProvider", () => ({
  useToast: () => ({ showToast: mocks.showToast }),
}));

describe("AdminVerifiedScreeningsPage landlord mode", () => {
  beforeEach(() => {
    cleanup();
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
    mocks.listVerifiedScreenings.mockReset();
    mocks.fetchVerifiedScreening.mockReset();
    mocks.updateVerifiedScreening.mockReset();
    mocks.showToast.mockReset();
    mocks.user = { id: "landlord-1", role: "landlord", actorRole: "landlord", email: "owner@example.test" };
    mocks.listVerifiedScreenings.mockResolvedValue([
      {
        id: "screening-1",
        createdAt: Date.UTC(2026, 5, 1, 12, 0),
        updatedAt: Date.UTC(2026, 5, 1, 12, 0),
        status: "COMPLETE",
        serviceLevel: "VERIFIED",
        landlordId: "landlord_raw_123",
        applicationId: "app_raw_123",
        orderId: "order_raw_123",
        propertyId: "property_raw_123",
        unitId: "unit_raw_123",
        applicant: { name: "Phil Jones", email: "phil@example.test" },
        aiIncluded: true,
        scoreAddOn: false,
        totalAmountCents: 4999,
        currency: "CAD",
        notesInternal: "Internal-only note",
        reviewer: { email: "reviewer@example.test" },
        completedAt: Date.UTC(2026, 5, 1, 13, 0),
        resultSummary: "Screening review completed.",
        recommendation: "APPROVE",
      },
    ]);
  });

  it("shows landlord-safe screening detail without raw internal or provider identifiers", async () => {
    render(
      <MemoryRouter>
        <AdminVerifiedScreeningsPage audience="landlord" shell="none" />
      </MemoryRouter>
    );

    expect(await screen.findByText("Phil Jones")).toBeInTheDocument();
    expect(mocks.listVerifiedScreenings).toHaveBeenCalledWith("landlord");
    expect(screen.getByPlaceholderText("Search applicant or email")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Phil Jones/i }));

    await waitFor(() => {
      expect(screen.getByText("Result summary")).toBeInTheDocument();
    });
    expect(screen.getByText("Screening review completed.")).toBeInTheDocument();
    expect(screen.getByText("Approve")).toBeInTheDocument();
    expect(screen.getAllByText("Completed").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Verified screening").length).toBeGreaterThan(0);
    expect(screen.getAllByText("$49.99 CAD").length).toBeGreaterThan(0);
    expect(mocks.fetchVerifiedScreening).not.toHaveBeenCalled();

    expect(screen.queryByText("COMPLETE")).not.toBeInTheDocument();
    expect(screen.queryByText("VERIFIED")).not.toBeInTheDocument();
    expect(screen.queryByText("APPROVE")).not.toBeInTheDocument();
    expect(screen.queryByText(/Application ID/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/app_raw_123/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Order ID/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/order_raw_123/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Property ID/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/property_raw_123/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Unit ID/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/unit_raw_123/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Internal-only note/i)).not.toBeInTheDocument();
  });
});

describe("AdminVerifiedScreeningsPage admin mode", () => {
  beforeEach(() => {
    cleanup();
    mocks.listVerifiedScreenings.mockReset();
    mocks.fetchVerifiedScreening.mockReset();
    mocks.updateVerifiedScreening.mockReset();
    mocks.showToast.mockReset();
    mocks.user = { id: "admin-1", role: "admin", actorRole: "admin", email: "admin@example.test" };
    const item = {
      id: "screening-1",
      createdAt: Date.UTC(2026, 5, 1, 12, 0),
      updatedAt: Date.UTC(2026, 5, 1, 12, 0),
      status: "IN_PROGRESS",
      serviceLevel: "VERIFIED_AI",
      landlordId: "landlord_raw_123",
      applicationId: "app_raw_123",
      orderId: "order_raw_123",
      propertyId: "property_raw_123",
      unitId: "unit_raw_123",
      applicant: { name: "Phil Jones", email: "phil@example.test" },
      aiIncluded: true,
      scoreAddOn: false,
      totalAmountCents: 4999,
      currency: "CAD",
      notesInternal: "Internal-only note",
      reviewer: { email: "reviewer@example.test" },
      completedAt: null,
      resultSummary: null,
      recommendation: null,
    };
    mocks.listVerifiedScreenings.mockResolvedValue([item]);
    mocks.fetchVerifiedScreening.mockResolvedValue(item);
  });

  it("preserves admin support identifiers on the admin route", async () => {
    render(
      <MemoryRouter>
        <AdminVerifiedScreeningsPage />
      </MemoryRouter>
    );

    expect(await screen.findByText("Phil Jones")).toBeInTheDocument();
    expect(mocks.listVerifiedScreenings).toHaveBeenCalledWith("admin");
    fireEvent.click(screen.getByRole("button", { name: /Phil Jones/i }));

    expect(await screen.findByText("Order ID: order_raw_123")).toBeInTheDocument();
    expect(screen.getByText("Application ID: app_raw_123")).toBeInTheDocument();
    expect(screen.getByText("Property ID: property_raw_123")).toBeInTheDocument();
    expect(screen.getByText("Unit ID: unit_raw_123")).toBeInTheDocument();
  });
});
