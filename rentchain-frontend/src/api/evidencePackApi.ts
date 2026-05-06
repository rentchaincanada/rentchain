import { apiFetch } from "./apiFetch";

export type EvidencePackScope =
  | "decision"
  | "workflow"
  | "delinquency"
  | "institution_export"
  | "audit_compliance"
  | "lease"
  | "property"
  | "tenant"
  | "maintenance"
  | "admin_review";

export type EvidencePackStatus = "ready_for_review" | "incomplete" | "blocked" | "unavailable";
export type EvidenceSectionStatus = "included" | "incomplete" | "blocked" | "unavailable";
export type EvidenceItemStatus = "included" | "redacted" | "blocked" | "unavailable";

export type EvidenceItem = {
  evidenceItemId: string;
  itemType:
    | "decision"
    | "workflow"
    | "operator_review"
    | "canonical_event"
    | "export_section"
    | "readiness_check"
    | "lease_summary"
    | "property_summary"
    | "ledger_summary"
    | "maintenance_summary"
    | "redaction_note";
  label: string;
  description: string;
  status: EvidenceItemStatus;
  source:
    | "decision_inbox"
    | "workflow_routing"
    | "operator_review"
    | "canonical_events"
    | "institution_exports"
    | "audit_compliance"
    | "lease_ledger"
    | "maintenance"
    | "registry"
    | "unknown";
  sourceId: string | null;
  destination: string | null;
  timestamp: string | null;
  redacted: boolean;
  redactionReason: string | null;
  blockedReason: string | null;
};

export type EvidencePackSection = {
  sectionKey:
    | "decision_lineage"
    | "workflow_routing"
    | "operator_review_sessions"
    | "audit_events"
    | "export_readiness"
    | "audit_compliance_readiness"
    | "lease_context"
    | "property_context"
    | "delinquency_context"
    | "maintenance_context"
    | "redaction_summary";
  label: string;
  status: EvidenceSectionStatus;
  itemsCount: number;
  items: EvidenceItem[];
  missingEvidence: string[];
  blockedReasons: string[];
};

export type EvidencePack = {
  evidencePackId: string;
  scope: EvidencePackScope;
  scopeId: string;
  status: EvidencePackStatus;
  manualReviewRequired: true;
  externalSharingEnabled: false;
  certificationIssued: false;
  generatedAt: string;
  summary: {
    totalItems: number;
    includedItems: number;
    redactedItems: number;
    blockedItems: number;
    missingItems: number;
  };
  sections: EvidencePackSection[];
  redactions: Array<{ fieldCategory: string; reason: string }>;
  blockedReasons: string[];
  disclaimers: string[];
};

export type EvidencePackQuery = {
  scope: EvidencePackScope;
  scopeId: string;
  packageType?:
    | "lender_due_diligence"
    | "insurance_review"
    | "government_program_review"
    | "auditor_review"
    | "internal_admin_review";
};

export function evidencePackPath(params: EvidencePackQuery) {
  const search = new URLSearchParams({ scope: params.scope, scopeId: params.scopeId });
  if (params.packageType) search.set("packageType", params.packageType);
  return `/evidence-packs?${search.toString()}`;
}

export async function fetchEvidencePackPreview(params: EvidencePackQuery): Promise<EvidencePack> {
  const search = new URLSearchParams({ scope: params.scope, scopeId: params.scopeId });
  if (params.packageType) search.set("packageType", params.packageType);
  const response = await apiFetch<{ ok: true; evidencePack: EvidencePack }>(
    `/landlord/evidence-packs/preview?${search.toString()}`
  );
  return response.evidencePack;
}
