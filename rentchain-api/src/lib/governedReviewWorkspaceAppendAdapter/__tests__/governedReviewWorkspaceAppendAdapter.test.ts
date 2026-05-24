import { describe, expect, it } from "vitest";

import {
  buildGovernedReviewWorkspaceAppendEnvelope,
  createGovernedReviewWorkspaceAppendAdapter,
  type GovernedReviewWorkspaceAppendEnvelope,
} from "../governedReviewWorkspaceAppendAdapter";

const safeCandidate = {
  workspaceType: "security_review",
  title: "Security review workspace",
  summary: "Metadata-only workspace record.",
  workflowFamily: "admin_security_incident_review",
  severity: "medium",
  reviewState: "metadata_review_ready",
  approvalExpectation: "admin_review",
  retentionClass: "security_review",
  createdAt: "2026-05-24T01:00:00.000Z",
  appendEvents: [
    {
      eventType: "workspace_candidate_created",
      eventSummary: "Workspace candidate prepared.",
      occurredAt: "2026-05-24T01:00:00.000Z",
    },
  ],
};

describe("governed review workspace append adapter", () => {
  it("builds admin/support-internal append-only envelopes", () => {
    const result = buildGovernedReviewWorkspaceAppendEnvelope({
      actor: {
        actorRole: "admin",
        displayName: "Security operator",
        permission: "system.admin",
      },
      candidate: safeCandidate,
      occurredAt: "2026-05-24T01:05:00.000Z",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected append envelope");

    expect(result.envelope).toEqual(
      expect.objectContaining({
        appendOnly: true,
        appendOperation: "append_workspace_record",
        storageTarget: "governed_review_workspace_append_log",
        storageWriteDecision: "adapter_port_only_firestore_deferred",
        metadataOnly: true,
        visibilityClass: "admin_support_internal",
        tenantVisible: false,
        landlordVisible: false,
        createRouteEnabled: false,
        updateRouteEnabled: false,
        deleteRouteEnabled: false,
        statusMutationEnabled: false,
        mutationControlsEnabled: false,
        rawPayloadAccessEnabled: false,
      })
    );
    expect(result.envelope.actorSummary).toEqual(
      expect.objectContaining({
        role: "admin",
        displayName: "Security operator",
        systemAdminAuthorized: true,
        rawActorIdsIncluded: false,
      })
    );
    expect(result.envelope.record.metadataOnly).toBe(true);
    expect(result.envelope.record.tenantVisible).toBe(false);
    expect(result.envelope.record.landlordVisible).toBe(false);
  });

  it("denies non-admin and non-support actors without writing", async () => {
    const writes: GovernedReviewWorkspaceAppendEnvelope[] = [];
    const adapter = createGovernedReviewWorkspaceAppendAdapter({
      async append(envelope) {
        writes.push(envelope);
      },
    });

    const result = await adapter.appendWorkspaceRecord({
      actor: {
        actorRole: "tenant",
        displayName: "Tenant user",
      },
      candidate: safeCandidate,
    });

    expect(result).toEqual(
      expect.objectContaining({
        ok: false,
        error: "admin_support_authority_required",
        metadataOnly: true,
        tenantVisible: false,
        landlordVisible: false,
        supportPowersGranted: false,
        rawPayloadAccessEnabled: false,
      })
    );
    expect(writes).toHaveLength(0);
  });

  it("sanitizes unsafe payloads before append store receives the envelope", async () => {
    const writes: GovernedReviewWorkspaceAppendEnvelope[] = [];
    const adapter = createGovernedReviewWorkspaceAppendAdapter({
      async append(envelope) {
        writes.push(envelope);
      },
    });

    const result = await adapter.appendWorkspaceRecord({
      actor: {
        actorRole: "support",
        supportAuthorized: true,
        displayName: "support-token-secret",
      },
      candidate: {
        workspaceType: "projection_safety_review",
        title: "abcdefghijklmnopqrstuvwxyz1234567890",
        summary: "Bearer raw.token.value requestBody={raw} stackTrace=unsafe",
        retentionReason: "secret=value gs://bucket/raw.pdf",
        createdAt: "2026-05-24T01:00:00.000Z",
        safeEvidenceRefs: [
          {
            referenceType: "document",
            referenceId: "doc-safe",
            label: "https://storage.googleapis.com/bucket/raw.pdf",
          },
        ],
        appendEvents: [
          {
            eventType: "debug_payload_added",
            eventSummary: "token=secret responseBody={raw}",
            actor: { authorization: "Bearer raw", cookie: "session=raw", displayName: "Support" },
          },
        ],
      },
      occurredAt: "2026-05-24T01:10:00.000Z",
    });

    expect(result.ok).toBe(true);
    expect(writes).toHaveLength(1);
    const serialized = JSON.stringify(writes[0]);
    expect(writes[0].warnings).toEqual(
      expect.arrayContaining([
        "restricted_credential_or_secret_like_input_sanitized",
        "storage_path_or_signed_url_input_sanitized",
        "raw_payload_input_excluded_from_contract",
      ])
    );
    expect(writes[0].actorSummary.displayName).toBeNull();
    expect(writes[0].record.title).toBe("Governed review workspace");
    expect(writes[0].record.safeEvidenceRefs[0].label).toBe("document reference");
    expect(serialized).not.toContain("raw.token.value");
    expect(serialized).not.toContain("gs://");
    expect(serialized).not.toContain("storage.googleapis.com");
    expect(serialized).not.toContain("responseBody");
    expect(serialized).not.toContain("support-token-secret");
  });

  it("uses an append-only store contract without update or delete operations", async () => {
    const writes: GovernedReviewWorkspaceAppendEnvelope[] = [];
    const store = {
      async append(envelope: GovernedReviewWorkspaceAppendEnvelope) {
        writes.push(envelope);
      },
    };
    const adapter = createGovernedReviewWorkspaceAppendAdapter(store);

    const result = await adapter.appendWorkspaceRecord({
      actor: { actorRole: "admin" },
      candidate: safeCandidate,
      occurredAt: "2026-05-24T01:15:00.000Z",
    });

    expect(result.ok).toBe(true);
    expect(writes).toHaveLength(1);
    expect("update" in store).toBe(false);
    expect("delete" in store).toBe(false);
    expect(writes[0].record.firestoreWriteEnabled).toBe(false);
    expect(writes[0].record.updateRouteEnabled).toBe(false);
    expect(writes[0].record.deleteRouteEnabled).toBe(false);
  });
});
