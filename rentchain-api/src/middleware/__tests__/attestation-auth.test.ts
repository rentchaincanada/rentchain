import { describe, expect, it } from "vitest";
import { buildAttestationAccessContext } from "../attestationAuth";
import { buildAttestationLandlordRef } from "../../services/attestation-hash-retrieval-service";

describe("attestation access context", () => {
  it("builds landlord context from authenticated user scope", () => {
    const context = buildAttestationAccessContext({
      id: "landlord-1",
      role: "landlord",
      landlordId: "landlord-1",
    });

    expect(context).toEqual(expect.objectContaining({
      role: "landlord",
      landlordRef: buildAttestationLandlordRef("landlord-1"),
      rawIdsIncluded: false,
    }));
    expect(context?.subjectRef).toMatch(/^actor:/);
  });

  it("limits tenant context to explicit safe evidence references", () => {
    const context = buildAttestationAccessContext({
      id: "tenant-1",
      role: "tenant",
      tenantEvidenceRefs: ["evidence:eeeeeeeeeeeeeeeeeeee", "invalid_reference"],
    });

    expect(context).toEqual(expect.objectContaining({
      role: "tenant",
      landlordRef: null,
      allowedEvidenceRefs: ["evidence:eeeeeeeeeeeeeeeeeeee"],
      rawIdsIncluded: false,
    }));
  });

  it("rejects unsupported roles", () => {
    expect(buildAttestationAccessContext({ id: "viewer-1", role: "viewer" })).toBeNull();
  });
});
