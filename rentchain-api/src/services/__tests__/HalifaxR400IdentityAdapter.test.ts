import { beforeEach, describe, expect, it, vi } from "vitest";

const { lookupMock, healthMock } = vi.hoisted(() => ({
  lookupMock: vi.fn(),
  healthMock: vi.fn(),
}));

vi.mock("../identityOracle/clients/halifaxR400SourceClient", () => ({
  lookupHalifaxR400ByPid: lookupMock,
}));

vi.mock("../identityOracle/halifaxR400HealthService", () => ({
  checkHalifaxR400Health: healthMock,
}));

describe("HalifaxR400IdentityAdapter", () => {
  beforeEach(() => {
    lookupMock.mockReset();
    healthMock.mockReset();
  });

  it("maps a strong Halifax dataset result to VERIFIED_MATCH", async () => {
    lookupMock.mockResolvedValue({
      ok: true,
      sourceType: "OPEN_DATASET",
      sourceKey: "halifax_r400",
      sourceLabel: "HRM Halifax Residential Rental Registry R-400",
      health: "healthy",
      issues: [],
      records: [
        {
          id: "record-1",
          registryRecordId: "reg-1",
          registrationNumber: "REH-2024-001",
          pid: "40123456",
          addressRaw: "10 Example Street, Halifax",
          addressNormalized: "10 example st halifax ns b3h1a1",
          primaryAddressCandidate: "10 example st halifax ns b3h1a1",
          postalCode: "B3H1A1",
          registrationStatusNormalized: "registered",
          sourceConfidence: 0.94,
          updatedAt: "2026-04-10T00:00:00.000Z",
        },
      ],
    });

    const { HalifaxR400IdentityAdapter } = await import("../identityOracle/adapters/HalifaxR400IdentityAdapter");
    const adapter = new HalifaxR400IdentityAdapter();
    const result = await adapter.verify({
      propertyId: "prop-1",
      province: "NS",
      municipality: "Halifax",
      identifier: "40123456",
      identifierType: "pid",
      propertyContext: {
        addressLine1: "10 Example Street",
        city: "Halifax",
        province: "NS",
        postalCode: "B3H1A1",
      },
    });

    expect(result.verificationStatus).toBe("VERIFIED_MATCH");
    expect(result.namespaceKey).toBe("NS:PVSC:40123456");
    expect(result.sourceType).toBe("OPEN_DATASET");
    expect(result.relatedNamespaces).toContain("NS:HRM:REH-2024-001");
  });

  it("maps ambiguous Halifax responses to PARTIAL_MATCH", async () => {
    lookupMock.mockResolvedValue({
      ok: true,
      sourceType: "OPEN_DATASET",
      sourceKey: "halifax_r400",
      sourceLabel: "HRM Halifax Residential Rental Registry R-400",
      health: "healthy",
      issues: [],
      records: [
        {
          id: "record-1",
          registryRecordId: "reg-1",
          registrationNumber: "REH-2024-001",
          pid: "40123456",
          addressRaw: "10 Example Street, Halifax",
          addressNormalized: "10 example st halifax ns b3h1a1",
          primaryAddressCandidate: "10 example st halifax ns b3h1a1",
          postalCode: "B3H1A1",
          registrationStatusNormalized: "registered",
          sourceConfidence: 0.94,
          updatedAt: "2026-04-10T00:00:00.000Z",
        },
        {
          id: "record-2",
          registryRecordId: "reg-2",
          registrationNumber: "REH-2024-002",
          pid: "40123456",
          addressRaw: "12 Example Street, Halifax",
          addressNormalized: "12 example st halifax ns b3h1a1",
          primaryAddressCandidate: "12 example st halifax ns b3h1a1",
          postalCode: "B3H1A1",
          registrationStatusNormalized: "registered",
          sourceConfidence: 0.94,
          updatedAt: "2026-04-10T00:00:00.000Z",
        },
      ],
    });

    const { HalifaxR400IdentityAdapter } = await import("../identityOracle/adapters/HalifaxR400IdentityAdapter");
    const result = await new HalifaxR400IdentityAdapter().verify({
      propertyId: "prop-1",
      province: "NS",
      municipality: "Halifax",
      identifier: "40123456",
      identifierType: "pid",
      propertyContext: {
        addressLine1: "10 Example Street",
        city: "Halifax",
        province: "NS",
        postalCode: "B3H1A1",
      },
    });

    expect(result.verificationStatus).toBe("PARTIAL_MATCH");
  });

  it("maps missing Halifax records to UNREGISTERED_RISK", async () => {
    lookupMock.mockResolvedValue({
      ok: true,
      sourceType: "OPEN_DATASET",
      sourceKey: "halifax_r400",
      sourceLabel: "HRM Halifax Residential Rental Registry R-400",
      health: "healthy",
      issues: [],
      records: [],
    });

    const { HalifaxR400IdentityAdapter } = await import("../identityOracle/adapters/HalifaxR400IdentityAdapter");
    const result = await new HalifaxR400IdentityAdapter().verify({
      propertyId: "prop-1",
      province: "NS",
      municipality: "Halifax",
      identifier: "40123456",
      identifierType: "pid",
      propertyContext: {
        addressLine1: "10 Example Street",
        city: "Halifax",
        province: "NS",
        postalCode: "B3H1A1",
      },
    });

    expect(result.verificationStatus).toBe("UNREGISTERED_RISK");
  });

  it("maps unavailable or malformed source responses to SOURCE_UNAVAILABLE", async () => {
    lookupMock.mockResolvedValue({
      ok: false,
      sourceType: "OPEN_DATASET",
      sourceKey: "halifax_r400",
      sourceLabel: "HRM Halifax Residential Rental Registry R-400",
      health: "schema_drift_detected",
      issues: ["missing_required_registry_fields"],
      records: [],
      failureKind: "schema_mismatch",
    });

    const { HalifaxR400IdentityAdapter } = await import("../identityOracle/adapters/HalifaxR400IdentityAdapter");
    const result = await new HalifaxR400IdentityAdapter().verify({
      propertyId: "prop-1",
      province: "NS",
      municipality: "Halifax",
      identifier: "40123456",
      identifierType: "pid",
      propertyContext: {
        addressLine1: "10 Example Street",
        city: "Halifax",
        province: "NS",
        postalCode: "B3H1A1",
      },
    });

    expect(result.verificationStatus).toBe("SOURCE_UNAVAILABLE");
  });
});
