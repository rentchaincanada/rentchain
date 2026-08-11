import {
  acquireVercelOidcToken,
  exchangeVercelToken,
  generateCloudRunIdToken,
  PreviewAuthBridgeError,
  type PreviewAuthConfig,
} from "./previewAuthBridge.js";

export const PR1516_QA = {
  branch: "feat/multi-property-notices-v1",
  projectNumber: "501298948635",
  poolId: "vercel-preview-proxy",
  providerId: "vercel-preview",
  serviceAccount: "vercel-preview-proxy@rentchain-preview.iam.gserviceaccount.com",
  serviceUrl: "https://rentchain-pr1516-notices-qa-a2695c6c-glistw4pya-nn.a.run.app",
  selector: "pr1516-landlord",
  propertyIds: ["qa-pr1516-property-a", "qa-pr1516-property-b", "qa-pr1516-property-c"],
} as const;

const providerPath = `projects/${PR1516_QA.projectNumber}/locations/global/workloadIdentityPools/${PR1516_QA.poolId}/providers/${PR1516_QA.providerId}`;
export const PR1516_QA_AUTH: PreviewAuthConfig = {
  vercelOidcTokenAudience: `https://iam.googleapis.com/${providerPath}`,
  googleStsAudience: `//iam.googleapis.com/${providerPath}`,
  cloudRunIdTokenAudience: PR1516_QA.serviceUrl,
  serviceAccountEmail: PR1516_QA.serviceAccount,
  cloudRunServiceUrl: PR1516_QA.serviceUrl,
  expectedSpikeCommit: "",
};

const DETAIL = /^\/api\/landlord\/notices\/notice_[a-f0-9]{64}$/;
const FILTER_ID = /^qa-pr1516-(?:unit|tenant)-[a-z0-9-]+$/;
const SAFE_RESPONSE_HEADERS = new Set(["cache-control", "content-type", "x-request-id", "x-route-source"]);
type FetchLike = typeof fetch;

export type Pr1516ProxyDependencies = {
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
  const prefix = "/api/pr1516-notices";
  if (!path.startsWith(`${prefix}/`) || /%2f|%5c|\\|\0/i.test(path)) return null;
  const backendPath = path.slice(prefix.length);
  const params = new URLSearchParams(query);
  const routedSuffix = backendPath.slice(1);
  if (params.get("path") === routedSuffix) params.delete("path");
  return { backendPath, query: params.toString() };
}

function exactSubset(value: string | null, allowed: readonly string[]) {
  if (!value) return false;
  const ids = value.split(",");
  return ids.length > 0 && ids.length <= allowed.length && new Set(ids).size === ids.length && ids.every((id) => allowed.includes(id));
}

function safeQuery(path: string, query: string) {
  const params = new URLSearchParams(query);
  if (path === "/api/landlord/notices") return params.size === 0 || (params.size === 1 && params.get("limit") === "50");
  if (path === "/api/properties") return params.size === 0 || (params.size === 1 && params.get("status") === "active");
  if (path === "/api/me") return params.size === 0;
  if (path === "/api/landlord/notices/recipients") {
    if (!exactSubset(params.get("propertyIds"), PR1516_QA.propertyIds)) return false;
    for (const key of params.keys()) if (!["propertyIds", "unitIds", "tenantIds"].includes(key)) return false;
    return [params.get("unitIds"), params.get("tenantIds")].filter(Boolean).every((value) =>
      String(value).split(",").every((id) => FILTER_ID.test(id)),
    );
  }
  return DETAIL.test(path) && params.size === 0;
}

export function classifyPr1516Request(req: any) {
  const method = String(req?.method || "GET").toUpperCase();
  if (method !== "GET") return { allowed: false as const, status: 405, error: "PR1516_QA_METHOD_NOT_ALLOWED" };
  const parsed = requestPath(req);
  if (!parsed) return { allowed: false as const, status: 404, error: "PR1516_QA_ROUTE_NOT_ALLOWED" };
  const allowedPath = parsed.backendPath === "/api/properties" || parsed.backendPath === "/api/me" ||
    parsed.backendPath === "/api/landlord/notices" || parsed.backendPath === "/api/landlord/notices/recipients" || DETAIL.test(parsed.backendPath);
  if (!allowedPath || !safeQuery(parsed.backendPath, parsed.query)) {
    return { allowed: false as const, status: 404, error: "PR1516_QA_ROUTE_NOT_ALLOWED" };
  }
  return { allowed: true as const, ...parsed };
}

export async function handlePr1516NoticesQaProxy(req: any, res: any, dependencies: Pr1516ProxyDependencies = {}) {
  if (process.env.VERCEL_ENV !== "preview" || process.env.VERCEL_GIT_COMMIT_REF !== PR1516_QA.branch) {
    return fail(res, 403, "PR1516_QA_CONTEXT_REJECTED");
  }
  const decision = classifyPr1516Request(req);
  if (!decision.allowed) {
    if (decision.status === 405) res.setHeader("allow", "GET");
    return fail(res, decision.status, decision.error);
  }
  if (decision.backendPath === "/api/me") {
    res.setHeader("x-rentchain-api-proxy", "pr1516-notices-readonly");
    return res.status(200).json({ user: { id: "qa-pr1516-landlord", landlordId: "qa-pr1516-landlord", email: "qa-pr1516-landlord@example.invalid", role: "landlord", plan: "starter", approved: true } });
  }

  const fetchImpl = dependencies.fetchImpl ?? fetch;
  try {
    const oidc = await acquireVercelOidcToken(PR1516_QA_AUTH, dependencies.getVercelOidcToken);
    const access = await exchangeVercelToken(oidc, PR1516_QA_AUTH, fetchImpl);
    const identity = await generateCloudRunIdToken(access, PR1516_QA_AUTH, PR1516_QA.serviceUrl, fetchImpl);
    const upstreamPath = decision.backendPath === "/api/properties"
      ? `/api/landlord/notices/recipients?propertyIds=${PR1516_QA.propertyIds.join(",")}`
      : `${decision.backendPath}${decision.query ? `?${decision.query}` : ""}`;
    const upstream = await fetchImpl(`${PR1516_QA.serviceUrl}${upstreamPath}`, {
      method: "GET",
      redirect: "manual",
      headers: {
        accept: "application/json",
        "X-Serverless-Authorization": `Bearer ${identity}`,
        "x-rentchain-preview-qa-identity": PR1516_QA.selector,
      },
    });
    const payload = await upstream.arrayBuffer();
    if (decision.backendPath === "/api/properties" && upstream.ok) {
      const data = JSON.parse(Buffer.from(payload).toString("utf8"));
      const units = new Map<string, { id: string; unitNumber: string; propertyId: string }>();
      for (const recipient of data.recipients || []) {
        for (const unit of recipient.units || []) units.set(unit.id, { id: unit.id, unitNumber: unit.label, propertyId: unit.propertyId });
      }
      const items = (data.properties || []).map((property: { id: string; label: string }) => ({
        id: property.id,
        name: property.label,
        addressLine1: property.label,
        status: "active",
        units: [...units.values()].filter((unit) => unit.propertyId === property.id).map(({ propertyId: _propertyId, ...unit }) => ({ ...unit, status: "occupied" })),
      })).map((property: any) => ({ ...property, totalUnits: property.units.length }));
      res.setHeader("content-type", "application/json; charset=utf-8");
      res.setHeader("x-rentchain-api-proxy", "pr1516-notices-readonly");
      return res.status(200).json({ items });
    }
    for (const [name, value] of upstream.headers.entries()) if (SAFE_RESPONSE_HEADERS.has(name.toLowerCase())) res.setHeader(name, value);
    res.setHeader("x-rentchain-api-proxy", "pr1516-notices-readonly");
    return res.status(upstream.status).send(Buffer.from(payload));
  } catch (error) {
    const code = error instanceof PreviewAuthBridgeError && error.code.startsWith("STS_")
      ? "PR1516_QA_STS_FAILED"
      : error instanceof PreviewAuthBridgeError && error.code.startsWith("IAM_")
        ? "PR1516_QA_IDENTITY_FAILED"
        : "PR1516_QA_BACKEND_UNAVAILABLE";
    console.error("[pr1516-qa-proxy] request failed", { code });
    return fail(res, 502, code);
  }
}
