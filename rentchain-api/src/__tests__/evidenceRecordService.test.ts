import { describe, expect, it } from "vitest";

import {
  buildEvidenceProvenanceMetadata,
  EvidenceRecordService,
  safeEvidenceScopeReference,
} from "../services/evidence-record-service";
import {
  EVIDENCE_CLASSES,
  EVIDENCE_RECORD_COLLECTION,
  EVIDENCE_RECORD_SCHEMA_VERSION,
  type CreateEvidenceRecordInput,
  type EvidenceClass,
  type EvidenceProjectionCategory,
  type EvidenceRecord,
  type EvidenceResourceType,
  type EvidenceSensitivityClass,
  type EvidenceSourceCollection,
} from "../types/evidence-record-types";
import { validateEvidenceId } from "../utils/evidence-identifier";

type StoredRecord = Record<string, unknown>;

function createEvidenceTestStore() {
  const collections = new Map<string, Map<string, StoredRecord>>();

  function ensure(name: string): Map<string, StoredRecord> {
    if (!collections.has(name)) collections.set(name, new Map());
    return collections.get(name)!;
  }

  return {
    read(collection: string, id: string): StoredRecord | null {
      return ensure(collection).get(id) || null;
    },
    collection<T = StoredRecord>(name: string) {
      return {
        doc(id: string) {
          return {
            async get() {
              return {
                id,
                exists: ensure(name).has(id),
                data: () => ensure(name).get(id),
              };
            },
            async create(data: T) {
              if (ensure(name).has(id)) throw new Error("already_exists");
              ensure(name).set(id, data as StoredRecord);
            },
            async set(data: T) {
              ensure(name).set(id, data as StoredRecord);
            },
          };
        },
      };
    },
  };
}

type EvidenceCase = {
  evidenceClass: EvidenceClass;
  evidenceType: string;
  sourceCollection: EvidenceSourceCollection;
  resourceType: EvidenceResourceType;
  resourceId: string;
  sensitivityClass: EvidenceSensitivityClass;
};

const evidenceCases: EvidenceCase[] = [
  {
    evidenceClass: "ApplicationEvidence",
    evidenceType: "ApplicationEvidence",
    sourceCollection: "rentalApplications",
    resourceType: "rentalApplication",
    resourceId: "application-raw-id-001",
    sensitivityClass: "Sensitive",
  },
  {
    evidenceClass: "ScreeningEvidence",
    evidenceType: "ScreeningEvidence",
    sourceCollection: "screeningOrders",
    resourceType: "screeningOrder",
    resourceId: "screening-order-raw-id-001",
    sensitivityClass: "Restricted",
  },
  {
    evidenceClass: "DecisionEvidence",
    evidenceType: "DecisionEvidence",
    sourceCollection: "decisionActions",
    resourceType: "decisionWorkflow",
    resourceId: "decision-action-raw-id-001",
    sensitivityClass: "Sensitive",
  },
  {
    evidenceClass: "PaymentEvidence",
    evidenceType: "PaymentEvidence",
    sourceCollection: "ledgerEntries",
    resourceType: "ledgerEntry",
    resourceId: "ledger-entry-raw-id-001",
    sensitivityClass: "Sensitive",
  },
  {
    evidenceClass: "MaintenanceEvidence",
    evidenceType: "MaintenanceEvidence",
    sourceCollection: "workOrders",
    resourceType: "workOrder",
    resourceId: "work-order-raw-id-001",
    sensitivityClass: "Sensitive",
  },
  {
    evidenceClass: "AuditEvidence",
    evidenceType: "AuditEvidence",
    sourceCollection: "canonicalEvents",
    resourceType: "canonicalEvent",
    resourceId: "canonical-event-raw-id-001",
    sensitivityClass: "Sensitive",
  },
];

function sensitivityMetadata(sensitivityClass: EvidenceSensitivityClass) {
  return {
    sensitivityClass,
    projectionCategories: ["audit_only", "landlord_operational"] as EvidenceProjectionCategory[],
    redactionPolicy: "allowlist_required" as const,
    excludedFieldGroups: ["rawPayload", "providerPayload", "credentialValues"],
    allowedFieldGroups: ["status", "timestamp", "safeReference"],
    containsRestrictedProviderData: false as const,
    containsRawPaymentData: false as const,
    containsMessageBody: false as const,
    containsIdentityDocument: false as const,
    rawIdsIncluded: false as const,
    payloadIncluded: false as const,
  };
}

function buildInput(overrides: Partial<CreateEvidenceRecordInput> = {}, evidenceCase: EvidenceCase = evidenceCases[0]): CreateEvidenceRecordInput {
  const createdAt = "2026-06-04T02:00:00.000Z";
  const creationAuthority = overrides.creationAuthority || {
    actorRole: "landlord" as const,
    actorId: "landlord-user-raw-id",
    landlordId: "landlord-raw-id-001",
    purpose: "landlord evidence capture",
  };
  return {
    evidenceClass: evidenceCase.evidenceClass,
    evidenceType: evidenceCase.evidenceType,
    landlordId: "landlord-raw-id-001",
    resourceType: evidenceCase.resourceType,
    resourceId: evidenceCase.resourceId,
    label: `${evidenceCase.evidenceClass} fixture`,
    creationAuthority,
    provenanceMetadata:
      overrides.provenanceMetadata ||
      buildEvidenceProvenanceMetadata({
        authority: creationAuthority,
        sourceCollection: evidenceCase.sourceCollection,
        resourceType: evidenceCase.resourceType,
        resourceId: evidenceCase.resourceId,
        reason: `${evidenceCase.evidenceClass} created for governed evidence capture`,
        createdAt,
        sourceObservedAt: createdAt,
        sourceVersion: "test_v1",
      }),
    sensitivityMetadata: overrides.sensitivityMetadata || sensitivityMetadata(evidenceCase.sensitivityClass),
    createdAt,
    ...overrides,
  };
}

function externalRecordFields(record: EvidenceRecord) {
  return {
    evidenceId: record.evidenceId,
    safeReference: record.safeReference,
    provenanceMetadata: record.provenanceMetadata,
    sensitivityMetadata: record.sensitivityMetadata,
    redactionSummary: record.redactionSummary,
  };
}

describe("EvidenceRecordService", () => {
  it("creates immutable metadata-only records for all evidence classes", async () => {
    expect(evidenceCases.map((item) => item.evidenceClass)).toEqual([...EVIDENCE_CLASSES]);
    for (const evidenceCase of evidenceCases) {
      const store = createEvidenceTestStore();
      const service = new EvidenceRecordService({ firestore: store });
      const record = await service.createEvidenceRecord(buildInput({}, evidenceCase));

      expect(record).toMatchObject({
        evidenceClass: evidenceCase.evidenceClass,
        evidenceType: evidenceCase.evidenceType,
        schemaVersion: EVIDENCE_RECORD_SCHEMA_VERSION,
        immutable: true,
        appendOnly: true,
        metadataOnly: true,
        rawIdsIncluded: false,
        status: "active",
      });
      expect(validateEvidenceId(record.evidenceId)).toBe(true);
      expect(record.safeReference.rawIdsIncluded).toBe(false);
      expect(record.safeReference.payloadIncluded).toBe(false);
      expect(store.read(EVIDENCE_RECORD_COLLECTION, record.evidenceId)).toEqual(record);
    }
  });

  it("generates deterministic evidence identifiers and rejects duplicate append writes", async () => {
    const store = createEvidenceTestStore();
    const service = new EvidenceRecordService({ firestore: store });
    const input = buildInput();
    const first = await service.createEvidenceRecord(input);
    const repeatedService = new EvidenceRecordService({ firestore: createEvidenceTestStore() });
    const repeated = await repeatedService.createEvidenceRecord(input);

    expect(first.evidenceId).toBe(repeated.evidenceId);
    await expect(service.createEvidenceRecord(input)).rejects.toThrow("already_exists");
  });

  it("keeps raw IDs out of external-facing evidence fields", async () => {
    const store = createEvidenceTestStore();
    const service = new EvidenceRecordService({ firestore: store });
    const record = await service.createEvidenceRecord(buildInput());
    const serializedExternalFields = JSON.stringify(externalRecordFields(record));

    expect(serializedExternalFields).not.toContain("landlord-raw-id-001");
    expect(serializedExternalFields).not.toContain("application-raw-id-001");
    expect(serializedExternalFields).not.toContain("landlord-user-raw-id");
    expect(serializedExternalFields).not.toMatch(/bearer-secret|secret-token|gs:\/\/|storage\.googleapis\.com/i);
    expect(record.landlordId).toBe("landlord-raw-id-001");
    expect(record.resourceId).toBe("application-raw-id-001");
  });

  it("fails closed on landlord scope mismatch", async () => {
    const store = createEvidenceTestStore();
    const service = new EvidenceRecordService({ firestore: store });
    const input = buildInput({
      provenanceMetadata: buildEvidenceProvenanceMetadata({
        authority: {
          actorRole: "landlord",
          actorId: "landlord-user-raw-id",
          landlordId: "other-landlord-raw-id",
          purpose: "landlord evidence capture",
        },
        sourceCollection: "rentalApplications",
        resourceType: "rentalApplication",
        resourceId: "application-raw-id-001",
        reason: "ApplicationEvidence created for governed evidence capture",
        createdAt: "2026-06-04T02:00:00.000Z",
      }),
    });

    await expect(service.createEvidenceRecord(input)).rejects.toThrow("evidence_landlord_scope_mismatch");
  });

  it("requires tenant scope for tenant-created evidence", async () => {
    const store = createEvidenceTestStore();
    const service = new EvidenceRecordService({ firestore: store });
    const tenantAuthority = {
      actorRole: "tenant" as const,
      actorId: "tenant-user-raw-id",
      landlordId: "landlord-raw-id-001",
      tenantId: "tenant-raw-id-001",
      purpose: "tenant evidence capture",
    };
    const record = await service.createEvidenceRecord(buildInput({
      creationAuthority: tenantAuthority,
      provenanceMetadata: buildEvidenceProvenanceMetadata({
        authority: tenantAuthority,
        sourceCollection: "rentalApplications",
        resourceType: "rentalApplication",
        resourceId: "application-raw-id-001",
        reason: "Tenant application evidence capture",
        createdAt: "2026-06-04T02:00:00.000Z",
      }),
    }));

    expect(record.provenanceMetadata.authority.tenantRef).toBe(safeEvidenceScopeReference("tenant", "tenant-raw-id-001"));

    const missingTenantScope = buildInput({
      creationAuthority: { actorRole: "tenant", actorId: "tenant-user-raw-id", landlordId: "landlord-raw-id-001" },
      provenanceMetadata: {
        ...record.provenanceMetadata,
        authority: {
          authorityRole: "tenant",
          landlordRef: safeEvidenceScopeReference("landlord", "landlord-raw-id-001"),
          tenantRef: null,
          supportAllowed: false,
          rawIdsIncluded: false,
        },
      },
    });
    await expect(service.createEvidenceRecord(missingTenantScope)).rejects.toThrow("evidence_tenant_scope_missing");
  });

  it("requires purpose and support allowance for admin/support evidence", async () => {
    const store = createEvidenceTestStore();
    const service = new EvidenceRecordService({ firestore: store });
    const supportAuthority = {
      actorRole: "support" as const,
      actorId: "support-user-raw-id",
      landlordId: "landlord-raw-id-001",
      supportAllowed: true,
      purpose: "support evidence capture",
    };
    const supportRecord = await service.createEvidenceRecord(buildInput({
      creationAuthority: supportAuthority,
      provenanceMetadata: buildEvidenceProvenanceMetadata({
        authority: supportAuthority,
        sourceCollection: "canonicalEvents",
        resourceType: "canonicalEvent",
        resourceId: "canonical-event-raw-id-001",
        reason: "Support audit evidence capture",
        createdAt: "2026-06-04T02:00:00.000Z",
      }),
    }, evidenceCases[5]));

    expect(supportRecord.provenanceMetadata.authority.supportAllowed).toBe(true);

    const deniedSupport = buildInput({
      resourceId: "canonical-event-raw-id-002",
      creationAuthority: { actorRole: "support", actorId: "support-user-raw-id", landlordId: "landlord-raw-id-001" },
      provenanceMetadata: buildEvidenceProvenanceMetadata({
        authority: { actorRole: "support", actorId: "support-user-raw-id", landlordId: "landlord-raw-id-001" },
        sourceCollection: "canonicalEvents",
        resourceType: "canonicalEvent",
        resourceId: "canonical-event-raw-id-002",
        reason: "Support audit evidence capture",
        createdAt: "2026-06-04T02:00:00.000Z",
      }),
    }, evidenceCases[5]);
    await expect(service.createEvidenceRecord(deniedSupport)).rejects.toThrow("evidence_support_not_allowed");

    const adminWithoutPurpose = buildInput({
      resourceId: "canonical-event-raw-id-003",
      creationAuthority: { actorRole: "admin", actorId: "admin-user-raw-id", landlordId: "landlord-raw-id-001" },
      provenanceMetadata: buildEvidenceProvenanceMetadata({
        authority: { actorRole: "admin", actorId: "admin-user-raw-id", landlordId: "landlord-raw-id-001" },
        sourceCollection: "canonicalEvents",
        resourceType: "canonicalEvent",
        resourceId: "canonical-event-raw-id-003",
        reason: "Admin audit evidence capture",
        createdAt: "2026-06-04T02:00:00.000Z",
      }),
    }, evidenceCases[5]);
    await expect(service.createEvidenceRecord(adminWithoutPurpose)).rejects.toThrow("evidence_admin_purpose_missing");
  });

  it("creates superseding evidence as a new append-only record without mutating the original", async () => {
    const store = createEvidenceTestStore();
    const service = new EvidenceRecordService({ firestore: store });
    const original = await service.createEvidenceRecord(buildInput({}, evidenceCases[3]));
    const superseding = await service.createEvidenceRecord(buildInput({
      resourceId: "ledger-entry-raw-id-002",
      supersedesEvidenceId: original.evidenceId,
      provenanceMetadata: buildEvidenceProvenanceMetadata({
        authority: {
          actorRole: "landlord",
          actorId: "landlord-user-raw-id",
          landlordId: "landlord-raw-id-001",
          purpose: "landlord evidence correction",
        },
        sourceCollection: "ledgerEntries",
        resourceType: "ledgerEntry",
        resourceId: "ledger-entry-raw-id-002",
        reason: "PaymentEvidence supersession capture",
        createdAt: "2026-06-04T02:05:00.000Z",
        provenanceChain: [original.safeReference],
      }),
      createdAt: "2026-06-04T02:05:00.000Z",
    }, evidenceCases[3]));

    expect(superseding.supersedesEvidenceId).toBe(original.evidenceId);
    expect(superseding.supersededByEvidenceId).toBeNull();
    expect(store.read(EVIDENCE_RECORD_COLLECTION, original.evidenceId)).toEqual(original);
    expect((store.read(EVIDENCE_RECORD_COLLECTION, original.evidenceId) as EvidenceRecord).status).toBe("active");
  });

  it("rejects unsafe provenance payload markers", async () => {
    const store = createEvidenceTestStore();
    const service = new EvidenceRecordService({ firestore: store });
    const input = buildInput({
      provenanceMetadata: {
        ...buildInput().provenanceMetadata,
        reason: "contains bearer-secret",
      },
    });

    await expect(service.createEvidenceRecord(input)).rejects.toThrow("evidence_reason_invalid");
  });
});
