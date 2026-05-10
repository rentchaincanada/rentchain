import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import RecipientTrustReviewPage from "./RecipientTrustReviewPage";

const recipientTrustReviewApi = vi.hoisted(() => ({
  getRecipientTrustReview: vi.fn(),
}));

vi.mock("../api/recipientTrustReview", () => recipientTrustReviewApi);

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/recipient/trust-review/grant-1"]}>
      <Routes>
        <Route path="/recipient/trust-review/:grantId" element={<RecipientTrustReviewPage />} />
      </Routes>
    </MemoryRouter>
  );
}

describe("RecipientTrustReviewPage", () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    window.sessionStorage.clear();
  });

  it("renders a conservative metadata-only view-only trust review", async () => {
    recipientTrustReviewApi.getRecipientTrustReview.mockResolvedValue({
      decision: {
        allowed: true,
        status: "available",
        reason: "review_available",
        metadataOnly: true,
        publicAccessEnabled: false,
        downloadEnabled: false,
      },
      summary: {
        schemaVersion: "recipient_trust_review.v1",
        grantId: "grant-1",
        audience: "insurer",
        purpose: "insurance_review",
        lifecycle: "active",
        recipient: {
          email: "reviewer@example.com",
          displayName: "Reviewer",
          organizationName: "Example Insurance",
        },
        consent: {
          granted: true,
          consentVersion: "tenant_institution_access_consent.v1",
          grantedAt: "2026-05-01T00:00:00.000Z",
          expiresAt: "2026-06-01T00:00:00.000Z",
          audience: "insurer",
          purpose: "insurance_review",
        },
        access: {
          authenticated: true,
          sessionBound: true,
          viewOnly: true,
          downloadEnabled: false,
          publicAccessEnabled: false,
          publicProfileEnabled: false,
          externalSubmissionEnabled: false,
          providerIntegrationEnabled: false,
          automatedDecisioningEnabled: false,
        },
        generatedAt: "2026-05-01T00:00:00.000Z",
        expiresAt: "2026-06-01T00:00:00.000Z",
        reviewedAt: "2026-05-02T00:00:00.000Z",
        session: {
          schemaVersion: "recipient_review_session.v1",
          sessionId: "session-1",
          lifecycle: "active",
          issuedAt: "2026-05-02T00:00:00.000Z",
          expiresAt: "2026-05-02T00:30:00.000Z",
          lastValidatedAt: "2026-05-02T00:00:00.000Z",
          grantId: "grant-1",
          audience: "insurer",
          purpose: "insurance_review",
          metadataOnly: true,
          authenticated: true,
          viewOnly: true,
          downloadEnabled: false,
          publicAccessEnabled: false,
          reauthenticationRequiredAt: "2026-05-02T00:30:00.000Z",
        },
        onboarding: {
          schemaVersion: "institution_review_onboarding.v1",
          status: "acknowledged",
          acknowledgementRequired: true,
          acknowledged: true,
          tenantMediated: true,
          authenticatedRecipientRequired: true,
          metadataOnly: true,
          viewOnly: true,
          timeBound: true,
          revocable: true,
          policyGated: true,
          publicAccessEnabled: false,
          downloadEnabled: false,
          institutionAccountCreated: false,
          automatedDecisioningEnabled: false,
          copy: {
            title: "Institution review orientation",
            intro: "A tenant authorized this limited RentChain review.",
            bullets: ["The review is metadata-only and view-only."],
            acknowledgement: "I understand this is not an approval or eligibility decision.",
            supportGuidance: ["Ask the tenant to re-authorize expired access."],
          },
        },
        metadataOnly: true,
        policyGated: true,
        includedClaims: [
          {
            claimCategory: "account_trust",
            claimLabel: "Account trust",
            lifecycleState: "export_ready",
            consentExpiresAt: "2026-06-01T00:00:00.000Z",
          },
        ],
        excludedClaims: [],
        redactions: ["Support/internal metadata is excluded.", "Raw provider payloads are excluded."],
        disclaimers: ["This review is not an automated eligibility decision."],
      },
    });

    renderPage();

    expect(await screen.findByText(/Metadata-only recipient review/i)).toBeInTheDocument();
    expect(screen.getByText("reviewer@example.com")).toBeInTheDocument();
    expect(screen.getByText("Account trust")).toBeInTheDocument();
    expect(screen.getByText(/Review session expires/i)).toBeInTheDocument();
    expect(screen.getByText(/Recipient downloads are disabled/i)).toBeInTheDocument();
    expect(screen.getByText(/Public profiles and public trust URLs are not created/i)).toBeInTheDocument();
    expect(screen.getByText(/not an approval, eligibility, credit, insurance, subsidy, ownership, government, or automated decision/i)).toBeInTheDocument();
    expect(screen.queryByText(/Verified tenant/i)).not.toBeInTheDocument();
  });

  it("requires lightweight onboarding acknowledgement before showing included metadata", async () => {
    const baseSummary: any = {
      schemaVersion: "recipient_trust_review.v1",
      grantId: "grant-1",
      audience: "insurer",
      purpose: "insurance_review",
      lifecycle: "active",
      recipient: { email: "reviewer@example.com", displayName: "Reviewer", organizationName: "Example Insurance" },
      consent: {
        granted: true,
        consentVersion: "tenant_institution_access_consent.v1",
        grantedAt: "2026-05-01T00:00:00.000Z",
        expiresAt: "2026-06-01T00:00:00.000Z",
        audience: "insurer",
        purpose: "insurance_review",
      },
      access: {
        authenticated: true,
        sessionBound: true,
        viewOnly: true,
        downloadEnabled: false,
        publicAccessEnabled: false,
        publicProfileEnabled: false,
        externalSubmissionEnabled: false,
        providerIntegrationEnabled: false,
        automatedDecisioningEnabled: false,
      },
      generatedAt: "2026-05-01T00:00:00.000Z",
      expiresAt: "2026-06-01T00:00:00.000Z",
      reviewedAt: "2026-05-02T00:00:00.000Z",
      session: {
        schemaVersion: "recipient_review_session.v1",
        sessionId: "session-1",
        lifecycle: "active",
        issuedAt: "2026-05-02T00:00:00.000Z",
        expiresAt: "2026-05-02T00:30:00.000Z",
        lastValidatedAt: "2026-05-02T00:00:00.000Z",
        grantId: "grant-1",
        audience: "insurer",
        purpose: "insurance_review",
        metadataOnly: true,
        authenticated: true,
        viewOnly: true,
        downloadEnabled: false,
        publicAccessEnabled: false,
        reauthenticationRequiredAt: "2026-05-02T00:30:00.000Z",
      },
      onboarding: {
        schemaVersion: "institution_review_onboarding.v1",
        status: "required",
        acknowledgementRequired: true,
        acknowledged: false,
        tenantMediated: true,
        authenticatedRecipientRequired: true,
        metadataOnly: true,
        viewOnly: true,
        timeBound: true,
        revocable: true,
        policyGated: true,
        publicAccessEnabled: false,
        downloadEnabled: false,
        institutionAccountCreated: false,
        automatedDecisioningEnabled: false,
        copy: {
          title: "Institution review orientation",
          intro: "A tenant authorized this limited RentChain review.",
          bullets: [
            "You must remain signed in with the invited recipient email before review metadata can be shown.",
            "The review is metadata-only and view-only.",
            "Access is time-bound and may be revoked by the tenant.",
            "RentChain is not making an approval or eligibility decision.",
          ],
          acknowledgement:
            "I understand this is a tenant-authorized, metadata-only, revocable, time-bound review and not an approval or eligibility decision.",
          supportGuidance: ["If access is expired or revoked, the tenant must re-authorize review before metadata can be shown again."],
        },
      },
      metadataOnly: true,
      policyGated: true,
      includedClaims: [],
      excludedClaims: [],
      redactions: ["Support/internal metadata is excluded."],
      disclaimers: ["This review is not an automated eligibility decision."],
    };
    recipientTrustReviewApi.getRecipientTrustReview
      .mockResolvedValueOnce({
        decision: {
          allowed: true,
          status: "onboarding_required",
          reason: "institution_review_onboarding_required",
          metadataOnly: true,
          publicAccessEnabled: false,
          downloadEnabled: false,
        },
        summary: baseSummary,
      })
      .mockResolvedValueOnce({
        decision: {
          allowed: true,
          status: "available",
          reason: "review_available",
          metadataOnly: true,
          publicAccessEnabled: false,
          downloadEnabled: false,
        },
        summary: {
          ...baseSummary,
          onboarding: { ...baseSummary.onboarding, status: "acknowledged", acknowledged: true },
          includedClaims: [
            {
              claimCategory: "account_trust",
              claimLabel: "Account trust",
              lifecycleState: "export_ready",
              consentExpiresAt: "2026-06-01T00:00:00.000Z",
            },
          ],
        },
      });

    renderPage();

    expect(await screen.findByText(/Institution review orientation/i)).toBeInTheDocument();
    expect(screen.queryByText("Account trust")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Continue to metadata review/i })).toBeDisabled();

    fireEvent.click(screen.getByLabelText(/tenant-authorized, metadata-only, revocable/i));
    fireEvent.click(screen.getByRole("button", { name: /Continue to metadata review/i }));

    expect(await screen.findByText("Account trust")).toBeInTheDocument();
    expect(recipientTrustReviewApi.getRecipientTrustReview).toHaveBeenLastCalledWith("grant-1", "session-1", true);
    expect(screen.queryByText(/Verified tenant/i)).not.toBeInTheDocument();
  });

  it("shows blocked lifecycle state without trust metadata", async () => {
    const err: any = new Error("blocked");
    err.body = { decision: { status: "revoked", reason: "grant_revoked" } };
    recipientTrustReviewApi.getRecipientTrustReview.mockRejectedValue(err);

    renderPage();

    expect(await screen.findByText(/Review unavailable/i)).toBeInTheDocument();
    expect(screen.getByText(/grant revoked/i)).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.queryByText(/Account trust/i)).not.toBeInTheDocument();
    });
  });

  it("clears stored recipient review session when reauthentication is required", async () => {
    window.sessionStorage.setItem("recipientTrustReviewSession:grant-1", "session-1");
    const err: any = new Error("reauthentication");
    err.body = {
      decision: {
        status: "session_expired",
        reason: "recipient_session_expired",
      },
    };
    recipientTrustReviewApi.getRecipientTrustReview.mockRejectedValue(err);

    renderPage();

    expect(await screen.findByText(/Review unavailable/i)).toBeInTheDocument();
    expect(screen.getByText(/recipient session expired/i)).toBeInTheDocument();
    expect(window.sessionStorage.getItem("recipientTrustReviewSession:grant-1")).toBeNull();
  });
});
