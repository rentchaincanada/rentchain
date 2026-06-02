export type LifecycleContinuityUiRecord = Record<string, unknown>;

export const lifecycleContinuityUiIds = {
  landlordId: "lc_landlord_001",
  propertyId: "lc_property_north_towers",
  unit101Id: "lc_unit_101",
  unit102Id: "lc_unit_102",
  unit103Id: "lc_unit_103",
  applicantId: "lc_applicant_001",
  activeTenantId: "lc_tenant_active_001",
  upcomingTenantId: "lc_tenant_upcoming_001",
  archivedTenantId: "lc_tenant_archived_001",
  activeLeaseId: "lc_lease_active_001",
  upcomingLeaseId: "lc_lease_upcoming_001",
  archivedLeaseId: "lc_lease_archived_001",
  paymentId: "lc_payment_import_001",
  ledgerEntryId: "lc_ledger_payment_001",
  obligationId: "lc_obligation_2026_06",
  decisionId: "lc_decision_manual_review_001",
  signedDocumentId: "lc_doc_signed_lease_001",
} as const;

export const lifecycleContinuityUiDates = {
  now: "2026-05-18T12:00:00.000Z",
  activeLeaseStart: "2026-06-01",
  activeLeaseEnd: "2027-05-31",
  upcomingLeaseStart: "2026-07-01",
  upcomingLeaseEnd: "2027-06-30",
  archivedLeaseStart: "2025-06-01",
  archivedLeaseEnd: "2026-05-31",
  paymentDate: "2026-06-01",
  obligationDueDate: "2026-06-01T00:00:00.000Z",
} as const;

export const lifecycleContinuityUiLabels = {
  propertyName: "North Towers",
  propertyAddress: "10 Harbour Road, Halifax, NS",
  unit101: "Unit 101",
  unit102: "Unit 102",
  unit103: "Unit 103",
  activeTenantName: "John Smith",
  upcomingTenantName: "Bailey Blinkers",
  archivedTenantName: "Casey Past",
  activeLeaseLabel: "North Towers - Unit 101 Lease",
  upcomingLeaseLabel: "North Towers - Unit 103 Lease",
} as const;

export const lifecycleContinuityIds = lifecycleContinuityUiIds;
export const lifecycleContinuityDates = lifecycleContinuityUiDates;
export const lifecycleContinuityLabels = lifecycleContinuityUiLabels;

function cloneRecord<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function withOverrides<T extends LifecycleContinuityUiRecord>(
  base: T,
  overrides?: Partial<T>,
): T {
  return {
    ...cloneRecord(base),
    ...(overrides ?? {}),
  };
}

export function buildLifecycleContinuityTenantRow(
  overrides?: Partial<LifecycleContinuityUiRecord>,
): LifecycleContinuityUiRecord {
  return withOverrides(
    {
      id: lifecycleContinuityUiIds.activeTenantId,
      displayName: "John Smith",
      email: "john.smith@example.test",
      lifecycleState: "active",
      lifecycleLabel: "Active",
      propertyLabel: "North Towers",
      unitLabel: "Unit 101",
      currentLease: {
        leaseId: lifecycleContinuityUiIds.activeLeaseId,
        label: "North Towers - Unit 101 Lease",
        href: `/leases/${lifecycleContinuityUiIds.activeLeaseId}/summary`,
      },
    },
    overrides,
  );
}

export function buildLifecycleContinuityProperty(
  overrides?: Partial<LifecycleContinuityUiRecord>,
): LifecycleContinuityUiRecord {
  return withOverrides(
    {
      id: lifecycleContinuityUiIds.propertyId,
      landlordId: lifecycleContinuityUiIds.landlordId,
      name: lifecycleContinuityUiLabels.propertyName,
      address: lifecycleContinuityUiLabels.propertyAddress,
      province: "NS",
      jurisdictionProvince: "NS",
      status: "active",
      createdAt: lifecycleContinuityUiDates.now,
      updatedAt: lifecycleContinuityUiDates.now,
    },
    overrides,
  );
}

export function buildLifecycleContinuityUnits(): LifecycleContinuityUiRecord[] {
  return [
    {
      id: lifecycleContinuityUiIds.unit101Id,
      landlordId: lifecycleContinuityUiIds.landlordId,
      propertyId: lifecycleContinuityUiIds.propertyId,
      label: lifecycleContinuityUiLabels.unit101,
      unitNumber: "101",
      configuredRentCents: 164000,
      occupancyDisplayStatus: "occupied",
      activeLeaseId: lifecycleContinuityUiIds.activeLeaseId,
      tenantId: lifecycleContinuityUiIds.activeTenantId,
    },
    {
      id: lifecycleContinuityUiIds.unit102Id,
      landlordId: lifecycleContinuityUiIds.landlordId,
      propertyId: lifecycleContinuityUiIds.propertyId,
      label: lifecycleContinuityUiLabels.unit102,
      unitNumber: "102",
      configuredRentCents: 154000,
      occupancyDisplayStatus: "vacant",
    },
    {
      id: lifecycleContinuityUiIds.unit103Id,
      landlordId: lifecycleContinuityUiIds.landlordId,
      propertyId: lifecycleContinuityUiIds.propertyId,
      label: lifecycleContinuityUiLabels.unit103,
      unitNumber: "103",
      configuredRentCents: 198000,
      occupancyDisplayStatus: "upcoming",
      activeLeaseId: lifecycleContinuityUiIds.upcomingLeaseId,
      tenantId: lifecycleContinuityUiIds.upcomingTenantId,
    },
  ];
}

export function buildLifecycleContinuityTenant(
  kind: "active" | "upcoming" | "archived" = "active",
  overrides?: Partial<LifecycleContinuityUiRecord>,
): LifecycleContinuityUiRecord {
  const baseByKind: Record<"active" | "upcoming" | "archived", LifecycleContinuityUiRecord> = {
    active: {
      id: lifecycleContinuityUiIds.activeTenantId,
      landlordId: lifecycleContinuityUiIds.landlordId,
      fullName: lifecycleContinuityUiLabels.activeTenantName,
      email: "john.smith@example.test",
      status: "active",
      lifecycleState: "active",
      currentLeaseId: lifecycleContinuityUiIds.activeLeaseId,
      propertyId: lifecycleContinuityUiIds.propertyId,
      unitId: lifecycleContinuityUiIds.unit101Id,
    },
    upcoming: {
      id: lifecycleContinuityUiIds.upcomingTenantId,
      landlordId: lifecycleContinuityUiIds.landlordId,
      fullName: lifecycleContinuityUiLabels.upcomingTenantName,
      email: "bailey.blinkers@example.test",
      status: "lease_signed",
      lifecycleState: "lease_signed",
      currentLeaseId: lifecycleContinuityUiIds.upcomingLeaseId,
      propertyId: lifecycleContinuityUiIds.propertyId,
      unitId: lifecycleContinuityUiIds.unit103Id,
    },
    archived: {
      id: lifecycleContinuityUiIds.archivedTenantId,
      landlordId: lifecycleContinuityUiIds.landlordId,
      fullName: lifecycleContinuityUiLabels.archivedTenantName,
      email: "casey.past@example.test",
      status: "archived",
      lifecycleState: "past",
      archived: true,
      previousLeaseId: lifecycleContinuityUiIds.archivedLeaseId,
      propertyId: lifecycleContinuityUiIds.propertyId,
      unitId: lifecycleContinuityUiIds.unit101Id,
    },
  };

  return withOverrides(baseByKind[kind], overrides);
}

export function buildLifecycleContinuityLease(
  kind: "active" | "upcoming" | "archived" = "active",
  overrides?: Partial<LifecycleContinuityUiRecord>,
): LifecycleContinuityUiRecord {
  const baseByKind: Record<"active" | "upcoming" | "archived", LifecycleContinuityUiRecord> = {
    active: {
      id: lifecycleContinuityUiIds.activeLeaseId,
      landlordId: lifecycleContinuityUiIds.landlordId,
      tenantId: lifecycleContinuityUiIds.activeTenantId,
      propertyId: lifecycleContinuityUiIds.propertyId,
      unitId: lifecycleContinuityUiIds.unit101Id,
      status: "active",
      signingStatus: "signed",
      startDate: lifecycleContinuityUiDates.activeLeaseStart,
      endDate: lifecycleContinuityUiDates.activeLeaseEnd,
      rentCents: 164000,
      rentDueDay: 1,
      paymentFrequency: "monthly",
      label: lifecycleContinuityUiLabels.activeLeaseLabel,
    },
    upcoming: {
      id: lifecycleContinuityUiIds.upcomingLeaseId,
      landlordId: lifecycleContinuityUiIds.landlordId,
      tenantId: lifecycleContinuityUiIds.upcomingTenantId,
      propertyId: lifecycleContinuityUiIds.propertyId,
      unitId: lifecycleContinuityUiIds.unit103Id,
      status: "signed",
      signingStatus: "signed",
      startDate: lifecycleContinuityUiDates.upcomingLeaseStart,
      endDate: lifecycleContinuityUiDates.upcomingLeaseEnd,
      rentCents: 198000,
      rentDueDay: 1,
      paymentFrequency: "monthly",
      label: lifecycleContinuityUiLabels.upcomingLeaseLabel,
    },
    archived: {
      id: lifecycleContinuityUiIds.archivedLeaseId,
      landlordId: lifecycleContinuityUiIds.landlordId,
      tenantId: lifecycleContinuityUiIds.archivedTenantId,
      propertyId: lifecycleContinuityUiIds.propertyId,
      unitId: lifecycleContinuityUiIds.unit101Id,
      status: "archived",
      signingStatus: "signed",
      startDate: lifecycleContinuityUiDates.archivedLeaseStart,
      endDate: lifecycleContinuityUiDates.archivedLeaseEnd,
      rentCents: 150000,
      rentDueDay: 1,
      paymentFrequency: "monthly",
      label: "North Towers - Unit 101 Archived Lease",
      archived: true,
    },
  };

  return withOverrides(baseByKind[kind], overrides);
}

export function buildLifecycleContinuityLeaseSummary(
  overrides?: Partial<LifecycleContinuityUiRecord>,
): LifecycleContinuityUiRecord {
  return withOverrides(
    {
      leaseId: lifecycleContinuityUiIds.activeLeaseId,
      label: "North Towers - Unit 101 Lease",
      tenantName: "John Smith",
      propertyLabel: "North Towers",
      unitLabel: "Unit 101",
      startDate: lifecycleContinuityUiDates.activeLeaseStart,
      endDate: lifecycleContinuityUiDates.activeLeaseEnd,
      status: "active",
      signingStatus: "signed",
      href: `/leases/${lifecycleContinuityUiIds.activeLeaseId}/summary`,
      ledgerHref: `/leases/${lifecycleContinuityUiIds.activeLeaseId}/ledger`,
    },
    overrides,
  );
}

export function buildLifecycleContinuityPropertyUnitRows(): LifecycleContinuityUiRecord[] {
  return [
    {
      unitId: lifecycleContinuityUiIds.unit101Id,
      unitLabel: "Unit 101",
      propertyLabel: "North Towers",
      configuredRent: "$1,640.00",
      occupancyStatus: "Occupied",
      occupancyDetail: "John Smith - Ends May 31, 2027",
      leaseId: lifecycleContinuityUiIds.activeLeaseId,
      leaseHref: `/leases/${lifecycleContinuityUiIds.activeLeaseId}/summary`,
      ledgerHref: `/leases/${lifecycleContinuityUiIds.activeLeaseId}/ledger`,
    },
    {
      unitId: lifecycleContinuityUiIds.unit103Id,
      unitLabel: "Unit 103",
      propertyLabel: "North Towers",
      configuredRent: "$1,980.00",
      occupancyStatus: "Upcoming",
      occupancyDetail: "Bailey Blinkers - Ends Jun 30, 2027",
      leaseId: lifecycleContinuityUiIds.upcomingLeaseId,
      leaseHref: `/leases/${lifecycleContinuityUiIds.upcomingLeaseId}/summary`,
      ledgerHref: `/leases/${lifecycleContinuityUiIds.upcomingLeaseId}/ledger`,
    },
  ];
}

export function buildLifecycleContinuityPaymentRow(
  overrides?: Partial<LifecycleContinuityUiRecord>,
): LifecycleContinuityUiRecord {
  return withOverrides(
    {
      id: lifecycleContinuityUiIds.paymentId,
      paymentDocumentId: lifecycleContinuityUiIds.paymentId,
      tenantName: "John Smith",
      propertyLabel: "North Towers",
      unitLabel: "Unit 101",
      amount: "$1,640.00",
      amountCents: 164000,
      paymentDate: lifecycleContinuityUiDates.paymentDate,
      method: "etransfer",
      reference: "LC-CSV-1001",
      status: "recorded",
      canEdit: true,
      ledgerEntryId: lifecycleContinuityUiIds.ledgerEntryId,
    },
    overrides,
  );
}

export function buildLifecycleContinuityLeaseLedgerResponse(): LifecycleContinuityUiRecord {
  return {
    lease: buildLifecycleContinuityLeaseSummary(),
    ledgerEntries: [
      {
        id: lifecycleContinuityUiIds.ledgerEntryId,
        type: "payment",
        category: "payment",
        amount: "-$1,640.00",
        amountCents: 164000,
        signedAmountCents: -164000,
        effectiveDate: lifecycleContinuityUiDates.paymentDate,
        paymentDocumentId: lifecycleContinuityUiIds.paymentId,
      },
    ],
    obligations: [
      {
        id: lifecycleContinuityUiIds.obligationId,
        financialStatus: "Current",
        dueDate: lifecycleContinuityUiDates.obligationDueDate,
        expectedAmount: "$1,640.00",
        paidAmount: "$1,640.00",
        outstandingAmount: "$0.00",
        evidence: "Reconciled",
      },
    ],
    decisions: [
      {
        id: lifecycleContinuityUiIds.decisionId,
        financialSignal: "Manual review required",
        workflowStatus: "Unreviewed",
        obligationId: lifecycleContinuityUiIds.obligationId,
      },
    ],
  };
}

export function buildLifecycleContinuityTenantWorkspaceDocumentContext(): LifecycleContinuityUiRecord {
  return {
    leaseId: lifecycleContinuityUiIds.activeLeaseId,
    tenantId: lifecycleContinuityUiIds.activeTenantId,
    propertyLabel: "North Towers",
    unitLabel: "Unit 101",
    leaseLabel: "North Towers - Unit 101 Lease",
    documentStatus: "signed",
    documentId: lifecycleContinuityUiIds.signedDocumentId,
    documentUrl: "https://example.test/docs/lc_doc_signed_lease_001.pdf",
    confidence: "high",
    warnings: [],
  };
}

export function buildLifecycleContinuityFrontendScenario(): {
  tenantRow: LifecycleContinuityUiRecord;
  leaseSummary: LifecycleContinuityUiRecord;
  propertyUnitRows: LifecycleContinuityUiRecord[];
  paymentRow: LifecycleContinuityUiRecord;
  leaseLedger: LifecycleContinuityUiRecord;
  tenantWorkspaceDocumentContext: LifecycleContinuityUiRecord;
} {
  return {
    tenantRow: buildLifecycleContinuityTenantRow(),
    leaseSummary: buildLifecycleContinuityLeaseSummary(),
    propertyUnitRows: buildLifecycleContinuityPropertyUnitRows(),
    paymentRow: buildLifecycleContinuityPaymentRow(),
    leaseLedger: buildLifecycleContinuityLeaseLedgerResponse(),
    tenantWorkspaceDocumentContext: buildLifecycleContinuityTenantWorkspaceDocumentContext(),
  };
}
