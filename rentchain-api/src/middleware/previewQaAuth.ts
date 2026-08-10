import type { RequestHandler } from "express";
import type { UserEntitlements } from "../services/entitlementsService";

export const PREVIEW_QA_IDENTITY_HEADER = "x-rentchain-preview-qa-identity";
export const PREVIEW_QA_IDENTITY_ALIAS = "pr1509-landlord";
export const PREVIEW_QA_LANDLORD_ID = "qa-pr1509-landlord";
export const PR1510_PREVIEW_QA_IDENTITY_ALIAS = "pr1510-landlord";
export const PR1510_PREVIEW_QA_LANDLORD_ID = "qa-pr1510-landlord";
export const PR1512_PREVIEW_QA_SCOPE = "pr1512-property-notices";
export const PR1512_PREVIEW_QA_IDENTITY_ALIAS = "pr1512-landlord";
export const PR1512_PREVIEW_QA_LANDLORD_ID = "qa-pr1512-landlord";
export const PR1512_PREVIEW_QA_SERVICE_PATTERN = /^rentchain-pr1512-notices-qa-[a-f0-9]{8}$/;

const PREVIEW_PROJECT_ID = "rentchain-preview";
const PRODUCTION_PROJECT_ID = "project-0d9658de-af29-4dc0-a99";
const PERMANENT_PREVIEW_SERVICE = "rentchain-preview-backend";
const previewQaAuthenticated = Symbol("previewQaAuthenticated");

export type PreviewQaRoute =
  | "landlord-inbox"
  | "landlord-message-recipients"
  | "landlord-message-list"
  | "landlord-message-detail"
  | "landlord-message-compose"
  | "landlord-notice-recipients"
  | "landlord-notice-list"
  | "landlord-notice-detail"
  | "landlord-notice-create";

type PreviewQaContract = {
  scope: string;
  servicePattern: RegExp;
  selector: string;
  landlordId: string;
  email: string;
  allowedOperations: ReadonlySet<string>;
};

const previewQaContracts: readonly PreviewQaContract[] = [
  {
    scope: "pr1509-unified-inbox",
    servicePattern: /^rentchain-pr1509-inbox-qa-[a-f0-9]{8}$/,
    selector: PREVIEW_QA_IDENTITY_ALIAS,
    landlordId: PREVIEW_QA_LANDLORD_ID,
    email: "qa-pr1509-landlord@example.invalid",
    allowedOperations: new Set([
      "GET:landlord-inbox",
      "GET:landlord-message-list",
      "GET:landlord-message-detail",
    ]),
  },
  {
    scope: "pr1510-landlord-messaging",
    servicePattern: /^rentchain-pr1510-messaging-qa-[a-f0-9]{8}$/,
    selector: PR1510_PREVIEW_QA_IDENTITY_ALIAS,
    landlordId: PR1510_PREVIEW_QA_LANDLORD_ID,
    email: "qa-pr1510-landlord@example.invalid",
    allowedOperations: new Set([
      "GET:landlord-message-recipients",
      "GET:landlord-message-list",
      "GET:landlord-message-detail",
      "POST:landlord-message-compose",
    ]),
  },
  {
    scope: PR1512_PREVIEW_QA_SCOPE,
    servicePattern: PR1512_PREVIEW_QA_SERVICE_PATTERN,
    selector: PR1512_PREVIEW_QA_IDENTITY_ALIAS,
    landlordId: PR1512_PREVIEW_QA_LANDLORD_ID,
    email: "qa-pr1512-landlord@example.invalid",
    allowedOperations: new Set([
      "GET:landlord-notice-recipients",
      "GET:landlord-notice-list",
      "GET:landlord-notice-detail",
      "POST:landlord-notice-create",
    ]),
  },
];

type PreviewQaDecision =
  | { kind: "continue-normal-auth" }
  | { kind: "reject" }
  | { kind: "allow" };

type PreviewQaDecisionInput = {
  env: NodeJS.ProcessEnv;
  method: string;
  route: PreviewQaRoute;
  selector: string;
  authorizationPresent: boolean;
};

export function decidePreviewQaAuth(input: PreviewQaDecisionInput): PreviewQaDecision {
  if (!input.selector) return { kind: "continue-normal-auth" };
  if (input.authorizationPresent) return { kind: "continue-normal-auth" };

  const projectId = String(input.env.GOOGLE_CLOUD_PROJECT || input.env.GCLOUD_PROJECT || "").trim();
  const appEnvironment = String(input.env.APP_ENV || "").trim().toLowerCase();
  const enabled = String(input.env.PREVIEW_QA_AUTH_ENABLED || "").trim().toLowerCase();
  const scope = String(input.env.PREVIEW_QA_AUTH_SCOPE || "").trim();
  const service = String(input.env.K_SERVICE || "").trim();
  const expectedService = String(input.env.PREVIEW_QA_EXPECTED_SERVICE || "").trim();
  const firestoreEnabled = String(input.env.FIRESTORE_ENABLED || "").trim().toLowerCase();
  const firestoreDatabaseId = String(input.env.FIRESTORE_DATABASE_ID || "").trim();
  const contract = previewQaContracts.find((candidate) => candidate.scope === scope);

  const isolatedPreviewQa =
    enabled === "true" &&
    Boolean(contract) &&
    appEnvironment === "preview" &&
    projectId !== PRODUCTION_PROJECT_ID &&
    projectId === PREVIEW_PROJECT_ID &&
    service !== PERMANENT_PREVIEW_SERVICE &&
    expectedService !== PERMANENT_PREVIEW_SERVICE &&
    Boolean(contract?.servicePattern.test(expectedService)) &&
    service === expectedService &&
    firestoreEnabled === "true" &&
    firestoreDatabaseId === "(default)";

  if (!isolatedPreviewQa || !contract) return { kind: "reject" };
  if (input.selector !== contract?.selector) return { kind: "reject" };
  if (!contract.allowedOperations.has(`${input.method.toUpperCase()}:${input.route}`)) return { kind: "reject" };
  return { kind: "allow" };
}

export function isPr1512PreviewQaRuntime(env: NodeJS.ProcessEnv = process.env): boolean {
  const service = String(env.K_SERVICE || "").trim();
  const expectedService = String(env.PREVIEW_QA_EXPECTED_SERVICE || "").trim();
  return (
    String(env.PREVIEW_QA_AUTH_ENABLED || "").trim().toLowerCase() === "true" &&
    String(env.PREVIEW_QA_AUTH_SCOPE || "").trim() === PR1512_PREVIEW_QA_SCOPE &&
    String(env.APP_ENV || "").trim().toLowerCase() === "preview" &&
    String(env.GOOGLE_CLOUD_PROJECT || env.GCLOUD_PROJECT || "").trim() === PREVIEW_PROJECT_ID &&
    service !== PERMANENT_PREVIEW_SERVICE &&
    expectedService !== PERMANENT_PREVIEW_SERVICE &&
    service === expectedService &&
    PR1512_PREVIEW_QA_SERVICE_PATTERN.test(service) &&
    String(env.FIRESTORE_ENABLED || "").trim().toLowerCase() === "true" &&
    String(env.FIRESTORE_DATABASE_ID || "").trim() === "(default)"
  );
}

function syntheticLandlordEntitlements(landlordId: string): UserEntitlements {
  return {
    userId: landlordId,
    role: "landlord",
    plan: "starter",
    capabilities: ["messaging"],
    landlordId,
  };
}

export function previewQaAuth(route: PreviewQaRoute): RequestHandler {
  return (req, res, next) => {
    const readHeader = (name: string) => {
      if (typeof req.header === "function") return req.header(name);
      return (req.headers as Record<string, string | string[] | undefined> | undefined)?.[name.toLowerCase()];
    };
    const selector = String(readHeader(PREVIEW_QA_IDENTITY_HEADER) || "").trim();
    const decision = decidePreviewQaAuth({
      env: process.env,
      method: req.method,
      route,
      selector,
      authorizationPresent: Boolean(String(readHeader("authorization") || "").trim()),
    });

    if (decision.kind === "continue-normal-auth") return next();
    if (decision.kind === "reject") {
      return res.status(401).json({ ok: false, error: "unauthenticated" });
    }

    const scope = String(process.env.PREVIEW_QA_AUTH_SCOPE || "").trim();
    const contract = previewQaContracts.find((candidate) => candidate.scope === scope);
    if (!contract) return res.status(401).json({ ok: false, error: "unauthenticated" });
    const entitlements = syntheticLandlordEntitlements(contract.landlordId);
    (req as any).user = {
      id: contract.landlordId,
      email: contract.email,
      role: "landlord",
      landlordId: contract.landlordId,
      plan: "starter",
      capabilities: [...entitlements.capabilities],
      entitlements,
    };
    (req as any).entitlements = entitlements;
    (req as any)[previewQaAuthenticated] = true;
    return next();
  };
}

export function isPreviewQaAuthenticatedRequest(req: unknown): boolean {
  return Boolean(req && typeof req === "object" && (req as any)[previewQaAuthenticated] === true);
}
