import { apiFetch } from "./apiFetch";

export type RentalDebtStatus = "verified" | "partially_verified" | "review_required" | "blocked" | "unknown";
export type DebtReferenceType = "payment_default" | "delinquency" | "dispute" | "consent" | "review" | "evidence" | "audit";
export type DebtReferenceStatus = "verified" | "partially_verified" | "blocked" | "unavailable";

export type DebtReference = {
  referenceId: string;
  referenceType: DebtReferenceType;
  status: DebtReferenceStatus;
  label: string;
  description: string;
  reviewRequired: true;
  lineageReferences: string[];
  destination: string | null;
  redacted: boolean;
  redactionReason: string | null;
  blockedReason: string | null;
};

export type DebtRestriction = {
  restrictionId: string;
  restrictionType: DebtReferenceType | "collections_execution" | "bureau_reporting" | "public_debt_exposure";
  status: "visible" | "blocked" | "review_required";
  label: string;
  description: string;
  blockedReason: string | null;
};

export type RentalDebtProfile = {
  rentalDebtId: string;
  status: RentalDebtStatus;
  landlordId: string;
  tenantId: string;
  manualReviewRequired: true;
  collectionsExecutionEnabled: false;
  bureauReportingEnabled: false;
  publicDebtExposureEnabled: false;
  generatedAt: string;
  summary: {
    totalReferences: number;
    verifiedReferences: number;
    partiallyVerifiedReferences: number;
    blockedReferences: number;
    unavailableReferences: number;
    restrictions: number;
  };
  paymentDefaultReferences: DebtReference[];
  delinquencyReferences: DebtReference[];
  disputeReferences: DebtReference[];
  consentReferences: DebtReference[];
  reviewReferences: DebtReference[];
  evidenceReferences: DebtReference[];
  auditReferences: DebtReference[];
  debtRestrictions: DebtRestriction[];
  redactions: string[];
  blockedReasons: string[];
  canonicalEvents: Array<{ eventType: string; action: string; status: RentalDebtStatus; resourceId: string; summary: string }>;
};

export async function fetchRentalDebtProfiles(params?: {
  tenantId?: string;
  status?: RentalDebtStatus | "";
}): Promise<RentalDebtProfile[]> {
  const search = new URLSearchParams();
  if (params?.tenantId) search.set("tenantId", params.tenantId);
  if (params?.status) search.set("status", params.status);
  const suffix = search.toString() ? `?${search.toString()}` : "";
  const response = await apiFetch<{ ok: true; profiles: RentalDebtProfile[] }>(`/landlord/rental-debt${suffix}`);
  return response.profiles;
}

export async function fetchRentalDebtProfile(rentalDebtId: string): Promise<RentalDebtProfile> {
  const response = await apiFetch<{ ok: true; profile: RentalDebtProfile }>(
    `/landlord/rental-debt/${encodeURIComponent(rentalDebtId)}`
  );
  return response.profile;
}
