import crypto from "crypto";

import { EVIDENCE_CLASSES, type EvidenceClass } from "../types/evidence-record-types";

export type EvidenceIdentifierMetadataValue = string | number | boolean | null;

export type EvidenceIdentifierMetadata = Record<string, EvidenceIdentifierMetadataValue>;

export type ParsedEvidenceId = {
  valid: boolean;
  version: "v1";
  evidenceType: string;
  sourceHash: string;
  governanceHash: string;
};

const EVIDENCE_ID_PREFIX = "evr";
const EVIDENCE_ID_VERSION = "v1";
const HASH_LENGTH = 20;
const EVIDENCE_ID_PATTERN = /^evr_v1_([a-z0-9][a-z0-9-]{1,48})_([a-f0-9]{20})_([a-f0-9]{20})$/;

function stableStringify(value: EvidenceIdentifierMetadata): string {
  const sorted: EvidenceIdentifierMetadata = {};
  for (const key of Object.keys(value).sort()) {
    sorted[key] = value[key];
  }
  return JSON.stringify(sorted);
}

function hash(value: unknown): string {
  return crypto.createHash("sha256").update(JSON.stringify(value ?? null)).digest("hex").slice(0, HASH_LENGTH);
}

export function normalizeEvidenceType(evidenceType: string): string {
  const normalized = evidenceType
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return normalized || "unknown-evidence";
}

export function isSupportedEvidenceClass(evidenceType: string): evidenceType is EvidenceClass {
  return EVIDENCE_CLASSES.includes(evidenceType as EvidenceClass);
}

export function generateEvidenceId(
  evidenceType: string,
  sourceId: string,
  metadata: EvidenceIdentifierMetadata,
): string {
  const normalizedType = normalizeEvidenceType(evidenceType);
  const sourceHash = hash([normalizedType, sourceId]);
  const governanceHash = hash([normalizedType, stableStringify(metadata)]);
  return `${EVIDENCE_ID_PREFIX}_${EVIDENCE_ID_VERSION}_${normalizedType}_${sourceHash}_${governanceHash}`;
}

export function validateEvidenceId(evidenceId: string): boolean {
  return EVIDENCE_ID_PATTERN.test(evidenceId);
}

export function parseEvidenceId(evidenceId: string): ParsedEvidenceId {
  const match = EVIDENCE_ID_PATTERN.exec(evidenceId);
  if (!match) {
    return {
      valid: false,
      version: EVIDENCE_ID_VERSION,
      evidenceType: "",
      sourceHash: "",
      governanceHash: "",
    };
  }
  return {
    valid: true,
    version: EVIDENCE_ID_VERSION,
    evidenceType: match[1],
    sourceHash: match[2],
    governanceHash: match[3],
  };
}
