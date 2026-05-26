import { tenantApiFetch } from "./tenantApiFetch";

export type TenantProfileStatus = "verified" | "pending" | "missing" | "needs_review";

export type TenantProfileData = {
  context: {
    authority: "applicant" | "active_tenant" | "invite" | null;
    propertyId: string | null;
    rc_prop_id: string | null;
    applicationId: string | null;
    leaseId: string | null;
    tenantId: string | null;
    unitId: string | null;
    invitedEmail: string | null;
  };
  profile: {
    displayName: string | null;
    email: string | null;
    phone: string | null;
    authorityLabel: string;
    property: {
      propertyId: string;
      rc_prop_id: string | null;
      street1: string | null;
      street2: string | null;
      city: string | null;
      province: string | null;
      postalCode: string | null;
      unitNumber?: string | null;
      unitDisplayLabel?: string | null;
      features: string[];
    } | null;
    unit: {
      unitId: string | null;
      label: string | null;
    } | null;
    application: {
      applicationId: string;
      status: string | null;
      missingSteps: string[];
      nextActions: string[];
      createdAt: string | null;
      updatedAt: string | null;
    } | null;
    lease: {
      leaseId: string;
      startDate: string | null;
      endDate: string | null;
      monthlyRent: number | null;
      status: string | null;
      documentUrl: string | null;
    } | null;
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
