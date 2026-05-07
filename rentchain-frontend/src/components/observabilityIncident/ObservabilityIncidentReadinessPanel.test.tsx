import { render, screen } from "@testing-library/react";
import React from "react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import type { ObservabilityIncidentReadinessProfile } from "@/api/observabilityIncidentReadinessApi";
import { ObservabilityIncidentReadinessPanel } from "./ObservabilityIncidentReadinessPanel";

const profile: ObservabilityIncidentReadinessProfile = {
  observabilityIncidentReadinessId: "observability_incident_readiness:operational-observability-incident-readiness-v1",
  status: "blocked",
  manualReviewRequired: true,
  externalMonitoringIntegrationEnabled: false,
  autonomousRemediationEnabled: false,
  alertSendingEnabled: false,
  productionMutationEnabled: false,
  sensitiveTelemetryExposed: false,
  generatedAt: "2026-01-01T00:00:00.000Z",
  summary: {
    totalReferences: 2,
    verifiedReferences: 1,
    partiallyVerifiedReferences: 0,
    blockedReferences: 1,
    unavailableReferences: 0,
    restrictions: 1,
  },
  observabilityReferences: [
    {
      referenceId: "obs-1",
      referenceType: "observability",
      status: "blocked",
      label: "Observability health reference",
      description: "Internal observability metadata is available.",
      reviewRequired: true,
      lineageReferences: ["obs-1"],
      destination: "/admin/observability",
      redacted: false,
      redactionReason: null,
      blockedReason: "Open critical observability event requires incident readiness review.",
    },
  ],
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
  observabilityIncidentRestrictions: [
    {
      restrictionId: "restriction-1",
      restrictionType: "observability",
      status: "blocked",
      label: "Observability health reference restriction",
      description: "Observability health reference is incomplete or blocked.",
      blockedReason: "Open critical observability event requires incident readiness review.",
    },
  ],
  redactions: ["Sensitive telemetry payloads, stack traces, request bodies, tenant/payment/screening data, and credentials are excluded."],
  blockedReasons: ["Open critical observability event requires incident readiness review."],
  canonicalEvents: [],
};

describe("ObservabilityIncidentReadinessPanel", () => {
  const forbiddenLabels = [
    ["Connect", "monitoring"],
    ["Send", "alert"],
    ["Auto", "remediate"],
    ["Execute", "recovery"],
    ["Mutate", "production"],
    ["Expose", "telemetry"],
  ].map((parts) => (parts[0] === "Auto" ? parts.join("-") : parts.join(" ")));

  it("renders safety copy, readiness status, restrictions, and blocked reasons", () => {
    render(
      <MemoryRouter>
        <ObservabilityIncidentReadinessPanel profile={profile} />
      </MemoryRouter>
    );

    expect(screen.getByText("View incident readiness")).toBeInTheDocument();
    expect(screen.getByText(/Observability and incident readiness is operationally scoped and review controlled/i)).toBeInTheDocument();
    expect(screen.getByText(/No external monitoring integration, alert sending, autonomous remediation, recovery execution, or production mutation is enabled/i)).toBeInTheDocument();
    expect(screen.getByText("Manual review required")).toBeInTheDocument();
    expect(screen.getAllByText("Blocked").length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Open critical observability event requires incident readiness review/i).length).toBeGreaterThan(0);
    expect(screen.getByText("View readiness restrictions")).toBeInTheDocument();
    expect(screen.getByText("View observability health")).toBeInTheDocument();
    expect(screen.getByText("Sensitive telemetry payloads, stack traces, request bodies, tenant/payment/screening data, and credentials are excluded.")).toBeInTheDocument();
  });

  it("omits forbidden execution labels", () => {
    render(
      <MemoryRouter>
        <ObservabilityIncidentReadinessPanel profile={profile} />
      </MemoryRouter>
    );

    for (const forbiddenLabel of forbiddenLabels) {
      expect(screen.queryByText(forbiddenLabel)).not.toBeInTheDocument();
    }
  });
});
