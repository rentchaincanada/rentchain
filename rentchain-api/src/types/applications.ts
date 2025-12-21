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
  screeningStatus?: "not_ready" | "ready" | "requested" | "paid" | "completed" | "failed";
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
}
