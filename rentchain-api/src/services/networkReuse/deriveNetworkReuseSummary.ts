export type NetworkReuseSummary = {
  reusable: boolean;
  source: "share_package" | "apply_with_rentchain";
  reuseStatus: "available" | "limited" | "not_available";
  consentRequired: true;
  reusePath:
    | "apply_prefill_ready"
    | "share_summary_ready"
    | "share_summary_with_more_available"
    | "not_ready";
  reusePathLabel: string;
  reusePathDescription: string;
  identitySummaryApproved: boolean;
  applicationSummaryApproved: boolean;
  additionalConsentMayUnlock: boolean;
};

type Input = {
  applicationSource?: "apply_with_rentchain" | null;
  identityReference?: {
    source?: "rentchain";
    referenceType?: "tenant_identity_reference";
    referenceStatus?: "available" | "limited" | "not_ready";
  } | null;
  approvedScopeKeys?: Array<
    | "identity_summary"
    | "credibility_summary"
    | "application_summary"
    | "documents_summary"
    | "lease_summary"
    | "payment_readiness_summary"
  > | null;
  portableIdentitySummary?: {
    portabilityStatus: "not_ready" | "ready" | "limited";
    reusableAcrossApplications: boolean;
  } | null;
};

const REUSE_SCOPE_KEYS = new Set(["identity_summary", "application_summary"]);

function hasScope(approvedScopeKeys: Input["approvedScopeKeys"], scopeKey: string): boolean {
  return Array.isArray(approvedScopeKeys)
    ? approvedScopeKeys.some((scope) => String(scope || "") === scopeKey)
    : false;
}

function hasReusableScope(
  approvedScopeKeys: Input["approvedScopeKeys"]
): boolean {
  return Array.isArray(approvedScopeKeys)
    ? approvedScopeKeys.some((scope) => REUSE_SCOPE_KEYS.has(String(scope || "")))
    : false;
}

export function deriveNetworkReuseSummary(input: Input): NetworkReuseSummary | null {
  const source =
    input.applicationSource === "apply_with_rentchain" ? "apply_with_rentchain" : "share_package";
  const referenceStatus = input.identityReference?.referenceStatus || null;
  const scopeReady = hasReusableScope(input.approvedScopeKeys);
  const identitySummaryApproved = hasScope(input.approvedScopeKeys, "identity_summary");
  const applicationSummaryApproved = hasScope(input.approvedScopeKeys, "application_summary");
  const portabilityStatus = input.portableIdentitySummary?.portabilityStatus || "not_ready";
  const reusableAcrossApplications = input.portableIdentitySummary?.reusableAcrossApplications === true;
  const hasSourceMetadata =
    input.applicationSource === "apply_with_rentchain" ||
    Boolean(input.identityReference) ||
    (Array.isArray(input.approvedScopeKeys) && input.approvedScopeKeys.length > 0);

  if (!hasSourceMetadata) {
    return null;
  }

  let reuseStatus: NetworkReuseSummary["reuseStatus"] = "not_available";
  if (referenceStatus === "available" && scopeReady) {
    reuseStatus = "available";
  } else if (
    referenceStatus === "limited" ||
    (referenceStatus === "available" && !scopeReady) ||
    portabilityStatus === "limited" ||
    reusableAcrossApplications
  ) {
    reuseStatus = "limited";
  }

  const additionalConsentMayUnlock = Boolean(referenceStatus && referenceStatus !== "not_ready" && !applicationSummaryApproved);

  let reusePath: NetworkReuseSummary["reusePath"] = "not_ready";
  if (referenceStatus === "available" && identitySummaryApproved && applicationSummaryApproved) {
    reusePath = "apply_prefill_ready";
  } else if (
    (referenceStatus === "available" || referenceStatus === "limited") &&
    (identitySummaryApproved || applicationSummaryApproved) &&
    additionalConsentMayUnlock
  ) {
    reusePath = "share_summary_with_more_available";
  } else if (reuseStatus === "limited" || (referenceStatus === "available" && scopeReady)) {
    reusePath = "share_summary_ready";
  }

  const copy: Record<
    NetworkReuseSummary["reusePath"],
    Pick<NetworkReuseSummary, "reusePathLabel" | "reusePathDescription">
  > = {
    apply_prefill_ready: {
      reusePathLabel: "Apply prefill ready",
      reusePathDescription:
        "Tenant-approved identity and reusable application details are already in scope for the RentChain apply path.",
    },
    share_summary_ready: {
      reusePathLabel: "Summary reuse ready",
      reusePathDescription:
        "Tenant-approved RentChain reuse metadata is available for summary-only follow-through without expanding landlord access.",
    },
    share_summary_with_more_available: {
      reusePathLabel: "More reusable detail available with approval",
      reusePathDescription:
        "Some tenant-approved reuse metadata is already available, and broader reusable application detail may still require additional tenant approval.",
    },
    not_ready: {
      reusePathLabel: "No reusable path ready",
      reusePathDescription:
        "A tenant-approved RentChain reuse path is not currently ready for broader follow-through.",
    },
  };

  return {
    reusable: reuseStatus !== "not_available",
    source,
    reuseStatus,
    consentRequired: true,
    reusePath,
    reusePathLabel: copy[reusePath].reusePathLabel,
    reusePathDescription: copy[reusePath].reusePathDescription,
    identitySummaryApproved,
    applicationSummaryApproved,
    additionalConsentMayUnlock,
  };
}
