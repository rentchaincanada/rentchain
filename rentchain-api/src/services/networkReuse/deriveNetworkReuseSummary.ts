export type NetworkReuseSummary = {
  reusable: boolean;
  source: "share_package" | "apply_with_rentchain";
  reuseStatus: "available" | "limited" | "not_available";
  consentRequired: true;
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

  return {
    reusable: reuseStatus !== "not_available",
    source,
    reuseStatus,
    consentRequired: true,
  };
}
