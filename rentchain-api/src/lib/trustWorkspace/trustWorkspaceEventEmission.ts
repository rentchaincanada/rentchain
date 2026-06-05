import {
  appendAuditEventSafely,
  type ExportAuditTrailFirestoreLike,
} from "../../services/export-audit-trail-service";
import type { ExportAuthorizationContext } from "../../types/export-authorization-types";
import type { ExportAuditEventPayload } from "../../types/export-audit-types";
import type { TrustWorkspaceSummary } from "./trustWorkspaceTypes";

function roleForExportAudit(role: TrustWorkspaceSummary["role"]): ExportAuthorizationContext["requestingActorRole"] {
  if (role === "support") return "AdminSupport";
  if (role === "admin") return "AdminSupport";
  if (role === "landlord") return "LandlordAdmin";
  return "SystemService";
}

export async function emitTrustWorkspaceDerivedEvent(
  summary: TrustWorkspaceSummary,
  input: {
    requesterRef: string;
    landlordScope: string;
    purpose?: string | null;
    firestore?: ExportAuditTrailFirestoreLike;
  }
): Promise<ExportAuditEventPayload | null> {
  const context: ExportAuthorizationContext = {
    requestingActorId: input.requesterRef,
    requestingActorRole: roleForExportAudit(summary.role),
    requestingActorScope: summary.role === "tenant" ? null : input.landlordScope,
    requestingPurpose: input.purpose || "trust_workspace_derivation",
    timestamp: summary.derivedAt,
    rawIdsIncluded: false,
  };
  return appendAuditEventSafely(
    {
      eventType: "TrustWorkspaceDerived",
      targetType: "TrustWorkspace",
      targetId: summary.workspaceRef,
      landlordId: input.landlordScope,
      context,
      eventSummary: "Trust workspace read model derived.",
      statusSummary: summary.errorFlags.length ? "derived_with_flags" : "derived",
      reason: input.purpose || "trust_workspace_derivation",
      details: {
        role: summary.role,
        evidenceCount: summary.evidenceSummaries.length,
        attestationCount: summary.attestationContexts.length,
        exportReadinessCount: summary.exportReadinessStates.length,
        crossOrgContextCount: summary.crossOrgContexts.length,
        errorFlagCount: summary.errorFlags.length,
        metadataOnly: true,
        rawIdsIncluded: false,
        payloadIncluded: false,
      },
      timestamp: summary.derivedAt,
      visibility: summary.role === "admin" || summary.role === "support" ? "admin_support_internal" : "landlord_operator_internal",
    },
    { firestore: input.firestore }
  );
}
