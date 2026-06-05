import { describe, expect, it } from "vitest";

import {
  ATTESTATION_LIFECYCLE_STATES,
  SIGNATURE_ALGORITHMS,
  type AttestationChain,
  type CertificateReference,
  type SignatureMetadata,
} from "../attestation-types";

describe("attestation types", () => {
  it("defines constrained signature algorithms and lifecycle states", () => {
    expect(SIGNATURE_ALGORITHMS).toEqual(["RSA-SHA256", "ECDSA-SHA256"]);
    expect(ATTESTATION_LIFECYCLE_STATES).toEqual([
      "SignatureRequested",
      "SignatureGenerated",
      "SignatureVerified",
      "AttestationLinked",
      "AttestationRevoked",
    ]);
  });

  it("keeps certificate and signature contracts metadata-only", () => {
    const certificate: CertificateReference = {
      certificateRef: "certificate:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      issuerRef: "issuer:bbbbbbbbbbbbbbbbbbbb",
      algorithm: "RSA-SHA256",
      validFrom: "2026-06-01T00:00:00.000Z",
      validTo: "2027-06-01T00:00:00.000Z",
      registeredAt: "2026-06-05T00:00:00.000Z",
      metadataOnly: true,
      rawCertificateIncluded: false,
      keyMaterialIncluded: false,
      rawIdsIncluded: false,
      payloadIncluded: false,
    };
    const signature: SignatureMetadata = {
      signatureRef: "signature:cccccccccccccccccccc",
      signatureAlgorithm: "ECDSA-SHA256",
      certificateRef: certificate.certificateRef,
      contentHash: "a".repeat(64),
      signedAt: "2026-06-05T00:01:00.000Z",
      verifiedAt: null,
      signerRef: "signer:dddddddddddddddddddd",
      metadataOnly: true,
      rawSignatureIncluded: false,
      rawCertificateIncluded: false,
      keyMaterialIncluded: false,
      rawIdsIncluded: false,
      payloadIncluded: false,
    };

    expect(certificate.rawCertificateIncluded).toBe(false);
    expect(certificate.keyMaterialIncluded).toBe(false);
    expect(signature.rawSignatureIncluded).toBe(false);
    expect(JSON.stringify({ certificate, signature })).not.toContain("certificate-content");
  });

  it("models attestation chains as immutable append-only safe projections", () => {
    const chain: AttestationChain = {
      attestationRef: "attestation:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      landlordRef: "landlord:bbbbbbbbbbbbbbbbbbbb",
      exportPackageRef: "exportpackage:cccccccccccccccccccc",
      events: [],
      currentState: null,
      metadataOnly: true,
      appendOnly: true,
      immutable: true,
      rawIdsIncluded: false,
      payloadIncluded: false,
    };

    expect(chain).toMatchObject({
      metadataOnly: true,
      appendOnly: true,
      immutable: true,
      rawIdsIncluded: false,
      payloadIncluded: false,
    });
  });
});
