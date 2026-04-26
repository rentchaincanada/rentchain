import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import PublicApplyPage from "./PublicApplyPage";

const { fetchPublicApplicationLink, submitPublicApplication, updatePublicApplicationProgress } = vi.hoisted(() => ({
  fetchPublicApplicationLink: vi.fn(),
  submitPublicApplication: vi.fn(),
  updatePublicApplicationProgress: vi.fn(),
}));

vi.mock("@/api/publicApplications", async () => {
  const actual = await vi.importActual<typeof import("@/api/publicApplications")>("@/api/publicApplications");
  return {
    ...actual,
    fetchPublicApplicationLink,
    submitPublicApplication,
    updatePublicApplicationProgress,
  };
});

afterEach(() => {
  vi.useRealTimers();
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

function completionPercent() {
  const text = screen.getByText(/% complete/i).textContent || "";
  const match = text.match(/(\d+)% complete/i);
  return match ? Number(match[1]) : 0;
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
    updatePublicApplicationProgress.mockReset();
    window.sessionStorage.clear();
    fetchPublicApplicationLink.mockResolvedValue({
      data: { propertyId: "prop-1", unitId: "unit-1", expiresAt: null },
      context: { propertyName: "Harbour House", unitLabel: "2A" },
    });
    submitPublicApplication.mockResolvedValue({ applicationId: "app-1" });
    updatePublicApplicationProgress.mockResolvedValue({ partialProgress: null });
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

  it("lets applicants continue directly and only shows the viewing request form when they need it", async () => {
    renderPage();

    expect(await screen.findByText("Before you continue")).toBeInTheDocument();
    expect(screen.queryByTestId("viewing-request-form")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "I need to request a viewing" }));
    expect(await screen.findByTestId("viewing-request-form")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "I've already viewed it" }));
    expect(screen.queryByTestId("viewing-request-form")).not.toBeInTheDocument();
    expect(screen.getByText("Great. Continue below with the application.")).toBeInTheDocument();
  });

  it("restores the viewing choice and draft fields from session storage", async () => {
    const firstRender = renderPage();
    await screen.findByText("Before you continue");

    fireEvent.click(screen.getByRole("button", { name: "I need to request a viewing" }));
    fireEvent.change(await screen.findByLabelText("First name *"), { target: { value: "Jordan" } });
    fireEvent.change(screen.getByLabelText("Last name *"), { target: { value: "Lee" } });
    firstRender.unmount();

    renderPage();

    expect(await screen.findByText("Resume your application")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Continue where you left off" })).toBeInTheDocument();
    expect(await screen.findByTestId("viewing-request-form")).toBeInTheDocument();
    expect(screen.getByLabelText("First name *")).toHaveValue("Jordan");
    expect(screen.getByLabelText("Last name *")).toHaveValue("Lee");
  });

  it("updates the local completion progress as required fields are completed", async () => {
    renderPage();
    await screen.findByText("Before you continue");

    const startingPercent = completionPercent();

    fireEvent.change(screen.getByLabelText("First name *"), { target: { value: "Jordan" } });
    fireEvent.change(screen.getByLabelText("Last name *"), { target: { value: "Lee" } });
    fireEvent.change(screen.getByLabelText("Email *"), { target: { value: "jordan@example.com" } });
    fireEvent.change(screen.getByLabelText("Date of birth *"), { target: { value: "1990-01-01" } });

    expect(completionPercent()).toBeGreaterThan(startingPercent);
  });

  it("lets applicants continue past the employment step even when employment details are incomplete", async () => {
    renderPage();
    await completeStepZero();
    await completeResidentialBase();

    fireEvent.click(screen.getByRole("button", { name: "Next" }));

    expect(await screen.findByText("Employment & income")).toBeInTheDocument();
    expect(
      screen.getByText("You can continue for now, but employment details are required before final submission.")
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Next" })).toBeEnabled();

    fireEvent.click(screen.getByRole("button", { name: "Next" }));

    expect(await screen.findByText("References, loans, vehicles")).toBeInTheDocument();
  });

  it("sends only safe partial progress metadata to the backend", async () => {
    renderPage();
    await screen.findByText("Before you continue");

    fireEvent.change(screen.getByLabelText("First name *"), { target: { value: "Jordan" } });
    fireEvent.change(screen.getByLabelText("Last name *"), { target: { value: "Lee" } });
    fireEvent.change(screen.getByLabelText("Email *"), { target: { value: "jordan@example.com" } });
    fireEvent.change(screen.getByLabelText("Date of birth *"), { target: { value: "1990-01-01" } });

    await waitFor(() => {
      expect(updatePublicApplicationProgress).toHaveBeenCalled();
    }, { timeout: 1500 });

    expect(updatePublicApplicationProgress).toHaveBeenLastCalledWith(
      "token-123",
      expect.objectContaining({
        status: expect.any(String),
        completionPercent: expect.any(Number),
        currentStep: expect.any(String),
        completedSections: expect.any(Array),
        missingSections: expect.any(Array),
        hasCoApplicant: false,
        viewingChoice: null,
      })
    );
    expect(updatePublicApplicationProgress).not.toHaveBeenLastCalledWith(
      expect.anything(),
      expect.objectContaining({
        applicant: expect.anything(),
      })
    );
  });

  it("focuses the missing field when a missing-details item is clicked", async () => {
    renderPage();
    await screen.findByText("Before you continue");

    fireEvent.click(screen.getByRole("button", { name: "Current address" }));

    const addressField = await screen.findByLabelText("Current address (line 1) *");
    await waitFor(() => {
      expect(addressField).toHaveFocus();
    });
  });

  it("keeps employment gaps in the missing-details guidance after moving past that step", async () => {
    renderPage();
    await completeStepZero();
    await completeResidentialBase();

    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(await screen.findByText("Employment & income")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Next" }));

    expect(await screen.findByText("Applicant employer")).toBeInTheDocument();
    expect(screen.getByText("Applicant job title")).toBeInTheDocument();
    expect(screen.getByText("Applicant gross income")).toBeInTheDocument();
    expect(screen.getByText("Applicant time at current job")).toBeInTheDocument();
  });

  it("lets applicants continue past employment while showing the co-applicant employment warning", async () => {
    renderPage();
    fireEvent.change(await screen.findByLabelText("First name *"), { target: { value: "Jordan" } });
    fireEvent.change(screen.getByLabelText("Last name *"), { target: { value: "Lee" } });
    fireEvent.change(screen.getByLabelText("Email *"), { target: { value: "jordan@example.com" } });
    fireEvent.change(screen.getByLabelText("Date of birth *"), { target: { value: "1990-01-01" } });
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.change(screen.getAllByLabelText("First name *")[1], { target: { value: "Taylor" } });
    fireEvent.change(screen.getAllByLabelText("Last name *")[1], { target: { value: "Lee" } });
    fireEvent.change(screen.getAllByLabelText("Email *")[1], { target: { value: "taylor@example.com" } });
    fireEvent.change(screen.getAllByLabelText("Date of birth *")[1], { target: { value: "1991-02-02" } });
    fireEvent.click(screen.getByRole("button", { name: "Next" }));

    await completeResidentialBase();

    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(await screen.findByText("Employment & income")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Employer *"), { target: { value: "North Wharf Ltd." } });
    fireEvent.change(screen.getByLabelText("Job title *"), { target: { value: "Designer" } });
    fireEvent.change(screen.getByLabelText("Gross income *"), { target: { value: "5200" } });
    fireEvent.change(screen.getByLabelText("Length (months) *"), { target: { value: "24" } });

    expect(
      screen.getByText("You can continue for now, but employment details for both applicants are required before final submission.")
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Next" })).toBeEnabled();

    fireEvent.click(screen.getByRole("button", { name: "Next" }));

    expect(await screen.findByText("References, loans, vehicles")).toBeInTheDocument();
  });

  it("blocks final submit if applicant employment details are still missing", async () => {
    renderPage();
    await completeStepZero();
    await completeResidentialBase();
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(await screen.findByText("Employment & income")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    fireEvent.change(await screen.findByLabelText("Reference name *"), { target: { value: "Casey Lead" } });
    fireEvent.change(screen.getByLabelText("Reference phone *"), { target: { value: "9025550100" } });
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    fireEvent.click(screen.getByLabelText(/I consent to a credit\/consumer report\./i));
    fireEvent.click(screen.getByLabelText(/I consent to contacting references and past landlords\./i));
    fireEvent.click(screen.getByLabelText(/I consent to data sharing for the tenant database\./i));
    fireEvent.change(screen.getByLabelText("Applicant full name (typed) *"), { target: { value: "Jordan Lee" } });
    fireEvent.change(screen.getByLabelText("Type your full name *"), { target: { value: "Jordan Lee" } });
    fireEvent.click(screen.getByLabelText(/I agree this is my legal signature\./i));
    fireEvent.click(screen.getByLabelText(/I confirm the information provided is accurate and I authorize/i));
    fireEvent.click(screen.getByRole("button", { name: "Submit application" }));

    expect(await screen.findByText("Employment details are required.")).toBeInTheDocument();
    expect(screen.getByText("Employment & income")).toBeInTheDocument();
  });

  it("keeps co-applicant employment required before final submit when co-applicant is enabled", async () => {
    renderPage();
    fireEvent.change(await screen.findByLabelText("First name *"), { target: { value: "Jordan" } });
    fireEvent.change(screen.getByLabelText("Last name *"), { target: { value: "Lee" } });
    fireEvent.change(screen.getByLabelText("Email *"), { target: { value: "jordan@example.com" } });
    fireEvent.change(screen.getByLabelText("Date of birth *"), { target: { value: "1990-01-01" } });
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.change(screen.getAllByLabelText("First name *")[1], { target: { value: "Taylor" } });
    fireEvent.change(screen.getAllByLabelText("Last name *")[1], { target: { value: "Lee" } });
    fireEvent.change(screen.getAllByLabelText("Email *")[1], { target: { value: "taylor@example.com" } });
    fireEvent.change(screen.getAllByLabelText("Date of birth *")[1], { target: { value: "1991-02-02" } });
    fireEvent.click(screen.getByRole("button", { name: "Next" }));

    await completeResidentialBase();
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(await screen.findByText("Employment & income")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Employer *"), { target: { value: "North Wharf Ltd." } });
    fireEvent.change(screen.getByLabelText("Job title *"), { target: { value: "Designer" } });
    fireEvent.change(screen.getByLabelText("Gross income *"), { target: { value: "5200" } });
    fireEvent.change(screen.getByLabelText("Length (months) *"), { target: { value: "24" } });
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    fireEvent.change(await screen.findByLabelText("Reference name *"), { target: { value: "Casey Lead" } });
    fireEvent.change(screen.getByLabelText("Reference phone *"), { target: { value: "9025550100" } });
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    fireEvent.click(screen.getByLabelText(/I consent to a credit\/consumer report\./i));
    fireEvent.click(screen.getByLabelText(/I consent to contacting references and past landlords\./i));
    fireEvent.click(screen.getByLabelText(/I consent to data sharing for the tenant database\./i));
    fireEvent.change(screen.getByLabelText("Applicant full name (typed) *"), { target: { value: "Jordan Lee" } });
    fireEvent.change(screen.getByLabelText("Co-applicant full name (typed) *"), { target: { value: "Taylor Lee" } });
    fireEvent.change(screen.getByLabelText("Type your full name *"), { target: { value: "Jordan Lee" } });
    fireEvent.click(screen.getByLabelText(/I agree this is my legal signature\./i));
    fireEvent.click(screen.getByLabelText(/I confirm the information provided is accurate and I authorize/i));
    fireEvent.click(screen.getByRole("button", { name: "Submit application" }));

    expect(await screen.findByText("Co-applicant employment details are required.")).toBeInTheDocument();
    expect(screen.getByText("Employment & income")).toBeInTheDocument();
  });

  it("clears the session draft only after successful submit", async () => {
    renderPage();
    await completeStepZero();
    await completeResidentialBase();
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    fireEvent.change(await screen.findByLabelText("Employer *"), { target: { value: "North Wharf Ltd." } });
    fireEvent.change(screen.getByLabelText("Job title *"), { target: { value: "Designer" } });
    fireEvent.change(screen.getByLabelText("Gross income *"), { target: { value: "5200" } });
    fireEvent.change(screen.getByLabelText("Length (months) *"), { target: { value: "24" } });
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    fireEvent.change(await screen.findByLabelText("Reference name *"), { target: { value: "Casey Lead" } });
    fireEvent.change(screen.getByLabelText("Reference phone *"), { target: { value: "9025550100" } });
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    fireEvent.click(screen.getByLabelText(/I consent to a credit\/consumer report\./i));
    fireEvent.click(screen.getByLabelText(/I consent to contacting references and past landlords\./i));
    fireEvent.click(screen.getByLabelText(/I consent to data sharing for the tenant database\./i));
    fireEvent.change(screen.getByLabelText("Applicant full name (typed) *"), { target: { value: "Jordan Lee" } });
    fireEvent.change(screen.getByLabelText("Type your full name *"), { target: { value: "Jordan Lee" } });
    fireEvent.click(screen.getByLabelText(/I agree this is my legal signature\./i));
    fireEvent.click(screen.getByLabelText(/I confirm the information provided is accurate and I authorize/i));
    fireEvent.click(screen.getByRole("button", { name: "Submit application" }));

    await screen.findByText("Application submitted");
    expect(window.sessionStorage.getItem("public-application-draft:token-123")).toBeNull();
  });
});
