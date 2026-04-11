import { MemoryRouter, Route, Routes } from "react-router-dom";
import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ApplicationReviewSummaryPage from "./ApplicationReviewSummaryPage";

vi.mock("@/hooks/useEntitlements", () => ({
  useEntitlements: vi.fn(),
}));

vi.mock("../api/reviewSummaryApi", () => ({
  fetchReviewSummary: vi.fn(),
  fetchReviewSummaryPdfSignedUrl: vi.fn(),
  ReviewSummaryApiError: class ReviewSummaryApiError extends Error {},
}));

vi.mock("@/api/rentalApplicationsApi", () => ({
  evaluateApplicationRiskSnapshot: vi.fn(),
  recordApplicationRiskDecision: vi.fn(),
}));

vi.mock("../components/ui/ToastProvider", () => ({
  useToast: () => ({ showToast: vi.fn() }),
}));

vi.mock("@/components/billing/LockedFeature", () => ({
  LockedFeature: ({ title }: { title: string }) => <div>{title}</div>,
}));

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/applications/app-1/review-summary"]}>
      <Routes>
        <Route path="/applications/:id/review-summary" element={<ApplicationReviewSummaryPage />} />
      </Routes>
    </MemoryRouter>
  );
}

describe("ApplicationReviewSummaryPage", () => {
  it("shows a locked state when review summaries are not entitled", async () => {
    const { useEntitlements } = await import("@/hooks/useEntitlements");
    const { fetchReviewSummary } = await import("../api/reviewSummaryApi");

    vi.mocked(useEntitlements).mockReturnValue({
      canViewReviewSummary: false,
      canExportPdf: false,
    } as any);

    renderPage();

    expect(screen.getByText("Screening decision summaries are available on Pro")).toBeInTheDocument();
    await waitFor(() => {
      expect(fetchReviewSummary).not.toHaveBeenCalled();
    });
  });

  it("loads the summary when the user is entitled", async () => {
    const { useEntitlements } = await import("@/hooks/useEntitlements");
    const { fetchReviewSummary } = await import("../api/reviewSummaryApi");

    vi.mocked(useEntitlements).mockReturnValue({
      canViewReviewSummary: true,
      canExportPdf: true,
    } as any);
    vi.mocked(fetchReviewSummary).mockResolvedValue({
      applicationId: "app-1",
      generatedAt: "2026-04-01T00:00:00.000Z",
      applicant: {
        name: "Jane Applicant",
        email: "jane@example.com",
        currentAddressLine: null,
        city: null,
        provinceState: null,
        postalCode: null,
        country: null,
        timeAtCurrentAddressMonths: null,
        currentRentAmountCents: null,
      },
      employment: {
        employerName: null,
        jobTitle: null,
        incomeAmountCents: null,
        incomeFrequency: null,
        incomeMonthlyCents: null,
        monthsAtJob: null,
      },
      reference: { name: null, phone: null },
      compliance: {
        applicationConsentAcceptedAt: null,
        applicationConsentVersion: null,
        signatureType: null,
        signedAt: null,
      },
      screening: { status: "complete", provider: "transunion", referenceId: "TU-1" },
      derived: { incomeToRentRatio: null, completeness: { score: 0.8, label: "High" }, flags: [] },
      insights: [],
      decisionSummary: {
        applicationId: "app-1",
        riskSnapshot: {
          version: "risk-v1",
          status: "completed",
          score: 72,
          grade: "B",
          confidence: 0.84,
          factors: [
            {
              code: "identity_verified",
              label: "Identity verification completed",
              impact: "positive",
              weight: 8,
            },
          ],
          flags: ["Income verification incomplete"],
          recommendations: ["Request additional income documentation"],
          updatedAt: "2026-04-01T00:00:00.000Z",
        },
      },
    } as any);

    renderPage();

   expect(await screen.findByText("Application Review Summary")).toBeInTheDocument();
expect(await screen.findByText("Intake Summary")).toBeInTheDocument();
expect(await screen.findByText("Review workflow guidance")).toBeInTheDocument();
expect(await screen.findByText("Shared package categories")).toBeInTheDocument();
expect(await screen.findByText("Recent activity")).toBeInTheDocument();
expect(screen.getAllByText("Profile details").length).toBeGreaterThan(0);
expect(screen.getAllByText("Rental history").length).toBeGreaterThan(0);
expect(screen.getAllByText("Documents & records").length).toBeGreaterThan(0);
expect(screen.getAllByText("Consent / identity status").length).toBeGreaterThan(0);
expect(screen.getAllByText("Application readiness").length).toBeGreaterThan(0);
expect((await screen.findAllByText("Ready for review")).length).toBeGreaterThan(0);
expect(await screen.findByText("Application readiness updated")).toBeInTheDocument();
expect(await screen.findByText("Next steps")).toBeInTheDocument();
expect(await screen.findByText("Structured follow-up loop")).toBeInTheDocument();
expect(screen.getAllByText(/Review the categories already available now/i).length).toBeGreaterThan(0);
expect(
  screen.getAllByText((_, element) => element?.textContent?.includes("Follow-up categories:") ?? false).length
).toBeGreaterThan(0);
expect(screen.getAllByText("Rental history").length).toBeGreaterThan(0);
expect(await screen.findByText(/Follow up is organized by aligned package categories/i)).toBeInTheDocument();
expect(await screen.findByText("Shared with tenant permission and current server-authorized review access.")).toBeInTheDocument();
expect(await screen.findByText("Jane Applicant")).toBeInTheDocument();
expect(await screen.findByText("Landlord Decision Panel")).toBeInTheDocument();
expect(await screen.findByText("Identity verification completed")).toBeInTheDocument();
  });
});
