import { describe, expect, it } from "vitest";
import { deriveVerifiedRentalHistory } from "../deriveVerifiedRentalHistory";

const baseInput = {
  landlordId: "landlord-1",
  identityId: "tenant-1",
  generatedAt: "2026-01-01T00:00:00.000Z",
  tenant: {
    id: "tenant-1",
    screeningId: "screening-1",
    governmentIdRaw: "sensitive-government-id",
    paymentAccount: "sensitive-payment-account",
  },
  leases: [
    {
      id: "lease-1",
      tenantId: "tenant-1",
      propertyId: "property-1",
      startDate: "2025-01-01",
      endDate: "2025-12-31",
    },
  ],
  properties: [{ id: "property-1", addressLine1: "123 Main St" }],
  maintenanceRequests: [{ id: "maintenance-1", tenantId: "tenant-1", leaseId: "lease-1", createdAt: "2025-06-01" }],
  decisions: [
    {
      id: "decision-1",
      tenantId: "tenant-1",
      leaseId: "lease-1",
      destination: "/leases/lease-1/ledger",
      workflow: { queue: "delinquency_review" },
    },
  ],
  operatorReviewSessions: [
    {
      reviewSessionId: "review-1",
      scopeId: "lease-1",
      openedAt: "2025-07-01",
    },
  ],
  evidencePacks: [{ evidencePackId: "evidence-1", scopeId: "lease-1", generatedAt: "2025-07-02" }],
  identityReferences: [{ referenceId: "screening-1", referenceType: "screening", label: "Screening verification" }],
  consentRecords: [{ id: "consent-1", tenantId: "tenant-1", scope: "rental history portability consent" }],
  canonicalEvents: [{ id: "event-1", leaseId: "lease-1", type: "lease.created", occurredAt: "2025-01-01" }],
};

describe("deriveVerifiedRentalHistory", () => {
  it("derives deterministic permissioned ledger flags and history entries", () => {
    const ledger = deriveVerifiedRentalHistory(baseInput);

    expect(ledger).toEqual(
      expect.objectContaining({
        ledgerId: "verified_rental_history:tenant:tenant-1",
        identityId: "tenant:tenant-1",
        ledgerType: "tenant_rental_history",
        manualReviewRequired: true,
        publiclyShareable: false,
        externalInstitutionSharingEnabled: false,
        tokenizationEnabled: false,
      })
    );
    expect(ledger.summary.totalEntries).toBeGreaterThanOrEqual(4);
    expect(ledger.historyEntries.map((entry) => entry.entryType)).toEqual(
      expect.arrayContaining(["lease_participation", "occupancy", "maintenance_history", "delinquency_review"])
    );
  });

  it("preserves review, evidence, consent, and identity lineage without sensitive payloads", () => {
    const ledger = deriveVerifiedRentalHistory(baseInput);
    const serialized = JSON.stringify(ledger);

    expect(ledger.verificationReferences.some((reference) => reference.referenceType === "identity")).toBe(true);
    expect(ledger.reviewReferences.some((reference) => reference.referenceId.includes("review-1"))).toBe(true);
    expect(ledger.evidenceReferences.some((reference) => reference.referenceId.includes("evidence-1"))).toBe(true);
    expect(ledger.consentReferences).toHaveLength(1);
    expect(serialized).not.toContain("sensitive-government-id");
    expect(serialized).not.toContain("sensitive-payment-account");
  });

  it("marks missing lease context as review required with deterministic blocked reasons", () => {
    const ledger = deriveVerifiedRentalHistory({ ...baseInput, leases: [] });

    expect(ledger.status).toBe("review_required");
    expect(ledger.blockedReasons).toContain("Lease participation history is unavailable.");
    expect(ledger.canonicalEvents.map((event) => event.eventType)).toContain("rental_history_review_required");
  });

  it("marks missing tenant context as unknown and keeps mandatory safety flags", () => {
    const ledger = deriveVerifiedRentalHistory({ ...baseInput, tenant: null });

    expect(ledger.status).toBe("unknown");
    expect(ledger.manualReviewRequired).toBe(true);
    expect(ledger.publiclyShareable).toBe(false);
    expect(ledger.externalInstitutionSharingEnabled).toBe(false);
    expect(ledger.tokenizationEnabled).toBe(false);
  });

  it("emits additive canonical event descriptors only", () => {
    const ledger = deriveVerifiedRentalHistory(baseInput);

    expect(ledger.canonicalEvents.map((event) => event.eventType)).toEqual(
      expect.arrayContaining(["rental_history_ledger_derived", "rental_history_entry_verified", "rental_history_redaction_applied"])
    );
    expect(ledger.canonicalEvents.every((event) => event.resourceType === "rental_history_ledger")).toBe(true);
  });
});
