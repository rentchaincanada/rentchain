import { describe, expect, it } from "vitest";
import type { EvidenceRecord } from "../../types/evidence-record-types";
import type { ExportAuditEventPayload } from "../../types/export-audit-types";
import type { ExportAuditTrailFirestoreLike } from "../export-audit-trail-service";
import { generateExportAuditSafeReference } from "../export-audit-trail-service";
import {
  buildTrustWorkspaceAccessContext,
  getTrustWorkspaceForUser,
} from "../trust-workspace-service";

const landlordId = "landlord-service-1";
const tenantId = "tenant-service-1";
const evidenceRef = "evidence:ffffffffffffffffffff";
const timestamp = "2026-06-05T12:00:00.000Z";

function evidenceRecord(): EvidenceRecord {
  const landlordRef = generateExportAuditSafeReference("landlord", landlordId);
  const tenantRef = generateExportAuditSafeReference("tenant", tenantId);
  return {
    evidenceId: "ev-service-1",
    evidenceClass: "AuditEvidence",
    evidenceType: "workspace_audit_metadata",
    schemaVersion: "evidence_record_v1",
    landlordId,
    resourceType: "canonicalEvent",
    resourceId: "event-service-1",
    safeReference: {
      evidenceId: "ev-service-1",
      evidenceClass: "AuditEvidence",
      resourceType: "canonicalEvent",
      safeReferenceKey: evidenceRef,
      label: "Workspace audit evidence",
      rawIdsIncluded: false,
      payloadIncluded: false,
    },
    provenanceMetadata: {
      createdAt: timestamp,
      createdBy: { actorRole: "system", actorRef: "actor:systemsystemsystem", rawActorIdsIncluded: false },
      authority: { authorityRole: "system", landlordRef, tenantRef, supportAllowed: true, rawIdsIncluded: false },
      source: {
        sourceCollection: "canonicalEvents",
        sourceReferenceKey: "event:ffffffffffffffffffff",
        sourceObservedAt: timestamp,
        sourceVersion: "v1",
        rawSourceIdsIncluded: false,
        rawPayloadIncluded: false,
      },
      reason: "Workspace service test.",
      provenanceChain: [],
      metadataOnly: true,
    },
    sensitivityMetadata: {
      sensitivityClass: "Operational",
      projectionCategories: ["landlord_operational", "tenant_safe", "admin_support"],
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
    redactionSummary: "Metadata-only audit evidence.",
  };
}

function eventStore() {
  const events = new Map<string, ExportAuditEventPayload>();
  const firestore: ExportAuditTrailFirestoreLike = {
    collection() {
      return {
        doc(id: string) {
          return {
            async get() {
              const event = events.get(id);
              return { exists: Boolean(event), data: () => event };
            },
            async create(data: ExportAuditEventPayload) {
              events.set(id, data);
            },
            async set(data: ExportAuditEventPayload) {
              events.set(id, data);
            },
          };
        },
        where() {
          return {
            async get() {
              return { docs: Array.from(events.values()).map((event) => ({ data: () => event })) };
            },
          };
        },
      };
    },
  };
  return { firestore, list: () => Array.from(events.values()) };
}

describe("trust workspace service", () => {
  it("builds access context from landlord user without exposing user id", () => {
    const context = buildTrustWorkspaceAccessContext({ id: landlordId, role: "landlord", landlordId });

    expect(context).toEqual(expect.objectContaining({
      role: "landlord",
      landlordRef: generateExportAuditSafeReference("landlord", landlordId),
      rawIdsIncluded: false,
    }));
    expect(context?.requesterRef).toMatch(/^actor:/);
    expect(JSON.stringify(context)).not.toContain(landlordId);
  });

  it("returns projected landlord workspace and emits descriptor event", async () => {
    const store = eventStore();
    const result = await getTrustWorkspaceForUser(
      { id: landlordId, role: "landlord", landlordId },
      {
        evidenceRecords: [evidenceRecord()],
        auditEvents: [],
        firestore: store.firestore,
        derivedAt: timestamp,
        exportReadinessRequests: [{ audience: "insurer", purpose: "insurance_review" }],
      }
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.workspace.evidenceSummaries).toHaveLength(1);
      expect(result.workspace.attestationContexts).toEqual([]);
      expect(result.workspace.metadataOnly).toBe(true);
    }
    expect(store.list()).toEqual([
      expect.objectContaining({
        eventType: "TrustWorkspaceDerived",
        metadataOnly: true,
        rawIdsIncluded: false,
        payloadIncluded: false,
      }),
    ]);
    expect(JSON.stringify({ result, events: store.list() })).not.toContain(landlordId);
  });

  it("returns tenant projection with evidence-only visibility", async () => {
    const result = await getTrustWorkspaceForUser(
      { id: tenantId, role: "tenant", tenantId, tenantEvidenceRefs: [evidenceRef] },
      {
        evidenceRecords: [evidenceRecord()],
        auditEvents: [],
        emitEvent: false,
        derivedAt: timestamp,
      }
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.workspace.landlordRef).toBeNull();
      expect(result.workspace.evidenceSummaries).toHaveLength(1);
      expect(result.workspace.attestationContexts).toEqual([]);
      expect(result.workspace.exportReadinessStates).toEqual([]);
      expect(result.workspace.crossOrgContexts).toEqual([]);
    }
  });

  it("fails closed on invalid role and missing tenant evidence scope", async () => {
    await expect(getTrustWorkspaceForUser({ id: "viewer-1", role: "viewer" })).resolves.toEqual(expect.objectContaining({
      ok: false,
      code: "TRUST_WORKSPACE_INVALID_ROLE",
    }));
    await expect(getTrustWorkspaceForUser({ id: tenantId, role: "tenant", tenantId })).resolves.toEqual(expect.objectContaining({
      ok: false,
      code: "TRUST_WORKSPACE_MISSING_SCOPE",
    }));
  });
});
