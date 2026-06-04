import type { ExportPackage } from "./export-package-types";
import type { ExportProfile } from "./export-profile-types";
import type { ExportRequest } from "./export-request-types";

function assertLandlordScope(entityLandlordId: string, landlordId: string): void {
  if (entityLandlordId !== landlordId) throw new Error("export_projection_landlord_scope_mismatch");
}

export function projectExportProfileForLandlord(profile: ExportProfile, landlordId: string) {
  assertLandlordScope(profile.landlordId, landlordId);
  return {
    exportProfileId: profile.exportProfileId,
    recipientType: profile.recipientType,
    recipientName: profile.recipientName,
    purpose: profile.purpose,
    description: profile.description,
    approvedEvidenceClasses: profile.approvedEvidenceClasses,
    excludedUnitIds: profile.excludedUnitIds,
    dataMinimizationLevel: profile.dataMinimizationLevel,
    retentionPolicyVersion: profile.retentionPolicyVersion,
    createdAt: profile.createdAt,
    isActive: profile.isActive,
    rawIdsIncluded: false as const,
  };
}

export function projectExportProfileForAdmin(profile: ExportProfile) {
  return {
    ...profile,
    rawIdsIncluded: false as const,
    payloadIncluded: false as const,
  };
}

export function projectExportRequestForLandlord(request: ExportRequest, landlordId: string) {
  assertLandlordScope(request.landlordId, landlordId);
  return {
    exportRequestId: request.exportRequestId,
    exportProfileId: request.exportProfileId,
    requestedAt: request.requestedAt,
    requestReason: request.requestReason,
    scopeParameters: request.scopeParameters,
    redactionPolicyOverride: request.redactionPolicyOverride,
    status: request.status,
    authorizationStatus: {
      isAuthorized: request.authorizationStatus.isAuthorized,
      authorizedAt: request.authorizationStatus.authorizedAt || null,
      rawIdsIncluded: false as const,
    },
    rawIdsIncluded: false as const,
  };
}

export function projectExportRequestForAdmin(request: ExportRequest) {
  return {
    ...request,
    rawIdsIncluded: false as const,
    payloadIncluded: false as const,
  };
}

export function projectExportPackageForLandlord(pkg: ExportPackage, landlordId: string) {
  assertLandlordScope(pkg.landlordId, landlordId);
  return {
    exportPackageId: pkg.exportPackageId,
    exportRequestId: pkg.exportRequestId,
    recipientType: pkg.recipientType,
    purpose: pkg.purpose,
    packageMetadata: {
      assembledAt: pkg.packageMetadata.assembledAt,
      assemblyVersion: pkg.packageMetadata.assemblyVersion,
      includedEvidenceCount: pkg.packageMetadata.includedEvidenceCount,
      totalPackageSize: pkg.packageMetadata.totalPackageSize,
      checksumAlgorithm: pkg.packageMetadata.checksumAlgorithm,
    },
    evidenceManifest: pkg.evidenceManifest,
    signatureStatus: {
      isSigned: pkg.signatureMetadata?.isSigned === true,
      signedAt: pkg.signatureMetadata?.signedAt || null,
    },
    deliveryStatus: {
      deliveryMethod: pkg.deliveryMetadata?.deliveryMethod || null,
      deliveredAt: pkg.deliveryMetadata?.deliveredAt || null,
    },
    status: pkg.status,
    rawIdsIncluded: false as const,
  };
}

export function projectExportPackageForAdmin(pkg: ExportPackage) {
  return {
    ...pkg,
    rawIdsIncluded: false as const,
    payloadIncluded: false as const,
  };
}
