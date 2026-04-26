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
      trustContext: {
        trustReadiness: "ready",
        trustLabel: "Ready for review",
        trustDescription: "Application information appears organized enough for review, with only limited follow-up signals still visible.",
        positiveSignals: ["Application information is mostly complete."],
        missingSignals: ["Employment or income details are still incomplete."],
        cautionSignals: ["Screening is not complete yet in the current normalized status view."],
        recommendedNextAction: "review_application",
        decisionSupportLevel: "medium",
      },
    } as any);

    renderPage();

    expect(await screen.findByText("Application Review Summary")).toBeInTheDocument();
    expect(await screen.findByText("Intake Summary")).toBeInTheDocument();
    expect(await screen.findByText("Follow-up resolution")).toBeInTheDocument();
    expect((await screen.findAllByText("Decision workspace")).length).toBeGreaterThan(0);
    expect(await screen.findByText("Shared package categories")).toBeInTheDocument();
    expect(await screen.findByText("Recent activity")).toBeInTheDocument();
    expect(screen.getAllByText("Profile details").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Rental history").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Documents & records").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Consent / identity status").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Application readiness").length).toBeGreaterThan(0);
    expect((await screen.findAllByText("Partly addressed")).length).toBeGreaterThan(0);
    expect(await screen.findByText("Application readiness updated")).toBeInTheDocument();
    expect((await screen.findAllByText("Next steps")).length).toBeGreaterThan(0);
    expect(await screen.findByText("Structured follow-up loop")).toBeInTheDocument();
    expect(screen.getAllByText(/Review the addressed categories now visible/i).length).toBeGreaterThan(0);
    expect(await screen.findByText("Still needs follow-up")).toBeInTheDocument();
    expect(await screen.findByText("Now appears addressed")).toBeInTheDocument();
    expect(await screen.findByText("Decision status")).toBeInTheDocument();
    expect(await screen.findByText("What is still missing")).toBeInTheDocument();
    expect(await screen.findByText(/This application is not ready for a landlord next-step decision yet/i)).toBeInTheDocument();
    expect(screen.getAllByText("Needs follow-up").length).toBeGreaterThan(0);
    expect(await screen.findByText("Decision outcome")).toBeInTheDocument();
    expect(await screen.findByText("Hold for later")).toBeInTheDocument();
    expect(await screen.findByText("Outcome blockers")).toBeInTheDocument();
    expect(await screen.findByText("Outcome next steps")).toBeInTheDocument();
    expect(await screen.findByText(/Derived from current review state/i)).toBeInTheDocument();
    expect(await screen.findByText("Lease step")).toBeInTheDocument();
    expect(await screen.findByText("Not ready for lease step")).toBeInTheDocument();
    expect(await screen.findByText("Lease blockers")).toBeInTheDocument();
    expect(await screen.findByText("Lease preparation")).toBeInTheDocument();
    expect((await screen.findAllByText("Not started")).length).toBeGreaterThan(0);
    expect((await screen.findAllByText("Completed items")).length).toBeGreaterThan(0);
    expect((await screen.findAllByText("Outstanding items")).length).toBeGreaterThan(0);
    expect(await screen.findByText("Preparation blockers")).toBeInTheDocument();
    expect(await screen.findByText("Move-in readiness")).toBeInTheDocument();
    expect(await screen.findByText("Readiness blockers")).toBeInTheDocument();
    expect(await screen.findByText("Lease execution workspace")).toBeInTheDocument();
    expect(await screen.findByText("Execution status")).toBeInTheDocument();
    expect((await screen.findAllByText("Blockers")).length).toBeGreaterThan(0);
    expect(await screen.findByText("Lease signing")).toBeInTheDocument();
    expect(await screen.findByText("Signing status")).toBeInTheDocument();
    expect((await screen.findAllByText("Next actor")).length).toBeGreaterThan(0);
    expect(await screen.findByText("Deposit / first payment")).toBeInTheDocument();
    expect(await screen.findByText("Payment status")).toBeInTheDocument();
    expect(await screen.findByText("Recent updates")).toBeInTheDocument();
    expect(await screen.findByText(/Tenant updated follow-up items/i)).toBeInTheDocument();
    expect(await screen.findByText(/Follow-up stays organized by aligned package categories/i)).toBeInTheDocument();
    expect(await screen.findByText("Shared with tenant permission and current server-authorized review access.")).toBeInTheDocument();
    expect(await screen.findByText("Jane Applicant")).toBeInTheDocument();
    expect(await screen.findByText("Landlord Decision Panel")).toBeInTheDocument();
    expect(await screen.findByText("Identity verification completed")).toBeInTheDocument();
    expect(await screen.findByText("Trust guidance")).toBeInTheDocument();
    expect((await screen.findAllByText("Ready for review")).length).toBeGreaterThan(0);
    expect(await screen.findByText("Application information is mostly complete.")).toBeInTheDocument();
    expect(await screen.findByText("Employment or income details are still incomplete.")).toBeInTheDocument();
    expect(await screen.findByText(/Recommended next action: Review application/i)).toBeInTheDocument();
  });

  it("shows ready for decision when follow-up is resolved and review signals are organized", async () => {
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
        name: "Jordan Applicant",
        email: "jordan@example.com",
        currentAddressLine: "12 Main St",
        city: "Halifax",
        provinceState: "NS",
        postalCode: "B3H1A1",
        country: "CA",
        timeAtCurrentAddressMonths: 24,
        currentRentAmountCents: 180000,
      },
      employment: {
        employerName: "Acme",
        jobTitle: "Manager",
        incomeAmountCents: 7200000,
        incomeFrequency: "annual",
        incomeMonthlyCents: 600000,
        monthsAtJob: 36,
      },
      reference: { name: "Sam Ref", phone: "555-0100" },
      compliance: {
        applicationConsentAcceptedAt: "2026-03-29T00:00:00.000Z",
        applicationConsentVersion: "v1",
        signatureType: "electronic",
        signedAt: "2026-03-29T00:00:00.000Z",
      },
      screening: { status: "complete", provider: "transunion", referenceId: "TU-2" },
      derived: { incomeToRentRatio: 3.2, completeness: { score: 0.92, label: "High" }, flags: [] },
      insights: [],
      decisionSummary: {
        applicationId: "app-1",
        screeningRecommendation: {
          recommended: false,
          reason: "Already complete.",
          priority: "low",
        },
        screeningSummary: {
          available: true,
          provider: "transunion",
          completedAt: "2026-04-01T00:00:00.000Z",
          highlights: [],
        },
        riskSnapshot: {
          version: "risk-v1",
          status: "completed",
          score: 78,
          grade: "B",
          confidence: 0.88,
          factors: [],
          flags: [],
          recommendations: [],
          updatedAt: "2026-04-01T00:00:00.000Z",
        },
      },
    } as any);

    renderPage();

    expect((await screen.findAllByText("Decision workspace")).length).toBeGreaterThan(0);
    expect((await screen.findAllByText("Ready for decision")).length).toBeGreaterThan(0);
    expect((await screen.findAllByText("Ready for next step")).length).toBeGreaterThan(0);
    expect((await screen.findAllByText("Ready for lease step")).length).toBeGreaterThan(0);
    expect((await screen.findAllByText("Awaiting next action")).length).toBeGreaterThan(0);
    expect((await screen.findAllByText("Move-in readiness")).length).toBeGreaterThan(0);
    expect((await screen.findAllByText("Awaiting next action")).length).toBeGreaterThan(1);
    expect((await screen.findAllByText("Lease execution workspace")).length).toBeGreaterThan(0);
    expect((await screen.findAllByText("Ready for execution")).length).toBeGreaterThan(0);
    expect((await screen.findAllByText("Lease signing")).length).toBeGreaterThan(0);
    expect((await screen.findAllByText("Ready for signing")).length).toBeGreaterThan(0);
    expect(await screen.findByText(/A lease-preparation record is not visible from the current review-summary surface yet/i)).toBeInTheDocument();
    expect(await screen.findByText(/Move this file into the lease flow/i)).toBeInTheDocument();
    expect(await screen.findByText(/No decision blockers are currently surfaced/i)).toBeInTheDocument();
  });

  it("shows hold for later when follow-up is resolved but review signals still need work", async () => {
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
        name: "Morgan Applicant",
        email: "morgan@example.com",
        currentAddressLine: "45 Harbour St",
        city: "Halifax",
        provinceState: "NS",
        postalCode: "B3H2B2",
        country: "CA",
        timeAtCurrentAddressMonths: 18,
        currentRentAmountCents: 160000,
      },
      employment: {
        employerName: "Acme",
        jobTitle: "Coordinator",
        incomeAmountCents: 5400000,
        incomeFrequency: "annual",
        incomeMonthlyCents: 450000,
        monthsAtJob: 8,
      },
      reference: { name: "Pat Ref", phone: "555-0101" },
      compliance: {
        applicationConsentAcceptedAt: "2026-03-29T00:00:00.000Z",
        applicationConsentVersion: "v1",
        signatureType: "electronic",
        signedAt: "2026-03-29T00:00:00.000Z",
      },
      screening: { status: "not_run", provider: null, referenceId: null },
      derived: { incomeToRentRatio: 2.1, completeness: { score: 0.68, label: "Medium" }, flags: ["MISSING_EMPLOYER_NAME"] },
      insights: [],
      decisionSummary: {
        applicationId: "app-1",
        screeningRecommendation: {
          recommended: true,
          reason: "Still recommended.",
          priority: "high",
        },
        screeningSummary: {
          available: false,
          provider: null,
          completedAt: null,
          highlights: [],
        },
        riskSnapshot: {
          version: "risk-v1",
          status: "completed",
          score: 61,
          grade: "C",
          confidence: 0.71,
          factors: [],
          flags: [],
          recommendations: [],
          updatedAt: "2026-04-01T00:00:00.000Z",
        },
      },
    } as any);

    renderPage();

    expect((await screen.findAllByText("Decision workspace")).length).toBeGreaterThan(0);
    expect((await screen.findAllByText("Hold for later")).length).toBeGreaterThan(0);
    expect((await screen.findAllByText("Not ready for lease step")).length).toBeGreaterThan(0);
    expect((await screen.findAllByText("Not started")).length).toBeGreaterThan(0);
    expect((await screen.findAllByText("Not ready for execution")).length).toBeGreaterThan(0);
    expect((await screen.findAllByText("Not ready for signing")).length).toBeGreaterThan(0);
    expect(
      (await screen.findAllByText(/Screening is still recommended before moving this file/i)).length
    ).toBeGreaterThan(0);
  });
});
