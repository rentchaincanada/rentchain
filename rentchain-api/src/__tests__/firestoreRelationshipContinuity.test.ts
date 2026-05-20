import { describe, expect, it } from "vitest";

import { deriveEvidencePack } from "../lib/evidencePacks/deriveEvidencePack";
import { deriveInstitutionExportPackage } from "../lib/institutionExports/deriveInstitutionExportPackage";
import { deriveLeaseOccupancyCoherence } from "../lib/leases/deriveLeaseOccupancyCoherence";
import {
  buildLifecycleContinuityLease,
  buildLifecycleContinuityScenario,
  lifecycleContinuityDates,
  lifecycleContinuityIds,
  lifecycleContinuityLabels,
} from "./fixtures/lifecycleContinuityFixtures";
import {
  expectEvidencePackageScope,
  expectLeaseRelationshipSpine,
  expectPaymentLedgerRelationship,
} from "./helpers/relationshipContinuityAssertions";

describe("Firestore relationship continuity", () => {
  it("keeps the active lease relationship spine coherent across landlord, property, unit, tenant, and application context", () => {
    const scenario = buildLifecycleContinuityScenario();
    const unit101 = scenario.units.find((unit) => unit.id === lifecycleContinuityIds.unit101Id);

    expect(unit101).toBeDefined();
    expectLeaseRelationshipSpine({
      lease: scenario.activeLease,
      landlordId: lifecycleContinuityIds.landlordId,
      property: scenario.property,
      unit: unit101!,
      tenant: scenario.activeTenant,
      application: scenario.application,
    });

    expect(scenario.application.status).toBe("approved");
    expect(scenario.applicant.applicationId).toBe(scenario.application.id);
    expect(scenario.activeTenant.currentLeaseId).toBe(scenario.activeLease.id);
    expect(scenario.activeLease.status).toBe("active");
  });

  it("keeps upcoming and archived lease relationships distinct from current occupancy", () => {
    const scenario = buildLifecycleContinuityScenario();
    const unit103 = scenario.units.find((unit) => unit.id === lifecycleContinuityIds.unit103Id);
    const unit101 = scenario.units.find((unit) => unit.id === lifecycleContinuityIds.unit101Id);

    expect(unit103).toBeDefined();
    expect(unit101).toBeDefined();
    expectLeaseRelationshipSpine({
      lease: scenario.upcomingLease,
      landlordId: lifecycleContinuityIds.landlordId,
      property: scenario.property,
      unit: unit103!,
      tenant: scenario.upcomingTenant,
    });

    expect(scenario.upcomingLease.status).toBe("signed");
    expect(scenario.upcomingTenant.currentLeaseId).toBe(scenario.upcomingLease.id);
    expect(scenario.archivedLease.status).toBe("archived");
    expect(scenario.archivedTenant.previousLeaseId).toBe(scenario.archivedLease.id);
    expect(scenario.archivedTenant.currentLeaseId).toBeUndefined();
    expect(scenario.archivedLease.unitId).toBe(unit101!.id);
    expect(scenario.archivedLease.tenantId).not.toBe(scenario.activeLease.tenantId);
  });

  it("uses lease-derived coherence instead of stale unit occupant fields for occupancy review", () => {
    const scenario = buildLifecycleContinuityScenario();
    const staleOccupiedUnit = {
      occupancyStatus: "occupied",
      tenantId: "stale_tenant_id",
      activeLeaseId: "stale_lease_id",
    };
    const coherence = deriveLeaseOccupancyCoherence({
      leaseStatus: scenario.upcomingLease.status,
      leaseLifecycleState: "signed_future",
      leaseExecutionStatus: "fully_executed",
      occupancyStatus: staleOccupiedUnit.occupancyStatus,
      tenantStatus: scenario.upcomingTenant.status,
      tenantLifecycleState: scenario.upcomingTenant.lifecycleState,
    });

    expect(staleOccupiedUnit.tenantId).not.toBe(scenario.upcomingLease.tenantId);
    expect(staleOccupiedUnit.activeLeaseId).not.toBe(scenario.upcomingLease.id);
    expect(coherence).toEqual(
      expect.objectContaining({
        coherenceStatus: "coherent",
        leaseOperationalState: "executed_future",
        occupancyState: "upcoming",
        tenantOperationalState: "pending_activation",
      }),
    );
    expect(coherence.flags.hasStateConflict).toBe(false);
  });

  it("keeps canonical payments and immutable ledger entries cross-linked to the same lease context", () => {
    const scenario = buildLifecycleContinuityScenario();

    expectPaymentLedgerRelationship({
      lease: scenario.activeLease,
      payment: scenario.payment,
      ledgerEntry: scenario.ledgerEntry,
    });

    expect(scenario.obligation).toEqual(
      expect.objectContaining({
        leaseId: scenario.activeLease.id,
        tenantId: scenario.activeTenant.id,
        propertyId: scenario.property.id,
        unitId: lifecycleContinuityIds.unit101Id,
        dueDate: lifecycleContinuityDates.obligationDueDate,
      }),
    );
    expect(scenario.obligation.evidence).toEqual([
      {
        paymentDocumentId: scenario.payment.id,
        ledgerEntryId: scenario.ledgerEntry.id,
        amountCents: scenario.payment.amountCents,
        paymentDate: scenario.payment.effectiveDate,
      },
    ]);
  });

  it("keeps processor payment state separate from canonical payment and ledger truth", () => {
    const scenario = buildLifecycleContinuityScenario();
    const rentPayment = {
      id: "lc_rent_payment_processor_001",
      landlordId: lifecycleContinuityIds.landlordId,
      tenantId: lifecycleContinuityIds.activeTenantId,
      leaseId: lifecycleContinuityIds.activeLeaseId,
      propertyId: lifecycleContinuityIds.propertyId,
      unitId: lifecycleContinuityIds.unit101Id,
      paymentIntentId: "lc_payment_intent_001",
      status: "processing",
      processor: "stripe",
    };
    const paymentIntent = {
      id: "lc_payment_intent_001",
      landlordId: lifecycleContinuityIds.landlordId,
      tenantId: lifecycleContinuityIds.activeTenantId,
      leaseId: lifecycleContinuityIds.activeLeaseId,
      status: "requires_payment_method",
    };
    const reconciliationRecord = {
      id: "lc_reconciliation_001",
      leaseId: lifecycleContinuityIds.activeLeaseId,
      subjectId: lifecycleContinuityIds.obligationId,
      paymentIntentId: paymentIntent.id,
      rentPaymentId: rentPayment.id,
      paymentDocumentId: scenario.payment.id,
      ledgerEntryId: scenario.ledgerEntry.id,
    };

    expect(rentPayment.paymentIntentId).toBe(paymentIntent.id);
    expect(rentPayment.leaseId).toBe(scenario.activeLease.id);
    expect(paymentIntent.leaseId).toBe(scenario.activeLease.id);
    expect(rentPayment.id).not.toBe(scenario.payment.id);
    expect(paymentIntent.id).not.toBe(scenario.payment.id);
    expect(reconciliationRecord).toEqual(
      expect.objectContaining({
        leaseId: scenario.activeLease.id,
        subjectId: scenario.obligation.id,
        paymentDocumentId: scenario.payment.id,
        ledgerEntryId: scenario.ledgerEntry.id,
      }),
    );
  });

  it("keeps evidence packs scoped to the requested lease and uses operational labels for visible context", () => {
    const scenario = buildLifecycleContinuityScenario();
    const unrelatedLease = buildLifecycleContinuityLease("upcoming", {
      id: "lc_unrelated_lease_001",
      tenantId: "lc_unrelated_tenant_001",
      propertyId: "lc_unrelated_property_001",
      unitId: "lc_unrelated_unit_001",
      propertyName: "Other Property",
      unitNumber: "999",
      tenantName: "Other Tenant",
    });

    const pack = deriveEvidencePack({
      scope: "lease",
      scopeId: String(scenario.activeLease.id),
      landlordId: lifecycleContinuityIds.landlordId,
      generatedAt: lifecycleContinuityDates.now,
      decisions: [
        {
          ...scenario.decision,
          workflow: {
            queue: "delinquency_review",
            workflowState: "under_review",
            escalationLevel: "warning",
          },
          destination: `/leases/${scenario.activeLease.id}/ledger`,
        } as any,
      ],
      leases: [
        {
          ...scenario.activeLease,
          propertyName: lifecycleContinuityLabels.propertyName,
          unitNumber: "101",
          tenantName: lifecycleContinuityLabels.activeTenantName,
        },
        unrelatedLease,
      ],
      properties: [
        scenario.property,
        { id: "lc_unrelated_property_001", landlordId: "other_landlord", name: "Other Property" },
      ],
      canonicalEvents: [
        {
          id: "lc_event_active_lease",
          leaseId: scenario.activeLease.id,
          type: "payment_reconciled",
          summary: "Payment evidence reconciled.",
          resource: { id: scenario.activeLease.id },
          occurredAt: lifecycleContinuityDates.now,
        },
        {
          id: "lc_event_unrelated_lease",
          leaseId: unrelatedLease.id,
          type: "other_lease_event",
          summary: "Unrelated lease event.",
          resource: { id: unrelatedLease.id },
          occurredAt: lifecycleContinuityDates.now,
        },
      ],
    });

    const leaseContext = pack.sections.find((section) => section.sectionKey === "lease_context");
    expect(leaseContext?.items).toHaveLength(1);
    expect(leaseContext?.items[0]).toEqual(
      expect.objectContaining({
        label: `${lifecycleContinuityLabels.propertyName} · Unit 101 · ${lifecycleContinuityLabels.activeTenantName}`,
        sourceId: scenario.activeLease.id,
      }),
    );
    expectEvidencePackageScope({
      payload: pack,
      includedIds: [String(scenario.activeLease.id), "lc_event_active_lease"],
      excludedIds: [
        "lc_unrelated_lease_001",
        "lc_unrelated_tenant_001",
        "lc_unrelated_unit_001",
        "lc_event_unrelated_lease",
      ],
      forbiddenPrimaryLabels: [`Lease ${scenario.activeLease.id}`, "Lease lc_unrelated_lease_001"],
    });
  });

  it("keeps institutional export previews landlord-scoped and relationship-count based", () => {
    const scenario = buildLifecycleContinuityScenario();
    const pkg = deriveInstitutionExportPackage({
      packageType: "lender_due_diligence",
      landlordId: lifecycleContinuityIds.landlordId,
      generatedAt: lifecycleContinuityDates.now,
      properties: [scenario.property],
      units: scenario.units,
      leases: [scenario.activeLease, scenario.upcomingLease],
      decisionItems: [
        {
          ...scenario.decision,
          workflow: { queue: "delinquency_review" },
        } as any,
      ],
      auditEvents: [{ id: "lc_audit_event_001", landlordId: lifecycleContinuityIds.landlordId }],
    });

    expect(pkg.status).toBe("preview_ready");
    expect(pkg.manualOnly).toBe(true);
    expect(pkg.externalSubmissionEnabled).toBe(false);
    expect(pkg.payloadPreview).toEqual(
      expect.objectContaining({
        landlordContextAvailable: true,
        propertySummary: expect.objectContaining({
          propertyCount: 1,
          unitCount: 3,
        }),
        leaseSummary: expect.objectContaining({
          leaseCount: 2,
          activeLeaseCount: 2,
        }),
        occupancySummary: expect.objectContaining({
          occupiedUnits: 0,
          totalUnits: 3,
        }),
        delinquencySummary: expect.objectContaining({
          decisionsCount: 1,
        }),
      }),
    );
    expect(JSON.stringify(pkg.payloadPreview)).not.toContain("other_landlord");
    expect(JSON.stringify(pkg.payloadPreview)).not.toContain("lc_unrelated");
  });
});
