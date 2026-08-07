import type { RequestHandler } from "express";
import type { UserEntitlements } from "../services/entitlementsService";

export const PREVIEW_QA_IDENTITY_HEADER = "x-rentchain-preview-qa-identity";
export const PREVIEW_QA_IDENTITY_ALIAS = "pr1509-landlord";
export const PREVIEW_QA_LANDLORD_ID = "qa-pr1509-landlord";

const PREVIEW_PROJECT_ID = "rentchain-preview";
const PREVIEW_QA_SERVICE = "rentchain-pr1509-inbox-qa-b82c9914";
const PREVIEW_QA_SCOPE = "pr1509-unified-inbox";
const previewQaAuthenticated = Symbol("previewQaAuthenticated");

export type PreviewQaRoute = "landlord-inbox" | "landlord-message-list" | "landlord-message-detail";

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

function isSupportedRoute(route: string): route is PreviewQaRoute {
  return route === "landlord-inbox" || route === "landlord-message-list" || route === "landlord-message-detail";
}

export function decidePreviewQaAuth(input: PreviewQaDecisionInput): PreviewQaDecision {
  if (!input.selector) return { kind: "continue-normal-auth" };
  if (input.authorizationPresent) return { kind: "continue-normal-auth" };

  const projectId = String(input.env.GOOGLE_CLOUD_PROJECT || input.env.GCLOUD_PROJECT || "").trim();
  const appEnvironment = String(input.env.APP_ENV || "").trim().toLowerCase();
  const enabled = String(input.env.PREVIEW_QA_AUTH_ENABLED || "").trim().toLowerCase();
  const scope = String(input.env.PREVIEW_QA_AUTH_SCOPE || "").trim();
  const service = String(input.env.K_SERVICE || "").trim();
  const firestoreEnabled = String(input.env.FIRESTORE_ENABLED || "").trim().toLowerCase();
  const firestoreDatabaseId = String(input.env.FIRESTORE_DATABASE_ID || "").trim();

  const isolatedPreviewQa =
    enabled === "true" &&
    scope === PREVIEW_QA_SCOPE &&
    appEnvironment === "preview" &&
    projectId === PREVIEW_PROJECT_ID &&
    service === PREVIEW_QA_SERVICE &&
    firestoreEnabled === "true" &&
    firestoreDatabaseId === "(default)";

  if (!isolatedPreviewQa) return { kind: "reject" };
  if (input.method.toUpperCase() !== "GET" || !isSupportedRoute(input.route)) return { kind: "reject" };
  if (input.selector !== PREVIEW_QA_IDENTITY_ALIAS) return { kind: "reject" };
  return { kind: "allow" };
}

function syntheticLandlordEntitlements(): UserEntitlements {
  return {
    userId: PREVIEW_QA_LANDLORD_ID,
    role: "landlord",
    plan: "starter",
    capabilities: ["messaging"],
    landlordId: PREVIEW_QA_LANDLORD_ID,
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

    const entitlements = syntheticLandlordEntitlements();
    (req as any).user = {
      id: PREVIEW_QA_LANDLORD_ID,
      email: "qa-pr1509-landlord@example.invalid",
      role: "landlord",
      landlordId: PREVIEW_QA_LANDLORD_ID,
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
