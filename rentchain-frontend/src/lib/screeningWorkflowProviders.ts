export type ScreeningProviderKey = "transunion" | "certn" | "equifax" | "manual_offline" | "future_provider";

export type ScreeningProviderAvailability = "available" | "coming_soon" | "manual" | "requires_setup" | "unavailable";

export type ScreeningWorkflowState =
  | "not_started"
  | "consent_needed"
  | "provider_selected"
  | "awaiting_applicant"
  | "in_progress"
  | "completed"
  | "manual_review"
  | "blocked"
  | "unavailable";

export type ScreeningProviderOption = {
  key: ScreeningProviderKey;
  label: string;
  availability: ScreeningProviderAvailability;
  capability: string;
  description: string;
  live: boolean;
};

const PROVIDER_BASE: Record<ScreeningProviderKey, Omit<ScreeningProviderOption, "availability" | "live">> = {
  transunion: {
    key: "transunion",
    label: "TransUnion",
    capability: "Credit and identity screening",
    description: "Existing configured provider path. Availability depends on landlord credentials and environment setup.",
  },
  certn: {
    key: "certn",
    label: "Certn",
    capability: "Background and identity workflow candidate",
    description: "Workflow-ready provider candidate. Integration is not active yet.",
  },
  equifax: {
    key: "equifax",
    label: "Equifax",
    capability: "Credit bureau workflow candidate",
    description: "Provider candidate for a future integration path. Integration is not active yet.",
  },
  manual_offline: {
    key: "manual_offline",
    label: "Manual/offline review",
    capability: "Offline document and reference review",
    description: "Use a review workflow when provider screening is unavailable or not appropriate.",
  },
  future_provider: {
    key: "future_provider",
    label: "Future provider",
    capability: "Additional screening provider slot",
    description: "Placeholder for future provider expansion without changing landlord workflow structure.",
  },
};

export function getScreeningProviderOptions(input?: {
  screeningEnabled?: boolean;
  transUnionConnected?: boolean;
}): ScreeningProviderOption[] {
  const screeningEnabled = input?.screeningEnabled !== false;
  const transUnionConnected = Boolean(input?.transUnionConnected);
  const transUnionAvailability: ScreeningProviderAvailability = !screeningEnabled
    ? "unavailable"
    : transUnionConnected
      ? "available"
      : "requires_setup";

  return [
    {
      ...PROVIDER_BASE.transunion,
      availability: transUnionAvailability,
      live: transUnionAvailability === "available",
    },
    {
      ...PROVIDER_BASE.certn,
      availability: "coming_soon",
      live: false,
    },
    {
      ...PROVIDER_BASE.equifax,
      availability: "coming_soon",
      live: false,
    },
    {
      ...PROVIDER_BASE.manual_offline,
      availability: "manual",
      live: screeningEnabled,
    },
    {
      ...PROVIDER_BASE.future_provider,
      availability: "coming_soon",
      live: false,
    },
  ];
}

export function normalizeScreeningWorkflowState(value?: string | null): ScreeningWorkflowState {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "requested") return "awaiting_applicant";
  if (normalized === "processing") return "in_progress";
  if (normalized === "complete") return "completed";
  if (normalized === "completed") return "completed";
  if (normalized === "failed" || normalized === "cancelled") return "manual_review";
  if (normalized === "blocked_transunion_not_connected") return "blocked";
  if (normalized === "pending" || normalized === "provider_selected") return "provider_selected";
  if (normalized === "consent_required" || normalized === "consent_needed") return "consent_needed";
  if (normalized === "unavailable") return "unavailable";
  if (normalized === "in_progress") return "in_progress";
  return "not_started";
}

export function screeningProviderAvailabilityLabel(value: ScreeningProviderAvailability): string {
  switch (value) {
    case "available":
      return "Available";
    case "coming_soon":
      return "Coming soon";
    case "manual":
      return "Manual";
    case "requires_setup":
      return "Requires setup";
    case "unavailable":
      return "Unavailable";
    default:
      return "Unavailable";
  }
}

export function screeningWorkflowStateLabel(value: ScreeningWorkflowState): string {
  switch (value) {
    case "consent_needed":
      return "Consent needed";
    case "provider_selected":
      return "Provider selected";
    case "awaiting_applicant":
      return "Awaiting applicant";
    case "in_progress":
      return "In progress";
    case "completed":
      return "Completed";
    case "manual_review":
      return "Manual review";
    case "blocked":
      return "Blocked";
    case "unavailable":
      return "Unavailable";
    default:
      return "Not started";
  }
}
