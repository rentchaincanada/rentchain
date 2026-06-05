import { describe, expect, it } from "vitest";

import {
  getCertificateReference,
  projectCertificateMetadata,
  registerCertificateReference,
  validateCertificateAlgorithm,
  validateCertificateValidity,
} from "../attestation-certificate-manager";

describe("attestation certificate manager", () => {
  it("generates deterministic safe certificate references", () => {
    const input = {
      issuer: "RentChain signing profile",
      algorithm: "RSA-SHA256" as const,
      validFrom: "2026-06-01T00:00:00.000Z",
      validTo: "2027-06-01T00:00:00.000Z",
      registeredAt: "2026-06-05T12:00:00.000Z",
    };
    const first = registerCertificateReference(input);
    const second = registerCertificateReference(input);

    expect(first).toEqual(second);
    expect(first.certificateRef).toMatch(/^certificate:[a-f0-9]{32}$/);
    expect(JSON.stringify(first)).not.toContain(input.issuer);
    expect(first.rawCertificateIncluded).toBe(false);
    expect(first.keyMaterialIncluded).toBe(false);
  });

  it("accepts only supported algorithms", () => {
    expect(validateCertificateAlgorithm("RSA-SHA256")).toBe(true);
    expect(validateCertificateAlgorithm("ECDSA-SHA256")).toBe(true);
    expect(validateCertificateAlgorithm("SHA1")).toBe(false);
    expect(() =>
      registerCertificateReference({
        issuer: "Deprecated issuer",
        algorithm: "SHA1" as never,
        validFrom: "2026-06-01T00:00:00.000Z",
        validTo: "2027-06-01T00:00:00.000Z",
      })
    ).toThrow("certificate_algorithm_unsupported");
  });

  it("projects certificate metadata without certificate content or key material", () => {
    const certificate = registerCertificateReference({
      issuer: "RentChain signing profile",
      algorithm: "ECDSA-SHA256",
      validFrom: "2026-06-01T00:00:00.000Z",
      validTo: "2027-06-01T00:00:00.000Z",
    });
    const projected = projectCertificateMetadata(certificate);

    expect(getCertificateReference(certificate.certificateRef, [certificate])).toEqual(certificate);
    expect(validateCertificateValidity(certificate.certificateRef, "2026-07-01T00:00:00.000Z", [certificate])).toBe(true);
    expect(validateCertificateValidity(certificate.certificateRef, "2028-07-01T00:00:00.000Z", [certificate])).toBe(false);
    expect(projected.rawCertificateIncluded).toBe(false);
    expect(projected.keyMaterialIncluded).toBe(false);
    expect(JSON.stringify(projected)).not.toContain("certificate-content");
  });
});
