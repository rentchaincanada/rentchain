export type TransUnionConnectionStatus =
  | "not_connected"
  | "pending_credentialing"
  | "connected"
  | "connection_error"
  | "disconnected";

export type TransUnionIntegrationDoc = {
  provider: "transunion";
  status: TransUnionConnectionStatus;
  businessName?: string | null;
  contactName?: string | null;
  contactEmail?: string | null;
  memberCodeMasked?: string | null;
  memberCodeCiphertext?: string | null;
  memberCodeIv?: string | null;
  passcodeCiphertext?: string | null;
  passcodeIv?: string | null;
  credentialSource?: string | null;
  onboardingRequestedAt?: number | null;
  pendingMarkedAt?: number | null;
  connectedAt?: number | null;
  disconnectedAt?: number | null;
  lastValidatedAt?: number | null;
  lastValidationResult?: string | null;
  lastErrorCode?: string | null;
  lastErrorMessage?: string | null;
  version: number;
  createdAt: number;
  updatedAt: number;
  updatedByUserId?: string | null;
};

export type TransUnionPublicIntegration = {
  provider: "transunion";
  status: TransUnionConnectionStatus;
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

export type TransUnionOnboardingRequestInput = {
  businessName?: string;
  contactName?: string;
  contactEmail?: string;
};

export type TransUnionConnectInput = {
  businessName: string;
  contactName: string;
  contactEmail: string;
  memberCode: string;
  passcode: string;
  confirmPermissibleUse: boolean;
};

export type TransUnionUpdateCredentialsInput = {
  businessName?: string;
  contactName?: string;
  contactEmail?: string;
  memberCode: string;
  passcode: string;
  confirmPermissibleUse: boolean;
};
