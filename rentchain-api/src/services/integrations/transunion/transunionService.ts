import {
  encryptTransUnionCredential,
  maskTransUnionMemberCode,
} from "./transunionEncryption";
import {
  getTransUnionIntegrationDoc,
  setTransUnionIntegrationDoc,
} from "./transunionRepository";
import type {
  TransUnionConnectInput,
  TransUnionIntegrationDoc,
  TransUnionOnboardingRequestInput,
  TransUnionPublicIntegration,
  TransUnionUpdateCredentialsInput,
} from "./transunionTypes";

const VERSION = 1;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PROVIDER = "transunion" as const;
const CREDENTIAL_SOURCE = "membership_credentials";

type ServiceErrorCode =
  | "invalid_request"
  | "invalid_email"
  | "transunion_encryption_unavailable"
  | "transunion_not_connected";

export class TransUnionServiceError extends Error {
  statusCode: number;
  code: ServiceErrorCode;

  constructor(statusCode: number, code: ServiceErrorCode, message: string) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
  }
}

function normalizeString(value: unknown): string {
  return String(value || "").trim();
}

function requireNonEmpty(value: unknown, fieldName: string): string {
  const normalized = normalizeString(value);
  if (!normalized) {
    throw new TransUnionServiceError(400, "invalid_request", `${fieldName} is required.`);
  }
  return normalized;
}

function validateEmail(value: unknown): string {
  const normalized = requireNonEmpty(value, "contactEmail");
  if (!EMAIL_REGEX.test(normalized)) {
    throw new TransUnionServiceError(400, "invalid_email", "A valid contact email is required.");
  }
  return normalized.toLowerCase();
}

function requirePermissibleUse(value: boolean) {
  if (value !== true) {
    throw new TransUnionServiceError(
      400,
      "invalid_request",
      "You must confirm the credentials were issued by TransUnion for permissible tenant-screening use."
    );
  }
}

function mapPublicDoc(doc: TransUnionIntegrationDoc | null): TransUnionPublicIntegration {
  if (!doc) {
    return {
      provider: PROVIDER,
      status: "not_connected",
      version: VERSION,
    };
  }

  return {
    provider: PROVIDER,
    status: doc.status,
    businessName: doc.businessName || undefined,
    contactName: doc.contactName || undefined,
    contactEmail: doc.contactEmail || undefined,
    memberCodeMasked: doc.memberCodeMasked || undefined,
    credentialSource: doc.credentialSource || undefined,
    onboardingRequestedAt: doc.onboardingRequestedAt || undefined,
    pendingMarkedAt: doc.pendingMarkedAt || undefined,
    connectedAt: doc.connectedAt || undefined,
    disconnectedAt: doc.disconnectedAt || undefined,
    lastValidatedAt: doc.lastValidatedAt || undefined,
    lastValidationResult: doc.lastValidationResult || undefined,
    lastErrorCode: doc.lastErrorCode || undefined,
    lastErrorMessage: doc.lastErrorMessage || undefined,
    version: doc.version,
    createdAt: doc.createdAt || undefined,
    updatedAt: doc.updatedAt || undefined,
  };
}

function buildCredentialPayload(memberCode: string, passcode: string) {
  try {
    const memberCodeEncrypted = encryptTransUnionCredential(memberCode);
    const passcodeEncrypted = encryptTransUnionCredential(passcode);
    return {
      memberCodeMasked: maskTransUnionMemberCode(memberCode),
      memberCodeCiphertext: memberCodeEncrypted.ciphertext,
      memberCodeIv: memberCodeEncrypted.iv,
      passcodeCiphertext: passcodeEncrypted.ciphertext,
      passcodeIv: passcodeEncrypted.iv,
    };
  } catch (error: any) {
    const code = String(error?.message || "");
    if (
      code === "TRANSUNION_ENCRYPTION_KEY_MISSING" ||
      code === "TRANSUNION_ENCRYPTION_KEY_INVALID"
    ) {
      throw new TransUnionServiceError(
        503,
        "transunion_encryption_unavailable",
        "TransUnion credential encryption is not configured."
      );
    }
    throw error;
  }
}

function logTransUnionEvent(event: string, meta: Record<string, unknown>) {
  console.info("[transunion_integration]", {
    event,
    provider: PROVIDER,
    ...meta,
  });
}

export async function getTransUnionIntegrationPublic(
  landlordId: string
): Promise<TransUnionPublicIntegration> {
  const existing = await getTransUnionIntegrationDoc(landlordId);
  return mapPublicDoc(existing);
}

export async function requestTransUnionOnboarding(
  landlordId: string,
  userId: string,
  input: TransUnionOnboardingRequestInput
): Promise<TransUnionPublicIntegration> {
  const now = Date.now();
  const existing = await getTransUnionIntegrationDoc(landlordId);
  const contactEmail = normalizeString(input.contactEmail);

  if (contactEmail && !EMAIL_REGEX.test(contactEmail)) {
    throw new TransUnionServiceError(400, "invalid_email", "A valid contact email is required.");
  }

  await setTransUnionIntegrationDoc(landlordId, {
    provider: PROVIDER,
    status: "pending_credentialing",
    businessName: normalizeString(input.businessName) || existing?.businessName,
    contactName: normalizeString(input.contactName) || existing?.contactName,
    contactEmail: contactEmail ? contactEmail.toLowerCase() : existing?.contactEmail,
    onboardingRequestedAt: existing?.onboardingRequestedAt || now,
    pendingMarkedAt: now,
    disconnectedAt: existing?.disconnectedAt,
    connectedAt: existing?.connectedAt,
    version: existing?.version || VERSION,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
    updatedByUserId: userId,
  });

  logTransUnionEvent("onboarding_requested", {
    landlordId,
    userId,
    status: "pending_credentialing",
  });

  return getTransUnionIntegrationPublic(landlordId);
}

export async function connectTransUnion(
  landlordId: string,
  userId: string,
  input: TransUnionConnectInput
): Promise<TransUnionPublicIntegration> {
  requirePermissibleUse(input.confirmPermissibleUse);
  const businessName = requireNonEmpty(input.businessName, "businessName");
  const contactName = requireNonEmpty(input.contactName, "contactName");
  const contactEmail = validateEmail(input.contactEmail);
  const memberCode = requireNonEmpty(input.memberCode, "memberCode");
  const passcode = requireNonEmpty(input.passcode, "passcode");
  const existing = await getTransUnionIntegrationDoc(landlordId);
  const now = Date.now();
  const credentials = buildCredentialPayload(memberCode, passcode);

  await setTransUnionIntegrationDoc(landlordId, {
    provider: PROVIDER,
    status: "connected",
    businessName,
    contactName,
    contactEmail,
    credentialSource: CREDENTIAL_SOURCE,
    onboardingRequestedAt: existing?.onboardingRequestedAt || now,
    pendingMarkedAt: existing?.pendingMarkedAt || now,
    connectedAt: now,
    disconnectedAt: null,
    lastValidatedAt: now,
    lastValidationResult: "credentials_saved",
    lastErrorCode: null,
    lastErrorMessage: null,
    version: existing?.version || VERSION,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
    updatedByUserId: userId,
    ...credentials,
  });

  logTransUnionEvent("connected", {
    landlordId,
    userId,
    status: "connected",
    memberCodeMasked: credentials.memberCodeMasked,
  });

  return getTransUnionIntegrationPublic(landlordId);
}

export async function updateTransUnionCredentials(
  landlordId: string,
  userId: string,
  input: TransUnionUpdateCredentialsInput
): Promise<TransUnionPublicIntegration> {
  requirePermissibleUse(input.confirmPermissibleUse);
  const existing = await getTransUnionIntegrationDoc(landlordId);
  const now = Date.now();
  const memberCode = requireNonEmpty(input.memberCode, "memberCode");
  const passcode = requireNonEmpty(input.passcode, "passcode");
  const credentials = buildCredentialPayload(memberCode, passcode);

  await setTransUnionIntegrationDoc(landlordId, {
    provider: PROVIDER,
    status: "connected",
    businessName: normalizeString(input.businessName) || existing?.businessName,
    contactName: normalizeString(input.contactName) || existing?.contactName,
    contactEmail: input.contactEmail
      ? validateEmail(input.contactEmail)
      : existing?.contactEmail,
    credentialSource: existing?.credentialSource || CREDENTIAL_SOURCE,
    connectedAt: existing?.connectedAt || now,
    disconnectedAt: null,
    lastValidatedAt: now,
    lastValidationResult: "credentials_updated",
    lastErrorCode: null,
    lastErrorMessage: null,
    version: existing?.version || VERSION,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
    updatedByUserId: userId,
    ...credentials,
  });

  logTransUnionEvent("credentials_updated", {
    landlordId,
    userId,
    status: "connected",
    memberCodeMasked: credentials.memberCodeMasked,
  });

  return getTransUnionIntegrationPublic(landlordId);
}

export async function disconnectTransUnion(
  landlordId: string,
  userId: string
): Promise<TransUnionPublicIntegration> {
  const existing = await getTransUnionIntegrationDoc(landlordId);
  const now = Date.now();
  await setTransUnionIntegrationDoc(landlordId, {
    provider: PROVIDER,
    status: "disconnected",
    memberCodeMasked: null,
    memberCodeCiphertext: null,
    memberCodeIv: null,
    passcodeCiphertext: null,
    passcodeIv: null,
    disconnectedAt: now,
    updatedAt: now,
    updatedByUserId: userId,
    version: existing?.version || VERSION,
    createdAt: existing?.createdAt || now,
  });

  logTransUnionEvent("disconnected", {
    landlordId,
    userId,
    status: "disconnected",
  });
  return getTransUnionIntegrationPublic(landlordId);
}

export async function assertTransUnionConnectedForScreening(landlordId: string): Promise<void> {
  const integration = await getTransUnionIntegrationDoc(landlordId);
  if (integration?.status === "connected") {
    return;
  }
  throw new TransUnionServiceError(
    409,
    "transunion_not_connected",
    "Connect your TransUnion membership before starting screening."
  );
}
