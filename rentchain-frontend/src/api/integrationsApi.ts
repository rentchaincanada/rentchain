import { apiFetch } from "./apiFetch";

export type TransUnionIntegrationStatus =
  | "not_connected"
  | "pending_credentialing"
  | "connected"
  | "connection_error"
  | "disconnected";

export type TransUnionIntegration = {
  provider: "transunion";
  status: TransUnionIntegrationStatus;
  businessName?: string;
  contactName?: string;
  contactEmail?: string;
  memberCodeMasked?: string;
  credentialSource?: string;
  onboardingRequestedAt?: number;
  pendingMarkedAt?: number;
  connectedAt?: number;
  disconnectedAt?: number;
  lastValidatedAt?: number;
  lastValidationResult?: string;
  lastErrorCode?: string;
  lastErrorMessage?: string;
  version: number;
  createdAt?: number;
  updatedAt?: number;
};

export type TransUnionCredentialsPayload = {
  businessName: string;
  contactName: string;
  contactEmail: string;
  memberCode: string;
  passcode: string;
  confirmPermissibleUse: boolean;
  sourceSurface?: string;
};

export type TransUnionUsageEventType =
  | "tu_option_viewed"
  | "tu_get_access_clicked"
  | "tu_have_credentials_clicked"
  | "tu_onboarding_viewed"
  | "tu_onboarding_started"
  | "tu_email_clicked"
  | "tu_phone_clicked"
  | "tu_already_credentialed_clicked";

export async function getTransUnionIntegration(): Promise<TransUnionIntegration> {
  return apiFetch<TransUnionIntegration>("/integrations/transunion");
}

export async function requestTransUnionOnboarding(payload: {
  businessName?: string;
  contactName?: string;
  contactEmail?: string;
}): Promise<TransUnionIntegration> {
  return apiFetch<TransUnionIntegration>("/integrations/transunion/onboarding-request", {
    method: "POST",
    body: payload,
  });
}

export async function connectTransUnion(
  payload: TransUnionCredentialsPayload
): Promise<TransUnionIntegration> {
  return apiFetch<TransUnionIntegration>("/integrations/transunion/connect", {
    method: "POST",
    body: payload,
  });
}

export async function updateTransUnionCredentials(
  payload: TransUnionCredentialsPayload
): Promise<TransUnionIntegration> {
  return apiFetch<TransUnionIntegration>("/integrations/transunion/update-credentials", {
    method: "POST",
    body: payload,
  });
}

export async function disconnectTransUnion(): Promise<TransUnionIntegration> {
  return apiFetch<TransUnionIntegration>("/integrations/transunion/disconnect", {
    method: "POST",
    body: {},
  });
}

export async function trackTransUnionUsageEvent(payload: {
  eventType: TransUnionUsageEventType;
  sourceSurface: string;
  applicationId?: string | null;
  propertyId?: string | null;
}) {
  return apiFetch<{ ok: true }>("/integrations/transunion/usage-events", {
    method: "POST",
    body: payload,
  });
}
