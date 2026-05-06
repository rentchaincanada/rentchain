import React from "react";
import { MemoryRouter } from "react-router-dom";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { IdentityProfilePanel } from "./IdentityProfilePanel";
import type { IdentityLayerProfile } from "@/api/identityLayerApi";

function profile(overrides: Partial<IdentityLayerProfile> = {}): IdentityLayerProfile {
  return {
    identityId: "tenant:tenant-1",
    identityType: "tenant",
    status: "verified",
    manualReviewRequired: true,
    publiclyShareable: false,
    externalInstitutionSharingEnabled: false,
    tokenizationEnabled: false,
    verificationSummary: {
      totalReferences: 2,
      verifiedReferences: 2,
      missingReferences: 0,
      blockedReferences: 0,
    },
    consentSummary: {
      consentAvailable: true,
      consentScope: ["screening consent"],
      consentReferences: 1,
      missingConsentReasons: [],
    },
    portabilitySummary: {
      portableReferenceAvailable: true,
      portabilityStatus: "ready",
      blockedReasons: [],
    },
    lineageReferences: [],
    verificationReferences: [
      {
        referenceId: "tenant-1",
        referenceType: "tenant_profile",
        label: "Tenant profile reference",
        status: "available",
        destination: "/tenants",
        occurredAt: null,
        redacted: false,
        blockedReason: null,
      },
    ],
    consentReferences: [
      {
        referenceId: "consent-1",
        referenceType: "consent",
        label: "screening consent",
        status: "available",
        destination: null,
        occurredAt: null,
        redacted: false,
        blockedReason: null,
      },
    ],
    reviewReferences: [],
    redactions: ["Raw screening and credit bureau payloads are excluded."],
    blockedReasons: [],
    canonicalEvents: [],
    generatedAt: "2026-05-06T00:00:00.000Z",
    ...overrides,
  };
}

describe("IdentityProfilePanel", () => {
  afterEach(() => cleanup());

  it("renders identity status, lineage, redactions, and required safety copy", () => {
    render(
      <MemoryRouter>
        <IdentityProfilePanel profile={profile()} />
      </MemoryRouter>
    );

    expect(screen.getByText("View identity profile")).toBeInTheDocument();
    expect(screen.getAllByText("Verified").length).toBeGreaterThan(0);
    expect(screen.getByText(/Identity references are permissioned and operationally scoped/i)).toBeInTheDocument();
    expect(screen.getByText(/Manual review remains required/i)).toBeInTheDocument();
    expect(screen.getByText(/No public identity sharing or tokenization is enabled/i)).toBeInTheDocument();
    expect(screen.getByText("View verification lineage")).toBeInTheDocument();
    expect(screen.getByText("Tenant profile reference")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View context" })).toHaveAttribute("href", "/tenants");
    expect(screen.getByText("View consent lineage")).toBeInTheDocument();
    expect(screen.getByText("screening consent")).toBeInTheDocument();
    expect(screen.getByText("Raw screening and credit bureau payloads are excluded.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /publish identity|share publicly|mint token|export identity publicly|autonomous verification|approve identity automatically/i })).not.toBeInTheDocument();
  });

  it("renders graceful missing context and blocked reasons", () => {
    render(
      <MemoryRouter>
        <IdentityProfilePanel
          profile={profile({
            status: "review_required",
            consentReferences: [],
            reviewReferences: [],
            portabilitySummary: {
              portableReferenceAvailable: false,
              portabilityStatus: "not_ready",
              blockedReasons: ["Identity portability requires verified references."],
            },
          })}
        />
      </MemoryRouter>
    );

    expect(screen.getAllByText("Context unavailable").length).toBeGreaterThan(0);
    expect(screen.getByText(/View blocked reason: Identity portability requires verified references\./i)).toBeInTheDocument();
  });
});
