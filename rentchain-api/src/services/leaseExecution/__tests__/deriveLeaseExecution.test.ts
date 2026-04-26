import { describe, expect, it } from "vitest";
import { deriveLeaseExecution } from "../deriveLeaseExecution";

describe("deriveLeaseExecution", () => {
  it("derives ready_for_tenant_signature when a document is visible and tenant signing is next", () => {
    const result = deriveLeaseExecution({
      leaseId: "lease-1",
      documentUrl: "https://example.com/lease.pdf",
      startDate: "2026-05-01",
      monthlyRent: 1800,
      status: "ready_for_signature",
      raw: {},
    });

    expect(result.executionStatus).toBe("ready_for_tenant_signature");
    expect(result.requiredNextAction).toBe("tenant_signature");
    expect(result.tenantSignatureStatus).toBe("needed");
  });

  it("derives tenant_signed from durable tenant signature metadata without exposing a landlord model", () => {
    const result = deriveLeaseExecution({
      leaseId: "lease-1",
      documentUrl: "https://example.com/lease.pdf",
      startDate: "2026-05-01",
      monthlyRent: 1800,
      status: "draft",
      raw: {
        tenantSignedAt: "2026-05-01T12:00:00.000Z",
        tenantSignatureMethod: "typed",
        tenantSignatureDisplayName: "Taylor Tenant",
      },
    });

    expect(result.executionStatus).toBe("tenant_signed");
    expect(result.requiredNextAction).toBe("landlord_signature");
    expect(result.landlordSignatureStatus).toBe("needed");
  });

  it("derives fully_executed from an active or signed lease record", () => {
    const result = deriveLeaseExecution({
      leaseId: "lease-1",
      documentUrl: "https://example.com/lease.pdf",
      startDate: "2026-05-01",
      monthlyRent: 1800,
      status: "active",
      raw: {
        tenantSignedAt: "2026-05-01T12:00:00.000Z",
      },
    });

    expect(result.executionStatus).toBe("fully_executed");
    expect(result.requiredNextAction).toBe("none");
  });
});
