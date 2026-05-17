import { normalizeProvinceCode } from "./provinces";

export type LeaseWorkflowProvince = "NS" | "ON";

export type LeaseWorkflowUiConfig = {
  province: LeaseWorkflowProvince;
  badgeLabel: string;
  leaseTemplateType: "standard_residential_ns_form_p" | "standard_residential_on";
  guidanceCopy: string;
  supportsLeaseGeneration: boolean;
};

const GUIDANCE_COPY = "Workflow guidance only - verify local legal requirements.";

const WORKFLOW_UI_CONFIG: Record<LeaseWorkflowProvince, LeaseWorkflowUiConfig> = {
  NS: {
    province: "NS",
    badgeLabel: "NS Residential",
    leaseTemplateType: "standard_residential_ns_form_p",
    guidanceCopy: GUIDANCE_COPY,
    supportsLeaseGeneration: true,
  },
  ON: {
    province: "ON",
    badgeLabel: "ON Residential",
    leaseTemplateType: "standard_residential_on",
    guidanceCopy: GUIDANCE_COPY,
    supportsLeaseGeneration: false,
  },
};

export function getJurisdictionWorkflow(input?: string | null): LeaseWorkflowUiConfig | null {
  const province = normalizeProvinceCode(input);
  if (province === "NS" || province === "ON") return WORKFLOW_UI_CONFIG[province];
  return null;
}

export function getLeaseWorkflowConfig(input?: string | null): LeaseWorkflowUiConfig | null {
  return getJurisdictionWorkflow(input);
}

export function getProvinceOperationalRules(input?: string | null): LeaseWorkflowUiConfig | null {
  return getJurisdictionWorkflow(input);
}
