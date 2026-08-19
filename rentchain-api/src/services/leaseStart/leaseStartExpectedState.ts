import crypto from "crypto";
import type { CanonicalLeaseStartInput, CanonicalLeaseStartResult } from "../../lib/leases/canonicalLeaseStart";

function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .filter(([, entry]) => entry !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => `${JSON.stringify(key)}:${stable(entry)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

export function leaseStartHash(value: unknown): string {
  return crypto.createHash("sha256").update(stable(value)).digest("hex");
}

function leaseMaterial(lease: CanonicalLeaseStartInput["candidateLease"]) {
  return {
    id: lease.id,
    landlordId: lease.landlordId ?? null,
    propertyId: lease.propertyId ?? null,
    unitId: lease.unitId ?? null,
    tenantId: lease.tenantId ?? null,
    tenantIds: lease.tenantIds ?? null,
    status: lease.status ?? null,
    startDate: lease.startDate ?? lease.leaseStartDate ?? lease.leaseStart ?? null,
    endDate: lease.endDate ?? lease.leaseEndDate ?? lease.leaseEnd ?? null,
    executionState: lease.executionState ?? null,
    executionStatus: lease.executionStatus ?? null,
    endedAt: lease.endedAt ?? null,
    terminatedAt: lease.terminatedAt ?? null,
    terminationDate: lease.terminationDate ?? null,
    updatedAt: lease.updatedAt ?? null,
  };
}

function unitMaterial(unit: CanonicalLeaseStartInput["standaloneUnits"][number]) {
  return {
    id: unit.id ?? null,
    landlordId: unit.landlordId ?? null,
    propertyId: unit.propertyId ?? null,
    status: unit.status ?? null,
    occupancyStatus: unit.occupancyStatus ?? null,
    tenantId: unit.tenantId ?? null,
    currentTenantId: unit.currentTenantId ?? null,
    leaseId: unit.leaseId ?? null,
    currentLeaseId: unit.currentLeaseId ?? null,
    occupied: unit.occupied ?? null,
    isOccupied: unit.isOccupied ?? null,
    updatedAt: (unit as any).updatedAt ?? null,
  };
}

export function buildLeaseStartExpectedStateToken(
  input: CanonicalLeaseStartInput,
  decision: CanonicalLeaseStartResult,
  versionMarkers: { propertyUpdatedAt?: unknown } = {}
): string {
  return leaseStartHash({
    version: "lease_start_expected_state_v1",
    landlordId: input.landlordId,
    propertyId: input.propertyId,
    unitId: input.unitId,
    tenantId: input.tenantId,
    evaluationInstant: decision.context.evaluationInstant,
    propertyUpdatedAt: versionMarkers.propertyUpdatedAt ?? null,
    candidateLease: leaseMaterial(input.candidateLease),
    contextLeases: input.contextLeases.map(leaseMaterial).sort((left, right) => left.id.localeCompare(right.id)),
    standaloneUnits: input.standaloneUnits.map(unitMaterial).sort((left, right) => String(left.id).localeCompare(String(right.id))),
    embeddedUnits: input.embeddedUnits.map(unitMaterial).sort((left, right) => String(left.id).localeCompare(String(right.id))),
    tenant: input.tenant ? {
      id: input.tenant.id ?? null,
      landlordId: input.tenant.landlordId ?? null,
      currentLeaseId: input.tenant.currentLeaseId ?? null,
      status: input.tenant.status ?? null,
      updatedAt: (input.tenant as any).updatedAt ?? null,
    } : null,
    tenancies: input.tenancies.map((tenancy) => ({
      id: tenancy.id,
      landlordId: tenancy.landlordId ?? null,
      propertyId: tenancy.propertyId ?? null,
      unitId: tenancy.unitId ?? null,
      tenantId: tenancy.tenantId ?? null,
      leaseId: tenancy.leaseId ?? null,
      status: tenancy.status ?? null,
      moveInAt: tenancy.moveInAt ?? null,
      moveOutAt: tenancy.moveOutAt ?? null,
      updatedAt: (tenancy as any).updatedAt ?? null,
    })).sort((left, right) => left.id.localeCompare(right.id)),
    canonicalOutcome: decision.outcome,
    canonicalReasons: decision.reasons,
  });
}

export function leaseStartDeterministicId(prefix: string, parts: unknown[]): string {
  return `${prefix}:${leaseStartHash([prefix, ...parts]).slice(0, 40)}`;
}
