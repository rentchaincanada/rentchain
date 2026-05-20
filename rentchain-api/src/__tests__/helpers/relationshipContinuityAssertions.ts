import { expect } from "vitest";

type RelationshipRecord = Record<string, any>;

function idOf(record: RelationshipRecord, fallbackKey = "id"): string {
  return String(record?.[fallbackKey] ?? record?.id ?? "").trim();
}

export function expectLeaseRelationshipSpine(input: {
  lease: RelationshipRecord;
  landlordId: string;
  property: RelationshipRecord;
  unit: RelationshipRecord;
  tenant: RelationshipRecord;
  application?: RelationshipRecord;
}): void {
  const leaseId = idOf(input.lease);
  const tenantId = idOf(input.tenant);
  const propertyId = idOf(input.property);
  const unitId = idOf(input.unit);

  expect(leaseId).toBeTruthy();
  expect(input.lease.landlordId).toBe(input.landlordId);
  expect(input.property.landlordId).toBe(input.landlordId);
  expect(input.unit.landlordId).toBe(input.landlordId);
  expect(input.tenant.landlordId).toBe(input.landlordId);

  expect(input.lease.propertyId).toBe(propertyId);
  expect(input.lease.unitId).toBe(unitId);
  expect(input.lease.tenantId).toBe(tenantId);

  expect(input.unit.propertyId).toBe(propertyId);
  expect(input.tenant.propertyId).toBe(propertyId);
  expect(input.tenant.unitId).toBe(unitId);

  const tenantLeaseRefs = [
    input.tenant.currentLeaseId,
    input.tenant.leaseId,
    input.tenant.previousLeaseId,
  ].filter(Boolean);
  expect(tenantLeaseRefs).toContain(leaseId);

  if (input.application) {
    expect(input.application.landlordId).toBe(input.landlordId);
    expect(input.application.propertyId).toBe(propertyId);
    expect(input.application.unitId).toBeTruthy();
    expect(input.application.tenantId).toBeTruthy();
  }
}

export function expectPaymentLedgerRelationship(input: {
  lease: RelationshipRecord;
  payment: RelationshipRecord;
  ledgerEntry: RelationshipRecord;
}): void {
  const paymentId = idOf(input.payment);
  const ledgerEntryId = idOf(input.ledgerEntry);

  expect(paymentId).toBeTruthy();
  expect(ledgerEntryId).toBeTruthy();
  expect(input.payment.ledgerEntryId).toBe(ledgerEntryId);
  expect(input.ledgerEntry.paymentDocumentId).toBe(paymentId);

  for (const key of ["landlordId", "tenantId", "leaseId", "propertyId", "unitId"]) {
    const leaseKey = key === "leaseId" ? "id" : key;
    expect(input.payment[key]).toBe(input.lease[leaseKey]);
    expect(input.ledgerEntry[key]).toBe(input.lease[leaseKey]);
  }

  expect(input.ledgerEntry.immutable).toBe(true);
  expect(input.ledgerEntry.entryType).toBe("payment");
  expect(Number(input.payment.amountCents)).toBeGreaterThan(0);
  expect(input.ledgerEntry.signedAmountCents).toBe(-Math.abs(Number(input.payment.amountCents)));
}

export function expectEvidencePackageScope(input: {
  payload: unknown;
  includedIds: string[];
  excludedIds: string[];
  forbiddenPrimaryLabels?: string[];
}): void {
  const serialized = JSON.stringify(input.payload);
  for (const id of input.includedIds) {
    expect(serialized).toContain(id);
  }
  for (const id of input.excludedIds) {
    expect(serialized).not.toContain(id);
  }
  for (const label of input.forbiddenPrimaryLabels ?? []) {
    expect(serialized).not.toContain(label);
  }
}
