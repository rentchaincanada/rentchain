import { describe, expect, it } from "vitest";

import {
  appendAttestationLinkedAuditEvent,
  appendSignatureGeneratedAuditEvent,
  appendSignatureRequestedAuditEvent,
  appendSignatureVerifiedAuditEvent,
  buildAttestationChain,
  projectAttestationForLandlord,
  verifyAttestationChainIntegrity,
} from "../attestation-service";
import type { ExportAuthorizationContext } from "../../types/export-authorization-types";
import type { ExportAuditEventPayload } from "../../types/export-audit-types";
import type { ExportPackage } from "../../types/export-package-types";
import { createExportPackageEntity, createExportProfileEntity, createExportRequestEntity } from "../export-service";
import type { ExportAuditTrailFirestoreLike } from "../export-audit-trail-service";

const landlordRef = "landlord:aaaaaaaaaaaaaaaaaaaa";
const otherLandlordRef = "landlord:ffffffffffffffffffff";
const actorRef = "actor:bbbbbbbbbbbbbbbbbbbb";
const timestamp = "2026-06-05T12:00:00.000Z";

type Filter = { field: string; op: string; value: unknown };

function createAuditStore() {
  const events = new Map<string, ExportAuditEventPayload>();

  class Query {
    constructor(private readonly filters: Filter[] = []) {}

    where(field: string, op: string, value: unknown) {
      return new Query([...this.filters, { field, op, value }]);
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
          .filter((event) =>
            this.filters.every((filter) => {
              const value = event[filter.field as keyof ExportAuditEventPayload];
              return filter.op === "==" ? value === filter.value : true;
            })
          )
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

function context(overrides: Partial<ExportAuthorizationContext> = {}): ExportAuthorizationContext {
  return {
    requestingActorId: actorRef,
    requestingActorRole: "LandlordAdmin",
    requestingActorScope: landlordRef,
    requestingPurpose: "InsuranceClaim",
    timestamp,
    rawIdsIncluded: false,
    ...overrides,
  };
}

function pkg(): ExportPackage {
  const auth = context();
  const profile = createExportProfileEntity(
    {
      landlordId: landlordRef,
      recipientType: "InsuranceAdjuster",
      recipientName: "Acme Insurance Adjusters LLC",
      recipientReference: "acme-insurance-adjusters",
      purpose: "InsuranceClaim",
      description: "Insurance claim review.",
      approvedEvidenceClasses: ["PaymentEvidence"],
      dataMinimizationLevel: "Redacted",
      createdReason: "Insurance claim package review.",
    },
    auth
  );
  const request = createExportRequestEntity(
    {
      profile,
      requestedAt: "2026-06-05T12:01:00.000Z",
      requestedBy: actorRef,
      requestReason: "Claim settlement review.",
      scopeParameters: { evidenceClassFilters: ["PaymentEvidence"] },
    },
    auth
  );
  return createExportPackageEntity({
    request,
    recipientType: profile.recipientType,
    purpose: profile.purpose,
    assembledAt: "2026-06-05T12:02:00.000Z",
    assembledBy: actorRef,
    evidenceClasses: ["PaymentEvidence"],
    redactionPolicyApplied: "Redacted",
    includedEvidenceCount: 1,
  });
}

describe("attestation service", () => {
  it("appends signature and attestation audit events as metadata-only canonical events", async () => {
    const audit = createAuditStore();
    const exportPackage = pkg();

    await appendSignatureRequestedAuditEvent(exportPackage, context(), {
      attestationId: "attestation:claim-package",
      timestamp: "2026-06-05T12:03:00.000Z",
      firestore: audit.firestore,
    });
    await appendSignatureGeneratedAuditEvent(exportPackage, context(), {
      attestationId: "attestation:claim-package",
      signatureId: "signature:claim-package",
      certificateId: "certificate:claim-package",
      signatureAlgorithm: "RSA-SHA256",
      timestamp: "2026-06-05T12:04:00.000Z",
      firestore: audit.firestore,
    });
    await appendSignatureVerifiedAuditEvent(exportPackage, context(), {
      attestationId: "attestation:claim-package",
      signatureId: "signature:claim-package",
      certificateId: "certificate:claim-package",
      signatureAlgorithm: "RSA-SHA256",
      timestamp: "2026-06-05T12:05:00.000Z",
      firestore: audit.firestore,
    });
    await appendAttestationLinkedAuditEvent(exportPackage, context(), {
      attestationId: "attestation:claim-package",
      evidenceReference: "evidence:eeeeeeeeeeeeeeeeeeee",
      timestamp: "2026-06-05T12:06:00.000Z",
      firestore: audit.firestore,
    });

    expect(audit.list().map((event) => event.eventType)).toEqual([
      "ExportPackageSignatureRequested",
      "ExportPackageSignatureGenerated",
      "ExportPackageSignatureVerified",
      "ExportPackageAttestationLinked",
    ]);
    expect(audit.list()).toEqual([
      expect.objectContaining({ metadataOnly: true, appendOnly: true, immutable: true, rawIdsIncluded: false, payloadIncluded: false }),
      expect.objectContaining({ metadataOnly: true, appendOnly: true, immutable: true, rawIdsIncluded: false, payloadIncluded: false }),
      expect.objectContaining({ metadataOnly: true, appendOnly: true, immutable: true, rawIdsIncluded: false, payloadIncluded: false }),
      expect.objectContaining({ metadataOnly: true, appendOnly: true, immutable: true, rawIdsIncluded: false, payloadIncluded: false }),
    ]);
    expect(JSON.stringify(audit.list())).not.toContain(exportPackage.exportPackageId);
    expect(JSON.stringify(audit.list())).not.toContain("certificate-content");
  });

  it("keeps append failures non-blocking", async () => {
    const failingStore: ExportAuditTrailFirestoreLike = {
      collection() {
        return {
          doc() {
            return {
              async create() {
                throw new Error("write_failed");
              },
            };
          },
        };
      },
    };

    await expect(
      appendSignatureRequestedAuditEvent(pkg(), context(), {
        attestationId: "attestation:non-blocking",
        firestore: failingStore,
      })
    ).resolves.toBeNull();
  });

  it("builds and verifies attestation chains from canonical events", async () => {
    const audit = createAuditStore();
    const exportPackage = pkg();
    await appendSignatureRequestedAuditEvent(exportPackage, context(), {
      attestationId: "attestation:chain",
      timestamp: "2026-06-05T12:03:00.000Z",
      firestore: audit.firestore,
    });
    await appendSignatureGeneratedAuditEvent(exportPackage, context(), {
      attestationId: "attestation:chain",
      signatureId: "signature:chain",
      certificateId: "certificate:chain",
      signatureAlgorithm: "ECDSA-SHA256",
      timestamp: "2026-06-05T12:04:00.000Z",
      firestore: audit.firestore,
    });
    await appendSignatureVerifiedAuditEvent(exportPackage, context(), {
      attestationId: "attestation:chain",
      signatureId: "signature:chain",
      certificateId: "certificate:chain",
      signatureAlgorithm: "ECDSA-SHA256",
      timestamp: "2026-06-05T12:05:00.000Z",
      firestore: audit.firestore,
    });

    const chain = await buildAttestationChain({
      landlordId: landlordRef,
      exportPackageId: exportPackage.exportPackageId,
      attestationId: "attestation:chain",
      firestore: audit.firestore,
    });
    const projection = projectAttestationForLandlord(landlordRef, chain);

    expect(verifyAttestationChainIntegrity(chain)).toEqual({ valid: true, errors: [] });
    expect(projection.currentState).toBe("SignatureVerified");
    expect(projection.events[1].signatureAlgorithm).toBe("ECDSA-SHA256");
    expect(JSON.stringify(projection)).not.toContain(landlordRef);
    expect(() => projectAttestationForLandlord(otherLandlordRef, chain)).toThrow("attestation_projection_landlord_scope_mismatch");
  });

  it("rejects chain gaps and state regressions", async () => {
    const audit = createAuditStore();
    const exportPackage = pkg();
    await appendSignatureVerifiedAuditEvent(exportPackage, context(), {
      attestationId: "attestation:gap",
      signatureId: "signature:gap",
      certificateId: "certificate:gap",
      signatureAlgorithm: "RSA-SHA256",
      timestamp: "2026-06-05T12:05:00.000Z",
      firestore: audit.firestore,
    });
    const chain = await buildAttestationChain({
      landlordId: landlordRef,
      exportPackageId: exportPackage.exportPackageId,
      attestationId: "attestation:gap",
      firestore: audit.firestore,
    });

    expect(verifyAttestationChainIntegrity(chain)).toEqual({
      valid: false,
      errors: ["attestation_chain_missing_signature_generation"],
    });
  });
});
