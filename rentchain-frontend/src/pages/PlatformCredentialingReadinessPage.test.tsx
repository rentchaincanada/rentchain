import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import PlatformCredentialingReadinessPage from "./PlatformCredentialingReadinessPage";

const mockFetchReadiness = vi.fn();
const mockShowToast = vi.fn();

vi.mock("@/api/platformCredentialingApi", () => ({
  fetchPlatformCredentialingReadiness: (...args: any[]) => mockFetchReadiness(...args),
}));

vi.mock("@/components/layout/MacShell", () => ({
  MacShell: ({ children, title }: any) => <main aria-label={title}>{children}</main>,
}));

vi.mock("@/components/ui/ToastProvider", () => ({
  useToast: () => ({ showToast: mockShowToast }),
}));

const readiness = {
  platformCredentialingId: "platform_credentialing:institutional:v1",
  status: "ready_for_review",
  manualApprovalRequired: true,
  consumerReportingExecutionEnabled: false,
  autonomousCredentialApprovalEnabled: false,
  publicCredentialExposureEnabled: false,
  generatedAt: "2026-05-07T00:00:00.000Z",
  summary: {
    totalReferences: 1,
    verifiedReferences: 1,
    partiallyVerifiedReferences: 0,
    blockedReferences: 0,
    unavailableReferences: 0,
    restrictions: 0,
  },
  governanceReferences: [],
  privacyReferences: [],
  consentReferences: [],
  auditReferences: [],
  verificationReferences: [],
  interoperabilityReferences: [],
  reviewReferences: [],
  evidenceReferences: [],
  credentialingRestrictions: [],
  redactions: ["Sensitive credentialing payloads are excluded."],
  blockedReasons: [],
  canonicalEvents: [],
};

describe("PlatformCredentialingReadinessPage", () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    mockFetchReadiness.mockResolvedValue([readiness]);
  });

  it("loads and renders platform credentialing readiness with required safety copy", async () => {
    render(
      <MemoryRouter>
        <PlatformCredentialingReadinessPage />
      </MemoryRouter>
    );

    expect(screen.getByText("Loading platform credentialing readiness...")).toBeInTheDocument();
    expect(await screen.findByText("Credentialing summary")).toBeInTheDocument();
    expect(screen.getAllByText(/Platform credentialing readiness is operationally scoped and review controlled/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Manual review remains required/i).length).toBeGreaterThan(0);
    expect(mockFetchReadiness).toHaveBeenCalledWith({ status: "" });
  });

  it("filters readiness by status", async () => {
    render(
      <MemoryRouter>
        <PlatformCredentialingReadinessPage />
      </MemoryRouter>
    );

    fireEvent.change((await screen.findAllByLabelText("Status"))[0], { target: { value: "blocked" } });
    await waitFor(() => {
      expect(mockFetchReadiness).toHaveBeenLastCalledWith({ status: "blocked" });
    });
  });

  it("renders the empty state", async () => {
    mockFetchReadiness.mockResolvedValue([]);

    render(
      <MemoryRouter>
        <PlatformCredentialingReadinessPage />
      </MemoryRouter>
    );

    expect(await screen.findByText("No platform credentialing readiness profiles match these filters.")).toBeInTheDocument();
  });
});
