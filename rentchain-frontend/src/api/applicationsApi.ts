// rentchain-frontend/src/api/applicationsApi.ts
// Canonical applications API wrapper (uses apiJson/apiFetch only)

import { apiFetch, apiJson } from "@/lib/apiClient";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:3000";

export function getApplicationPdfUrl(id: string): string {
  return `${API_BASE_URL}/applications/${id}/pdf`;
}

/**
 * Shared application types
 */
export type ApplicationStatus =
  | "new"
  | "in_review"
  | "approved"
  | "rejected"
  | "submitted"
  | "converted";
export type RiskLevel = "Low" | "Medium" | "High";

export interface ApplicantAddress {
  address?: string;
  city?: string;
  provinceState?: string;
  postalCode?: string;
}

export interface CoApplicantSummary extends ApplicantAddress {
  fullName?: string;
  email?: string;
  phone?: string;
  monthlyIncome?: number;
}

export interface HouseholdDetails {
  otherOccupants?: string;
  pets?: string;
  vehicles?: string;
  notes?: string;
}

export interface ReferenceDetails {
  currentLandlordName?: string;
  currentLandlordPhone?: string;
}

export interface CosignerApplication {
  fullName: string;
  email: string;
  phone?: string;
  monthlyIncome?: number;
  address?: string;
  city?: string;
  provinceState?: string;
  postalCode?: string;
  relationshipToApplicant?: string;
  notes?: string;
  creditConsent: boolean;
  submittedAt: string;
}

export interface CosignerApplicationPayload {
  fullName: string;
  email: string;
  phone?: string;
  monthlyIncome?: number;
  address?: string;
  city?: string;
  provinceState?: string;
  postalCode?: string;
  relationshipToApplicant?: string;
  notes?: string;
  creditConsent: boolean;
}

export interface LeaseDraft {
  id: string;
  applicationId: string;
  applicantName: string;
  propertyName: string;
  unit: string;
  monthlyRent: number;
  startDate: string;
  endDate: string | null;
  createdAt: string;
  status: string;
}

export interface Application {
  id: string;
  landlordId?: string;
  fullName: string;
  applicantFullName?: string;
  applicantEmail?: string;
  firstName?: string;
  middleName?: string | null;
  lastName?: string;
  email: string;
  phone: string;
  applicantPhone?: string;
  consentCreditCheck?: boolean;
  propertyId: string;
  unitId?: string;
  propertyName: string;
  unit: string;
  unitApplied?: string;
  leaseStartDate?: string | null;
  canRunCreditReport?: boolean;
  dateOfBirth?: string | null;
  sinProvided?: boolean;
  sinLast4?: string | null;
  phoneVerified?: boolean;
  phoneVerificationStatus?: "unverified" | "pending" | "verified";
  phoneVerifiedAt?: string | null;
  referencesContacted?: boolean;
  referencesContactedAt?: string | null;
  referencesNotes?: string | null;
  status: ApplicationStatus;
  riskLevel: RiskLevel;
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

  primaryAddress?: ApplicantAddress;
  recentAddress?: {
    streetNumber?: string;
    streetName?: string;
    city?: string;
    province?: string;
    postalCode?: string;
  };
  coApplicant?: CoApplicantSummary;
  household?: HouseholdDetails;
  references?: ReferenceDetails;

  // Co-signer workflow
  cosignerRequested?: boolean;
  cosignerRequestedAt?: string | null;
  cosignerApplication?: CosignerApplication | null;

  // conversion metadata
  tenantId?: string | null;
  leaseId?: string | null;
  ledgerEventId?: string | null;
  convertedAt?: string | null;
  convertedTenantId?: string | null;
  screeningId?: string | null;
  screeningRequestId?: string | null;
  updatedAt?: string | null;

  // co-signer
  coSignerName?: string | null;
  coSignerRelationship?: string | null;
  coSignerMonthlyIncome?: number | null;
}

/**
 * Payload from the online Apply wizard
 */
export interface SubmitApplicationPayload {
  propertyId: string;
  propertyName: string;
  unit: string;
  unitApplied?: string;
  leaseStartDate: string;
  requestedRent: number;

  primaryApplicant: {
    firstName: string;
    middleName?: string;
    lastName: string;
    email: string;
    phone: string;
    dateOfBirth: string;
    dob?: string;
    recentAddress: {
      streetNumber: string;
      streetName: string;
      city: string;
      province: string;
      postalCode: string;
    };
    sinLast4?: string;
    sinProvided?: boolean;
  };

  employment?: {
    employer?: string;
    position?: string;
    monthlyIncome?: number;
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

  references?: {
    currentLandlordName?: string;
    currentLandlordPhone?: string;
  };

  household?: {
    otherOccupants?: string;
    pets?: string;
    vehicles?: string;
    notes?: string;
  };

  creditConsent: boolean;
}

export interface UpdateApplicationPayload {
  firstName?: string;
  middleName?: string | null;
  lastName?: string;
  leaseStartDate?: string | null;
  unitApplied?: string;
  dateOfBirth?: string | null;
  sinProvided?: boolean;
  sinLast4?: string | null;
  consentCreditCheck?: boolean;
  recentAddress?: {
    streetNumber?: string;
    streetName?: string;
    city?: string;
    province?: string;
    postalCode?: string;
  };
}

export interface CreditReportPayload {
  building: {
    propertyId: string;
    propertyName: string;
    propertyAddressLine1: string;
    city: string;
    province: string;
    postalCode: string;
    unitApplied: string;
    leaseStartDate: string;
  };
  applicant: {
    firstName: string;
    middleName?: string;
    lastName: string;
    dateOfBirth: string;
    sinProvided: boolean;
    email?: string;
    phone?: string;
  };
  address: {
    streetNumber: string;
    streetName: string;
    city: string;
    province: string;
    postalCode: string;
    country: string;
  };
  consent: {
    creditCheck: boolean;
    consentedAt?: string | null;
  };
}

/**
 * Fetch list of applications
 */
export async function fetchApplications(): Promise<Application[]> {
  const data = await apiJson<any>("/applications");
  return (data?.applications ?? data) as Application[];
}

/**
 * Fetch a single application by id
 */
export async function fetchApplication(id: string): Promise<Application> {
  return apiJson<Application>(`/applications/${encodeURIComponent(id)}`);
}

export type ApplicationTimelineEvent = {
  id: string;
  applicationId: string;
  type: string;
  message: string;
  actor: "tenant" | "landlord" | "system";
  createdAt: string;
  metadata?: Record<string, any>;
};

export async function fetchApplicationTimeline(
  id: string
): Promise<ApplicationTimelineEvent[]> {
  const data = await apiJson<any>(
    `/applications/${encodeURIComponent(id)}/timeline`
  );
  if (Array.isArray(data)) return data as ApplicationTimelineEvent[];
  if (Array.isArray(data?.events)) return data.events as ApplicationTimelineEvent[];
  return [];
}

/**
 * Update application status (New / In Review / Approved / Rejected)
 */
export async function updateApplicationStatus(
  id: string,
  status: ApplicationStatus
): Promise<Application> {
  return apiJson<Application>(`/applications/${encodeURIComponent(id)}/status`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ status }),
  });
}

/**
 * Update editable application details
 */
export async function updateApplicationDetails(
  applicationId: string,
  payload: UpdateApplicationPayload
): Promise<Application> {
  return apiJson<Application>(`/applications/${encodeURIComponent(applicationId)}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
}

export async function updateApplicationReferences(
  applicationId: string,
  payload: { contacted: boolean; notes?: string | null }
): Promise<Application> {
  return apiJson<Application>(
    `/applications/${encodeURIComponent(applicationId)}/references`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }
  );
}

/**
 * Build a credit screening payload for an application
 */
export async function buildScreeningPayload(
  applicationId: string
): Promise<CreditReportPayload> {
  const res = await apiFetch(
    `/applications/${encodeURIComponent(applicationId)}/screening/payload`,
    {
      method: "POST",
    }
  );

  const text = await res.text().catch(() => "");
  let payload: any = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = null;
  }

  if (res.status === 400 && payload?.error === "missing_fields") {
    const err = new Error("Missing required fields for screening") as Error & {
      code?: string;
      missing?: string[];
      status?: number;
    };
    err.code = "missing_fields";
    err.missing = Array.isArray(payload.missing) ? payload.missing : [];
    err.status = 400;
    throw err;
  }

  if (!res.ok) {
    throw new Error(payload?.error || text || "Unable to build screening payload");
  }

  return payload as CreditReportPayload;
}

/**
 * Request a co-signer on an application
 */
export async function requestCosigner(id: string): Promise<Application> {
  return apiJson<Application>(
    `/applications/${encodeURIComponent(id)}/request-cosigner`,
    { method: "POST" }
  );
}


export interface ConvertApplicationResult {
  success: boolean;
  applicationId: string;
  tenantId: string;
  leaseId: string;
  ledgerEventId: string;
  convertedAt: string; 
  alreadyConverted?: boolean;
  screening?: { screeningId: string; status: string };
}


export async function convertApplicationToTenant(
  id: string,
  runScreening?: boolean
): Promise<ConvertApplicationResult> {
  return apiJson<ConvertApplicationResult>(
    `/applications/${encodeURIComponent(id)}/convert`,
    runScreening === undefined
      ? { method: "POST" }
      : {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ runScreening }),
        }
  );
}

export async function sendApplicationPhoneCode(
  applicationId: string
): Promise<{ success: boolean; devCode?: string; application?: Application }> {
  return apiJson(`/applications/${encodeURIComponent(applicationId)}/phone/send-code`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
}

export async function confirmApplicationPhoneCode(
  applicationId: string,
  code: string
): Promise<Application> {
  return apiJson<Application>(
    `/applications/${encodeURIComponent(applicationId)}/phone/confirm`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    }
  );
}

export async function submitExistingApplication(
  applicationId: string
): Promise<Application> {
  return apiJson<Application>(
    `/applications/${encodeURIComponent(applicationId)}/submit`,
    { method: "POST", headers: { "Content-Type": "application/json" } }
  );
}

/**
 * Start a new application from the public Apply wizard
 */
export async function createApplication(
  payload: SubmitApplicationPayload
): Promise<Application> {
  return apiJson<Application>("/applications/submit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

/**
 * Finalize an existing application after phone verification
 */
export async function submitApplication(applicationId: string): Promise<Application> {
  return apiJson<Application>(
    `/applications/${encodeURIComponent(applicationId)}/submit`,
    { method: "POST" }
  );
}

/**
 * Submit co-signer mini-application attached to an existing application
 */
export async function submitCosignerApplication(
  applicationId: string,
  payload: CosignerApplicationPayload
): Promise<Application> {
  return apiJson<Application>(
    `/applications/${encodeURIComponent(applicationId)}/cosigner-submit`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }
  );
}

/**
 * Generate a lease draft from an application
 */
export async function generateLeaseDraft(
  applicationId: string,
  options?: { startDate?: string; endDate?: string | null }
): Promise<LeaseDraft> {
  return apiJson<LeaseDraft>(
    `/applications/${encodeURIComponent(applicationId)}/generate-lease-draft`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(options || {}),
    }
  );
}
