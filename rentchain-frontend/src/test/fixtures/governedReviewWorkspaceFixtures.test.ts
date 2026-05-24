import { describe, expect, it } from "vitest";

import {
  getGovernedReviewWorkspaceFixtureDetail,
  getGovernedReviewWorkspaceFixtureResponse,
  governedReviewWorkspaceFixtureDetails,
  governedReviewWorkspaceFixtureRecords,
  governedReviewWorkspaceFixtureScope,
} from "./governedReviewWorkspaceFixtures";

const UNSAFE_PATTERNS = [
  "gs://",
  "storage.googleapis.com",
  "secret-token",
  "Bearer ",
  "credential-value",
  "authorization:",
  "cookie=",
  "rawProviderPayload",
  "rawDocument",
  "rawNote",
  "requestBody",
  "responseBody",
  "stackTrace",
  "debugPayload",
  "tenant-raw-id",
  "landlord-raw-id",
];

function collectStrings(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (!value || typeof value !== "object") return [];
  if (Array.isArray(value)) return value.flatMap(collectStrings);
  return Object.values(value as Record<string, unknown>).flatMap(collectStrings);
}

describe("governed review workspace preview fixtures", () => {
  it("covers required metadata-only workspace examples", () => {
    expect(governedReviewWorkspaceFixtureRecords.map((item) => item.workspaceType)).toEqual([
      "security_review",
      "support_escalation_review",
      "export_governance_review",
      "evidence_review",
    ]);
    expect(governedReviewWorkspaceFixtureScope).toMatchObject({
      fixtureOnly: true,
      productionRuntime: false,
      firestoreWrites: false,
      mutationControlsEnabled: false,
      tenantVisible: false,
      landlordVisible: false,
    });
  });

  it("keeps records and details internal, metadata-only, append-only, and read-only", () => {
    for (const record of governedReviewWorkspaceFixtureRecords) {
      expect(record).toMatchObject({
        metadataOnly: true,
        visibilityClass: "admin_support_internal",
        tenantVisible: false,
        landlordVisible: false,
        appendOnly: true,
        mutationControlsEnabled: false,
        rawPayloadAccessEnabled: false,
      });
      expect(record.title).not.toContain(record.workspaceId);
    }

    for (const detail of Object.values(governedReviewWorkspaceFixtureDetails)) {
      expect(detail.safeEvidenceRefs.every((ref) => ref.metadataOnly && ref.internalReference)).toBe(true);
      expect(detail.relatedWorkspaceLinks.every((link) => link.metadataOnly && !link.mutationControlsEnabled)).toBe(true);
      expect(detail.appendEventSummaries.every((event) => event.metadataOnly && event.appendOnly)).toBe(true);
      expect(detail.payloadSafety).toMatchObject({
        rawNotes: "excluded",
        rawDocuments: "excluded",
        providerPayloads: "excluded",
        storagePaths: "excluded",
        tokens: "excluded",
        secrets: "excluded",
        debugPayloads: "excluded",
        requestResponseBodies: "excluded",
      });
    }
  });

  it("does not carry unsafe raw payload markers or raw IDs as labels", () => {
    const strings = collectStrings({
      records: governedReviewWorkspaceFixtureRecords,
      details: governedReviewWorkspaceFixtureDetails,
    });
    const joined = strings.join("\n");

    for (const pattern of UNSAFE_PATTERNS) {
      expect(joined).not.toContain(pattern);
    }
    for (const detail of Object.values(governedReviewWorkspaceFixtureDetails)) {
      for (const link of detail.relatedWorkspaceLinks) {
        expect(link.sourceSummary.rawIdsIncluded).toBe(false);
        expect(link.targetSummary.rawIdsIncluded).toBe(false);
      }
    }
  });

  it("returns deterministic list and detail responses for page tests", () => {
    const response = getGovernedReviewWorkspaceFixtureResponse();
    const detail = getGovernedReviewWorkspaceFixtureDetail("fixture_workspace_security_review");

    expect(response.summary.total).toBe(4);
    expect(response.schema).toMatchObject({
      metadataOnly: true,
      tenantVisible: false,
      landlordVisible: false,
      createRouteEnabled: false,
      updateRouteEnabled: false,
      deleteRouteEnabled: false,
    });
    expect(detail.workspace.title).toBe("Security review workspace");
  });
});
