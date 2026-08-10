import {
  acquireVercelOidcToken,
  exchangeVercelToken,
  generateCloudRunIdToken,
  PreviewAuthBridgeError,
  type PreviewAuthConfig,
} from "./previewAuthBridge.js";

export const PR1512_QA = {
  branch: "feat/property-notices-v1",
  projectNumber: "501298948635",
  poolId: "vercel-preview-proxy",
  providerId: "vercel-preview",
  serviceAccount: "vercel-preview-proxy@rentchain-preview.iam.gserviceaccount.com",
  serviceUrl: "https://rentchain-pr1512-notices-qa-fff3a2dc-glistw4pya-nn.a.run.app",
  selector: "pr1512-landlord",
  propertyId: "pr1512-notices-fff3-property-a",
} as const;

const providerPath = `projects/${PR1512_QA.projectNumber}/locations/global/workloadIdentityPools/${PR1512_QA.poolId}/providers/${PR1512_QA.providerId}`;
export const PR1512_QA_AUTH: PreviewAuthConfig = {
  vercelOidcTokenAudience: `https://iam.googleapis.com/${providerPath}`,
  googleStsAudience: `//iam.googleapis.com/${providerPath}`,
  cloudRunIdTokenAudience: PR1512_QA.serviceUrl,
  serviceAccountEmail: PR1512_QA.serviceAccount,
  cloudRunServiceUrl: PR1512_QA.serviceUrl,
  expectedSpikeCommit: "",
};

const DETAIL = /^\/api\/landlord\/notices\/notice_[a-f0-9]{64}$/;
const SAFE_RESPONSE_HEADERS = new Set(["cache-control", "content-type", "x-request-id", "x-route-source"]);
type FetchLike = typeof fetch;

export type Pr1512ProxyDependencies = {
  fetchImpl?: FetchLike;
  getVercelOidcToken?: (options: { audience: string }) => Promise<string>;
};

function fail(res: any, status: number, error: string) {
  res.setHeader("cache-control", "no-store");
  return res.status(status).json({ ok: false, error });
}

function requestPath(req: any) {
  const raw = String(req?.url || "");
  const [path, query = ""] = raw.split("?", 2);
  const prefix = "/api/pr1512-notices";
  if (!path.startsWith(`${prefix}/`) || /%2f|%5c|\\|\0/i.test(path)) return null;
  return { backendPath: path.slice(prefix.length), query };
}

function safeQuery(path: string, query: string) {
  const params = new URLSearchParams(query);
  if (path === "/api/landlord/notices") {
    return params.size === 0 || (params.size === 1 && params.get("limit") === "50");
  }
  if (path === "/api/properties") {
    return params.size === 0 || (params.size === 1 && params.get("status") === "active");
  }
  if (path === "/api/me") return params.size === 0;
  if (path === "/api/landlord/notices/recipients") {
    if (params.get("propertyId") !== PR1512_QA.propertyId) return false;
    for (const key of params.keys()) if (!["propertyId", "unitIds", "tenantIds"].includes(key)) return false;
    return [params.get("unitIds"), params.get("tenantIds")].filter(Boolean).every((value) =>
      String(value).split(",").every((id) => /^pr1512-notices-fff3-(?:unit|tenant)-[a-z0-9]+$/.test(id)),
    );
  }
  return DETAIL.test(path) && params.size === 0;
}

export function classifyPr1512Request(req: any) {
  const method = String(req?.method || "GET").toUpperCase();
  if (method !== "GET") return { allowed: false as const, status: 405, error: "PR1512_QA_METHOD_NOT_ALLOWED" };
  const parsed = requestPath(req);
  if (!parsed) return { allowed: false as const, status: 404, error: "PR1512_QA_ROUTE_NOT_ALLOWED" };
  const allowedPath = parsed.backendPath === "/api/properties" ||
    parsed.backendPath === "/api/me" ||
    parsed.backendPath === "/api/landlord/notices" ||
    parsed.backendPath === "/api/landlord/notices/recipients" || DETAIL.test(parsed.backendPath);
  if (!allowedPath || !safeQuery(parsed.backendPath, parsed.query)) {
    return { allowed: false as const, status: 404, error: "PR1512_QA_ROUTE_NOT_ALLOWED" };
  }
  return { allowed: true as const, ...parsed };
}

export async function handlePr1512NoticesQaProxy(req: any, res: any, dependencies: Pr1512ProxyDependencies = {}) {
  if (process.env.VERCEL_ENV !== "preview" || process.env.VERCEL_GIT_COMMIT_REF !== PR1512_QA.branch) {
    return fail(res, 403, "PR1512_QA_CONTEXT_REJECTED");
  }
  const decision = classifyPr1512Request(req);
  if (!decision.allowed) {
    if (decision.status === 405) res.setHeader("allow", "GET");
    return fail(res, decision.status, decision.error);
  }

  if (decision.backendPath === "/api/me") {
    res.setHeader("x-rentchain-api-proxy", "pr1512-notices-readonly");
    return res.status(200).json({ user: { id: "qa-pr1512-landlord", landlordId: "qa-pr1512-landlord", email: "qa-pr1512-landlord@example.invalid", role: "landlord", plan: "starter", approved: true } });
  }

  const fetchImpl = dependencies.fetchImpl ?? fetch;
  try {
    const oidc = await acquireVercelOidcToken(PR1512_QA_AUTH, dependencies.getVercelOidcToken);
    const access = await exchangeVercelToken(oidc, PR1512_QA_AUTH, fetchImpl);
    const identity = await generateCloudRunIdToken(access, PR1512_QA_AUTH, PR1512_QA.serviceUrl, fetchImpl);
    const upstreamPath = decision.backendPath === "/api/properties"
      ? `/api/landlord/notices/recipients?propertyId=${encodeURIComponent(PR1512_QA.propertyId)}`
      : `${decision.backendPath}${decision.query ? `?${decision.query}` : ""}`;
    const upstream = await fetchImpl(`${PR1512_QA.serviceUrl}${upstreamPath}`, {
      method: "GET",
      redirect: "manual",
      headers: {
        accept: "application/json",
        "X-Serverless-Authorization": `Bearer ${identity}`,
        "x-rentchain-preview-qa-identity": PR1512_QA.selector,
      },
    });
    const payload = await upstream.arrayBuffer();
    if (decision.backendPath === "/api/properties" && upstream.ok) {
      const data = JSON.parse(Buffer.from(payload).toString("utf8"));
      const units = new Map<string, string>();
      for (const recipient of data.recipients || []) {
        (recipient.unitIds || []).forEach((id: string, index: number) => units.set(id, recipient.unitLabels?.[index] || "Unit"));
      }
      res.setHeader("content-type", "application/json; charset=utf-8");
      res.setHeader("x-rentchain-api-proxy", "pr1512-notices-readonly");
      return res.status(200).json({ items: [{ id: data.property.id, name: data.property.label, addressLine1: data.property.label, totalUnits: units.size, status: "active", units: [...units].map(([id, unitNumber]) => ({ id, unitNumber, status: "occupied" })) }] });
    }
    for (const [name, value] of upstream.headers.entries()) if (SAFE_RESPONSE_HEADERS.has(name.toLowerCase())) res.setHeader(name, value);
    res.setHeader("x-rentchain-api-proxy", "pr1512-notices-readonly");
    return res.status(upstream.status).send(Buffer.from(payload));
  } catch (error) {
    const code = error instanceof PreviewAuthBridgeError && error.code.startsWith("STS_")
      ? "PR1512_QA_STS_FAILED"
      : error instanceof PreviewAuthBridgeError && error.code.startsWith("IAM_")
        ? "PR1512_QA_IDENTITY_FAILED"
        : "PR1512_QA_BACKEND_UNAVAILABLE";
    console.error("[pr1512-qa-proxy] request failed", { code });
    return fail(res, 502, code);
  }
}
