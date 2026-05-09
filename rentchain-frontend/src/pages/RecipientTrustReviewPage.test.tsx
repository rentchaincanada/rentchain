import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
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
