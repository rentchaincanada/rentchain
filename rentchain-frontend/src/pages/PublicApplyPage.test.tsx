import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import PublicApplyPage from "./PublicApplyPage";

const { fetchPublicApplicationLink, submitPublicApplication } = vi.hoisted(() => ({
  fetchPublicApplicationLink: vi.fn(),
  submitPublicApplication: vi.fn(),
}));

vi.mock("@/api/publicApplications", async () => {
  const actual = await vi.importActual<typeof import("@/api/publicApplications")>("@/api/publicApplications");
  return {
    ...actual,
    fetchPublicApplicationLink,
    submitPublicApplication,
  };
});

afterEach(() => {
  cleanup();
});

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/apply/token-123"]}>
      <Routes>
        <Route path="/apply/:token" element={<PublicApplyPage />} />
      </Routes>
    </MemoryRouter>
  );
}

async function completeStepZero() {
  fireEvent.change(await screen.findByLabelText("First name *"), { target: { value: "Jordan" } });
  fireEvent.change(screen.getByLabelText("Last name *"), { target: { value: "Lee" } });
  fireEvent.change(screen.getByLabelText("Email *"), { target: { value: "jordan@example.com" } });
  fireEvent.change(screen.getByLabelText("Date of birth *"), { target: { value: "1990-01-01" } });
  fireEvent.click(screen.getByRole("button", { name: "Next" }));
}

async function completeResidentialBase() {
  fireEvent.change(await screen.findByLabelText("Current address (line 1) *"), { target: { value: "123 King St" } });
  fireEvent.change(screen.getByLabelText("City *"), { target: { value: "Halifax" } });
  fireEvent.change(screen.getByLabelText("Province *"), { target: { value: "NS" } });
  fireEvent.change(screen.getByLabelText("Postal code *"), { target: { value: "B3H1A1" } });
  fireEvent.change(screen.getByLabelText("Time at current address (months) *"), { target: { value: "18" } });
  fireEvent.change(screen.getByLabelText("Current rent amount (monthly) *"), { target: { value: "1800" } });
}

describe("PublicApplyPage", () => {
  beforeEach(() => {
    fetchPublicApplicationLink.mockReset();
    submitPublicApplication.mockReset();
    fetchPublicApplicationLink.mockResolvedValue({
      data: { propertyId: "prop-1", unitId: "unit-1", expiresAt: null },
      context: { propertyName: "Harbour House", unitLabel: "2A" },
    });
    submitPublicApplication.mockResolvedValue({ applicationId: "app-1" });
  });

  it("renders conditional lease status fields when applicant is under a lease", async () => {
    renderPage();
    await completeStepZero();
    await completeResidentialBase();

    expect(await screen.findByText("Current Housing & Lease Status")).toBeInTheDocument();
    expect(screen.queryByLabelText("Lease end date *")).not.toBeInTheDocument();

    fireEvent.click(screen.getByLabelText("Yes"));

    expect(await screen.findByLabelText("Lease end date *")).toBeInTheDocument();
    expect(
      screen.getByText("Is your current landlord aware you are applying for a new rental? *")
    ).toBeInTheDocument();
  });

  it("requires lease end date before continuing when active lease is yes", async () => {
    renderPage();
    await completeStepZero();
    await completeResidentialBase();

    fireEvent.click(screen.getByLabelText("Yes"));

    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();

    fireEvent.change(screen.getByLabelText("Lease end date *"), { target: { value: "2026-08-15" } });

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Next" })).toBeEnabled();
    });
  });
});
