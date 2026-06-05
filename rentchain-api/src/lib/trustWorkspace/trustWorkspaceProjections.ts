import type {
  TrustWorkspaceAccessContext,
  TrustWorkspaceSummary,
} from "./trustWorkspaceTypes";

function assertSummary(summary: TrustWorkspaceSummary): void {
  if (
    summary.metadataOnly !== true ||
    summary.rawIdsIncluded !== false ||
    summary.payloadIncluded !== false ||
    summary.nonPublic !== true ||
    summary.nonShareable !== true
  ) {
    throw new Error("trust_workspace_projection_flags_invalid");
  }
}

function assertLandlordScope(summary: TrustWorkspaceSummary, context: TrustWorkspaceAccessContext): void {
  if (context.role === "admin") return;
  if (!summary.landlordRef || !context.landlordRef || summary.landlordRef !== context.landlordRef) {
    throw new Error("trust_workspace_projection_scope_mismatch");
  }
}

export function projectTrustWorkspaceForLandlord(
  summary: TrustWorkspaceSummary,
  context: TrustWorkspaceAccessContext
): TrustWorkspaceSummary {
  assertSummary(summary);
  assertLandlordScope(summary, context);
  if (context.role !== "landlord") throw new Error("trust_workspace_projection_role_invalid");
  return {
    ...summary,
    role: "landlord",
    tenantRef: null,
    evidenceSummaries: summary.evidenceSummaries.map((item) => ({
      ...item,
      authority: {
        ...item.authority,
        tenantRef: null,
        rawIdsIncluded: false,
      },
      rawIdsIncluded: false,
      payloadIncluded: false,
    })),
    metadataOnly: true,
    rawIdsIncluded: false,
    payloadIncluded: false,
  };
}

export function projectTrustWorkspaceForTenant(
  summary: TrustWorkspaceSummary,
  context: TrustWorkspaceAccessContext
): TrustWorkspaceSummary {
  assertSummary(summary);
  if (context.role !== "tenant") throw new Error("trust_workspace_projection_role_invalid");
  const allowed = new Set(context.allowedEvidenceRefs);
  return {
    ...summary,
    role: "tenant",
    landlordRef: null,
    evidenceSummaries: summary.evidenceSummaries
      .filter((item) => allowed.has(item.evidenceRef))
      .map((item) => ({
        ...item,
        contentHash: null,
        provenanceChain: [],
        authority: {
          authorityRole: item.authority.authorityRole,
          landlordRef: null,
          tenantRef: context.tenantRef,
          supportAllowed: false,
          rawIdsIncluded: false,
        },
        rawIdsIncluded: false,
        payloadIncluded: false,
      })),
    attestationContexts: [],
    exportReadinessStates: [],
    crossOrgContexts: [],
    metadataOnly: true,
    rawIdsIncluded: false,
    payloadIncluded: false,
  };
}

export function projectTrustWorkspaceForAdmin(
  summary: TrustWorkspaceSummary,
  context: TrustWorkspaceAccessContext
): TrustWorkspaceSummary {
  assertSummary(summary);
  if (context.role !== "admin") throw new Error("trust_workspace_projection_role_invalid");
  return {
    ...summary,
    role: "admin",
    metadataOnly: true,
    rawIdsIncluded: false,
    payloadIncluded: false,
  };
}

export function projectTrustWorkspaceForSupport(
  summary: TrustWorkspaceSummary,
  context: TrustWorkspaceAccessContext
): TrustWorkspaceSummary {
  assertSummary(summary);
  assertLandlordScope(summary, context);
  if (context.role !== "support" || !context.supportPurpose) throw new Error("trust_workspace_projection_role_invalid");
  return {
    ...summary,
    role: "support",
    exportReadinessStates: summary.exportReadinessStates.map((item) => ({
      ...item,
      nonShareable: true,
      publicAccessEnabled: false,
      externalSubmissionEnabled: false,
      rawIdsIncluded: false,
      payloadIncluded: false,
    })),
    metadataOnly: true,
    rawIdsIncluded: false,
    payloadIncluded: false,
  };
}

export function projectTrustWorkspace(
  summary: TrustWorkspaceSummary,
  context: TrustWorkspaceAccessContext
): TrustWorkspaceSummary {
  if (context.role === "tenant") return projectTrustWorkspaceForTenant(summary, context);
  if (context.role === "landlord") return projectTrustWorkspaceForLandlord(summary, context);
  if (context.role === "admin") return projectTrustWorkspaceForAdmin(summary, context);
  if (context.role === "support") return projectTrustWorkspaceForSupport(summary, context);
  throw new Error("trust_workspace_projection_role_invalid");
}
