export type SupportedLeaseWorkflowProvince = "NS" | "ON";

export type JurisdictionWorkflowConfidence = "high" | "medium" | "low";

export type JurisdictionNoticeType =
  | "rent_increase"
  | "termination"
  | "inspection"
  | "renewal_review";

export type JurisdictionLeaseType = "fixed_term" | "year_to_year" | "month_to_month";

export type JurisdictionWorkflowConfig = {
  province: SupportedLeaseWorkflowProvince;
  provinceLabel: string;
  country: "CA";
  workflowVersion: "jurisdiction-workflow-v1";
  leaseTemplateType: "standard_residential_ns_form_p" | "standard_residential_on";
  legalAdviceDisclaimer: string;
  noticePeriods: {
    rentIncreaseDays: number;
    entryNoticeHours: number;
    leaseTerminationDays: number;
    leaseTerminationByLeaseType: Partial<Record<JurisdictionLeaseType, number>>;
  };
  supportsDigitalSigning: boolean;
  requiresDepositRules: boolean;
  defaultWorkflow: {
    leaseRenewalReminderDays: number;
    moveOutPreparationDays: number;
  };
  leaseLifecycleExpectations: {
    fixedTermContinuation: "ends_on_term_end" | "continues_periodic";
    periodicContinuation: "continues_until_notice";
    activeRequiresExecutionReview: boolean;
  };
  supportedNoticeTypes: JurisdictionNoticeType[];
  guidance: {
    leaseCreation: string[];
    renewalReview: string[];
    moveOutReview: string[];
  };
  sources: Array<{
    label: string;
    url: string;
    accessedAt: "2026-05-17";
  }>;
  confidence: JurisdictionWorkflowConfidence;
};

export type JurisdictionWorkflowSummary = Pick<
  JurisdictionWorkflowConfig,
  | "province"
  | "provinceLabel"
  | "country"
  | "workflowVersion"
  | "leaseTemplateType"
  | "legalAdviceDisclaimer"
  | "noticePeriods"
  | "supportsDigitalSigning"
  | "requiresDepositRules"
  | "defaultWorkflow"
  | "leaseLifecycleExpectations"
  | "supportedNoticeTypes"
  | "guidance"
  | "confidence"
>;

const LEGAL_ADVICE_DISCLAIMER =
  "RentChain provides operational workflow guidance only. It does not provide legal advice, create legal conclusions, or replace review of current provincial forms and rules.";

const WORKFLOW_REGISTRY: Record<SupportedLeaseWorkflowProvince, JurisdictionWorkflowConfig> = {
  NS: {
    province: "NS",
    provinceLabel: "Nova Scotia",
    country: "CA",
    workflowVersion: "jurisdiction-workflow-v1",
    leaseTemplateType: "standard_residential_ns_form_p",
    legalAdviceDisclaimer: LEGAL_ADVICE_DISCLAIMER,
    noticePeriods: {
      rentIncreaseDays: 120,
      entryNoticeHours: 24,
      leaseTerminationDays: 90,
      leaseTerminationByLeaseType: {
        fixed_term: 0,
        year_to_year: 90,
        month_to_month: 30,
      },
    },
    supportsDigitalSigning: true,
    requiresDepositRules: true,
    defaultWorkflow: {
      leaseRenewalReminderDays: 90,
      moveOutPreparationDays: 30,
    },
    leaseLifecycleExpectations: {
      fixedTermContinuation: "ends_on_term_end",
      periodicContinuation: "continues_until_notice",
      activeRequiresExecutionReview: true,
    },
    supportedNoticeTypes: ["rent_increase", "termination", "inspection", "renewal_review"],
    guidance: {
      leaseCreation: [
        "Use the Nova Scotia standard form lease workflow metadata for lease package selection.",
        "Treat fixed-term continuation as requiring explicit written follow-through before assuming renewal.",
      ],
      renewalReview: [
        "Review renewal or move-out workflow before the lease end date.",
        "Do not automatically generate or send formal notices from this metadata alone.",
      ],
      moveOutReview: [
        "Surface move-out preparation as an operational reminder.",
        "Keep notice validation and legal form selection as human-reviewed steps.",
      ],
    },
    sources: [
      {
        label: "Nova Scotia rent cap facts",
        url: "https://novascotia.ca/residential-tenancies-tenants-and-landlords/docs/rent-cap-facts-en.pdf",
        accessedAt: "2026-05-17",
      },
      {
        label: "Nova Scotia Standard Form of Lease (Form P)",
        url: "https://www.novascotia.ca/standard-form-lease-form-p",
        accessedAt: "2026-05-17",
      },
    ],
    confidence: "medium",
  },
  ON: {
    province: "ON",
    provinceLabel: "Ontario",
    country: "CA",
    workflowVersion: "jurisdiction-workflow-v1",
    leaseTemplateType: "standard_residential_on",
    legalAdviceDisclaimer: LEGAL_ADVICE_DISCLAIMER,
    noticePeriods: {
      rentIncreaseDays: 90,
      entryNoticeHours: 24,
      leaseTerminationDays: 60,
      leaseTerminationByLeaseType: {
        fixed_term: 60,
        month_to_month: 60,
      },
    },
    supportsDigitalSigning: true,
    requiresDepositRules: true,
    defaultWorkflow: {
      leaseRenewalReminderDays: 60,
      moveOutPreparationDays: 30,
    },
    leaseLifecycleExpectations: {
      fixedTermContinuation: "continues_periodic",
      periodicContinuation: "continues_until_notice",
      activeRequiresExecutionReview: true,
    },
    supportedNoticeTypes: ["rent_increase", "termination", "inspection", "renewal_review"],
    guidance: {
      leaseCreation: [
        "Use Ontario standard lease workflow metadata for lease package selection.",
        "Do not treat the end of a fixed term as automatic tenant move-out.",
      ],
      renewalReview: [
        "Surface lease end review as an operational checkpoint, not as a legal conclusion.",
        "Keep formal notice selection and delivery human-reviewed.",
      ],
      moveOutReview: [
        "Surface tenant move-out planning as a review workflow.",
        "Do not automatically infer vacant possession from lease end dates.",
      ],
    },
    sources: [
      {
        label: "Ontario residential rent increases",
        url: "https://www.ontario.ca/page/residential-rent-increases",
        accessedAt: "2026-05-17",
      },
      {
        label: "Landlord and Tenant Board guide to the Residential Tenancies Act",
        url: "https://tm2.tribunalsontario.ca/documents/ltb/Brochures/Guide%20to%20RTA%20%28English%29.html",
        accessedAt: "2026-05-17",
      },
    ],
    confidence: "medium",
  },
};

function normalizeProvinceValue(input: unknown): string {
  const value = String(input || "").trim().toUpperCase();
  if (value === "NOVA SCOTIA") return "NS";
  if (value === "ONTARIO") return "ON";
  return value;
}

export function normalizeLeaseWorkflowProvince(input: unknown): SupportedLeaseWorkflowProvince | null {
  const normalized = normalizeProvinceValue(input);
  if (normalized === "NS" || normalized === "ON") return normalized;
  return null;
}

export function getJurisdictionWorkflowConfig(
  provinceInput: unknown
): JurisdictionWorkflowConfig | null {
  const province = normalizeLeaseWorkflowProvince(provinceInput);
  return province ? WORKFLOW_REGISTRY[province] : null;
}

export function getJurisdictionWorkflow(provinceInput: unknown): JurisdictionWorkflowConfig | null {
  return getJurisdictionWorkflowConfig(provinceInput);
}

export function getLeaseWorkflowConfig(provinceInput: unknown): JurisdictionWorkflowConfig | null {
  return getJurisdictionWorkflowConfig(provinceInput);
}

export function getProvinceOperationalRules(provinceInput: unknown): JurisdictionWorkflowSummary | null {
  const config = getJurisdictionWorkflowConfig(provinceInput);
  return config ? toJurisdictionWorkflowSummary(config) : null;
}

export function listJurisdictionWorkflowConfigs(): JurisdictionWorkflowConfig[] {
  return Object.values(WORKFLOW_REGISTRY);
}

export function listSupportedJurisdictionWorkflowProvinces(): SupportedLeaseWorkflowProvince[] {
  return Object.keys(WORKFLOW_REGISTRY) as SupportedLeaseWorkflowProvince[];
}

export function toJurisdictionWorkflowSummary(
  config: JurisdictionWorkflowConfig
): JurisdictionWorkflowSummary {
  return {
    province: config.province,
    provinceLabel: config.provinceLabel,
    country: config.country,
    workflowVersion: config.workflowVersion,
    leaseTemplateType: config.leaseTemplateType,
    legalAdviceDisclaimer: config.legalAdviceDisclaimer,
    noticePeriods: config.noticePeriods,
    supportsDigitalSigning: config.supportsDigitalSigning,
    requiresDepositRules: config.requiresDepositRules,
    defaultWorkflow: config.defaultWorkflow,
    leaseLifecycleExpectations: config.leaseLifecycleExpectations,
    supportedNoticeTypes: config.supportedNoticeTypes,
    guidance: config.guidance,
    confidence: config.confidence,
  };
}
