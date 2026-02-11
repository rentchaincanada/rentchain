import { apiFetch } from "./apiFetch";

export type PublicApplicationContext = {
  propertyName?: string | null;
  unitLabel?: string | null;
};

export type PublicApplicationLinkData = {
  propertyId: string | null;
  unitId: string | null;
  expiresAt: number | null;
  landlordBrandName?: string | null;
};

export async function fetchPublicApplicationLink(token: string): Promise<{
  data: PublicApplicationLinkData;
  context: PublicApplicationContext;
}> {
  const res: any = await apiFetch(`/public/application-links/${encodeURIComponent(token)}`);
  const data = (res?.data || {}) as PublicApplicationLinkData;
  const context = (res?.context || {}) as PublicApplicationContext;
  if (!res?.ok && res?.error) {
    throw new Error(res.error);
  }
  if (!data?.propertyId) {
    throw new Error("Application link not found");
  }
  return { data, context };
}

export type RentalApplicationPayload = {
  token: string;
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
  };
  applicantProfile?: {
    currentAddress: {
      line1: string;
      line2?: string;
      city: string;
      provinceState: string;
      postalCode: string;
      country: string;
    };
    timeAtCurrentAddressMonths: number;
    currentRentAmountCents: number;
    employment: {
      employerName: string;
      jobTitle: string;
      incomeAmountCents: number;
      incomeFrequency: "monthly" | "annual";
      monthsAtJob: number;
    };
    workReference: {
      name: string;
      phone: string;
    };
    signature: {
      type: "drawn" | "typed";
      drawnDataUrl?: string;
      typedName?: string;
      typedAcknowledge?: boolean;
      signedAt: string;
    };
    applicantNotes?: string;
  };
  applicationConsent?: {
    version: "v1.0";
    accepted: true;
    acceptedAt: string;
    textHash?: string;
  };
  formVersion?: string;
};

export async function submitPublicApplication(params: RentalApplicationPayload): Promise<{ applicationId?: string }> {
  const res: any = await apiFetch("/public/rental-applications", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  if (!res?.ok && res?.error) {
    throw new Error(res?.error || "Failed to submit application");
  }
  return { applicationId: res?.data?.applicationId };
}
