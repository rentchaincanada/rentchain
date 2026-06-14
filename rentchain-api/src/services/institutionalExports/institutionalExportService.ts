import crypto from "crypto";
import {
  buildLeaseEvidencePackageVerificationMetadata,
  LEASE_EVIDENCE_PACKAGE_VERSION,
} from "../evidencePackages/leaseEvidencePackageManifest";
import { renderLeaseEvidencePackagePdf } from "../evidencePackages/leaseEvidencePackagePdf";
import { generateLeaseEvidencePackage } from "../evidencePackages/leaseEvidencePackageService";
import type {
  InstitutionalExportReason,
  InstitutionalExportRequest,
  InstitutionalLeaseEvidencePdfExport,
} from "./institutionalExportTypes";

export const INSTITUTIONAL_EXPORT_VERSION = "institutional-export-framework-v1";

const EXPORT_REASONS = new Set<InstitutionalExportReason>([
  "tribunal",
  "court",
  "insurance",
  "lender",
  "internal_review",
  "other",
]);

function asString(value: unknown, max = 500): string {
  return String(value ?? "").trim().slice(0, max);
}

function stableHash(parts: unknown[], length = 24): string {
  return crypto
    .createHash("sha256")
    .update(parts.map((part) => String(part ?? "")).join("|"))
    .digest("hex")
    .slice(0, length);
}

export function parseInstitutionalExportRequest(body: any): InstitutionalExportRequest {
  const exportFormat = asString(body?.exportFormat, 24);
  if (exportFormat !== "pdf") {
    throw Object.assign(new Error("UNSUPPORTED_EXPORT_FORMAT"), { status: 400 });
  }

  const exportScope = asString(body?.exportScope, 80);
  if (exportScope !== "lease_evidence_package") {
    throw Object.assign(new Error("UNSUPPORTED_EXPORT_SCOPE"), { status: 400 });
  }

  const resourceType = asString(body?.resourceType, 80);
  if (resourceType !== "lease") {
    throw Object.assign(new Error("UNSUPPORTED_EXPORT_RESOURCE"), { status: 400 });
  }

  const exportReason = asString(body?.exportReason, 80) as InstitutionalExportReason;
  if (!EXPORT_REASONS.has(exportReason)) {
    throw Object.assign(new Error("INVALID_EXPORT_REASON"), { status: 400 });
  }

  const leaseId = asString(body?.leaseId, 240);
  if (!leaseId) {
    throw Object.assign(new Error("LEASE_ID_REQUIRED"), { status: 400 });
  }

  return {
    exportFormat,
    exportReason,
    exportScope,
    resourceType,
    leaseId,
  };
}

export async function generateLeaseEvidenceInstitutionalExport(input: {
  request: InstitutionalExportRequest;
  landlordId: string;
  generatedBy: string;
}): Promise<InstitutionalLeaseEvidencePdfExport> {
  const generatedAt = new Date().toISOString();
  const pkg = await generateLeaseEvidencePackage({
    leaseId: input.request.leaseId,
    landlordId: input.landlordId,
    generatedBy: input.generatedBy,
    generatedAt,
  });
  pkg.governance.verification = buildLeaseEvidencePackageVerificationMetadata(pkg);
  const pdf = await renderLeaseEvidencePackagePdf(pkg);
  const verification = pkg.governance.verification;
  const exportId = `instexp_${stableHash([
    input.landlordId,
    input.request.leaseId,
    input.request.exportReason,
    generatedAt,
    verification.manifestHash,
  ])}`;

  return {
    pdf,
    filenamePrefix: "rentchain-institutional-lease-evidence-export",
    metadata: {
      exportId,
      exportType: "institutional_export",
      exportFormat: "pdf",
      exportReason: input.request.exportReason,
      exportScope: "lease_evidence_package",
      generatedBy: input.generatedBy,
      generatedAt,
      resourceType: "lease",
      resourceId: input.request.leaseId,
      leaseId: input.request.leaseId,
      sensitivity: "confidential",
      retentionCategory: "export_metadata",
      exportVersion: INSTITUTIONAL_EXPORT_VERSION,
      evidencePackageId: verification.evidencePackageId,
      manifestHash: verification.manifestHash,
      manifestVersion: verification.manifestVersion,
      packageVersion: LEASE_EVIDENCE_PACKAGE_VERSION,
    },
  };
}
