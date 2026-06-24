export const DEFAULT_PM_COMPANY_AUTH_PROFILE_ROLE = "property_manager_company";
export const DEFAULT_PM_COMPANY_AUTH_PROFILE_ACCOUNT_TYPE = "property_manager_company";
export const PM_COMPANY_AUTH_PROFILE_MANAGED_BY = "feat/property-manager-company-auth-profile-v1";

export type PropertyManagerCompanyAuthProfileMode = "upsert";

export type PropertyManagerCompanyAuthProfileOptions = {
  userId: string;
  userEmail: string;
  now?: string;
};

export type PropertyManagerCompanyAuthProfileMetadata = {
  qaProfile: true;
  managedBy: {
    source: string;
    purpose: string;
  };
};

function cleanString(value: unknown, max = 500): string {
  return String(value ?? "").trim().slice(0, max);
}

function requireString(value: unknown, code: string, max = 500): string {
  const text = cleanString(value, max);
  if (!text) throw new Error(code);
  return text;
}

function isoTimestamp(value?: string): string {
  if (!value) return new Date().toISOString();
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) throw new Error("invalid_profile_timestamp");
  return new Date(parsed).toISOString();
}

function profileMetadata(): PropertyManagerCompanyAuthProfileMetadata {
  return {
    qaProfile: true,
    managedBy: {
      source: PM_COMPANY_AUTH_PROFILE_MANAGED_BY,
      purpose: "Property Manager Company auth profile setup",
    },
  };
}

export function buildPropertyManagerCompanyAuthProfile(options: PropertyManagerCompanyAuthProfileOptions) {
  const userId = requireString(options.userId, "missing_user_id", 200);
  const email = requireString(options.userEmail, "missing_user_email", 320).toLowerCase();
  const now = isoTimestamp(options.now);
  const metadata = profileMetadata();
  const profile = {
    id: userId,
    email,
    role: DEFAULT_PM_COMPANY_AUTH_PROFILE_ROLE,
    accountType: DEFAULT_PM_COMPANY_AUTH_PROFILE_ACCOUNT_TYPE,
    landlordId: null,
    status: "active",
    approved: true,
    approvedAt: now,
    approvedBy: PM_COMPANY_AUTH_PROFILE_MANAGED_BY,
    permissions: [],
    revokedPermissions: [],
    createdAt: now,
    updatedAt: now,
    ...metadata,
  };

  return {
    userProfile: profile,
    accountProfile: profile,
  };
}

export function buildPropertyManagerCompanyAuthProfileSafeSummary(input: {
  write: boolean;
  userProfileExists: boolean;
  accountProfileExists: boolean;
  userProfile: ReturnType<typeof buildPropertyManagerCompanyAuthProfile>["userProfile"];
  accountProfile: ReturnType<typeof buildPropertyManagerCompanyAuthProfile>["accountProfile"];
}) {
  return {
    ok: true,
    mode: input.write ? "write" : "dry-run",
    userProfile: {
      action: input.userProfileExists ? "update" : "create",
      email: input.userProfile.email,
      role: input.userProfile.role,
      accountType: input.userProfile.accountType,
      landlordId: null,
      status: input.userProfile.status,
      approved: input.userProfile.approved,
      qaProfile: input.userProfile.qaProfile,
    },
    accountProfile: {
      action: input.accountProfileExists ? "update" : "create",
      email: input.accountProfile.email,
      role: input.accountProfile.role,
      accountType: input.accountProfile.accountType,
      landlordId: null,
      status: input.accountProfile.status,
      approved: input.accountProfile.approved,
      qaProfile: input.accountProfile.qaProfile,
    },
    landlordProfileAction: "none",
    rawIdsPrinted: false,
  };
}
