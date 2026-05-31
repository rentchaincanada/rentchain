import { tenantApiFetch } from "./tenantApiFetch";
import type { TenantSafeProjectionMetadata } from "./tenantPortal";

export type TenantProfileStatus = "verified" | "pending" | "missing" | "needs_review";
export type TenantProfileSafeReference = string | null;

export type TenantProfileData = TenantSafeProjectionMetadata & {
  context: {
    authority: "applicant" | "active_tenant" | "invite" | null;
    propertyId: TenantProfileSafeReference;
    rc_prop_id: TenantProfileSafeReference;
    applicationId: TenantProfileSafeReference;
    leaseId: TenantProfileSafeReference;
    tenantId: TenantProfileSafeReference;
    unitId: TenantProfileSafeReference;
    invitedEmail: string | null;
  };
  profile: {
    displayName: string | null;
    email: string | null;
    phone: string | null;
    authorityLabel: string;
    property: (TenantSafeProjectionMetadata & {
      propertyId: Exclude<TenantProfileSafeReference, null>;
      rc_prop_id: TenantProfileSafeReference;
      street1: string | null;
      street2: string | null;
      city: string | null;
      province: string | null;
      postalCode: string | null;
      unitNumber?: string | null;
      unitDisplayLabel?: string | null;
      features: string[];
    }) | null;
    unit: {
      unitId: TenantProfileSafeReference;
      label: string | null;
    } | null;
    application: (TenantSafeProjectionMetadata & {
      applicationId: Exclude<TenantProfileSafeReference, null>;
      status: string | null;
      missingSteps: string[];
      nextActions: string[];
      createdAt: string | null;
      updatedAt: string | null;
    }) | null;
    lease: (TenantSafeProjectionMetadata & {
      leaseId: Exclude<TenantProfileSafeReference, null>;
      startDate: string | null;
      endDate: string | null;
      monthlyRent: number | null;
      status: string | null;
      documentUrl: string | null;
    }) | null;
  };
  identity: {
    overallStatus: TenantProfileStatus;
    identityVerification: {
      status: TenantProfileStatus;
      label: string;
      note: string | null;
      updatedAt: string | null;
    };
    documentChecklist: Array<{
      code: string;
      label: string;
      status: TenantProfileStatus;
      nextStep: string | null;
    }>;
    nextSteps: string[];
  };
  actions: {
    editableFields: string[];
    documentEntry: {
      available: boolean;
      path: string | null;
      label: string;
      note: string | null;
    };
  };
};

export async function getTenantProfile(): Promise<TenantProfileData> {
  const res = await tenantApiFetch<{ ok: boolean; data: TenantProfileData }>("/tenant/profile");
  return res.data;
}

export async function updateTenantProfile(input: {
  displayName?: string | null;
  phone?: string | null;
}): Promise<TenantProfileData> {
  const res = await tenantApiFetch<{ ok: boolean; data: TenantProfileData }>("/tenant/profile", {
    method: "PATCH",
    body: input,
  });
  return res.data;
}
