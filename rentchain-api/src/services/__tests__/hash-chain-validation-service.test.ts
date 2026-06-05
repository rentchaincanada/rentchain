import { describe, expect, it } from "vitest";

import {
  buildHashChainFromAttestation,
  validateHashChainIntegrity,
  verifyEvidenceHashAgainstChain,
} from "../hash-chain-validation-service";
import type { AttestationChain } from "../../types/attestation-types";

const hash = "a".repeat(64);
const otherHash = "b".repeat(64);

function chain(overrides: Partial<AttestationChain> = {}): AttestationChain {
  return {
    attestationRef: "attestation:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    landlordRef: "landlord:bbbbbbbbbbbbbbbbbbbb",
    exportPackageRef: "exportpackage:cccccccccccccccccccc",
    events: [
      {
        eventId: "event:requested",
        eventType: "ExportPackageSignatureRequested",
        lifecycleState: "SignatureRequested",
        timestamp: "2026-06-05T14:01:00.000Z",
        attestationRef: "attestation:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        signatureRef: null,
        certificateRef: null,
        signatureAlgorithm: null,
        contentHash: null,
        evidenceRef: null,
        eventSummary: "requested",
        metadataOnly: true,
        immutable: true,
        rawIdsIncluded: false,
        payloadIncluded: false,
      },
      {
        eventId: "event:generated",
        eventType: "ExportPackageSignatureGenerated",
        lifecycleState: "SignatureGenerated",
        timestamp: "2026-06-05T14:02:00.000Z",
        attestationRef: "attestation:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        signatureRef: "signature:dddddddddddddddddddddddddddddddd",
        certificateRef: "certificate:eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
        signatureAlgorithm: "RSA-SHA256",
        contentHash: hash,
        evidenceRef: null,
        eventSummary: "generated",
        metadataOnly: true,
        immutable: true,
        rawIdsIncluded: false,
        payloadIncluded: false,
      },
      {
        eventId: "event:verified",
        eventType: "ExportPackageSignatureVerified",
        lifecycleState: "SignatureVerified",
        timestamp: "2026-06-05T14:03:00.000Z",
        attestationRef: "attestation:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        signatureRef: "signature:dddddddddddddddddddddddddddddddd",
        certificateRef: "certificate:eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
        signatureAlgorithm: "RSA-SHA256",
        contentHash: hash,
        evidenceRef: null,
        eventSummary: "verified",
        metadataOnly: true,
        immutable: true,
        rawIdsIncluded: false,
        payloadIncluded: false,
      },
    ],
    currentState: "SignatureVerified",
    metadataOnly: true,
    appendOnly: true,
    immutable: true,
    rawIdsIncluded: false,
    payloadIncluded: false,
    ...overrides,
  };
}

describe("hash chain validation service", () => {
  it("reconstructs hash chain state from attestation events", () => {
    const hashChain = buildHashChainFromAttestation(chain());

    expect(hashChain.generatedHash).toBe(hash);
    expect(hashChain.verifiedHash).toBe(hash);
    expect(validateHashChainIntegrity(hashChain)).toEqual({
      success: true,
      errorCount: 0,
      errors: [],
      metadataOnly: true,
      rawIdsIncluded: false,
      payloadIncluded: false,
    });
  });

  it("verifies matching evidence hashes against the chain", () => {
    expect(verifyEvidenceHashAgainstChain(hash, chain())).toMatchObject({
      success: true,
      matchedHash: hash,
      errors: [],
      rawIdsIncluded: false,
      payloadIncluded: false,
    });
  });

  it("fails closed for mismatched hashes and missing lifecycle steps", () => {
    expect(verifyEvidenceHashAgainstChain(otherHash, chain()).errors).toContain("verification_hash_mismatch");
    expect(
      validateHashChainIntegrity(
        buildHashChainFromAttestation({
          ...chain(),
          events: chain().events.filter((event) => event.lifecycleState !== "SignatureVerified"),
        })
      ).errors
    ).toContain("hash_chain_signature_verified_missing");
  });

  it("rejects invalid hash formats and generated/verified mismatch", () => {
    const invalid = chain({
      events: chain().events.map((event) =>
        event.lifecycleState === "SignatureVerified" ? { ...event, contentHash: otherHash } : event
      ),
    });
    expect(validateHashChainIntegrity(buildHashChainFromAttestation(invalid)).errors).toContain(
      "hash_chain_generated_verified_mismatch"
    );
    expect(verifyEvidenceHashAgainstChain("bad-hash", chain()).errors).toContain("verification_hash_invalid");
  });
});
