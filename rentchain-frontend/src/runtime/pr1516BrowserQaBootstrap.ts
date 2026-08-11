export const PR1516_QA_BRANCH = "feat/multi-property-notices-v1";
export const PR1516_QA_SCOPE = "pr1516-multi-property-notices";
export const PR1516_QA_SELECTOR = "pr1516-landlord";
export const PR1516_QA_API_BASE = "/api/pr1516-notices";
export const PR1516_QA_BOOTSTRAP_PATH = "/api/pr1516-bootstrap";
export const PR1516_QA_SESSION_KEY = "rentchain.pr1516.browserQaSession.v1";

export const PR1516_QA_USER = {
  id: "qa-pr1516-landlord",
  landlordId: "qa-pr1516-landlord",
  email: "qa-pr1516-landlord@example.invalid",
  role: "landlord",
  plan: "starter",
  approved: true,
} as const;

type QaEnvironment = {
  VITE_DEPLOY_ENV?: string;
  VITE_PR1516_NOTICES_QA?: string;
  VITE_PR1516_QA_BRANCH?: string;
  VITE_PR1516_QA_COMMIT_SHA?: string;
  VITE_PR1516_QA_SCOPE?: string;
  VITE_PR1516_QA_SELECTOR?: string;
  VITE_API_BASE_URL?: string;
};

export type Pr1516BootstrapResponse = {
  ok: true;
  branch: string;
  commitSha: string;
  scope: string;
  selector: string;
  apiBase: string;
  landingPath: "/notices";
};

const SHA_PATTERN = /^[a-f0-9]{40}$/;

export function getPr1516QaBuildContract(
  env: QaEnvironment = import.meta.env,
  hostname = typeof window === "undefined" ? "" : window.location.hostname
) {
  const commitSha = String(env.VITE_PR1516_QA_COMMIT_SHA || "").trim().toLowerCase();
  const validHostname = hostname.endsWith(".vercel.app") && hostname !== "rentchain.vercel.app";
  const valid =
    validHostname &&
    env.VITE_DEPLOY_ENV === "preview" &&
    env.VITE_PR1516_NOTICES_QA === "true" &&
    env.VITE_PR1516_QA_BRANCH === PR1516_QA_BRANCH &&
    SHA_PATTERN.test(commitSha) &&
    env.VITE_PR1516_QA_SCOPE === PR1516_QA_SCOPE &&
    env.VITE_PR1516_QA_SELECTOR === PR1516_QA_SELECTOR &&
    env.VITE_API_BASE_URL === PR1516_QA_API_BASE;
  return { valid, commitSha };
}

export function isValidPr1516BootstrapResponse(value: unknown, expectedSha: string): value is Pr1516BootstrapResponse {
  const response = value as Partial<Pr1516BootstrapResponse> | null;
  return Boolean(
    response?.ok === true &&
      response.branch === PR1516_QA_BRANCH &&
      response.commitSha === expectedSha &&
      response.scope === PR1516_QA_SCOPE &&
      response.selector === PR1516_QA_SELECTOR &&
      response.apiBase === PR1516_QA_API_BASE &&
      response.landingPath === "/notices"
  );
}

export function activatePr1516BrowserQaSession(storage: Storage, commitSha: string): void {
  storage.setItem(PR1516_QA_SESSION_KEY, JSON.stringify({ version: 1, commitSha }));
}

export function clearPr1516BrowserQaSession(storage: Storage = window.sessionStorage): void {
  storage.removeItem(PR1516_QA_SESSION_KEY);
}

export function isPr1516BrowserQaSessionActive(
  storage: Storage = window.sessionStorage,
  env: QaEnvironment = import.meta.env,
  hostname = typeof window === "undefined" ? "" : window.location.hostname
): boolean {
  const contract = getPr1516QaBuildContract(env, hostname);
  if (!contract.valid) return false;
  try {
    const marker = JSON.parse(storage.getItem(PR1516_QA_SESSION_KEY) || "null");
    return marker?.version === 1 && marker?.commitSha === contract.commitSha;
  } catch {
    return false;
  }
}

export function resolvePr1516BrowserQaUser(
  storage: Storage,
  env: QaEnvironment,
  hostname: string
) {
  return isPr1516BrowserQaSessionActive(storage, env, hostname)
    ? { ...PR1516_QA_USER }
    : null;
}
