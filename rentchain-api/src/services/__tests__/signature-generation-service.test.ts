import { describe, expect, it } from "vitest";

import {
  generateSignature,
  generateSignatureReference,
  validateSignatureAlgorithm,
} from "../signature-generation-service";
import type { ExportAuthorizationContext } from "../../types/export-authorization-types";

const hash = "a".repeat(64);
const landlordRef = "landlord:aaaaaaaaaaaaaaaaaaaa";
const actorRef = "actor:bbbbbbbbbbbbbbbbbbbb";

function context(overrides: Partial<ExportAuthorizationContext> = {}): ExportAuthorizationContext {
  return {
    requestingActorId: actorRef,
    requestingActorRole: "LandlordAdmin",
    requestingActorScope: landlordRef,
    requestingPurpose: "InsuranceClaim",
    timestamp: "2026-06-05T14:00:00.000Z",
    rawIdsIncluded: false,
    ...overrides,
  };
}

describe("signature generation service", () => {
  it("generates deterministic signature references from hash and algorithm", () => {
    expect(generateSignatureReference(hash, "RSA-SHA256")).toBe(generateSignatureReference(hash, "RSA-SHA256"));
    expect(generateSignatureReference(hash, "RSA-SHA256")).toMatch(/^signature:[a-f0-9]{32}$/);
    expect(generateSignatureReference(hash, "RSA-SHA256")).not.toBe(generateSignatureReference(hash, "ECDSA-SHA256"));
  });

  it("returns metadata-only signature records", () => {
    const signature = generateSignature(hash, "ECDSA-SHA256", context(), {
      certificateRef: "certificate:cccccccccccccccccccccccccccccccc",
    });

    expect(signature).toMatchObject({
      signatureAlgorithm: "ECDSA-SHA256",
      certificateRef: "certificate:cccccccccccccccccccccccccccccccc",
      contentHash: hash,
      metadataOnly: true,
      rawSignatureIncluded: false,
      rawCertificateIncluded: false,
      keyMaterialIncluded: false,
      rawIdsIncluded: false,
      payloadIncluded: false,
    });
    expect(JSON.stringify(signature)).not.toContain(actorRef);
  });

  it("rejects unsupported algorithms and invalid hashes", () => {
    expect(validateSignatureAlgorithm("RSA-SHA256")).toBe(true);
    expect(validateSignatureAlgorithm("SHA1")).toBe(false);
    expect(() => generateSignatureReference("not-a-hash", "RSA-SHA256")).toThrow("signature_hash_invalid");
    expect(() => generateSignature(hash, "SHA1" as never, context())).toThrow("signature_algorithm_unsupported");
  });

  it("rejects invalid signing context", () => {
    expect(() => generateSignature(hash, "RSA-SHA256", context({ rawIdsIncluded: true as false }))).toThrow(
      "signature_context_invalid"
    );
    expect(() => generateSignature(hash, "RSA-SHA256", context({ requestingActorId: "" }))).toThrow(
      "signature_actor_required"
    );
    expect(() => generateSignature(hash, "RSA-SHA256", context({ requestingActorScope: "" }))).toThrow(
      "signature_landlord_scope_required"
    );
  });
});
