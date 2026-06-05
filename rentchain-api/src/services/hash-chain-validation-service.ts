import type { AttestationChain, AttestationChainEvent } from "../types/attestation-types";
import { isSha256Hash } from "../lib/evidence-hash-service";

export type HashChainEntry = {
  eventId: string;
  lifecycleState: AttestationChainEvent["lifecycleState"];
  timestamp: string;
  contentHash: string | null;
  signatureRef: string | null;
  rawIdsIncluded: false;
  payloadIncluded: false;
};

export type HashChain = {
  attestationRef: string;
  exportPackageRef: string;
  entries: HashChainEntry[];
  generatedHash: string | null;
  verifiedHash: string | null;
  metadataOnly: true;
  rawIdsIncluded: false;
  payloadIncluded: false;
};

export type VerificationResult = {
  success: boolean;
  matchedHash: string | null;
  attestationRef: string;
  chainEventReferences: string[];
  errors: string[];
  metadataOnly: true;
  rawIdsIncluded: false;
  payloadIncluded: false;
};

export type ValidationResult = {
  success: boolean;
  errorCount: number;
  errors: string[];
  metadataOnly: true;
  rawIdsIncluded: false;
  payloadIncluded: false;
};

export function buildHashChainFromAttestation(chain: AttestationChain): HashChain {
  const entries = chain.events
    .filter((event) => event.lifecycleState === "SignatureGenerated" || event.lifecycleState === "SignatureVerified")
    .map((event) => ({
      eventId: event.eventId,
      lifecycleState: event.lifecycleState,
      timestamp: event.timestamp,
      contentHash: event.contentHash,
      signatureRef: event.signatureRef,
      rawIdsIncluded: false as const,
      payloadIncluded: false as const,
    }));
  return {
    attestationRef: chain.attestationRef,
    exportPackageRef: chain.exportPackageRef,
    entries,
    generatedHash: entries.find((entry) => entry.lifecycleState === "SignatureGenerated")?.contentHash || null,
    verifiedHash: entries.find((entry) => entry.lifecycleState === "SignatureVerified")?.contentHash || null,
    metadataOnly: true,
    rawIdsIncluded: false,
    payloadIncluded: false,
  };
}

export function validateHashChainIntegrity(chain: HashChain): ValidationResult {
  const errors: string[] = [];
  if (chain.rawIdsIncluded !== false || chain.payloadIncluded !== false) errors.push("hash_chain_raw_or_payload_included");
  if (!chain.entries.length) errors.push("hash_chain_empty");
  let previousTime = 0;
  const generated = chain.entries.filter((entry) => entry.lifecycleState === "SignatureGenerated");
  const verified = chain.entries.filter((entry) => entry.lifecycleState === "SignatureVerified");
  if (!generated.length) errors.push("hash_chain_signature_generated_missing");
  if (!verified.length) errors.push("hash_chain_signature_verified_missing");
  for (const entry of chain.entries) {
    const parsed = Date.parse(entry.timestamp);
    if (!Number.isFinite(parsed)) errors.push("hash_chain_timestamp_invalid");
    if (parsed < previousTime) errors.push("hash_chain_timestamp_out_of_order");
    previousTime = parsed;
    if (!entry.contentHash || !isSha256Hash(entry.contentHash)) errors.push("hash_chain_content_hash_invalid");
    if (entry.rawIdsIncluded !== false || entry.payloadIncluded !== false) errors.push("hash_chain_entry_raw_or_payload_included");
  }
  if (chain.generatedHash && chain.verifiedHash && chain.generatedHash !== chain.verifiedHash) {
    errors.push("hash_chain_generated_verified_mismatch");
  }
  return {
    success: errors.length === 0,
    errorCount: errors.length,
    errors,
    metadataOnly: true,
    rawIdsIncluded: false,
    payloadIncluded: false,
  };
}

export function verifyEvidenceHashAgainstChain(hash: string, chain: AttestationChain): VerificationResult {
  const errors: string[] = [];
  if (!isSha256Hash(hash)) errors.push("verification_hash_invalid");
  if (chain.rawIdsIncluded !== false || chain.payloadIncluded !== false) errors.push("attestation_chain_raw_or_payload_included");
  if (!chain.events.length) errors.push("attestation_chain_empty");
  const states = chain.events.map((event) => event.lifecycleState);
  if (states.includes("SignatureGenerated") && !states.includes("SignatureRequested")) errors.push("attestation_chain_missing_signature_request");
  if (states.includes("SignatureVerified") && !states.includes("SignatureGenerated")) errors.push("attestation_chain_missing_signature_generation");
  const hashChain = buildHashChainFromAttestation(chain);
  const chainIntegrity = validateHashChainIntegrity(hashChain);
  if (!chainIntegrity.success) errors.push(...chainIntegrity.errors);
  if (hashChain.generatedHash && hashChain.generatedHash !== hash) errors.push("verification_hash_mismatch");
  return {
    success: errors.length === 0,
    matchedHash: errors.length === 0 ? hash : null,
    attestationRef: chain.attestationRef,
    chainEventReferences: hashChain.entries.map((entry) => entry.eventId),
    errors,
    metadataOnly: true,
    rawIdsIncluded: false,
    payloadIncluded: false,
  };
}
