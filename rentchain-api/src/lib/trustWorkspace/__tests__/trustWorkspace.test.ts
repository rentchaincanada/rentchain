import { describe, expect, it } from "vitest";
import type { EvidenceRecord } from "../../../types/evidence-record-types";
import type { ExportAuthorizationContext } from "../../../types/export-authorization-types";
import type { ExportAuditEventPayload } from "../../../types/export-audit-types";
import type { ExportPackage } from "../../../types/export-package-types";
import type { PortableAttestation } from "../../portableAttestations/portableAttestationTypes";
import type { ExportAuditTrailFirestoreLike } from "../../../services/export-audit-trail-service";
import { generateExportAuditSafeReference } from "../../../services/export-audit-trail-service";
import {
  appendAttestationLinkedAuditEvent,
  appendSignatureGeneratedAuditEvent,
  appendSignatureRequestedAuditEvent,
  appendSignatureVerifiedAuditEvent,
} from "../../../services/attestation-service";
import {
  assembleTrustWorkspaceSummary,
  buildTrustWorkspaceContext,
  deriveCrossOrgContext,
  deriveExportReadinessSummary,
} from "../deriveTrustWorkspace";
import {
  projectTrustWorkspaceForAdmin,
  projectTrustWorkspaceForLandlord,
  projectTrustWorkspaceForTenant,
} from "../trustWorkspaceProjections";

const landlordId = "landlord-workspace-1";
const tenantId = "tenant-workspace-1";
const actorRef = "actor:bbbbbbbbbbbbbbbbbbbb";
const evidenceRef = "evidence:eeeeeeeeeeeeeeeeeeee";
const hashValue = "c".repeat(64);
const timestamp = "2026-06-05T12:00:00.000Z";

type Filter = { field: string; value: unknown };

function auditStore() {
  const events = new Map<string, ExportAuditEventPayload>();

  function getField(event: ExportAuditEventPayload, field: string) {
    if (field === "metadata.details.contentHash") return event.metadata.details.contentHash;
    if (field === "metadata.details.linkedEvidenceRef") return event.metadata.details.linkedEvidenceRef;
    return event[field as keyof ExportAuditEventPayload];
  }

  class Query {
    constructor(private readonly filters: Filter[] = []) {}

    where(field: string, _op: string, value: unknown) {
      return new Query([...this.filters, { field, value }]);
    }

    orderBy() {
      return this;
    }

    limit() {
      return this;
    }

    async get() {
      return {
        docs: Array.from(events.values())
          .filter((event) => this.filters.every((filter) => getField(event, filter.field) === filter.value))
          .sort((a, b) => a.timestamp.localeCompare(b.timestamp))
          .map((event) => ({ data: () => event })),
      };
    }
  }

  const firestore: ExportAuditTrailFirestoreLike = {
    collection() {
      const query = new Query();
      return {
        doc(id: string) {
          return {
            async get() {
              const event = events.get(id);
              return { exists: Boolean(event), data: () => event };
            },
            async create(data: ExportAuditEventPayload) {
              if (events.has(id)) throw new Error("already_exists");
              events.set(id, data);
            },
            async set(data: ExportAuditEventPayload) {
              events.set(id, data);
            },
          };
        },
        where: query.where.bind(query),
        orderBy: query.orderBy.bind(query),
        limit: query.limit.bind(query),
        get: query.get.bind(query),
      };
    },
  };

  return { firestore, list: () => Array.from(events.values()) };
}

function authContext(): ExportAuthorizationContext {
  return {
    requestingActorId: actorRef,
    requestingActorRole: "LandlordAdmin",
    requestingActorScope: landlordId,
    requestingPurpose: "InsuranceClaim",
    timestamp,
    rawIdsIncluded: false,
  };
}

function exportPackage(): ExportPackage {
  return {
    exportPackageId: "exp_pkg_v1_workspace",
    exportRequestId: "exp_req_v1_workspace",
    landlordId,
    recipientType: "InsuranceAdjuster",
    purpose: "InsuranceClaim",
    packageMetadata: {
      assembledAt: timestamp,
      assembledBy: actorRef,
      assemblyVersion: "evidence_package_builder_v1",
      includedEvidenceCount: 1,
      totalPackageSize: 1,
      checksumAlgorithm: "sha256",
      checksumValue: hashValue,
    },
    evidenceManifest: {
      evidenceClasses: ["PaymentEvidence"],
      dateRangeApplied: { start: null, end: null },
      unitsScopeApplied: [],
      redactionPolicyApplied: "Redacted",
      excludedEvidence: [],
    },
    status: "Assembled",
    auditTrailReference: "export_audit:workspace",
    metadata: { metadataOnly: true },
    rawIdsIncluded: false,
    payloadIncluded: false,
  };
}

function evidenceRecord(overrides: Partial<EvidenceRecord> = {}): EvidenceRecord {
  const landlordRef = generateExportAuditSafeReference("landlord", landlordId);
  const tenantRef = generateExportAuditSafeReference("tenant", tenantId);
  return {
    evidenceId: "ev-workspace-1",
    evidenceClass: "PaymentEvidence",
    evidenceType: "rent_payment_metadata",
    schemaVersion: "evidence_record_v1",
    landlordId,
    resourceType: "payment",
    resourceId: "payment-workspace-1",
    safeReference: {
      evidenceId: "ev-workspace-1",
      evidenceClass: "PaymentEvidence",
      resourceType: "payment",
      safeReferenceKey: evidenceRef,
      label: "Payment evidence",
      rawIdsIncluded: false,
      payloadIncluded: false,
    },
    provenanceMetadata: {
      createdAt: timestamp,
      createdBy: { actorRole: "landlord", actorRef, rawActorIdsIncluded: false },
      authority: { authorityRole: "landlord", landlordRef, tenantRef, supportAllowed: true, rawIdsIncluded: false },
      source: {
        sourceCollection: "payments",
        sourceReferenceKey: "payment:aaaaaaaaaaaaaaaaaaaa",
        sourceObservedAt: timestamp,
        sourceVersion: "v1",
        rawSourceIdsIncluded: false,
        rawPayloadIncluded: false,
      },
      reason: "Workspace trust chain test.",
      provenanceChain: [{
        evidenceId: "ev-source",
        evidenceClass: "AuditEvidence",
        resourceType: "canonicalEvent",
        safeReferenceKey: "evidence:dddddddddddddddddddd",
        label: "Source event",
        rawIdsIncluded: false,
        payloadIncluded: false,
      }],
      metadataOnly: true,
    },
    sensitivityMetadata: {
      sensitivityClass: "Operational",
      projectionCategories: ["landlord_operational", "admin_support", "institutional_export"],
      redactionPolicy: "metadata_only",
      excludedFieldGroups: [],
      allowedFieldGroups: ["metadata"],
      containsRestrictedProviderData: false,
      containsRawPaymentData: false,
      containsMessageBody: false,
      containsIdentityDocument: false,
      rawIdsIncluded: false,
      payloadIncluded: false,
    },
    retentionMetadata: {
      retentionPolicy: "evidence_retention_policy_v1",
      retentionReviewRequired: false,
      archiveAfter: null,
      deleteAfter: null,
      appliedRetentionPolicyRule: null,
      evaluatedAt: timestamp,
      eligibleForArchivalAt: null,
      eligibleForDeletionAt: null,
      legalHoldStatus: "none",
      lifecycleEvents: [],
    },
    status: "active",
    createdAt: timestamp,
    supersedesEvidenceId: null,
    supersededByEvidenceId: null,
    immutable: true,
    appendOnly: true,
    metadataOnly: true,
    rawIdsIncluded: false,
    redactionSummary: "Metadata-only payment evidence.",
    ...overrides,
  };
}

function portableAttestation(): PortableAttestation {
  return {
    attestationId: "attestation:portable-workspace",
    attestationType: "tenant_portability",
    subjectType: "tenant",
    subjectId: "tenant:aaaaaaaaaaaaaaaaaaaa",
    claimCategory: "tenant_portability",
    claimLabel: "Tenant portability metadata",
    claimDescription: "Tenant portability claim.",
    status: "active",
    lifecycleState: "export_ready",
    issuerCategory: "rentchain",
    audience: "insurer",
    consentScope: {
      consentId: "consent:aaaaaaaaaaaaaaaaaaaa",
      purpose: "insurance_review",
      audience: "insurer",
      grantedAt: timestamp,
      expiresAt: null,
      revokedAt: null,
      claimCategories: ["tenant_portability"],
      attributeScopes: ["metadata"],
    },
    retentionClass: "portable_metadata",
    evidenceSummary: {
      evidenceCategory: "metadata_only",
      sourceSystem: "tenant_share_package",
      sourceCategory: "tenant_portability",
      sourceVersion: "v1",
      auditEventRef: "audit:aaaaaaaaaaaaaaaaaaaa",
      rawEvidenceIncluded: false,
    },
    sourceReference: {
      sourceSystem: "tenant_share_package",
      sourceId: "tenant_share:aaaaaaaaaaaaaaaaaaaa",
      sourceAttestationId: null,
      sourceVersion: "v1",
    },
    confidence: "high",
    issuedAt: timestamp,
    effectiveAt: timestamp,
    expiresAt: null,
    revokedAt: null,
    supersededAt: null,
    nextReverificationAt: null,
    jurisdiction: "CA",
    redactionProfile: "strict",
    metadataOnly: true,
    rawSensitivePayloadStored: false,
    rawProviderPayloadIncluded: false,
    supportMetadataIncluded: false,
    publicAccessEnabled: false,
    externalSubmissionEnabled: false,
    unsupportedClaim: false,
    supportVisible: true,
    reviewRequired: false,
    nonAuthorityDisclaimers: [],
    internalReferenceId: null,
    providerReferenceId: null,
  };
}

async function seedAttestation() {
  const store = auditStore();
  await appendSignatureRequestedAuditEvent(exportPackage(), authContext(), {
    attestationId: "attestation:workspace",
    timestamp: "2026-06-05T12:01:00.000Z",
    firestore: store.firestore,
  });
  await appendSignatureGeneratedAuditEvent(exportPackage(), authContext(), {
    attestationId: "attestation:workspace",
    signatureId: "signature:workspace",
    certificateId: "certificate:workspace",
    signatureAlgorithm: "RSA-SHA256",
    contentHash: hashValue,
    timestamp: "2026-06-05T12:02:00.000Z",
    firestore: store.firestore,
  });
  await appendSignatureVerifiedAuditEvent(exportPackage(), authContext(), {
    attestationId: "attestation:workspace",
    signatureId: "signature:workspace",
    certificateId: "certificate:workspace",
    signatureAlgorithm: "RSA-SHA256",
    contentHash: hashValue,
    timestamp: "2026-06-05T12:03:00.000Z",
    firestore: store.firestore,
  });
  await appendAttestationLinkedAuditEvent(exportPackage(), authContext(), {
    attestationId: "attestation:workspace",
    evidenceReference: evidenceRef,
    timestamp: "2026-06-05T12:04:00.000Z",
    firestore: store.firestore,
  });
  return store;
}

describe("trust workspace derivation", () => {
  it("assembles landlord workspace with evidence, attestation, export, and cross-org context", async () => {
    const store = await seedAttestation();
    const context = buildTrustWorkspaceContext({
      context: {
        role: "landlord",
        requesterRef: actorRef,
        landlordRef: generateExportAuditSafeReference("landlord", landlordId),
        tenantRef: null,
        allowedEvidenceRefs: [],
        supportPurpose: null,
        rawIdsIncluded: false,
      },
      derivedAt: timestamp,
    });

    const summary = await assembleTrustWorkspaceSummary({
      context,
      evidenceRecords: [evidenceRecord()],
      auditEvents: store.list(),
      portableAttestations: [portableAttestation()],
      exportReadinessRequests: [{ audience: "insurer", purpose: "insurance_review" }],
      crossOrgInput: {
        relationshipType: "evidence_trust",
        evidencePacks: [{ evidencePackId: "pack-1", status: "ready_for_review" }],
        consentRecords: [{ consentId: "consent-1" }],
      },
      derivedAt: timestamp,
    });

    expect(summary.evidenceSummaries).toHaveLength(1);
    expect(summary.attestationContexts[0]).toEqual(expect.objectContaining({
      attestationRef: "attestation:workspace",
      hashVerificationStatus: "verified",
      rawIdsIncluded: false,
      payloadIncluded: false,
    }));
    expect(summary.exportReadinessStates[0]).toEqual(expect.objectContaining({
      policyGateStatus: "ready",
      exportableAttestationCount: 1,
    }));
    expect(summary.crossOrgContexts[0].evidenceTrustState).toBe("verified");
    expect(JSON.stringify(summary)).not.toContain(landlordId);
  });

  it("projects landlord and tenant workspaces with role-safe visibility", async () => {
    const store = await seedAttestation();
    const landlordContext = {
      role: "landlord" as const,
      requesterRef: actorRef,
      landlordRef: generateExportAuditSafeReference("landlord", landlordId),
      tenantRef: null,
      allowedEvidenceRefs: [],
      supportPurpose: null,
      rawIdsIncluded: false as const,
    };
    const summary = await assembleTrustWorkspaceSummary({
      context: landlordContext,
      evidenceRecords: [evidenceRecord()],
      auditEvents: store.list(),
      exportReadinessRequests: [{ audience: "insurer", purpose: "insurance_review" }],
      crossOrgInput: { relationshipType: "evidence_trust", consentRecords: [{ consentId: "consent-1" }] },
      derivedAt: timestamp,
    });
    const landlord = projectTrustWorkspaceForLandlord(summary, landlordContext);
    const tenant = projectTrustWorkspaceForTenant(
      { ...summary, role: "tenant" },
      {
        role: "tenant",
        requesterRef: "actor:tenanttenanttenant",
        landlordRef: null,
        tenantRef: generateExportAuditSafeReference("tenant", tenantId),
        allowedEvidenceRefs: [evidenceRef],
        supportPurpose: null,
        rawIdsIncluded: false,
      }
    );

    expect(landlord.evidenceSummaries[0].authority.tenantRef).toBeNull();
    expect(tenant.attestationContexts).toEqual([]);
    expect(tenant.exportReadinessStates).toEqual([]);
    expect(tenant.crossOrgContexts).toEqual([]);
    expect(tenant.evidenceSummaries[0].contentHash).toBeNull();
  });

  it("allows admin metadata projection while preserving safety flags", async () => {
    const summary = await assembleTrustWorkspaceSummary({
      context: {
        role: "admin",
        requesterRef: "actor:adminadminadmin",
        landlordRef: null,
        tenantRef: null,
        allowedEvidenceRefs: [],
        supportPurpose: "trust_workspace_admin_review",
        rawIdsIncluded: false,
      },
      evidenceRecords: [evidenceRecord()],
      derivedAt: timestamp,
    });
    const projected = projectTrustWorkspaceForAdmin(summary, {
      role: "admin",
      requesterRef: "actor:adminadminadmin",
      landlordRef: null,
      tenantRef: null,
      allowedEvidenceRefs: [],
      supportPurpose: "trust_workspace_admin_review",
      rawIdsIncluded: false,
    });

    expect(projected.metadataOnly).toBe(true);
    expect(projected.rawIdsIncluded).toBe(false);
    expect(projected.payloadIncluded).toBe(false);
  });

  it("fails closed on missing tenant evidence scope", async () => {
    await expect(
      assembleTrustWorkspaceSummary({
        context: {
          role: "tenant",
          requesterRef: "actor:tenanttenanttenant",
          landlordRef: null,
          tenantRef: generateExportAuditSafeReference("tenant", tenantId),
          allowedEvidenceRefs: [],
          supportPurpose: null,
          rawIdsIncluded: false,
        },
        evidenceRecords: [evidenceRecord()],
      })
    ).rejects.toThrow("trust_workspace_missing_tenant_scope");
  });

  it("derives export readiness and cross-org summaries without exposing source values", () => {
    const readiness = deriveExportReadinessSummary({
      audience: "insurer",
      purpose: "insurance_review",
      attestations: [portableAttestation()],
      derivedAt: timestamp,
    });
    const crossOrg = deriveCrossOrgContext(generateExportAuditSafeReference("landlord", landlordId), {
      relationshipType: "sharing_trust",
      consentRecords: [],
      sharingRooms: [{ sharingRoomId: "share-1", publiclyAccessible: true, externalExecutionEnabled: false, status: "active" }],
    }, timestamp);

    expect(readiness.policyGateStatus).toBe("ready");
    expect(crossOrg[0]).toEqual(expect.objectContaining({
      status: "blocked",
      manualReviewRequired: true,
      publicTrustExposureEnabled: false,
    }));
    expect(JSON.stringify({ readiness, crossOrg })).not.toContain("share-1");
  });
});
