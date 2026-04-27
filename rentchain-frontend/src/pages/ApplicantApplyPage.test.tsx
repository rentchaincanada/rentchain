import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ApplicantApplyPage from "./ApplicantApplyPage";

const applicationsApi = vi.hoisted(() => ({
  createApplication: vi.fn(),
  submitApplication: vi.fn(),
  sendApplicationPhoneCode: vi.fn(),
  confirmApplicationPhoneCode: vi.fn(),
}));

vi.mock("@/api/applicationsApi", () => applicationsApi);

function renderPage(state?: any) {
  return render(
    <MemoryRouter initialEntries={[{ pathname: "/apply", state }]}>
      <Routes>
        <Route path="/apply" element={<ApplicantApplyPage />} />
      </Routes>
    </MemoryRouter>
  );
}

describe("ApplicantApplyPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows the RentChain profile banner and visible prefilled fields", async () => {
    renderPage({
      applyWithRentChain: {
        source: "share_token",
        tokenValidated: true,
        scopesApproved: ["identity_summary", "application_summary"],
        identityReference: {
          referenceStatus: "available",
          portabilityStatus: "ready",
        },
        applicationContext: {
          prefilled: true,
          requiredRemaining: ["credit_consent"],
          prefill: {
            applicant: {
              firstName: "Jordan",
              lastName: "Lee",
              email: "jordan@example.com",
              phone: "5551112222",
            },
            currentAddress: {
              line1: "123 King St",
              city: "Halifax",
              province: "NS",
              postalCode: "B3H1A1",
            },
            employment: {
              employerName: "Harbour Labs",
              jobTitle: "Designer",
              incomeAmountCents: 720000,
              incomeFrequency: "monthly",
              monthsAtJob: 12,
            },
          },
        },
      },
    });

    expect(screen.getByText(/Using your RentChain profile/i)).toBeInTheDocument();
    expect(screen.getByDisplayValue("Jordan")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Lee")).toBeInTheDocument();
    expect(screen.getByDisplayValue("jordan@example.com")).toBeInTheDocument();
    expect(screen.getByDisplayValue("5551112222")).toBeInTheDocument();
    expect(screen.getByDisplayValue("123")).toBeInTheDocument();
    expect(screen.getByDisplayValue("King St")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Halifax")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Harbour Labs")).toBeInTheDocument();
    expect(screen.getByText(/Still needed: credit consent/i)).toBeInTheDocument();
  });

  it("keeps prefilled fields editable", async () => {
    renderPage({
      applyWithRentChain: {
        source: "share_token",
        tokenValidated: true,
        scopesApproved: ["identity_summary"],
        identityReference: {
          referenceStatus: "limited",
          portabilityStatus: "limited",
        },
        applicationContext: {
          prefilled: true,
          requiredRemaining: ["credit_consent"],
          prefill: {
            applicant: {
              firstName: "Jordan",
              lastName: "Lee",
              email: "jordan@example.com",
              phone: "5551112222",
            },
            currentAddress: null,
            employment: null,
          },
        },
      },
    });

    const firstName = screen.getAllByDisplayValue("Jordan")[0] as HTMLInputElement;
    fireEvent.change(firstName, { target: { value: "Alex" } });
    expect(firstName.value).toBe("Alex");
  });
});
