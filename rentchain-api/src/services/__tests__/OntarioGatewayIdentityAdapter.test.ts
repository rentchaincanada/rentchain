import { beforeEach, describe, expect, it, vi } from "vitest";

const { lookupMock, healthMock } = vi.hoisted(() => ({
  lookupMock: vi.fn(),
  healthMock: vi.fn(),
}));

vi.mock("../identityOracle/clients/ontarioGatewaySourceClient", () => ({
  lookupOntarioGatewayByPin: lookupMock,
}));

vi.mock("../identityOracle/ontarioGatewayHealthService", () => ({
  checkOntarioGatewayHealth: healthMock,
}));

describe("OntarioGatewayIdentityAdapter", () => {
  beforeEach(() => {
    lookupMock.mockReset();
    healthMock.mockReset();
    process.env.IDENTITY_ORACLE_ON_GATEWAY_POLICY = "enabled";
    process.env.IDENTITY_ORACLE_ON_USAGE_GATE = "allow";
  });

  it("falls back safely to SYNTAX_ONLY when policy denies verification", async () => {
    process.env.IDENTITY_ORACLE_ON_GATEWAY_POLICY = "disabled";
    const { OntarioGatewayIdentityAdapter } = await import("../identityOracle/adapters/OntarioGatewayIdentityAdapter");
    const result = await new OntarioGatewayIdentityAdapter().verify({
      propertyId: "prop-on-1",
      province: "ON",
      source: "ontario_gateway",
      identifier: "123456789",
      identifierType: "pin",
      propertyContext: {
        addressLine1: "10 Ontario Street",
        city: "Toronto",
        province: "ON",
        postalCode: "M5V1A1",
      },
    });

    expect(result.verificationStatus).toBe("SYNTAX_ONLY");
    expect(result.policyGate?.allowed).toBe(false);
    expect(lookupMock).not.toHaveBeenCalled();
  });

  it("falls back safely to SYNTAX_ONLY when usage gate denies verification", async () => {
    process.env.IDENTITY_ORACLE_ON_USAGE_GATE = "deny";
    const { OntarioGatewayIdentityAdapter } = await import("../identityOracle/adapters/OntarioGatewayIdentityAdapter");
    const result = await new OntarioGatewayIdentityAdapter().verify({
      propertyId: "prop-on-1",
      province: "ON",
      source: "ontario_gateway",
      identifier: "123456789",
      identifierType: "pin",
      propertyContext: {
        addressLine1: "10 Ontario Street",
        city: "Toronto",
        province: "ON",
        postalCode: "M5V1A1",
      },
    });

    expect(result.verificationStatus).toBe("SYNTAX_ONLY");
    expect(result.usageGate?.allowed).toBe(false);
    expect(lookupMock).not.toHaveBeenCalled();
  });

  it("maps a strong gateway response to VERIFIED_MATCH", async () => {
    lookupMock.mockResolvedValue({
      ok: true,
      sourceType: "PAID_GATEWAY",
      sourceKey: "ontario_gateway",
      sourceLabel: "Ontario Property Verification Gateway",
      health: "healthy",
      issues: [],
      records: [
        {
          gatewayPropertyId: "gw-1",
          pin: "123456789",
          addressLine1: "10 Ontario Street",
          city: "Toronto",
          province: "ON",
          postalCode: "M5V1A1",
          registrationNumber: "101260418",
          confidenceHint: 0.93,
        },
      ],
    });

    const { OntarioGatewayIdentityAdapter } = await import("../identityOracle/adapters/OntarioGatewayIdentityAdapter");
    const result = await new OntarioGatewayIdentityAdapter().verify({
      propertyId: "prop-on-1",
      province: "ON",
      source: "ontario_gateway",
      identifier: "123456789",
      identifierType: "pin",
      propertyContext: {
        addressLine1: "10 Ontario Street",
        city: "Toronto",
        province: "ON",
        postalCode: "M5V1A1",
      },
    });

    expect(result.verificationStatus).toBe("VERIFIED_MATCH");
    expect(result.namespaceKey).toBe("ON:GATEWAY:123456789");
    expect(result.sourceType).toBe("PAID_GATEWAY");
    expect(result.relatedNamespaces).toContain("ON:LRO:101260418");
  });

  it("maps ambiguous or no-match gateway outcomes correctly", async () => {
    lookupMock.mockResolvedValueOnce({
      ok: true,
      sourceType: "PAID_GATEWAY",
      sourceKey: "ontario_gateway",
      sourceLabel: "Ontario Property Verification Gateway",
      health: "healthy",
      issues: [],
      records: [
        {
          gatewayPropertyId: "gw-1",
          pin: "123456789",
          addressLine1: "11 Ontario Street",
          city: "Toronto",
          province: "ON",
          postalCode: "M5V1A1",
          registrationNumber: null,
          confidenceHint: 0.74,
        },
      ],
    });
    lookupMock.mockResolvedValueOnce({
      ok: true,
      sourceType: "PAID_GATEWAY",
      sourceKey: "ontario_gateway",
      sourceLabel: "Ontario Property Verification Gateway",
      health: "healthy",
      issues: [],
      records: [],
      noMatch: true,
    });

    const { OntarioGatewayIdentityAdapter } = await import("../identityOracle/adapters/OntarioGatewayIdentityAdapter");
    const adapter = new OntarioGatewayIdentityAdapter();

    const partial = await adapter.verify({
      propertyId: "prop-on-1",
      province: "ON",
      source: "ontario_gateway",
      identifier: "123456789",
      identifierType: "pin",
      propertyContext: {
        addressLine1: "10 Ontario Street",
        city: "Toronto",
        province: "ON",
        postalCode: "M5V1A1",
      },
    });
    const noMatch = await adapter.verify({
      propertyId: "prop-on-1",
      province: "ON",
      source: "ontario_gateway",
      identifier: "123456789",
      identifierType: "pin",
      propertyContext: {
        addressLine1: "10 Ontario Street",
        city: "Toronto",
        province: "ON",
        postalCode: "M5V1A1",
      },
    });

    expect(partial.verificationStatus).toBe("PARTIAL_MATCH");
    expect(noMatch.verificationStatus).toBe("UNVERIFIED");
  });

  it("maps unavailable or malformed gateway responses to SOURCE_UNAVAILABLE", async () => {
    lookupMock.mockResolvedValue({
      ok: false,
      sourceType: "PAID_GATEWAY",
      sourceKey: "ontario_gateway",
      sourceLabel: "Ontario Property Verification Gateway",
      health: "schema_drift_detected",
      issues: ["missing_required_gateway_fields"],
      records: [],
      failureKind: "schema_mismatch",
    });

    const { OntarioGatewayIdentityAdapter } = await import("../identityOracle/adapters/OntarioGatewayIdentityAdapter");
    const result = await new OntarioGatewayIdentityAdapter().verify({
      propertyId: "prop-on-1",
      province: "ON",
      source: "ontario_gateway",
      identifier: "123456789",
      identifierType: "pin",
      propertyContext: {
        addressLine1: "10 Ontario Street",
        city: "Toronto",
        province: "ON",
        postalCode: "M5V1A1",
      },
    });

    expect(result.verificationStatus).toBe("SOURCE_UNAVAILABLE");
  });
});
