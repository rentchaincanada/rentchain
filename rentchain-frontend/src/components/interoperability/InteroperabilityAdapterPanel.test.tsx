import { render, screen } from "@testing-library/react";
import React from "react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import type { InteroperabilityAdapterReadiness } from "@/api/interoperabilityAdaptersApi";
import { InteroperabilityAdapterPanel } from "./InteroperabilityAdapterPanel";

const readiness: InteroperabilityAdapterReadiness = {
  adapterReadinessId: "interoperability_adapter_readiness:landlord-1:lender",
  adapterType: "lender",
  status: "partially_ready",
  manualReviewRequired: true,
  liveIntegrationEnabled: false,
  externalSynchronizationEnabled: false,
  generatedAt: "2026-01-01T00:00:00.000Z",
  summary: {
    totalReferences: 1,
    verifiedReferences: 0,
    partiallyVerifiedReferences: 1,
    blockedReferences: 0,
    unavailableReferences: 0,
    restrictions: 1,
  },
  compatibilityReferences: [
    {
      referenceId: "compatibility-1",
      referenceType: "compatibility",
      status: "partially_verified",
      label: "Compatibility readiness reference",
      description: "Operational compatibility metadata is available.",
      reviewRequired: true,
      lineageReferences: ["risk-1"],
      destination: "/operational-risk",
      redacted: false,
      redactionReason: null,
      blockedReason: null,
    },
  ],
  settlementReferences: [],
  regulatoryReferences: [],
  evidenceReferences: [],
  reviewReferences: [],
  sharingReferences: [],
  auditReferences: [],
  adapterRestrictions: [],
  redactions: ["Live integration credentials, webhook secrets, and external API payloads are excluded."],
  blockedReasons: [],
  canonicalEvents: [],
};

describe("InteroperabilityAdapterPanel", () => {
  it("renders required safety copy and compatibility references", () => {
    render(
      <MemoryRouter>
        <InteroperabilityAdapterPanel readiness={readiness} />
      </MemoryRouter>
    );

    expect(screen.getByText("View interoperability readiness")).toBeInTheDocument();
    expect(screen.getByText(/No live integrations or autonomous synchronization is enabled/i)).toBeInTheDocument();
    expect(screen.getByText("Manual review required")).toBeInTheDocument();
    expect(screen.getByText("View compatibility references")).toBeInTheDocument();
    expect(screen.getByText("Live integration credentials, webhook secrets, and external API payloads are excluded.")).toBeInTheDocument();
  });

  it("omits forbidden interoperability labels", () => {
    render(
      <MemoryRouter>
        <InteroperabilityAdapterPanel readiness={readiness} />
      </MemoryRouter>
    );

    expect(screen.queryByText("Connect integration")).not.toBeInTheDocument();
    expect(screen.queryByText("Enable sync")).not.toBeInTheDocument();
    expect(screen.queryByText("Auto-sync")).not.toBeInTheDocument();
    expect(screen.queryByText("Connect lender")).not.toBeInTheDocument();
    expect(screen.queryByText("Connect regulator")).not.toBeInTheDocument();
    expect(screen.queryByText("Connect payment provider")).not.toBeInTheDocument();
    expect(screen.queryByText("Autonomous integration")).not.toBeInTheDocument();
  });
});
