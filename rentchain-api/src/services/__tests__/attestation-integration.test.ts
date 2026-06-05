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
import { registerCertificateReference } from "../attestation-certificate-manager";
import {
  buildEvidenceAttestationMap,
  linkEvidenceToAttestation,
} from "../evidence-attestation-linker";
import { createExportPackageEntity, createExportProfileEntity, createExportRequestEntity } from "../export-service";
import type { ExportAuthorizationContext } from "../../types/export-authorization-types";
import type { ExportAuditEventPayload } from "../../types/export-audit-types";
import type { ExportAuditTrailFirestoreLike } from "../export-audit-trail-service";

const landlordRef = "landlord:aaaaaaaaaaaaaaaaaaaa";
const actorRef = "actor:bbbbbbbbbbbbbbbbbbbb";
const timestamp = "2026-06-05T13:00:00.000Z";

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

function context(): ExportAuthorizationContext {
  return {
    requestingActorId: actorRef,
    requestingActorRole: "LandlordAdmin",
    requestingActorScope: landlordRef,
    requestingPurpose: "InsuranceClaim",
    timestamp,
    rawIdsIncluded: false,
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
      requestedAt: "2026-06-05T13:01:00.000Z",
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
    assembledAt: "2026-06-05T13:02:00.000Z",
    assembledBy: actorRef,
    evidenceClasses: ["PaymentEvidence"],
    redactionPolicyApplied: "Redacted",
    includedEvidenceCount: 1,
  });
}

describe("attestation integration", () => {
  it("connects certificate metadata, audit events, links, and projections", async () => {
    const audit = createAuditStore();
    const pkg = exportPackage();
    const certificate = registerCertificateReference({
      issuer: "RentChain signing profile",
      algorithm: "RSA-SHA256",
      validFrom: "2026-06-01T00:00:00.000Z",
      validTo: "2027-06-01T00:00:00.000Z",
    });

    await appendSignatureRequestedAuditEvent(pkg, context(), {
      attestationId: "attestation:integrated",
      timestamp: "2026-06-05T13:03:00.000Z",
      firestore: audit.firestore,
    });
    await appendSignatureGeneratedAuditEvent(pkg, context(), {
      attestationId: "attestation:integrated",
      signatureId: "signature:integrated",
      certificateId: certificate.certificateRef,
      signatureAlgorithm: certificate.algorithm,
      timestamp: "2026-06-05T13:04:00.000Z",
      firestore: audit.firestore,
    });
    await appendSignatureVerifiedAuditEvent(pkg, context(), {
      attestationId: "attestation:integrated",
      signatureId: "signature:integrated",
      certificateId: certificate.certificateRef,
      signatureAlgorithm: certificate.algorithm,
      timestamp: "2026-06-05T13:05:00.000Z",
      firestore: audit.firestore,
    });
    await appendAttestationLinkedAuditEvent(pkg, context(), {
      attestationId: "attestation:integrated",
      evidenceReference: "evidence:eeeeeeeeeeeeeeeeeeee",
      timestamp: "2026-06-05T13:06:00.000Z",
      firestore: audit.firestore,
    });

    const chain = await buildAttestationChain({
      landlordId: landlordRef,
      exportPackageId: pkg.exportPackageId,
      attestationId: "attestation:integrated",
      firestore: audit.firestore,
    });
    const link = linkEvidenceToAttestation({
      landlordId: landlordRef,
      attestationId: chain.attestationRef,
      evidenceRef: "evidence:eeeeeeeeeeeeeeeeeeee",
      exportPackageId: pkg.exportPackageId,
    });
    const mapped = buildEvidenceAttestationMap(landlordRef, pkg.exportPackageId, [link], chain.events);
    const projection = projectAttestationForLandlord(landlordRef, chain);

    expect(verifyAttestationChainIntegrity(chain)).toEqual({ valid: true, errors: [] });
    expect(mapped.get(link.evidenceRef)?.map((event) => event.lifecycleState)).toEqual([
      "SignatureRequested",
      "SignatureGenerated",
      "SignatureVerified",
      "AttestationLinked",
    ]);
    expect(projection.currentState).toBe("AttestationLinked");
    expect(projection.rawIdsIncluded).toBe(false);
    expect(JSON.stringify({ events: audit.list(), projection, mapped: Array.from(mapped.entries()) })).not.toContain(
      "certificate-content"
    );
  });
});
