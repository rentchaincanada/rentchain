import { describe, expect, it } from "vitest";

import {
  buildEvidenceAttestationMap,
  linkEvidencePackageToAttestation,
  linkEvidenceToAttestation,
  queryEvidenceAttestations,
} from "../evidence-attestation-linker";
import type { AttestationChainEvent } from "../../types/attestation-types";

const landlordRef = "landlord:aaaaaaaaaaaaaaaaaaaa";
const otherLandlordRef = "landlord:ffffffffffffffffffff";
const packageRef = "exp_pkg_v1_cccccccccccccccccccc_dddddddddddddddddddd";

function event(attestationRef: string): AttestationChainEvent {
  return {
    eventId: "export_audit:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    eventType: "ExportPackageSignatureVerified",
    lifecycleState: "SignatureVerified",
    timestamp: "2026-06-05T12:00:00.000Z",
    attestationRef: attestationRef as AttestationChainEvent["attestationRef"],
    signatureRef: "signature:bbbbbbbbbbbbbbbbbbbb",
    certificateRef: "certificate:cccccccccccccccccccccccccccccccc",
    signatureAlgorithm: "RSA-SHA256",
    contentHash: "a".repeat(64),
    evidenceRef: null,
    eventSummary: "Export package signature metadata verified.",
    metadataOnly: true,
    immutable: true,
    rawIdsIncluded: false,
    payloadIncluded: false,
  };
}

describe("evidence attestation linker", () => {
  it("creates immutable metadata-only links without exposing package input values", () => {
    const link = linkEvidencePackageToAttestation({
      landlordId: landlordRef,
      attestationId: "attestation:test",
      evidencePackageId: packageRef,
      linkedAt: "2026-06-05T12:00:00.000Z",
    });

    expect(link).toMatchObject({
      linkStatus: "linked",
      metadataOnly: true,
      immutable: true,
      rawIdsIncluded: false,
      payloadIncluded: false,
    });
    expect(JSON.stringify(link)).not.toContain(packageRef);
    expect(JSON.stringify(link)).not.toContain(landlordRef);
  });

  it("filters queried links by landlord and package scope", () => {
    const scoped = linkEvidencePackageToAttestation({
      landlordId: landlordRef,
      attestationId: "attestation:scoped",
      evidencePackageId: packageRef,
    });
    const other = linkEvidencePackageToAttestation({
      landlordId: otherLandlordRef,
      attestationId: "attestation:other",
      evidencePackageId: packageRef,
    });

    expect(queryEvidenceAttestations(landlordRef, packageRef, [scoped, other])).toEqual([scoped]);
  });

  it("builds evidence-to-attestation maps from safe references", () => {
    const link = linkEvidenceToAttestation({
      landlordId: landlordRef,
      attestationId: "attestation:scoped",
      evidenceRef: "evidence:eeeeeeeeeeeeeeeeeeee",
      exportPackageId: packageRef,
    });
    const mapped = buildEvidenceAttestationMap(landlordRef, packageRef, [link], [event(link.attestationRef)]);

    expect(Array.from(mapped.keys())).toEqual([link.evidenceRef]);
    expect(mapped.get(link.evidenceRef)?.[0]).toMatchObject({
      attestationRef: link.attestationRef,
      rawIdsIncluded: false,
      payloadIncluded: false,
    });
  });
});
