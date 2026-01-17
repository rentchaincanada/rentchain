import { apiFetch } from "./apiFetch";

export type RentalApplicationStatus =
  | "DRAFT"
  | "SUBMITTED"
  | "IN_REVIEW"
  | "APPROVED"
  | "DECLINED"
  | "CONDITIONAL_COSIGNER"
  | "CONDITIONAL_DEPOSIT";

export type RentalApplicationSummary = {
  id: string;
  applicantName: string;
  email: string | null;
  propertyId: string | null;
  unitId: string | null;
  status: RentalApplicationStatus;
  submittedAt: number | null;
};

export type RentalApplication = {
  id: string;
  landlordId: string;
  propertyId: string;
  unitId: string | null;
  applicationLinkId: string;
  createdAt: number;
  submittedAt: number | null;
  updatedAt: number;
  status: RentalApplicationStatus;
  applicant: {
    firstName: string;
    middleInitial?: string | null;
    lastName: string;
    email: string;
    phoneHome?: string | null;
    phoneWork?: string | null;
    dob?: string | null;
    maritalStatus?: "SINGLE" | "MARRIED" | "DIVORCED" | "COMMON_LAW" | null;
  };
  coApplicant?: {
    firstName: string;
    middleInitial?: string | null;
    lastName: string;
    email: string;
    phoneHome?: string | null;
    phoneWork?: string | null;
    dob?: string | null;
    maritalStatus?: "SINGLE" | "MARRIED" | "DIVORCED" | "COMMON_LAW" | null;
  } | null;
  otherResidents?: Array<{ name: string; relationship: string; age: number | null }>;
  residentialHistory: Array<{
    address: string;
    durationMonths?: number | null;
    rentAmountCents?: number | null;
    landlordName?: string | null;
    landlordPhone?: string | null;
    reasonForLeaving?: string | null;
  }>;
  employment: {
    applicant: {
      status?: "FULL_TIME" | "PART_TIME" | "STUDENT" | "RETIRED" | "UNEMPLOYED" | "OTHER" | null;
      jobTitle?: string | null;
      employer?: string | null;
      employerAddress?: string | null;
      supervisor?: string | null;
      phone?: string | null;
      monthlyIncomeCents?: number | null;
      incomeType?: "NET" | "GROSS" | null;
      lengthMonths?: number | null;
    };
    coApplicant?: {
      status?: "FULL_TIME" | "PART_TIME" | "STUDENT" | "RETIRED" | "UNEMPLOYED" | "OTHER" | null;
      jobTitle?: string | null;
      employer?: string | null;
      employerAddress?: string | null;
      supervisor?: string | null;
      phone?: string | null;
      monthlyIncomeCents?: number | null;
      incomeType?: "NET" | "GROSS" | null;
      lengthMonths?: number | null;
    } | null;
  };
  references?: {
    bank?: { name?: string | null; address?: string | null } | null;
    applicantPersonal?: { name?: string | null; relationship?: string | null; phone?: string | null; address?: string | null } | null;
    coApplicantPersonal?: { name?: string | null; relationship?: string | null; phone?: string | null; address?: string | null } | null;
  } | null;
  loans?: Array<{ institution?: string | null; address?: string | null; monthlyPaymentCents?: number | null; balanceCents?: number | null }>;
  vehicles?: Array<{ makeModel?: string | null; year?: string | null; color?: string | null; plate?: string | null; province?: string | null }>;
  nextOfKin?: { name?: string | null; relationship?: string | null; phone?: string | null; address?: string | null } | null;
  coNextOfKin?: { name?: string | null; relationship?: string | null; phone?: string | null; address?: string | null } | null;
  consent: {
    creditConsent: boolean;
    referenceConsent: boolean;
    dataSharingConsent: boolean;
    acceptedAt: number | null;
    applicantNameTyped?: string | null;
    coApplicantNameTyped?: string | null;
    ip?: string | null;
    userAgent?: string | null;
  };
  screening: {
    requested: boolean;
    requestedAt?: number | null;
    status?: "NOT_REQUESTED" | "PENDING" | "COMPLETE" | "FAILED";
    provider?: "STUB" | string | null;
    orderId?: string | null;
    amountCents?: number | null;
    currency?: string | null;
    paidAt?: number | null;
    scoreAddOn?: boolean;
    scoreAddOnCents?: number | null;
    totalAmountCents?: number | null;
    serviceLevel?: "SELF_SERVE" | "VERIFIED" | "VERIFIED_AI";
    aiVerification?: boolean;
    ai?: {
      enabled: boolean;
      riskAssessment: "LOW" | "MODERATE" | "HIGH";
      confidenceScore: number;
      flags: string[];
      recommendations: string[];
      summary: string;
      generatedAt: number;
    } | null;
    result?: {
      riskBand: "LOW" | "MEDIUM" | "HIGH";
      matchConfidence: "LOW" | "MEDIUM" | "HIGH";
      fileFound: boolean;
      score?: number | null;
      tradelinesCount?: number | null;
      collectionsCount?: number | null;
      bankruptciesCount?: number | null;
      notes?: string | null;
    } | null;
  };
  landlordNote?: string | null;
};

export type ScreeningQuote = {
  baseAmountCents: number;
  verifiedAddOnCents: number;
  aiAddOnCents: number;
  currency: string;
  scoreAddOnCents: number;
  totalAmountCents: number;
  eligible: boolean;
};

export type ScreeningRunResult = {
  orderId: string;
  status: "COMPLETE" | "FAILED" | "PENDING";
  result: NonNullable<RentalApplication["screening"]["result"]> | null;
  amountCents: number;
  currency: string;
  paidAt?: number;
  scoreAddOn?: boolean;
  scoreAddOnCents?: number;
  totalAmountCents?: number;
  serviceLevel?: "SELF_SERVE" | "VERIFIED" | "VERIFIED_AI";
  aiVerification?: boolean;
  ai?: RentalApplication["screening"]["ai"] | null;
};

export async function fetchRentalApplications(params?: {
  propertyId?: string;
  status?: string;
}): Promise<RentalApplicationSummary[]> {
  const query = new URLSearchParams();
  if (params?.propertyId) query.set("propertyId", params.propertyId);
  if (params?.status) query.set("status", params.status);
  const res: any = await apiFetch(`/rental-applications?${query.toString()}`);
  return (res?.data || []) as RentalApplicationSummary[];
}

export async function fetchRentalApplication(id: string): Promise<RentalApplication> {
  const res: any = await apiFetch(`/rental-applications/${encodeURIComponent(id)}`);
  return res?.data as RentalApplication;
}

export async function updateRentalApplicationStatus(
  id: string,
  status: RentalApplicationStatus,
  note?: string | null
): Promise<RentalApplication> {
  const res: any = await apiFetch(`/rental-applications/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status, note }),
  });
  return res?.data as RentalApplication;
}

export async function fetchScreeningQuote(
  id: string,
  params?: { serviceLevel?: "SELF_SERVE" | "VERIFIED" | "VERIFIED_AI"; scoreAddOn?: boolean }
): Promise<{ ok: boolean; data?: ScreeningQuote; error?: string; detail?: string }> {
  const res: any = await apiFetch(`/rental-applications/${encodeURIComponent(id)}/screening/quote`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params || {}),
  });
  return res as { ok: boolean; data?: ScreeningQuote; error?: string; detail?: string };
}

export async function runScreening(
  id: string,
  params: { scoreAddOn: boolean; serviceLevel: "SELF_SERVE" | "VERIFIED" | "VERIFIED_AI" }
): Promise<{ ok: boolean; data?: ScreeningRunResult; error?: string; detail?: string }> {
  const res: any = await apiFetch(`/rental-applications/${encodeURIComponent(id)}/screening/run`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  return res as { ok: boolean; data?: ScreeningRunResult; error?: string; detail?: string };
}

export async function fetchScreening(
  id: string
): Promise<{ ok: boolean; data?: RentalApplication["screening"]; error?: string }> {
  const res: any = await apiFetch(`/rental-applications/${encodeURIComponent(id)}/screening`);
  return res as { ok: boolean; data?: RentalApplication["screening"]; error?: string };
}
