import { describe, expect, it } from "vitest";

import { computeEvidencePackageHash, computeEvidenceRecordHash } from "../../lib/evidence-hash-service";
import {
  buildAttestationChain,
  recordGeneratedSignature,
  recordVerifiedSignature,
  requestSignatureForPackage,
} from "../attestation-service";
import { buildEvidenceAttestationMap, linkEvidenceToAttestation } from "../evidence-attestation-linker";
import { verifyEvidenceHashAgainstChain } from "../hash-chain-validation-service";
import { createExportPackageEntity, createExportProfileEntity, createExportRequestEntity } from "../export-service";
import type { ExportAuthorizationContext } from "../../types/export-authorization-types";
import type { ExportAuditEventPayload } from "../../types/export-audit-types";
import type { ExportAuditTrailFirestoreLike } from "../export-audit-trail-service";
import { evidenceRecordFixtures } from "../../__tests__/fixtures/evidence-record-fixtures";

const landlordRef = "landlord:aaaaaaaaaaaaaaaaaaaa";
const otherLandlordRef = "landlord:ffffffffffffffffffff";
const actorRef = "actor:bbbbbbbbbbbbbbbbbbbb";
const timestamp = "2026-06-05T15:00:00.000Z";

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

function exportPackage() {
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
      requestedAt: "2026-06-05T15:01:00.000Z",
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
    assembledAt: "2026-06-05T15:02:00.000Z",
    assembledBy: actorRef,
    evidenceClasses: ["PaymentEvidence"],
    redactionPolicyApplied: "Redacted",
    includedEvidenceCount: 1,
  });
}

describe("evidence package hash integration", () => {
  it("runs request, generated, and verified signature workflow through canonical events", async () => {
    const audit = createAuditStore();
    const pkg = exportPackage();
    const before = JSON.stringify(pkg);
    const recordBefore = JSON.stringify(evidenceRecordFixtures.paymentEvidence);
    const packageHash = computeEvidencePackageHash(pkg);
    const evidenceHash = computeEvidenceRecordHash(evidenceRecordFixtures.paymentEvidence);

    await requestSignatureForPackage(pkg, context(), {
      attestationId: "attestation:package-hash",
      timestamp: "2026-06-05T15:03:00.000Z",
      firestore: audit.firestore,
    });
    await recordGeneratedSignature(pkg, packageHash, "RSA-SHA256", "certificate:package-hash", context(), {
      attestationId: "attestation:package-hash",
      timestamp: "2026-06-05T15:04:00.000Z",
      firestore: audit.firestore,
    });
    const verified = await recordVerifiedSignature(pkg, packageHash, "attestation:package-hash", context(), {
      timestamp: "2026-06-05T15:05:00.000Z",
      firestore: audit.firestore,
      evidenceReference: `evidence:${evidenceHash.slice(0, 20)}`,
    });
    const chain = await buildAttestationChain({
      landlordId: landlordRef,
      exportPackageId: pkg.exportPackageId,
      attestationId: "attestation:package-hash",
      firestore: audit.firestore,
    });
    const link = linkEvidenceToAttestation({
      landlordId: landlordRef,
      attestationId: chain.attestationRef,
      evidenceRef: `evidence:${evidenceHash.slice(0, 20)}`,
      exportPackageId: pkg.exportPackageId,
    });
    const mapped = buildEvidenceAttestationMap(landlordRef, pkg.exportPackageId, [link], chain.events);

    expect(verified.success).toBe(true);
    expect(verifyEvidenceHashAgainstChain(packageHash, chain).success).toBe(true);
    expect(audit.list().map((event) => event.eventType)).toEqual([
      "ExportPackageSignatureRequested",
      "ExportPackageSignatureGenerated",
      "ExportPackageSignatureVerified",
    ]);
    expect(mapped.get(link.evidenceRef)?.map((event) => event.lifecycleState)).toEqual([
      "SignatureRequested",
      "SignatureGenerated",
      "SignatureVerified",
    ]);
    expect(JSON.stringify(pkg)).toBe(before);
    expect(JSON.stringify(evidenceRecordFixtures.paymentEvidence)).toBe(recordBefore);
  });

  it("rejects cross-landlord verification attempts", async () => {
    const audit = createAuditStore();
    const pkg = exportPackage();
    const packageHash = computeEvidencePackageHash(pkg);
    await requestSignatureForPackage(pkg, context(), {
      attestationId: "attestation:scope",
      firestore: audit.firestore,
    });
    await recordGeneratedSignature(pkg, packageHash, "RSA-SHA256", "certificate:scope", context(), {
      attestationId: "attestation:scope",
      firestore: audit.firestore,
    });

    await expect(
      recordVerifiedSignature(pkg, packageHash, "attestation:scope", context({ requestingActorScope: otherLandlordRef }), {
        firestore: audit.firestore,
      })
    ).rejects.toThrow("attestation_landlord_scope_mismatch");
  });

  it("keeps request append non-blocking when audit storage fails", async () => {
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

    await expect(requestSignatureForPackage(exportPackage(), context(), { firestore: failingStore })).resolves.toBeNull();
  });
});
