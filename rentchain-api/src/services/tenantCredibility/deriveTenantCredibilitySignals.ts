import type {
  TenantIdentityRecord,
  TenantIdentityVerificationLevel,
} from "../tenantPortal/tenantProfileService";
import type { LeaseExecution } from "../leaseExecution/deriveLeaseExecution";

export type TenantCredibilitySignalStatus =
  | "not_available"
  | "available"
  | "verified"
  | "incomplete";

export type TenantCredibilitySignalKey =
  | "profile_complete"
  | "application_reusable"
  | "documents_available"
  | "screening_completed"
  | "lease_history_present";

export type TenantCredibilitySignals = {
  signals: Array<{
    key: TenantCredibilitySignalKey;
    label: string;
    description: string;
    status: TenantCredibilitySignalStatus;
  }>;
  summary: {
    completenessLevel: "low" | "medium" | "high";
    verificationLevel: TenantIdentityVerificationLevel;
    summaryLabel: string;
    summaryDescription: string;
  };
};

export type LandlordSafeTenantCredibilitySummary = TenantCredibilitySignals["summary"];

type DeriveTenantCredibilitySignalsInput = {
  tenantIdentityRecord: TenantIdentityRecord | null;
  leaseExecution?: LeaseExecution | null;
};

export function deriveTenantCredibilitySignals(
  input: DeriveTenantCredibilitySignalsInput
): {
  tenantCredibilitySignals: TenantCredibilitySignals;
  landlordSafeSummary: LandlordSafeTenantCredibilitySummary;
} {
  const record = input.tenantIdentityRecord || null;
  const leaseExecution = input.leaseExecution || null;

  const profileSignalStatus: TenantCredibilitySignalStatus = !record
    ? "not_available"
    : record.profile.completionStatus === "complete"
    ? "verified"
    : record.profile.completionStatus === "missing"
    ? "not_available"
    : "incomplete";

  const applicationSignalStatus: TenantCredibilitySignalStatus = !record
    ? "not_available"
    : record.application.reusable
    ? "available"
    : "incomplete";

  const documentSignalStatus: TenantCredibilitySignalStatus = !record
    ? "not_available"
    : record.documents.completionStatus === "complete"
    ? "available"
    : record.documents.completionStatus === "missing"
    ? "not_available"
    : "incomplete";

  const screeningSignalStatus: TenantCredibilitySignalStatus = !record
    ? "not_available"
    : record.screening.status === "completed"
    ? "verified"
    : record.screening.status === "in_progress"
    ? "available"
    : record.screening.status === "not_started"
    ? "not_available"
    : "incomplete";

  const hasLeaseHistory = Boolean(
    record && (record.leases.activeCount > 0 || record.leases.historicalCount > 0)
  );
  const leaseExecutionVerified = Boolean(
    leaseExecution &&
      (leaseExecution.executionStatus === "fully_executed" ||
        leaseExecution.executionStatus === "landlord_signed")
  );
  const leaseSignalStatus: TenantCredibilitySignalStatus = !record
    ? "not_available"
    : hasLeaseHistory
    ? leaseExecutionVerified
      ? "verified"
      : "available"
    : "not_available";

  const signals: TenantCredibilitySignals["signals"] = [
    {
      key: "profile_complete",
      label: "Profile complete",
      description:
        profileSignalStatus === "verified"
          ? "Your core profile details are organized and available."
          : profileSignalStatus === "incomplete"
          ? "Some core profile details still need attention."
          : "Profile details are not available yet.",
      status: profileSignalStatus,
    },
    {
      key: "application_reusable",
      label: "Application reusable",
      description:
        applicationSignalStatus === "available"
          ? "Your application details are organized for reuse."
          : applicationSignalStatus === "incomplete"
          ? "Your application details are still being organized."
          : "Reusable application details are not available yet.",
      status: applicationSignalStatus,
    },
    {
      key: "documents_available",
      label: "Documents available",
      description:
        documentSignalStatus === "available"
          ? "Supporting documents are available in your current tenant-safe record."
          : documentSignalStatus === "incomplete"
          ? "Supporting documents are still incomplete or under review."
          : "Supporting documents are not available yet.",
      status: documentSignalStatus,
    },
    {
      key: "screening_completed",
      label: "Screening completed",
      description:
        screeningSignalStatus === "verified"
          ? "Screening is complete in the current normalized status view."
          : screeningSignalStatus === "available"
          ? "Screening is underway in the current normalized status view."
          : screeningSignalStatus === "incomplete"
          ? "Screening still needs attention in the current normalized status view."
          : "Screening is not available yet in the current normalized status view.",
      status: screeningSignalStatus,
    },
    {
      key: "lease_history_present",
      label: "Lease history present",
      description:
        leaseSignalStatus === "verified"
          ? "Lease history is present with a completed execution signal."
          : leaseSignalStatus === "available"
          ? "Lease history is present in your current record."
          : "Lease history is not available yet.",
      status: leaseSignalStatus,
    },
  ];

  const availableCount = signals.filter(
    (signal) => signal.status === "available" || signal.status === "verified"
  ).length;
  const verifiedCount = signals.filter((signal) => signal.status === "verified").length;
  const completenessLevel: TenantCredibilitySignals["summary"]["completenessLevel"] =
    availableCount >= 4 ? "high" : availableCount >= 2 ? "medium" : "low";
  const verificationLevel: TenantIdentityVerificationLevel =
    record?.verification.level || "none";

  const summaryLabel =
    completenessLevel === "high"
      ? "Credibility established"
      : completenessLevel === "medium"
      ? "Building credibility"
      : "Getting started";
  const summaryDescription =
    completenessLevel === "high"
      ? "Most credibility signals are available in your current record."
      : completenessLevel === "medium"
      ? "Some credibility signals are available, while others are still being organized."
      : verifiedCount > 0
      ? "Only a limited set of credibility signals is available so far."
      : "Credibility signals are still limited in the current record.";

  const summary: TenantCredibilitySignals["summary"] = {
    completenessLevel,
    verificationLevel,
    summaryLabel,
    summaryDescription,
  };

  return {
    tenantCredibilitySignals: {
      signals,
      summary,
    },
    landlordSafeSummary: summary,
  };
}
