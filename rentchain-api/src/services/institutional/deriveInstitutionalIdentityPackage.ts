import type { PortableIdentity } from "../identityPortability/deriveIdentityPortability";
import type { LeaseExecution } from "../leaseExecution/deriveLeaseExecution";
import type { PaymentReadiness } from "../paymentReadiness/derivePaymentReadiness";
import type { LandlordSafeTenantCredibilitySummary } from "../tenantCredibility/deriveTenantCredibilitySignals";
import type { IdentityTimeline } from "../identityTimeline/deriveIdentityTimeline";
import type { TenantIdentityRecord } from "../tenantPortal/tenantProfileService";

export type InstitutionalIdentityPackage = {
  identitySummary: {
    identityStatus: "incomplete" | "ready" | "verified" | "limited";
    verificationLevel: "none" | "partial" | "strong";
    completenessLevel: "low" | "medium" | "high";
    readinessLabel: string;
  };
  credibilitySummary: {
    completenessLevel: "low" | "medium" | "high";
    verificationLevel: "none" | "partial" | "strong";
    summaryLabel: string;
    summaryDescription: string;
  };
  leaseSummary: {
    activeLease: boolean;
    leaseExecutionStatus:
      | "draft"
      | "ready_for_tenant_signature"
      | "tenant_signed"
      | "ready_for_landlord_signature"
      | "landlord_signed"
      | "fully_executed"
      | "blocked"
      | "not_available";
  };
  paymentReadinessSummary: {
    readinessStatus: "not_ready" | "ready_to_configure" | "blocked" | "not_available";
    readinessLabel: string;
    readinessDescription: string;
  };
  auditSummary: {
    totalEvents: number;
    recentActivity: Array<{
      type:
        | "application.created"
        | "application.submitted"
        | "screening_consent_confirmed"
        | "screening.completed"
        | "lease.created"
        | "lease.activated"
        | "lease.tenant_signed";
      label: string;
      occurredAt: string;
    }>;
  };
  portabilitySummary?: {
    portabilityStatus: "not_ready" | "ready" | "limited";
    portabilityLabel: string;
    reusableAcrossApplications: boolean;
  };
  metadata: {
    generatedAt: string;
    dataScope: "tenant_controlled_institutional_readiness";
    consentRequired: true;
  };
};

type DeriveInstitutionalIdentityPackageInput = {
  tenantIdentityRecord: TenantIdentityRecord | null;
  credibilitySummary: LandlordSafeTenantCredibilitySummary | null;
  leaseExecution: LeaseExecution | null;
  paymentReadiness: PaymentReadiness | null;
  identityTimeline: IdentityTimeline | null;
  portableIdentity?: PortableIdentity | null;
  leaseStatus?: string | null;
};

function deriveCompletenessLevel(
  tenantIdentityRecord: TenantIdentityRecord | null,
  credibilitySummary: LandlordSafeTenantCredibilitySummary | null
): "low" | "medium" | "high" {
  if (credibilitySummary?.completenessLevel) return credibilitySummary.completenessLevel;
  if (!tenantIdentityRecord) return "low";
  if (tenantIdentityRecord.identityStatus === "verified") return "high";
  if (tenantIdentityRecord.identityStatus === "ready") return "medium";
  return "low";
}

function normalizeLeaseExecutionStatus(
  leaseExecution: LeaseExecution | null
): InstitutionalIdentityPackage["leaseSummary"]["leaseExecutionStatus"] {
  if (!leaseExecution) return "not_available";
  return leaseExecution.executionStatus;
}

function hasActiveLease(
  leaseStatus: string | null | undefined,
  leaseExecution: LeaseExecution | null
): boolean {
  const normalized = String(leaseStatus || "").trim().toLowerCase();
  if (["active", "current", "signed"].includes(normalized)) return true;
  return Boolean(
    leaseExecution &&
      ["tenant_signed", "ready_for_landlord_signature", "landlord_signed", "fully_executed"].includes(
        leaseExecution.executionStatus
      )
  );
}

export function deriveInstitutionalIdentityPackage(
  input: DeriveInstitutionalIdentityPackageInput
): InstitutionalIdentityPackage {
  const tenantIdentityRecord = input.tenantIdentityRecord || null;
  const credibilitySummary = input.credibilitySummary || null;
  const leaseExecution = input.leaseExecution || null;
  const paymentReadiness = input.paymentReadiness || null;
  const identityTimeline = input.identityTimeline || { events: [] };
  const portableIdentity = input.portableIdentity || null;
  const completenessLevel = deriveCompletenessLevel(tenantIdentityRecord, credibilitySummary);

  return {
    identitySummary: {
      identityStatus: tenantIdentityRecord?.identityStatus || "incomplete",
      verificationLevel: tenantIdentityRecord?.verification.level || "none",
      completenessLevel,
      readinessLabel: tenantIdentityRecord?.readinessLabel || "More details needed",
    },
    credibilitySummary: {
      completenessLevel: credibilitySummary?.completenessLevel || "low",
      verificationLevel: credibilitySummary?.verificationLevel || "none",
      summaryLabel: credibilitySummary?.summaryLabel || "Getting started",
      summaryDescription:
        credibilitySummary?.summaryDescription ||
        "Credibility signals are still limited in the current tenant-controlled record.",
    },
    leaseSummary: {
      activeLease: hasActiveLease(input.leaseStatus, leaseExecution),
      leaseExecutionStatus: normalizeLeaseExecutionStatus(leaseExecution),
    },
    paymentReadinessSummary: paymentReadiness
      ? {
          readinessStatus: paymentReadiness.readinessStatus,
          readinessLabel: paymentReadiness.readinessLabel,
          readinessDescription: paymentReadiness.readinessDescription,
        }
      : {
          readinessStatus: "not_available",
          readinessLabel: "Payment readiness unavailable",
          readinessDescription: "Payment readiness is not available in the current tenant-safe lease projection.",
        },
    auditSummary: {
      totalEvents: Array.isArray(identityTimeline.events) ? identityTimeline.events.length : 0,
      recentActivity: (Array.isArray(identityTimeline.events) ? identityTimeline.events : []).slice(-5).reverse(),
    },
    portabilitySummary: portableIdentity
      ? {
          portabilityStatus: portableIdentity.portabilityStatus,
          portabilityLabel: portableIdentity.portabilityLabel,
          reusableAcrossApplications: portableIdentity.reusableAcrossApplications,
        }
      : undefined,
    metadata: {
      generatedAt: new Date().toISOString(),
      dataScope: "tenant_controlled_institutional_readiness",
      consentRequired: true,
    },
  };
}
