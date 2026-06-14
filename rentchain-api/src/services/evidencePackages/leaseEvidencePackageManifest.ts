import crypto from "crypto";
import type {
  LeaseEvidencePackage,
  LeaseEvidencePackageManifest,
  LeaseEvidencePackageSectionSourceCount,
  LeaseEvidencePackageSourceManifest,
  LeaseEvidencePackageVerificationMetadata,
} from "./leaseEvidencePackageTypes";

export const LEASE_EVIDENCE_PACKAGE_MANIFEST_VERSION = "lease_evidence_manifest_v1";
export const LEASE_EVIDENCE_PACKAGE_VERSION = "lease-evidence-package-pdf-v1";
export const LEASE_EVIDENCE_PACKAGE_HASH_ALGORITHM = "sha256";

function sortedUnique(values: unknown[]): string[] {
  return Array.from(
    new Set(
      values
        .map((value) => String(value ?? "").trim())
        .filter(Boolean)
    )
  ).sort((a, b) => a.localeCompare(b));
}

function sortedRecord(record: Record<string, number>): Record<string, number> {
  return Object.fromEntries(Object.entries(record).sort(([left], [right]) => left.localeCompare(right)));
}

export function canonicalizeJson(value: unknown): string {
  if (value == null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((entry) => canonicalizeJson(entry)).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, entry]) => entry !== undefined)
    .sort(([left], [right]) => left.localeCompare(right));
  return `{${entries.map(([key, entry]) => `${JSON.stringify(key)}:${canonicalizeJson(entry)}`).join(",")}}`;
}

function sourceManifestForPackage(pkg: LeaseEvidencePackage): LeaseEvidencePackageSourceManifest {
  const sourceCollections = sortedUnique(pkg.governance.sourceReferences.map((ref) => ref.sourceCollection));
  const sourceCountsByCollection: Record<string, number> = {};
  for (const ref of pkg.governance.sourceReferences) {
    const collection = String(ref.sourceCollection || "").trim();
    if (!collection) continue;
    sourceCountsByCollection[collection] = (sourceCountsByCollection[collection] || 0) + 1;
  }
  const sectionSourceCounts: LeaseEvidencePackageSectionSourceCount[] = pkg.sections
    .map((section) => ({
      sectionKey: section.key,
      itemCount: section.items.length,
      sourceCollections: sortedUnique(section.items.map((item) => item.sourceCollection)),
    }))
    .sort((left, right) => left.sectionKey.localeCompare(right.sectionKey));

  return {
    totalSourceReferences: pkg.governance.sourceReferences.length,
    sourceCollections,
    sourceCountsByCollection: sortedRecord(sourceCountsByCollection),
    sectionSourceCounts,
  };
}

export function buildLeaseEvidencePackageManifest(pkg: LeaseEvidencePackage): LeaseEvidencePackageManifest {
  return {
    manifestVersion: LEASE_EVIDENCE_PACKAGE_MANIFEST_VERSION,
    packageVersion: LEASE_EVIDENCE_PACKAGE_VERSION,
    evidencePackageId: pkg.governance.evidencePackageId,
    leaseId: pkg.governance.leaseId,
    landlordId: pkg.governance.landlordId,
    packageType: pkg.governance.packageType,
    generatedAt: pkg.governance.generatedAt,
    generatedBy: {
      actorType: "landlord",
      actorId: pkg.governance.generatedBy,
    },
    sectionsIncluded: [...pkg.governance.sectionsIncluded].sort((left, right) => left.localeCompare(right)),
    sourceManifest: sourceManifestForPackage(pkg),
  };
}

export function hashLeaseEvidencePackageManifest(manifest: LeaseEvidencePackageManifest): string {
  return crypto.createHash(LEASE_EVIDENCE_PACKAGE_HASH_ALGORITHM).update(canonicalizeJson(manifest)).digest("hex");
}

export function buildLeaseEvidencePackageVerificationMetadata(pkg: LeaseEvidencePackage): LeaseEvidencePackageVerificationMetadata {
  const manifest = buildLeaseEvidencePackageManifest(pkg);
  return {
    manifestVersion: manifest.manifestVersion,
    hashAlgorithm: LEASE_EVIDENCE_PACKAGE_HASH_ALGORITHM,
    manifestHash: hashLeaseEvidencePackageManifest(manifest),
    packageVersion: manifest.packageVersion,
    evidencePackageId: manifest.evidencePackageId,
    generatedAt: manifest.generatedAt,
    sourceReferenceCount: manifest.sourceManifest.totalSourceReferences,
    sourceCollections: manifest.sourceManifest.sourceCollections,
    sectionSourceCounts: manifest.sourceManifest.sectionSourceCounts,
  };
}
