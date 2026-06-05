import { describe, expect, it } from "vitest";

import {
  buildEvidencePackage,
  type EvidenceRecordFirestoreLike,
  type ExportAssemblyContext,
} from "../evidence-package-builder-service";
import {
  appendExportRequestAuthorizationAuditEvent,
  getAuditTrailForPackage,
  getAuditTrailForRequest,
  type ExportAuditTrailFirestoreLike,
} from "../export-audit-trail-service";
import {
  createExportProfileEntity,
  createExportRequestEntity,
} from "../../services/export-service";
import {
  validateExportRequestAuthorization,
  type ExportAuthorizationContext,
} from "../../types/export-authorization-types";
import { EVIDENCE_RECORD_COLLECTION, type EvidenceRecord } from "../../types/evidence-record-types";
import type { ExportAuditEventPayload } from "../../types/export-audit-types";
import { evidenceRecordFixtures } from "../../__tests__/fixtures/evidence-record-fixtures";

const landlordRef = "landlord:aaaaaaaaaaaaaaaaaaaa";
const otherLandlordRef = "landlord:ffffffffffffffffffff";
const actorRef = "actor:bbbbbbbbbbbbbbbbbbbb";
const timestamp = "2026-06-04T17:00:00.000Z";

type Filter = { field: string; op: string; value: unknown };

class EvidenceQuery {
  constructor(private readonly data: EvidenceRecord[], private readonly filters: Filter[] = []) {}

  where(field: string, op: string, value: unknown) {
    return new EvidenceQuery(this.data, [...this.filters, { field, op, value }]);
  }

  orderBy() {
    return this;
  }

  limit() {
    return this;
  }

  async get() {
    const docs = this.data
      .filter((record) =>
        this.filters.every((filter) => {
          const value = record[filter.field as keyof EvidenceRecord];
          if (filter.op === "==") return value === filter.value;
          if (filter.op === ">=") return String(value) >= String(filter.value);
          if (filter.op === "<=") return String(value) <= String(filter.value);
          return true;
        })
      )
      .map((record) => ({ data: () => record }));
    return { docs };
  }
}

function evidenceFirestore(records: EvidenceRecord[]): EvidenceRecordFirestoreLike {
  return {
    collection(name: string) {
      if (name !== EVIDENCE_RECORD_COLLECTION) throw new Error("unexpected_collection");
      return new EvidenceQuery(records) as unknown as ReturnType<EvidenceRecordFirestoreLike["collection"]>;
    },
  };
}

function createAuditStore() {
  const events = new Map<string, ExportAuditEventPayload>();

  class AuditQuery {
    constructor(private readonly filters: Filter[] = []) {}

    where(field: string, op: string, value: unknown) {
      return new AuditQuery([...this.filters, { field, op, value }]);
    }

    orderBy() {
      return this;
    }

    limit() {
      return this;
    }

    async get() {
      const docs = Array.from(events.values())
        .filter((event) =>
          this.filters.every((filter) => {
            const value = event[filter.field as keyof ExportAuditEventPayload];
            return filter.op === "==" ? value === filter.value : true;
          })
        )
        .map((event) => ({ data: () => event }));
      return { docs };
    }
  }

  const firestore: ExportAuditTrailFirestoreLike = {
    collection() {
      const query = new AuditQuery();
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

function authorizationContext(overrides: Partial<ExportAuthorizationContext> = {}): ExportAuthorizationContext {
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

function record(base: EvidenceRecord, overrides: Partial<EvidenceRecord> = {}): EvidenceRecord {
  return {
    ...base,
    landlordId: landlordRef,
    ...overrides,
  };
}

function evidenceRecords() {
  return [
    record(evidenceRecordFixtures.paymentEvidence),
    record(evidenceRecordFixtures.maintenanceEvidence),
  ];
}

function entities() {
  const context = authorizationContext();
  const profile = createExportProfileEntity(
    {
      landlordId: landlordRef,
      recipientType: "InsuranceAdjuster",
      recipientName: "Acme Insurance Adjusters LLC",
      recipientReference: "acme-insurance-adjusters",
      purpose: "InsuranceClaim",
      description: "Insurance claim review.",
      approvedEvidenceClasses: ["PaymentEvidence", "MaintenanceEvidence"],
      dataMinimizationLevel: "Redacted",
      createdReason: "Insurance claim package review.",
    },
    context
  );
  const request = createExportRequestEntity(
    {
      profile,
      requestedAt: "2026-06-04T17:05:00.000Z",
      requestedBy: actorRef,
      requestReason: "Claim settlement review.",
      scopeParameters: {
        evidenceClassFilters: ["PaymentEvidence", "MaintenanceEvidence"],
      },
      redactionPolicyOverride: {
        dataMinimizationLevel: "RedactedSensitive",
        reason: "Tighten external projection.",
      },
    },
    context
  );
  return { context, profile, request };
}

describe("export audit trail integration", () => {
  it("emits package assembly audit event from the evidence package builder", async () => {
    const { profile, request } = entities();
    const audit = createAuditStore();
    const assemblyContext: ExportAssemblyContext = {
      timestamp: "2026-06-04T17:15:00.000Z",
      actorId: actorRef,
      actorRole: "LandlordAdmin",
      landlordId: landlordRef,
      purpose: "InsuranceClaim",
      firestore: evidenceFirestore(evidenceRecords()),
      auditTrailFirestore: audit.firestore,
      rawIdsIncluded: false,
    };

    const pkg = await buildEvidencePackage(request, profile, assemblyContext);
    const events = audit.list();
    const trail = await getAuditTrailForPackage(landlordRef, pkg.exportPackageId, { firestore: audit.firestore });

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      eventType: "ExportPackageAssembled",
      sourceCollection: "canonicalEvents",
      metadataOnly: true,
      appendOnly: true,
      immutable: true,
      rawIdsIncluded: false,
      payloadIncluded: false,
    });
    expect(events[0].metadata.details.evidenceCount).toBe(2);
    expect(trail).toEqual([
      expect.objectContaining({
        eventType: "ExportPackageAssembled",
        targetType: "ExportPackage",
        rawIdsIncluded: false,
        payloadIncluded: false,
      }),
    ]);
    expect(JSON.stringify(events)).not.toContain(pkg.exportPackageId);
    expect(JSON.stringify(events)).not.toMatch(/token|secret|credential|provider payload|gs:\/\//i);
  });

  it("emits authorization approved and denied audit events with safe request projections", async () => {
    const { context, profile, request } = entities();
    const audit = createAuditStore();
    const approved = validateExportRequestAuthorization(request, profile, context);
    const deniedContext = authorizationContext({ requestingActorScope: otherLandlordRef });
    const denied = validateExportRequestAuthorization(request, profile, deniedContext);

    await appendExportRequestAuthorizationAuditEvent(request, approved, context, { firestore: audit.firestore });
    await appendExportRequestAuthorizationAuditEvent(request, denied, context, { firestore: audit.firestore });

    const trail = await getAuditTrailForRequest(landlordRef, request.exportRequestId, { firestore: audit.firestore });

    expect(trail.map((event) => event.eventType)).toEqual(["ExportRequestAuthorized", "ExportRequestDenied"]);
    expect(trail.map((event) => event.reason)).toEqual(["Claim settlement review.", "landlord_scope_mismatch"]);
    expect(JSON.stringify(trail)).not.toContain(request.exportRequestId);
    expect(JSON.stringify(trail)).not.toContain(landlordRef);
  });
});
