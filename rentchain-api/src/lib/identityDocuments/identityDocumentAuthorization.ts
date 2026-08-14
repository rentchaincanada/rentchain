export const IDENTITY_DOCUMENT_OPERATIONS = [
  "upload",
  "view_metadata",
  "view_raw_document",
  "replace",
  "delete",
  "issue_access_link",
  "view_verification_summary",
] as const;

export type IdentityDocumentOperation = (typeof IDENTITY_DOCUMENT_OPERATIONS)[number];
export type IdentityDocumentActorRole = "subject" | "organization_member" | "admin_staff" | "provider_service";

export type IdentityDocumentAuthorizationInput = {
  operation: IdentityDocumentOperation;
  actor: {
    actorId: string;
    role: IdentityDocumentActorRole;
    subjectId?: string | null;
    organizationId?: string | null;
    privileges?: readonly ("identity_raw_view" | "identity_break_glass")[];
  };
  resource: {
    subjectId: string;
    organizationId: string;
    activeWorkflow: boolean;
  };
  context: {
    applicationAccess: boolean;
    purposeCode?: string | null;
    providerDocumentGrant?: boolean;
  };
};

export type IdentityDocumentAuthorizationDecision = {
  allowed: boolean;
  reason:
    | "subject_owns_active_workflow"
    | "same_organization_metadata_access"
    | "explicit_raw_view_privilege"
    | "audited_break_glass"
    | "provider_exact_document_grant"
    | "deny_by_default";
  rawDocumentAccess: boolean;
  auditRequired: boolean;
};

const SUBJECT_MANAGEMENT_OPERATIONS: readonly IdentityDocumentOperation[] = [
  "upload",
  "view_metadata",
  "view_raw_document",
  "replace",
  "delete",
  "issue_access_link",
];

export function authorizeIdentityDocumentOperation(
  input: IdentityDocumentAuthorizationInput
): IdentityDocumentAuthorizationDecision {
  const isOwnSubject = input.actor.role === "subject" && input.actor.subjectId === input.resource.subjectId;
  if (isOwnSubject && input.resource.activeWorkflow && SUBJECT_MANAGEMENT_OPERATIONS.includes(input.operation)) {
    return {
      allowed: true,
      reason: "subject_owns_active_workflow",
      rawDocumentAccess: input.operation === "view_raw_document" || input.operation === "issue_access_link",
      auditRequired: input.operation === "view_raw_document" || input.operation === "issue_access_link",
    };
  }

  const sameOrganization =
    input.actor.organizationId === input.resource.organizationId && input.context.applicationAccess;
  if (
    input.actor.role === "organization_member" &&
    sameOrganization &&
    (input.operation === "view_metadata" || input.operation === "view_verification_summary")
  ) {
    return { allowed: true, reason: "same_organization_metadata_access", rawDocumentAccess: false, auditRequired: false };
  }

  const hasPurpose = Boolean(input.context.purposeCode?.trim());
  if (
    input.actor.role === "organization_member" &&
    sameOrganization &&
    hasPurpose &&
    input.actor.privileges?.includes("identity_raw_view") &&
    (input.operation === "view_raw_document" || input.operation === "issue_access_link")
  ) {
    return { allowed: true, reason: "explicit_raw_view_privilege", rawDocumentAccess: true, auditRequired: true };
  }

  if (
    input.actor.role === "admin_staff" &&
    hasPurpose &&
    input.actor.privileges?.includes("identity_break_glass") &&
    (input.operation === "view_metadata" || input.operation === "view_raw_document" || input.operation === "issue_access_link")
  ) {
    return {
      allowed: true,
      reason: "audited_break_glass",
      rawDocumentAccess: input.operation !== "view_metadata",
      auditRequired: true,
    };
  }

  if (
    input.actor.role === "provider_service" &&
    input.context.providerDocumentGrant === true &&
    input.operation === "view_raw_document"
  ) {
    return { allowed: true, reason: "provider_exact_document_grant", rawDocumentAccess: true, auditRequired: true };
  }

  return { allowed: false, reason: "deny_by_default", rawDocumentAccess: false, auditRequired: true };
}
