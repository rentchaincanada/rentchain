import type { IdentityExchangeReference } from "../identityExchange/deriveIdentityExchangeReference";
import type { TenantApplicationReuseProjection } from "../tenantPortal/tenantProfileService";
import type { TenantSharePermissionKey } from "../tenantPortal/tenantSharePackageService";

export type ApplyWithRentChainScope = TenantSharePermissionKey;

export type ApplyWithRentChainPrefill = {
  applicant: {
    firstName?: string | null;
    lastName?: string | null;
    email?: string | null;
    phone?: string | null;
  };
  currentAddress?: {
    line1?: string | null;
    city?: string | null;
    province?: string | null;
    postalCode?: string | null;
  } | null;
  employment?: {
    employerName?: string | null;
    jobTitle?: string | null;
    incomeAmountCents?: number | null;
    incomeFrequency?: "monthly" | "annual" | null;
    monthsAtJob?: number | null;
  } | null;
};

export type ApplyWithRentChainContext = {
  source: "share_token";
  tokenValidated: true;
  scopesApproved: ApplyWithRentChainScope[];
  identityReference: {
    referenceStatus: "available" | "limited" | "not_ready";
    portabilityStatus: "ready" | "limited" | "not_ready";
  };
  applicationContext: {
    prefilled: boolean;
    requiredRemaining: string[];
    prefill: ApplyWithRentChainPrefill;
  };
};

type DeriveApplyWithRentChainContextInput = {
  approvedScopeKeys: ApplyWithRentChainScope[];
  identityExchangeReference: IdentityExchangeReference;
  applicationReuse: TenantApplicationReuseProjection;
};

function uniq(values: string[]) {
  return Array.from(new Set(values));
}

export function deriveApplyWithRentChainContext(
  input: DeriveApplyWithRentChainContextInput
): ApplyWithRentChainContext {
  const approvedScopes = Array.from(new Set(input.approvedScopeKeys));
  const allowIdentity = approvedScopes.includes("identity_summary");
  const allowApplication = approvedScopes.includes("application_summary");

  const prefill: ApplyWithRentChainPrefill = {
    applicant: {},
  };

  if (allowIdentity) {
    prefill.applicant = {
      firstName: input.applicationReuse.applicant.firstName,
      lastName: input.applicationReuse.applicant.lastName,
      email: input.applicationReuse.applicant.email,
      phone: input.applicationReuse.applicant.phone,
    };
  }

  if (allowApplication) {
    prefill.currentAddress = input.applicationReuse.currentAddress
      ? {
          line1: input.applicationReuse.currentAddress.line1,
          city: input.applicationReuse.currentAddress.city,
          province: input.applicationReuse.currentAddress.provinceState,
          postalCode: input.applicationReuse.currentAddress.postalCode,
        }
      : null;
    prefill.employment = input.applicationReuse.employment
      ? {
          employerName: input.applicationReuse.employment.employerName,
          jobTitle: input.applicationReuse.employment.jobTitle,
          incomeAmountCents: input.applicationReuse.employment.incomeAmountCents,
          incomeFrequency: input.applicationReuse.employment.incomeFrequency,
          monthsAtJob: input.applicationReuse.employment.monthsAtJob,
        }
      : null;
  }

  const requiredRemaining: string[] = [];

  if (!prefill.applicant.firstName) requiredRemaining.push("first_name");
  if (!prefill.applicant.lastName) requiredRemaining.push("last_name");
  if (!prefill.applicant.email) requiredRemaining.push("email");
  if (!prefill.applicant.phone) requiredRemaining.push("phone");

  if (!prefill.currentAddress?.line1) requiredRemaining.push("current_address_line1");
  if (!prefill.currentAddress?.city) requiredRemaining.push("current_address_city");
  if (!prefill.currentAddress?.province) requiredRemaining.push("current_address_province");
  if (!prefill.currentAddress?.postalCode) requiredRemaining.push("current_address_postal_code");

  if (!prefill.employment?.employerName) requiredRemaining.push("employment_employer_name");
  if (!prefill.employment?.jobTitle) requiredRemaining.push("employment_job_title");
  if (prefill.employment?.incomeAmountCents == null) requiredRemaining.push("employment_income_amount");
  if (!prefill.employment?.incomeFrequency) requiredRemaining.push("employment_income_frequency");
  if (prefill.employment?.monthsAtJob == null) requiredRemaining.push("employment_months_at_job");

  requiredRemaining.push("credit_consent");

  const prefilled = Boolean(
    prefill.applicant.firstName ||
      prefill.applicant.lastName ||
      prefill.applicant.email ||
      prefill.applicant.phone ||
      prefill.currentAddress?.line1 ||
      prefill.currentAddress?.city ||
      prefill.currentAddress?.province ||
      prefill.currentAddress?.postalCode ||
      prefill.employment?.employerName ||
      prefill.employment?.jobTitle ||
      prefill.employment?.incomeAmountCents != null ||
      prefill.employment?.monthsAtJob != null
  );

  return {
    source: "share_token",
    tokenValidated: true,
    scopesApproved: approvedScopes,
    identityReference: {
      referenceStatus: input.identityExchangeReference.referenceStatus,
      portabilityStatus: input.identityExchangeReference.portabilityStatus,
    },
    applicationContext: {
      prefilled,
      requiredRemaining: uniq(requiredRemaining),
      prefill,
    },
  };
}
