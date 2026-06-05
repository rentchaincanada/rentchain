import { describe, expect, it } from "vitest";
import {
  appendAttestationLinkedAuditEvent,
  appendSignatureGeneratedAuditEvent,
  appendSignatureRequestedAuditEvent,
  appendSignatureVerifiedAuditEvent,
} from "../attestation-service";
import {
  buildAttestationLandlordRef,
  getAttestationEvidenceChain,
  getAttestationHashMetadata,
  verifyAttestationEvidenceChain,
} from "../attestation-hash-retrieval-service";
import type { ExportAuthorizationContext } from "../../types/export-authorization-types";
import type { ExportAuditEventPayload } from "../../types/export-audit-types";
import type { ExportPackage } from "../../types/export-package-types";
import type { ExportAuditTrailFirestoreLike } from "../export-audit-trail-service";
import type { AttestationAccessContext } from "../../types/attestation-api-types";

const landlordId = "landlord-route-1";
const actorRef = "actor:bbbbbbbbbbbbbbbbbbbb";
const evidenceRef = "evidence:eeeeeeeeeeeeeeeeeeee";
const hashValue = "a".repeat(64);

type Filter = { field: string; value: unknown };

function createAuditStore() {
  const events = new Map<string, ExportAuditEventPayload>();

  function getField(event: ExportAuditEventPayload, field: string): unknown {
    if (field === "metadata.details.contentHash") return event.metadata.details.contentHash;
    if (field === "metadata.details.linkedEvidenceRef") return event.metadata.details.linkedEvidenceRef;
    return event[field as keyof ExportAuditEventPayload];
  }

  class Query {
    constructor(private readonly filters: Filter[] = [], private readonly limitCount: number | null = null) {}

    where(field: string, _op: string, value: unknown) {
      return new Query([...this.filters, { field, value }], this.limitCount);
    }

    orderBy() {
      return this;
    }

    limit(limitCount: number) {
      return new Query(this.filters, limitCount);
    }

    async get() {
      return {
        docs: Array.from(events.values())
          .filter((event) => this.filters.every((filter) => getField(event, filter.field) === filter.value))
          .sort((a, b) => a.timestamp.localeCompare(b.timestamp))
          .slice(0, this.limitCount || Number.MAX_SAFE_INTEGER)
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

function context(): ExportAuthorizationContext {
  return {
    requestingActorId: actorRef,
    requestingActorRole: "LandlordAdmin",
    requestingActorScope: landlordId,
    requestingPurpose: "InsuranceClaim",
    timestamp: "2026-06-05T12:00:00.000Z",
    rawIdsIncluded: false,
  };
}

function pkg(): ExportPackage {
  return {
    exportPackageId: "exp_pkg_v1_routehash",
    exportRequestId: "exp_req_v1_routehash",
    landlordId,
    recipientType: "InsuranceAdjuster",
    purpose: "InsuranceClaim",
    packageMetadata: {
      assembledAt: "2026-06-05T12:01:00.000Z",
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
    auditTrailReference: "export_audit:routehash",
    metadata: { metadataOnly: true },
    rawIdsIncluded: false,
    payloadIncluded: false,
  };
}

function landlordAccess(overrides: Partial<AttestationAccessContext> = {}): AttestationAccessContext {
  return {
    role: "landlord",
    subjectRef: actorRef,
    landlordRef: buildAttestationLandlordRef(landlordId),
    allowedEvidenceRefs: [],
    supportPurpose: null,
    rawIdsIncluded: false,
    ...overrides,
  };
}

async function seedAttestation() {
  const audit = createAuditStore();
  const exportPackage = pkg();
  await appendSignatureRequestedAuditEvent(exportPackage, context(), {
    attestationId: "attestation:routehash",
    timestamp: "2026-06-05T12:02:00.000Z",
    firestore: audit.firestore,
  });
  await appendSignatureGeneratedAuditEvent(exportPackage, context(), {
    attestationId: "attestation:routehash",
    signatureId: "signature:routehash",
    certificateId: "certificate:routehash",
    signatureAlgorithm: "RSA-SHA256",
    contentHash: hashValue,
    timestamp: "2026-06-05T12:03:00.000Z",
    firestore: audit.firestore,
  });
  await appendSignatureVerifiedAuditEvent(exportPackage, context(), {
    attestationId: "attestation:routehash",
    signatureId: "signature:routehash",
    certificateId: "certificate:routehash",
    signatureAlgorithm: "RSA-SHA256",
    contentHash: hashValue,
    timestamp: "2026-06-05T12:04:00.000Z",
    firestore: audit.firestore,
  });
  await appendAttestationLinkedAuditEvent(exportPackage, context(), {
    attestationId: "attestation:routehash",
    evidenceReference: evidenceRef,
    timestamp: "2026-06-05T12:05:00.000Z",
    firestore: audit.firestore,
  });
  return audit;
}

describe("attestation hash retrieval service", () => {
  it("returns projection-safe hash metadata for authorized landlord scope", async () => {
    const audit = await seedAttestation();
    const result = await getAttestationHashMetadata(hashValue, landlordAccess(), { firestore: audit.firestore });

    expect(result).toEqual(expect.objectContaining({
      hashValue,
      attestationRef: "attestation:routehash",
      verificationStatus: "verified",
      metadataOnly: true,
      rawIdsIncluded: false,
      payloadIncluded: false,
    }));
    expect(JSON.stringify(result)).not.toContain(landlordId);
    expect(JSON.stringify(result)).not.toContain("exp_pkg_v1_routehash");
  });

  it("returns ordered evidence chain and verification metadata without event document ids", async () => {
    const audit = await seedAttestation();
    const chain = await getAttestationEvidenceChain(evidenceRef, landlordAccess(), { firestore: audit.firestore, limit: 2 });
    const verification = await verifyAttestationEvidenceChain(evidenceRef, landlordAccess(), { firestore: audit.firestore });

    expect(chain?.events.map((event) => event.lifecycleState)).toEqual(["SignatureRequested", "SignatureGenerated"]);
    expect(chain?.pagination).toEqual({ limit: 2, returned: 2, hasMore: true });
    expect(verification).toEqual(expect.objectContaining({
      evidenceRef,
      verified: true,
      matchedHash: hashValue,
      metadataOnly: true,
    }));
    expect(JSON.stringify({ chain, verification })).not.toContain("export_audit:");
  });

  it("fails closed for cross-scope and invalid references", async () => {
    const audit = await seedAttestation();
    await expect(
      getAttestationHashMetadata(hashValue, landlordAccess({ landlordRef: buildAttestationLandlordRef("landlord-other") }), {
        firestore: audit.firestore,
      })
    ).rejects.toThrow("attestation_access_forbidden");
    await expect(getAttestationEvidenceChain("invalid_reference", landlordAccess(), { firestore: audit.firestore })).rejects.toThrow(
      "attestation_evidence_ref_invalid"
    );
  });
});
