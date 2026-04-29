import type { InstitutionalIdentityPackage } from "./deriveInstitutionalIdentityPackage";
import type { ComplianceReadiness } from "../compliance/deriveComplianceReadiness";

export type InstitutionalExportV2 = {
  schema: {
    name: "rentchain.institutional_identity_package";
    version: "2.0";
    generatedAt: string;
    jurisdiction: "CA";
    dataScope: "tenant_controlled_export";
    consentRequired: true;
  };
  subject: {
    subjectType: "tenant";
    identityStatus: "incomplete" | "limited" | "ready" | "verified";
    verificationLevel: "none" | "partial" | "strong";
    completenessLevel: "low" | "medium" | "high";
  };
  identity: {
    portabilityStatus: "not_ready" | "limited" | "ready";
    identityReadiness: "incomplete" | "limited" | "ready" | "verified";
    credibilityReadiness: "low" | "medium" | "high";
  };
  rentalHistory: {
    activeLeaseAvailable: boolean;
    leaseExecutionStatus: "not_available" | "draft" | "pending_signature" | "executed" | "blocked";
    leaseSummaryAvailable: boolean;
  };
  paymentReadiness: {
    rentTermsReady: boolean;
    paymentRailAvailable: boolean;
    latestPaymentStatus?: "not_available" | "checkout_created" | "pending" | "paid" | "failed" | "canceled" | "expired";
  };
  audit: {
    auditTrailAvailable: boolean;
    totalIdentityEvents: number;
    recentActivityAvailable: boolean;
  };
  validation: {
    status: "valid" | "valid_with_warnings" | "invalid";
    warnings: string[];
    missingRecommendedFields: string[];
  };
  complianceReadiness: ComplianceReadiness;
  extensions: {
    reserved: Record<string, never>;
  };
};

type DeriveInstitutionalSchemaV2Input = {
  packageV1: InstitutionalIdentityPackage;
  latestPaymentStatus?:
    | "setup_required"
    | "checkout_created"
    | "payment_pending"
    | "paid"
    | "failed"
    | "canceled"
    | "expired"
    | null;
};

function normalizeLeaseExecutionStatus(
  value: InstitutionalIdentityPackage["leaseSummary"]["leaseExecutionStatus"]
): InstitutionalExportV2["rentalHistory"]["leaseExecutionStatus"] {
  switch (value) {
    case "ready_for_tenant_signature":
    case "tenant_signed":
    case "ready_for_landlord_signature":
    case "landlord_signed":
      return "pending_signature";
    case "fully_executed":
      return "executed";
    case "draft":
      return "draft";
    case "blocked":
      return "blocked";
    case "not_available":
    default:
      return "not_available";
  }
}

function normalizePaymentStatus(
  value: DeriveInstitutionalSchemaV2Input["latestPaymentStatus"]
): InstitutionalExportV2["paymentReadiness"]["latestPaymentStatus"] {
  switch (value) {
    case "setup_required":
      return "not_available";
    case "checkout_created":
      return "checkout_created";
    case "payment_pending":
      return "pending";
    case "paid":
      return "paid";
    case "failed":
      return "failed";
    case "canceled":
      return "canceled";
    case "expired":
      return "expired";
    case null:
    case undefined:
    default:
      return "not_available";
  }
}

export function deriveInstitutionalSchemaV2(input: DeriveInstitutionalSchemaV2Input): InstitutionalExportV2 {
  const packageV1 = input.packageV1;
  return {
    schema: {
      name: "rentchain.institutional_identity_package",
      version: "2.0",
      generatedAt: packageV1.metadata.generatedAt,
      jurisdiction: "CA",
      dataScope: "tenant_controlled_export",
      consentRequired: true,
    },
    subject: {
      subjectType: "tenant",
      identityStatus: packageV1.identitySummary.identityStatus,
      verificationLevel: packageV1.identitySummary.verificationLevel,
      completenessLevel: packageV1.identitySummary.completenessLevel,
    },
    identity: {
      portabilityStatus: packageV1.portabilitySummary?.portabilityStatus || "not_ready",
      identityReadiness: packageV1.identitySummary.identityStatus,
      credibilityReadiness: packageV1.credibilitySummary.completenessLevel,
    },
    rentalHistory: {
      activeLeaseAvailable: packageV1.leaseSummary.activeLease,
      leaseExecutionStatus: normalizeLeaseExecutionStatus(packageV1.leaseSummary.leaseExecutionStatus),
      leaseSummaryAvailable: packageV1.leaseSummary.leaseExecutionStatus !== "not_available",
    },
    paymentReadiness: {
      rentTermsReady: packageV1.paymentReadinessSummary.readinessStatus === "ready_to_configure",
      paymentRailAvailable: normalizePaymentStatus(input.latestPaymentStatus) !== "not_available",
      latestPaymentStatus: normalizePaymentStatus(input.latestPaymentStatus),
    },
    audit: {
      auditTrailAvailable: packageV1.auditSummary.totalEvents > 0,
      totalIdentityEvents: packageV1.auditSummary.totalEvents,
      recentActivityAvailable: packageV1.auditSummary.recentActivity.length > 0,
    },
    validation: {
      status: "valid",
      warnings: [],
      missingRecommendedFields: [],
    },
    complianceReadiness: {
      readinessStatus: "partial",
      readinessLabel: "Compliance readiness pending",
      readinessDescription:
        "Compliance readiness is attached during tenant-controlled schema export generation.",
      checks: [],
      exportTraceability: {
        exportAvailable: false,
        schemaVersion: "2.0",
        exportStorage: "not_stored",
        outboundTransfer: "none",
      },
      auditTraceability: {
        traceabilityStatus: "limited",
        traceabilityLabel: "Limited",
        traceabilityDescription:
          "Audit traceability is attached during tenant-controlled schema export generation.",
        evidenceCoverage: {
          identityTimelineAvailable: false,
          exportGeneratedOnDemand: true,
          exportStoredByRentChain: false,
          handoffDraftMetadataAvailable: false,
          manualReleasePreparationAvailable: false,
          observabilityCoverage: "none",
          canonicalInstitutionEventsAvailable: false,
        },
        readinessGaps: [
          "institutional_export_events_not_recorded",
          "institutional_handoff_lifecycle_events_limited",
          "access_audit_summary_not_available",
        ],
      },
    },
    extensions: {
      reserved: {},
    },
  };
}
