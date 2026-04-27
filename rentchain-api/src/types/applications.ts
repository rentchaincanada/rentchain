export type ApplicationStatus =
  | "new"
  | "in_review"
  | "approved"
  | "rejected"
  | "submitted"
  | "converted";

export interface Application {
  id: string;
  landlordId?: string;
  fullName: string;
  applicantFullName?: string;
  firstName?: string;
  middleName?: string | null;
  lastName?: string;
  email: string;
  phone: string;
  applicantEmail: string;
  applicantPhone?: string;
  consentCreditCheck: boolean;
  phoneVerified?: boolean;
  phoneVerificationStatus?: "unverified" | "pending" | "verified";
  phoneVerifiedAt?: string | null;
  emailVerified?: boolean;
  referencesContacted?: boolean;
  referencesContactedAt?: string | null;
  referencesNotes?: string | null;
  screeningStatus?:
    | "not_ready"
    | "ready"
    | "requested"
    | "paid"
    | "processing"
    | "complete"
    | "completed"
    | "failed"
    | "ineligible";
  screeningPaidAt?: number | null;
  screeningStartedAt?: number | null;
  screeningCompletedAt?: number | null;
  screeningFailedAt?: number | null;
  screeningFailureCode?: string | null;
  screeningFailureDetail?: string | null;
  screeningProvider?: string | null;
  screeningResultId?: string | null;
  screeningResultSummary?: {
    overall: "pass" | "review" | "fail" | "unknown";
    scoreBand?: "A" | "B" | "C" | "D" | "E";
    flags?: string[];
    updatedAt?: number;
  } | null;
  screeningLastUpdatedAt?: number | null;
  screeningRequestId?: string;
  propertyId: string;
  propertyName: string;
  unit: string;
  unitApplied?: string;
  leaseStartDate?: string | null;
  dateOfBirth: string;
  sin?: string | null;
  sinProvided?: boolean;
  sinLast4?: string | null;
  status: ApplicationStatus;
  riskLevel: "Low" | "Medium" | "High";
  score: number;
  monthlyIncome: number;
  requestedRent: number;
  rentToIncomeRatio: number;
  moveInDate: string | null;
  createdAt: string;
  submittedAt?: string;
  inReviewAt?: string | null;
  approvedAt?: string | null;
  rejectedAt?: string | null;
  notes?: string;
  flags?: string[];
  primaryAddress?: {
    address?: string;
    city?: string;
    provinceState?: string;
    postalCode?: string;
  };
  recentAddress: {
    streetNumber: string;
    streetName: string;
    city: string;
    province: string;
    postalCode: string;
  };
  coApplicant?: {
    fullName?: string;
    email?: string;
    phone?: string;
    monthlyIncome?: number;
    address?: string;
    city?: string;
    provinceState?: string;
    postalCode?: string;
  };
  household?: {
    otherOccupants?: string;
    pets?: string;
    vehicles?: string;
    notes?: string;
  };
  references?: {
    currentLandlordName?: string;
    currentLandlordPhone?: string;
  };
  cosignerRequested?: boolean;
  tenantId?: string | null;
  leaseId?: string | null;
  ledgerEventId?: string | null;
  convertedAt?: string | null;
  convertedTenantId?: string | null;
  screeningId?: string | null;
  updatedAt?: string | null;
  applicationSource?: "apply_with_rentchain" | null;
  identityReference?: {
    source: "rentchain";
    referenceType: "tenant_identity_reference";
    referenceStatus: "available" | "limited" | "not_ready";
  } | null;
  approvedScopeKeys?: Array<
    | "identity_summary"
    | "credibility_summary"
    | "application_summary"
    | "documents_summary"
    | "lease_summary"
    | "payment_readiness_summary"
  > | null;
}
