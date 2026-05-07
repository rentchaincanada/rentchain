import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ObservabilityIncidentReadinessPage from "./ObservabilityIncidentReadinessPage";

const mockFetchProfiles = vi.fn();
const mockShowToast = vi.fn();

vi.mock("@/api/observabilityIncidentReadinessApi", () => ({
  fetchObservabilityIncidentReadinessProfiles: (...args: any[]) => mockFetchProfiles(...args),
}));

vi.mock("@/components/layout/MacShell", () => ({
  MacShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/ui/ToastProvider", () => ({
  useToast: () => ({ showToast: mockShowToast }),
}));

const profile = {
  observabilityIncidentReadinessId: "observability_incident_readiness:operational-observability-incident-readiness-v1",
  status: "ready_for_review",
  manualReviewRequired: true,
  externalMonitoringIntegrationEnabled: false,
  autonomousRemediationEnabled: false,
  alertSendingEnabled: false,
  productionMutationEnabled: false,
  sensitiveTelemetryExposed: false,
  generatedAt: "2026-01-01T00:00:00.000Z",
  summary: {
    totalReferences: 1,
    verifiedReferences: 1,
    partiallyVerifiedReferences: 0,
    blockedReferences: 0,
    unavailableReferences: 0,
    restrictions: 0,
  },
  observabilityReferences: [],
  incidentReferences: [],
  outageReferences: [],
  recoveryReferences: [],
  escalationReferences: [],
  postIncidentReviewReferences: [],
  slaReferences: [],
  alertReferences: [],
  releaseReferences: [],
  publicExposureReferences: [],
  evidenceReferences: [],
  reviewReferences: [],
  auditReferences: [],
  observabilityIncidentRestrictions: [],
  redactions: ["External monitoring integrations, alert sending, autonomous remediation, and production mutation are not enabled."],
  blockedReasons: [],
  canonicalEvents: [],
};

describe("ObservabilityIncidentReadinessPage", () => {
  const forbiddenLabels = [
    ["Connect", "monitoring"],
    ["Send", "alert"],
    ["Auto", "remediate"],
    ["Execute", "recovery"],
    ["Mutate", "production"],
    ["Expose", "telemetry"],
  ].map((parts) => (parts[0] === "Auto" ? parts.join("-") : parts.join(" ")));

  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockFetchProfiles.mockResolvedValue([profile]);
  });

  it("renders observability incident readiness and required safety copy", async () => {
    render(
      <MemoryRouter>
        <ObservabilityIncidentReadinessPage />
      </MemoryRouter>
    );

    expect(await screen.findByText("Observability and incident readiness")).toBeInTheDocument();
    expect(screen.getAllByText(/No external monitoring integration, alert sending, autonomous remediation, recovery execution, or production mutation is enabled/i).length).toBeGreaterThan(0);
    expect(screen.getByText("Manual review required")).toBeInTheDocument();
    expect(screen.getByText("External monitoring integrations, alert sending, autonomous remediation, and production mutation are not enabled.")).toBeInTheDocument();
  });

  it("updates deterministic status filters", async () => {
    render(
      <MemoryRouter>
        <ObservabilityIncidentReadinessPage />
      </MemoryRouter>
    );

    await screen.findByText("Observability and incident readiness");
    fireEvent.change(screen.getByLabelText("Status"), { target: { value: "blocked" } });

    await waitFor(() => {
      expect(mockFetchProfiles).toHaveBeenLastCalledWith({
        status: "blocked",
      });
    });
  });

  it("shows empty state and omits forbidden labels", async () => {
    mockFetchProfiles.mockResolvedValue([]);
    render(
      <MemoryRouter>
        <ObservabilityIncidentReadinessPage />
      </MemoryRouter>
    );

    expect(await screen.findByText("No observability incident readiness profiles match these filters.")).toBeInTheDocument();
    for (const forbiddenLabel of forbiddenLabels) {
      expect(screen.queryByText(forbiddenLabel)).not.toBeInTheDocument();
    }
  });
});
