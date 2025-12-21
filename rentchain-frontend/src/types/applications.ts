// @ts-nocheck
// Shared application types for UI components
import type {
  Application as ApiApplication,
  ApplicationStatus as ApiApplicationStatus,
} from "@/api/applicationsApi";

export type ApplicationStatus = ApiApplicationStatus;

export type ApplicantRole = "primary" | "co_applicant";

export type Applicant = {
  id: string;
  role: ApplicantRole;

  fullName: string;
  dateOfBirth?: string | null;
  socialInsuranceNumber?: string | null;

  monthlyIncome?: number | null;

  currentAddress?: string | null;
  currentCity?: string | null;
  currentProvince?: string | null;
  currentPostalCode?: string | null;

  landlordReferenceName?: string | null;
  landlordReferencePhone?: string | null;

  employmentReferenceName?: string | null;
  employmentReferencePhone?: string | null;

  bankReferenceName?: string | null;
  bankReferenceAccountMasked?: string | null;

  vehicleMake?: string | null;
  vehicleModel?: string | null;
  vehicleYear?: number | null;
  vehiclePlate?: string | null;

  notes?: string | null;
};

// Extend the existing Application shape with optional co-signer fields (keep all existing fields).
export interface Application extends ApiApplication {
  applicants?: Applicant[];
  coSignerName?: string | null;
  coSignerRelationship?: string | null;
  coSignerMonthlyIncome?: number | null;

  applicantName?: string | null;
  unitLabel?: string | null;
  monthlyRent?: number | null;

  // Applicant details
  socialInsuranceNumber?: string | null;
  dateOfBirth?: string | null;
  currentAddress?: string | null;
  currentCity?: string | null;
  currentProvince?: string | null;
  currentPostalCode?: string | null;

  // References
  landlordReferenceName?: string | null;
  landlordReferencePhone?: string | null;
  employmentReferenceName?: string | null;
  employmentReferencePhone?: string | null;
  bankReferenceName?: string | null;
  bankReferenceAccountMasked?: string | null;

  // Vehicle
  vehicleMake?: string | null;
  vehicleModel?: string | null;
  vehicleYear?: number | null;
  vehiclePlate?: string | null;

  // Additional notes
  notes?: string | null;
}

export type ApplicationTimelineEntry = {
  id: string;
  date: string; // ISO or YYYY-MM-DD
  label: string;
  status?: ApplicationStatus;
  notes?: string | null;
  actor?: "tenant" | "landlord" | "system";
};
