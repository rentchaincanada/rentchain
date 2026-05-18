import React from "react";
import { MemoryRouter } from "react-router-dom";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import EvidencePackPage from "./EvidencePackPage";

const apiMocks = vi.hoisted(() => ({
  fetchEvidencePackPreview: vi.fn(),
  showToast: vi.fn(),
  macShellProps: vi.fn(),
}));

vi.mock("@/api/evidencePackApi", async () => {
  const actual = await vi.importActual<any>("@/api/evidencePackApi");
  return {
    ...actual,
    fetchEvidencePackPreview: apiMocks.fetchEvidencePackPreview,
  };
});

vi.mock("@/components/ui/ToastProvider", () => ({
  useToast: () => ({ showToast: apiMocks.showToast }),
}));

vi.mock("@/components/layout/MacShell", () => ({
  MacShell: ({ children, ...props }: { children: React.ReactNode; showTopNav?: boolean }) => {
    apiMocks.macShellProps(props);
    return <div>{children}</div>;
  },
}));

function evidencePack() {
  return {
    evidencePackId: "evidence_pack:decision:landlord-1:decision-1",
    scope: "decision",
    scopeId: "decision-1",
    status: "ready_for_review",
    manualReviewRequired: true,
    externalSharingEnabled: false,
    certificationIssued: false,
    generatedAt: "2026-05-05T12:00:00.000Z",
    summary: { totalItems: 1, includedItems: 1, redactedItems: 0, blockedItems: 0, missingItems: 0 },
    sections: [],
    redactions: [{ fieldCategory: "tenant_contact_details", reason: "Tenant contact details are excluded." }],
    blockedReasons: [],
    disclaimers: [
      "Preview only. Evidence is not shared externally.",
      "Manual review is required before relying on or sharing this evidence.",
      "Sensitive data may be excluded or redacted.",
    ],
  };
}

describe("EvidencePackPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiMocks.fetchEvidencePackPreview.mockResolvedValue(evidencePack());
  });

  afterEach(() => cleanup());

  it("renders evidence pack preview from query params", async () => {
    render(
      <MemoryRouter initialEntries={["/evidence-packs?scope=decision&scopeId=decision-1"]}>
        <EvidencePackPage />
      </MemoryRouter>
    );

    expect(await screen.findByRole("heading", { name: "Evidence pack preview" })).toBeInTheDocument();
    expect(apiMocks.fetchEvidencePackPreview).toHaveBeenCalledWith({ scope: "decision", scopeId: "decision-1" });
    expect(screen.getByText("Ready For Review")).toBeInTheDocument();
    expect(screen.getByText("Tenant Contact Details")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /submit|send|share externally|certify|file|upload|auto-report|legal approval/i })).not.toBeInTheDocument();
    expect(apiMocks.macShellProps).toHaveBeenCalledWith(expect.objectContaining({ showTopNav: false }));
  });

  it("loads a preview after manual scope input", async () => {
    render(
      <MemoryRouter initialEntries={["/evidence-packs"]}>
        <EvidencePackPage />
      </MemoryRouter>
    );

    fireEvent.change(screen.getByLabelText(/Internal scope reference/i), { target: { value: "lease-1" } });
    fireEvent.change(screen.getByLabelText("Scope"), { target: { value: "lease" } });
    fireEvent.click(screen.getByRole("button", { name: "Preview evidence" }));

    await waitFor(() => {
      expect(apiMocks.fetchEvidencePackPreview).toHaveBeenCalledWith({ scope: "lease", scopeId: "lease-1" });
    });
  });
});
