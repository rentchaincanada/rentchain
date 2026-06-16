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

  it("does not infer tenant signature readiness from document and core lease details alone", () => {
    const result = deriveLeaseExecution({
      leaseId: "lease-1",
      documentUrl: "https://example.com/lease.pdf",
      startDate: "2026-05-01",
      monthlyRent: 1800,
      status: "active",
      raw: {},
    });

    expect(result.executionStatus).toBe("draft");
    expect(result.executionLabel).toBe("Lease details ready");
    expect(result.requiredNextAction).toBe("complete_lease_details");
    expect(result.tenantSignatureStatus).toBe("blocked");
    expect(result.landlordSignatureStatus).toBe("blocked");
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

  it("does not derive fully_executed from an active lease without landlord signature metadata", () => {
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

    expect(result.executionStatus).toBe("tenant_signed");
    expect(result.requiredNextAction).toBe("landlord_signature");
  });

  it("derives fully_executed when both tenant and landlord signature metadata exist", () => {
    const result = deriveLeaseExecution({
      leaseId: "lease-1",
      documentUrl: "https://example.com/lease.pdf",
      startDate: "2026-05-01",
      monthlyRent: 1800,
      status: "active",
      raw: {
        tenantSignedAt: "2026-05-01T12:00:00.000Z",
        landlordSignedAt: "2026-05-01T13:00:00.000Z",
      },
    });

    expect(result.executionStatus).toBe("fully_executed");
    expect(result.requiredNextAction).toBe("none");
  });

  it("does not derive fully_executed from current status and document readiness alone", () => {
    const result = deriveLeaseExecution({
      leaseId: "lease-1",
      documentUrl: "https://example.com/lease.pdf",
      startDate: "2026-05-01",
      monthlyRent: 1800,
      status: "current",
      raw: {
        leaseSharedAt: "2026-05-01T10:00:00.000Z",
      },
    });

    expect(result.executionStatus).toBe("draft");
    expect(result.requiredNextAction).toBe("complete_lease_details");
    expect(result.completedAt).toBeNull();
  });

  it("does not derive fully_executed from generic completion timestamps without party signatures", () => {
    const result = deriveLeaseExecution({
      leaseId: "lease-1",
      documentUrl: "https://example.com/lease.pdf",
      startDate: "2026-05-01",
      monthlyRent: 1800,
      status: "active",
      raw: {
        fullySignedAt: "2026-05-09T12:00:00.000Z",
        signatureCompletedAt: "2026-05-09T12:00:00.000Z",
        fullyExecutedAt: "2026-05-09T12:00:00.000Z",
      },
    });

    expect(result.executionStatus).toBe("draft");
    expect(result.tenantSignatureStatus).toBe("blocked");
    expect(result.landlordSignatureStatus).toBe("blocked");
    expect(result.completedAt).toBeNull();
  });

  it("derives fully_executed from provider signing completion state", () => {
    const result = deriveLeaseExecution({
      leaseId: "lease-1",
      documentUrl: "https://example.com/lease.pdf",
      startDate: "2026-05-01",
      monthlyRent: 1800,
      status: "active",
      raw: {
        currentSigningStatus: "signed",
        currentStatusAt: "2026-05-09T12:00:00.000Z",
      },
    });

    expect(result.executionStatus).toBe("fully_executed");
    expect(result.executionLabel).toBe("Lease fully executed");
    expect(result.requiredNextAction).toBe("none");
    expect(result.tenantSignatureStatus).toBe("completed");
    expect(result.landlordSignatureStatus).toBe("completed");
    expect(result.completedAt).toBe("2026-05-09T12:00:00.000Z");
  });

  it("derives ready_for_tenant_signature from provider pending signature state", () => {
    const result = deriveLeaseExecution({
      leaseId: "lease-1",
      documentUrl: "https://example.com/lease.pdf",
      startDate: "2026-05-01",
      monthlyRent: 1800,
      status: "active",
      raw: {
        currentSigningStatus: "pending_signature",
        currentStatusAt: "2026-05-09T12:00:00.000Z",
      },
    });

    expect(result.executionStatus).toBe("ready_for_tenant_signature");
    expect(result.executionLabel).toBe("Waiting for tenant signature");
    expect(result.requiredNextAction).toBe("tenant_signature");
  });
});
