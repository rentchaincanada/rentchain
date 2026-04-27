import type { PortableIdentity } from "../identityPortability/deriveIdentityPortability";

export type IdentityExchangeReferenceStatus = "available" | "limited" | "not_ready";

export type IdentityExchangeReference = {
  referenceType: "tenant_identity_reference";
  referenceStatus: IdentityExchangeReferenceStatus;
  referenceLabel: string;
  referenceDescription: string;
  portabilityStatus: "ready" | "limited" | "not_ready";
  exchangeReadiness: {
    identityReady: boolean;
    credibilityReady: boolean;
    sharingControlsReady: boolean;
    auditTimelineReady: boolean;
    paymentReadinessAvailable: boolean;
  };
};

type DeriveIdentityExchangeReferenceInput = {
  portableIdentity: PortableIdentity | null;
  auditTimelineReady: boolean;
  paymentReadinessAvailable: boolean;
  sharingControlsReady: boolean;
};

function buildCopy(
  status: IdentityExchangeReferenceStatus
): Pick<IdentityExchangeReference, "referenceLabel" | "referenceDescription"> {
  if (status === "available") {
    return {
      referenceLabel: "Identity exchange available",
      referenceDescription:
        "This rental identity can support summary-only exchange requests within the tenant-controlled sharing flow.",
    };
  }

  if (status === "limited") {
    return {
      referenceLabel: "Identity exchange limited",
      referenceDescription:
        "Some exchange-readiness signals are available, but a few identity or workflow details still need attention.",
    };
  }

  return {
    referenceLabel: "Identity exchange not ready",
    referenceDescription:
      "More identity or workflow detail is needed before this rental identity is ready for broader exchange scaffolding.",
  };
}

export function deriveIdentityExchangeReference(
  input: DeriveIdentityExchangeReferenceInput
): IdentityExchangeReference {
  const portableIdentity = input.portableIdentity || null;
  const identityReady = Boolean(portableIdentity?.readiness.identityReady);
  const credibilityReady = Boolean(portableIdentity?.readiness.credibilityReady);
  const sharingControlsReady = Boolean(input.sharingControlsReady);
  const auditTimelineReady = Boolean(input.auditTimelineReady);
  const paymentReadinessAvailable = Boolean(input.paymentReadinessAvailable);
  const portabilityStatus = portableIdentity?.portabilityStatus || "not_ready";

  let referenceStatus: IdentityExchangeReferenceStatus = "not_ready";
  if (identityReady && credibilityReady && sharingControlsReady) {
    referenceStatus = "available";
  } else if (
    identityReady ||
    credibilityReady ||
    sharingControlsReady ||
    auditTimelineReady ||
    paymentReadinessAvailable ||
    portabilityStatus === "limited" ||
    portabilityStatus === "ready"
  ) {
    referenceStatus = "limited";
  }

  const copy = buildCopy(referenceStatus);
  return {
    referenceType: "tenant_identity_reference",
    referenceStatus,
    referenceLabel: copy.referenceLabel,
    referenceDescription: copy.referenceDescription,
    portabilityStatus,
    exchangeReadiness: {
      identityReady,
      credibilityReady,
      sharingControlsReady,
      auditTimelineReady,
      paymentReadinessAvailable,
    },
  };
}
