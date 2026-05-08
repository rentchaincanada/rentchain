import {
  exportGovernanceMetadata,
  governanceMetadata,
  type GovernanceMetadata,
  type GovernanceSensitivity,
} from "../governance/platformGovernance";

export type LegalDocumentKind = "lease_summary" | "schedule_a" | "lease_notice";

export type LegalDocumentMetadata = {
  documentKind: LegalDocumentKind;
  title: string;
  version: string;
  province: string | null;
  templateKey?: string | null;
  sensitivity: GovernanceSensitivity;
  governance: GovernanceMetadata;
};

export type LegalDocumentField = {
  key: string;
  label: string;
  value: string;
};

export type LegalDocumentSection = {
  id: string;
  title: string;
  fields: LegalDocumentField[];
  body?: string | null;
  layout?: {
    avoidBreakInside?: boolean;
    signatureSafe?: boolean;
  };
};

export type LegalDocumentDefinition = {
  metadata: LegalDocumentMetadata;
  heading: {
    title: string;
    subtitle?: string | null;
    description?: string | null;
  };
  sections: LegalDocumentSection[];
  footer?: string | null;
};

export function legalExportMetadata(params: {
  documentKind: LegalDocumentKind;
  title: string;
  version: string;
  province?: string | null;
  templateKey?: string | null;
  sensitivity?: GovernanceSensitivity;
}): LegalDocumentMetadata {
  const exportType = params.documentKind === "lease_notice" ? "lease_summary" : params.documentKind;
  const defaultGovernance = exportGovernanceMetadata(exportType);
  const sensitivity = params.sensitivity || defaultGovernance.sensitivity;
  const governance =
    sensitivity === defaultGovernance.sensitivity
      ? defaultGovernance
      : governanceMetadata({
          sensitivity,
          retentionCategory: defaultGovernance.retentionCategory,
          redactionApplied: defaultGovernance.redactionApplied,
        });
  return {
    documentKind: params.documentKind,
    title: params.title,
    version: params.version,
    province: params.province ? String(params.province).trim().toUpperCase() : null,
    templateKey: params.templateKey || null,
    sensitivity,
    governance,
  };
}
