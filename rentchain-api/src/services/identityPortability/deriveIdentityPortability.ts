import type { LandlordSafeTenantCredibilitySummary } from "../tenantCredibility/deriveTenantCredibilitySignals";
import type { TenantIdentityRecord } from "../tenantPortal/tenantProfileService";

export type PortableIdentityStatus = "not_ready" | "ready" | "limited";

export type PortableIdentity = {
  portabilityStatus: PortableIdentityStatus;
  portabilityLabel: string;
  portabilityDescription: string;
  reusableAcrossApplications: boolean;
  identityReference: {
    referenceType: "tenant_identity";
    referenceStatus: "active" | "limited";
  };
  readiness: {
    identityReady: boolean;
    applicationReusable: boolean;
    credibilityReady: boolean;
    sharingEnabled: boolean;
  };
  nextAction: "complete_identity" | "enable_sharing" | "review_reusability" | "none";
};

export type PortableIdentitySummary = {
  portabilityStatus: PortableIdentityStatus;
  portabilityLabel: string;
  portabilityDescription: string;
  reusableAcrossApplications: boolean;
};

type DeriveIdentityPortabilityInput = {
  tenantIdentityRecord: TenantIdentityRecord | null;
  credibilitySummary: LandlordSafeTenantCredibilitySummary | null;
  shareAvailability: {
    sharingEnabled: boolean;
  };
  timelineAvailability?: {
    hasIdentityTimeline: boolean;
  } | null;
};

function buildStatusCopy(
  portabilityStatus: PortableIdentityStatus,
  sharingEnabled: boolean
): Pick<PortableIdentity, "portabilityLabel" | "portabilityDescription" | "nextAction"> {
  if (portabilityStatus === "ready") {
    return {
      portabilityLabel: "Ready to reuse",
      portabilityDescription: sharingEnabled
        ? "Your rental identity is organized for reuse across application contexts, and sharing controls are available when you need them."
        : "Your rental identity is organized for reuse across application contexts.",
      nextAction: sharingEnabled ? "none" : "enable_sharing",
    };
  }

  if (portabilityStatus === "limited") {
    return {
      portabilityLabel: "Almost portable",
      portabilityDescription:
        "Some portability foundations are in place, but a few identity or application details still need attention.",
      nextAction: sharingEnabled ? "review_reusability" : "enable_sharing",
    };
  }

  return {
    portabilityLabel: "More details needed",
    portabilityDescription:
      "Your rental identity needs more complete profile, application, or credibility details before it is ready for broader reuse.",
    nextAction: "complete_identity",
  };
}

export function deriveIdentityPortability(
  input: DeriveIdentityPortabilityInput
): {
  portableIdentity: PortableIdentity;
  portableIdentitySummary: PortableIdentitySummary;
} {
  const record = input.tenantIdentityRecord || null;
  const credibilitySummary = input.credibilitySummary || null;
  const sharingEnabled = Boolean(input.shareAvailability?.sharingEnabled);
  const hasIdentityTimeline = Boolean(input.timelineAvailability?.hasIdentityTimeline);

  const identityReady = Boolean(
    record &&
      (record.identityStatus === "ready" || record.identityStatus === "verified") &&
      record.profile.completionStatus === "complete"
  );
  const applicationReusable = Boolean(record?.application.reusable);
  const credibilityReady = Boolean(
    credibilitySummary &&
      (credibilitySummary.completenessLevel === "high" ||
        (credibilitySummary.completenessLevel === "medium" &&
          credibilitySummary.verificationLevel !== "none"))
  );

  let portabilityStatus: PortableIdentityStatus = "not_ready";
  if (identityReady && applicationReusable && credibilityReady) {
    portabilityStatus = "ready";
  } else if (identityReady || applicationReusable || credibilityReady || sharingEnabled || hasIdentityTimeline) {
    portabilityStatus = "limited";
  }

  const copy = buildStatusCopy(portabilityStatus, sharingEnabled);
  const reusableAcrossApplications = portabilityStatus === "ready" && applicationReusable;

  const portableIdentity: PortableIdentity = {
    portabilityStatus,
    portabilityLabel: copy.portabilityLabel,
    portabilityDescription: copy.portabilityDescription,
    reusableAcrossApplications,
    identityReference: {
      referenceType: "tenant_identity",
      referenceStatus: portabilityStatus === "ready" ? "active" : "limited",
    },
    readiness: {
      identityReady,
      applicationReusable,
      credibilityReady,
      sharingEnabled,
    },
    nextAction: copy.nextAction,
  };

  return {
    portableIdentity,
    portableIdentitySummary: {
      portabilityStatus,
      portabilityLabel: copy.portabilityLabel,
      portabilityDescription: copy.portabilityDescription,
      reusableAcrossApplications,
    },
  };
}
