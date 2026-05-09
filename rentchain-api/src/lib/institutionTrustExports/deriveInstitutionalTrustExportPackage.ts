import type { InstitutionExportPackageType } from "../institutionExports/institutionExportTypes";
import { buildPolicySafeExportSummary } from "../portableAttestations/attestationPolicyGate";
import type {
  AttestationPolicyDecision,
  PortableAttestation,
} from "../portableAttestations/portableAttestationTypes";
import type {
  DeriveInstitutionalTrustExportPackageInput,
  InstitutionalTrustExportAudience,
  InstitutionalTrustExportAudienceMapping,
  InstitutionalTrustExportLifecycleControl,
  InstitutionalTrustExportPackage,
  InstitutionalTrustExportPurpose,
  InstitutionalTrustExportRedaction,
} from "./institutionTrustExportTypes";

const REDACTIONS: InstitutionalTrustExportRedaction[] = [
  {
    fieldCategory: "raw_identity_documents",
    reason: "Raw government ID documents, biometric payloads, and identity-provider payloads are excluded.",
  },
  {
    fieldCategory: "raw_property_or_registry_payloads",
    reason: "Raw title, registry, business, and property-provider payloads are excluded.",
  },
  {
    fieldCategory: "support_internal_metadata",
    reason: "Support-console notes, internal references, and unpublished governance metadata are excluded.",
  },
  {
    fieldCategory: "unsupported_claims",
    reason: "Unsupported verification, ownership, credit, subsidy, and approval claims are blocked.",
  },
  {
    fieldCategory: "public_exposure",
    reason: "Institutional trust exports are non-public, manual-only, and do not create public trust profiles.",
  },
];

const PACKAGE_EXPORT_MAPPING: Record<InstitutionExportPackageType, InstitutionalTrustExportAudienceMapping> = {
  lender_due_diligence: {
    audience: "lender",
    purpose: "lender_review",
    portableAudience: "lender",
    portablePurpose: "lender_review",
  },
  insurance_review: {
    audience: "insurer",
    purpose: "insurance_review",
    portableAudience: "insurer",
    portablePurpose: "insurance_review",
  },
  government_program_review: {
    audience: "government_review",
    purpose: "government_program_review",
    portableAudience: "government",
    portablePurpose: "government_program_review",
  },
  auditor_review: {
    audience: "auditor",
    purpose: "auditor_review",
    portableAudience: "auditor",
    portablePurpose: "auditor_review",
  },
  internal_admin_review: {
    audience: "internal_review",
    purpose: "internal_review",
    portableAudience: null,
    portablePurpose: null,
  },
};

function asString(value: unknown, max = 240): string {
  return String(value ?? "").trim().slice(0, max);
}

function normalizeGeneratedAt(value: unknown): string {
  const raw = asString(value, 120);
  const date = raw ? new Date(raw) : new Date();
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}

function cleanId(value: unknown): string {
  return asString(value, 240)
    .toLowerCase()
    .replace(/[\/\\#?]+/g, "_")
    .replace(/[^a-z0-9_.:-]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function arrayOf<T>(value: T[] | null | undefined): T[] {
  return Array.isArray(value) ? value : [];
}

function mappingForAudience(
  audience: InstitutionalTrustExportAudience,
  purpose: InstitutionalTrustExportPurpose
): InstitutionalTrustExportAudienceMapping {
  if (audience === "insurer" && purpose === "insurance_review") {
    return { audience, purpose, portableAudience: "insurer", portablePurpose: "insurance_review" };
  }
  if (audience === "lender" && purpose === "lender_review") {
    return { audience, purpose, portableAudience: "lender", portablePurpose: "lender_review" };
  }
  if (audience === "government_review" && purpose === "government_program_review") {
    return { audience, purpose, portableAudience: "government", portablePurpose: "government_program_review" };
  }
  if (audience === "subsidy_program" && purpose === "government_program_review") {
    return { audience, purpose, portableAudience: "government", portablePurpose: "government_program_review" };
  }
  if (audience === "auditor" && purpose === "auditor_review") {
    return { audience, purpose, portableAudience: "auditor", portablePurpose: "auditor_review" };
  }
  if (audience === "institutional_landlord" && purpose === "institutional_landlord_review") {
    return { audience, purpose, portableAudience: "institutional_landlord", portablePurpose: "future_institution_review" };
  }
  if (audience === "tenant_portability" && purpose === "tenant_controlled_portability") {
    return { audience, purpose, portableAudience: "tenant", portablePurpose: "tenant_controlled_sharing" };
  }
  return { audience, purpose, portableAudience: null, portablePurpose: null };
}

export function institutionalTrustExportMappingForPackageType(
  packageType: InstitutionExportPackageType
): InstitutionalTrustExportAudienceMapping {
  return PACKAGE_EXPORT_MAPPING[packageType];
}

function policyReasonLines(decisions: AttestationPolicyDecision[]) {
  return decisions.flatMap((decision) =>
    decision.allowed ? [] : decision.reasons.map((reason) => `${decision.attestationId}: ${reason}`)
  );
}

function lifecycleControlFor(params: {
  status: InstitutionalTrustExportPackage["status"];
  lifecycle: InstitutionalTrustExportPackage["lifecycle"];
  generatedAt: string;
  blockedReasons: string[];
  exportSummaryCount: number;
}): InstitutionalTrustExportLifecycleControl {
  const joined = params.blockedReasons.join(" ");
  const state: InstitutionalTrustExportLifecycleControl["state"] =
    params.status === "export_ready" && params.exportSummaryCount > 0
      ? "active"
      : params.lifecycle === "empty"
      ? "empty"
      : joined.includes("reverification_required")
      ? "reverification_required"
      : joined.includes("revoked")
      ? "revoked"
      : joined.includes("superseded")
      ? "superseded"
      : joined.includes("expired")
      ? "expired"
      : joined.includes("raw_payload_blocked") || joined.includes("support_metadata_blocked")
      ? "invalidated"
      : "blocked";
  const active = state === "active";
  return {
    schemaVersion: "institutional_trust_export_lifecycle_control.v1",
    state,
    reasons: active ? ["export_active"] : params.blockedReasons,
    active,
    shareable: active,
    evaluatedAt: params.generatedAt,
    metadataOnly: true,
    publicAccessEnabled: false,
    externalSubmissionEnabled: false,
  };
}

export function deriveInstitutionalTrustExportPackage(
  input: DeriveInstitutionalTrustExportPackageInput
): InstitutionalTrustExportPackage {
  const generatedAt = normalizeGeneratedAt(input.generatedAt);
  const attestations = arrayOf<PortableAttestation>(input.attestations);
  const mapping = mappingForAudience(input.audience, input.purpose);
  const exportId = cleanId(input.exportId || `institutional_trust_export:${input.audience}:${input.purpose}`);
  const policyDecisions: AttestationPolicyDecision[] = [];
  const exportSummaries: InstitutionalTrustExportPackage["exportSummaries"] = [];
  const blockedReasons: string[] = [];

  if (!mapping.portableAudience || !mapping.portablePurpose) {
    blockedReasons.push("Institutional trust export audience and purpose are not portable in this context.");
  }

  if (!attestations.length) {
    blockedReasons.push("No portable attestations were provided for institution-safe trust export.");
  }

  if (mapping.portableAudience && mapping.portablePurpose) {
    for (const attestation of attestations) {
      const { decision, exportSummary } = buildPolicySafeExportSummary(attestation, {
        operation: "export",
        requestedAudience: mapping.portableAudience,
        requestedPurpose: mapping.portablePurpose,
        generatedAt,
        sensitivity: "confidential",
        publicRequest: false,
      });
      policyDecisions.push(decision);
      if (exportSummary) exportSummaries.push(exportSummary);
    }
  }

  blockedReasons.push(...policyReasonLines(policyDecisions));

  const uniqueBlockedReasons = Array.from(new Set(blockedReasons));
  const status = exportSummaries.length ? "export_ready" : uniqueBlockedReasons.length ? "blocked" : "unavailable";
  const lifecycle = status === "export_ready" ? "policy_evaluated" : attestations.length ? "blocked" : "empty";
  const lifecycleControl = lifecycleControlFor({
    status,
    lifecycle,
    generatedAt,
    blockedReasons: uniqueBlockedReasons,
    exportSummaryCount: exportSummaries.length,
  });

  return {
    exportId,
    schemaVersion: "institutional_trust_export.v1",
    audience: input.audience,
    purpose: input.purpose,
    status,
    lifecycle,
    generatedAt,
    lifecycleControl,
    metadataOnly: true,
    consentScoped: true,
    policyGated: true,
    manualOnly: true,
    publicAccessEnabled: false,
    externalSubmissionEnabled: false,
    exportSummaries,
    policyDecisions,
    blockedReasons: uniqueBlockedReasons,
    redactions: REDACTIONS,
    provenance: {
      source: "portable_attestations",
      sourceSchemaVersion: "portable_attestation.v1",
      sourceCount: attestations.length,
      policyGate: "attestation_policy_gate.v1",
    },
    auditMetadata: {
      exportId,
      generatedAt,
      audience: input.audience,
      purpose: input.purpose,
      consentScoped: true,
      policyGated: true,
      manualOnly: true,
      publicAccessEnabled: false,
      externalSubmissionEnabled: false,
      portableAttestationCount: attestations.length,
      exportableAttestationCount: exportSummaries.length,
      blockedAttestationCount: policyDecisions.filter((decision) => !decision.allowed).length,
      policyDecisionCount: policyDecisions.length,
    },
  };
}
