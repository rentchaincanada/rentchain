import crypto from "crypto";
import {
  createPropertyManagerCompany,
  createPropertyManagerCompanyMembership,
  type PropertyManagerCompany,
  type PropertyManagerCompanyMembership,
  type PropertyManagerCompanyRole,
  type PropertyManagerCompanyStatus,
  type PropertyManagerCompanyMembershipStatus,
} from "../lib/propertyManagerCompany";

export const DEFAULT_PM_COMPANY_QA_FIXTURE_KEY = "pm-company-preview-qa-v1";
export const DEFAULT_PM_COMPANY_QA_LABEL = "Acme Property Management QA";
export const DEFAULT_PM_COMPANY_QA_ROLE: PropertyManagerCompanyRole = "company_admin";
export const PM_COMPANY_QA_MANAGED_BY = "chore/property-manager-company-preview-fixtures-v1";

export type PropertyManagerCompanyPreviewFixtureMode = "upsert" | "suspend";

export type PropertyManagerCompanyPreviewFixtureOptions = {
  fixtureKey?: string;
  companyLabel?: string;
  userId: string;
  userEmail: string;
  role?: PropertyManagerCompanyRole;
  now?: string;
  mode?: PropertyManagerCompanyPreviewFixtureMode;
};

export type PropertyManagerCompanyPreviewFixtureMetadata = {
  qaFixture: true;
  qaFixtureKey: string;
  managedBy: {
    source: string;
    purpose: string;
  };
};

export type PropertyManagerCompanyPreviewFixtureCompany = PropertyManagerCompany &
  PropertyManagerCompanyPreviewFixtureMetadata;

export type PropertyManagerCompanyPreviewFixtureMembership = PropertyManagerCompanyMembership &
  PropertyManagerCompanyPreviewFixtureMetadata & {
    safeDisplayLabel: string;
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
  if (!Number.isFinite(parsed)) throw new Error("invalid_fixture_timestamp");
  return new Date(parsed).toISOString();
}

export function stablePreviewFixtureId(prefix: string, parts: readonly unknown[]): string {
  const digest = crypto.createHash("sha256").update(JSON.stringify(parts)).digest("hex").slice(0, 24);
  return `${prefix}_${digest}`;
}

function fixtureMetadata(fixtureKey: string): PropertyManagerCompanyPreviewFixtureMetadata {
  return {
    qaFixture: true,
    qaFixtureKey: fixtureKey,
    managedBy: {
      source: PM_COMPANY_QA_MANAGED_BY,
      purpose: "Property Manager Company preview QA fixture",
    },
  };
}

export function buildPropertyManagerCompanyPreviewFixture(options: PropertyManagerCompanyPreviewFixtureOptions): {
  company: PropertyManagerCompanyPreviewFixtureCompany;
  membership: PropertyManagerCompanyPreviewFixtureMembership;
} {
  const fixtureKey = requireString(options.fixtureKey || DEFAULT_PM_COMPANY_QA_FIXTURE_KEY, "missing_fixture_key", 120);
  const companyLabel = requireString(options.companyLabel || DEFAULT_PM_COMPANY_QA_LABEL, "missing_company_label", 160);
  const userId = requireString(options.userId, "missing_user_id", 200);
  const userEmail = requireString(options.userEmail, "missing_user_email", 320).toLowerCase();
  const role = options.role || DEFAULT_PM_COMPANY_QA_ROLE;
  if (!["company_owner", "company_admin"].includes(role)) {
    throw new Error("qa_fixture_company_admin_or_owner_required");
  }
  const now = isoTimestamp(options.now);
  const mode = options.mode || "upsert";
  const companyStatus: PropertyManagerCompanyStatus = mode === "suspend" ? "archived" : "active";
  const membershipStatus: PropertyManagerCompanyMembershipStatus = mode === "suspend" ? "removed" : "active";
  const companyId = stablePreviewFixtureId("pm_company_qa", [fixtureKey]);
  const membershipId = stablePreviewFixtureId("pm_membership_qa", [fixtureKey, userId]);
  const metadata = fixtureMetadata(fixtureKey);

  const company = createPropertyManagerCompany({
    companyId,
    companyName: companyLabel,
    status: companyStatus,
    createdByUserId: userId,
    createdAt: now,
  }) as PropertyManagerCompanyPreviewFixtureCompany;

  const membership = createPropertyManagerCompanyMembership({
    membershipId,
    companyId,
    userId,
    role,
    status: membershipStatus,
    createdByUserId: userId,
    createdAt: now,
  }) as PropertyManagerCompanyPreviewFixtureMembership;

  return {
    company: {
      ...company,
      updatedAt: now,
      ...metadata,
    },
    membership: {
      ...membership,
      safeDisplayLabel: userEmail,
      updatedAt: now,
      removedAt: mode === "suspend" ? now : null,
      removedByUserId: mode === "suspend" ? userId : null,
      ...metadata,
    },
  };
}

export function buildPropertyManagerCompanyPreviewFixtureSafeSummary(input: {
  mode: PropertyManagerCompanyPreviewFixtureMode;
  write: boolean;
  company: PropertyManagerCompanyPreviewFixtureCompany;
  membership: PropertyManagerCompanyPreviewFixtureMembership;
  companyExists: boolean;
  membershipExists: boolean;
}) {
  return {
    ok: true,
    mode: input.write ? "write" : "dry-run",
    fixtureMode: input.mode,
    company: {
      action: input.companyExists ? "update" : "create",
      label: input.company.safeDisplayLabel,
      status: input.company.status,
      qaFixture: input.company.qaFixture,
      qaFixtureKey: input.company.qaFixtureKey,
    },
    membership: {
      action: input.membershipExists ? "update" : "create",
      staffLabel: input.membership.safeDisplayLabel,
      role: input.membership.role,
      status: input.membership.status,
      qaFixture: input.membership.qaFixture,
      qaFixtureKey: input.membership.qaFixtureKey,
    },
    rawIdsPrinted: false,
  };
}
