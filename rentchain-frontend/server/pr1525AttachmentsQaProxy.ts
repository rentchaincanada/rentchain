import {
  acquireVercelOidcToken,
  exchangeVercelToken,
  generateCloudRunIdToken,
  PreviewAuthBridgeError,
  type PreviewAuthConfig,
} from "./previewAuthBridge.js";

export const PR1525_ATTACHMENTS_QA = {
  branch: "feat/tenant-maintenance-image-attachments-v1",
  projectNumber: "501298948635",
  poolId: "vercel-preview-proxy",
  providerId: "vercel-preview",
  serviceAccount: "vercel-preview-proxy@rentchain-preview.iam.gserviceaccount.com",
  serviceUrl: "https://rentchain-pr1525-attachments-qa-d4fe051b-glistw4pya-nn.a.run.app",
  selectors: {
    tenant: "pr1525-tenant",
    landlord: "pr1525-landlord",
    foreignTenant: "pr1525-foreign-tenant",
    foreignLandlord: "pr1525-foreign-landlord",
  },
} as const;

const providerPath = `projects/${PR1525_ATTACHMENTS_QA.projectNumber}/locations/global/workloadIdentityPools/${PR1525_ATTACHMENTS_QA.poolId}/providers/${PR1525_ATTACHMENTS_QA.providerId}`;
const auth: PreviewAuthConfig = {
  vercelOidcTokenAudience: `https://iam.googleapis.com/${providerPath}`,
  googleStsAudience: `//iam.googleapis.com/${providerPath}`,
  cloudRunIdTokenAudience: PR1525_ATTACHMENTS_QA.serviceUrl,
  serviceAccountEmail: PR1525_ATTACHMENTS_QA.serviceAccount,
  cloudRunServiceUrl: PR1525_ATTACHMENTS_QA.serviceUrl,
  expectedSpikeCommit: "",
};

const ATTACHMENT_ID = "[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}";
const TENANT_PATH = new RegExp(`^/api/tenant/maintenance-requests/qa-pr1525-(?:target|foreign)-request/attachments(?:/${ATTACHMENT_ID}(?:/access)?)?$`, "i");
const LANDLORD_PATH = new RegExp(`^/api/landlord/maintenance/qa-pr1525-(?:target|foreign)-request/attachments(?:/${ATTACHMENT_ID}/access)?$`, "i");
const SAFE_RESPONSE_HEADERS = new Set(["cache-control", "content-type", "x-request-id", "x-route-source"]);

function fail(res: any, status: number, error: string) {
  res.setHeader("cache-control", "no-store");
  return res.status(status).json({ ok: false, error });
}

export function classifyPr1525AttachmentRequest(req: any) {
  const raw = String(req?.url || "").split("?", 1)[0];
  const prefix = "/api/pr1525-attachments/";
  if (!raw.startsWith(prefix) || /%2f|%5c|\\|\0/i.test(raw)) return { allowed: false as const, status: 404 };
  const remainder = raw.slice(prefix.length);
  const slash = remainder.indexOf("/");
  if (slash < 1) return { allowed: false as const, status: 404 };
  const actor = remainder.slice(0, slash) as keyof typeof PR1525_ATTACHMENTS_QA.selectors;
  const backendPath = `/${remainder.slice(slash + 1)}`;
  const selector = PR1525_ATTACHMENTS_QA.selectors[actor];
  const method = String(req?.method || "GET").toUpperCase();
  const tenantActor = actor === "tenant" || actor === "foreignTenant";
  const landlordActor = actor === "landlord" || actor === "foreignLandlord";
  const allowedMethod = tenantActor ? ["GET", "POST", "DELETE"].includes(method) : method === "GET";
  const allowedPath = (tenantActor && TENANT_PATH.test(backendPath)) || (landlordActor && LANDLORD_PATH.test(backendPath));
  if (!selector || !allowedMethod || !allowedPath) return { allowed: false as const, status: allowedPath ? 405 : 404 };
  return { allowed: true as const, actor, selector, backendPath, method };
}

async function requestBody(req: any): Promise<Buffer | undefined> {
  if (["GET", "HEAD"].includes(String(req?.method || "GET").toUpperCase())) return undefined;
  if (Buffer.isBuffer(req.body)) return req.body;
  const chunks: Buffer[] = [];
  if (req && typeof req[Symbol.asyncIterator] === "function") {
    for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return chunks.length ? Buffer.concat(chunks) : undefined;
}

export async function handlePr1525AttachmentsQaProxy(req: any, res: any, dependencies: any = {}) {
  if (process.env.VERCEL_ENV !== "preview" || process.env.VERCEL_GIT_COMMIT_REF !== PR1525_ATTACHMENTS_QA.branch) {
    return fail(res, 403, "PR1525_QA_CONTEXT_REJECTED");
  }
  const decision = classifyPr1525AttachmentRequest(req);
  if (!decision.allowed) return fail(res, decision.status, "PR1525_QA_ROUTE_NOT_ALLOWED");
  const fetchImpl = dependencies.fetchImpl ?? fetch;
  try {
    const oidc = await acquireVercelOidcToken(auth, dependencies.getVercelOidcToken);
    const access = await exchangeVercelToken(oidc, auth, fetchImpl);
    const identity = await generateCloudRunIdToken(access, auth, PR1525_ATTACHMENTS_QA.serviceUrl, fetchImpl);
    const body = await requestBody(req);
    const headers: Record<string, string> = {
      accept: "application/json",
      "X-Serverless-Authorization": `Bearer ${identity}`,
      "x-rentchain-preview-qa-identity": decision.selector,
    };
    const contentType = String(req?.headers?.["content-type"] || "");
    if (body && contentType) headers["content-type"] = contentType;
    const upstream = await fetchImpl(`${PR1525_ATTACHMENTS_QA.serviceUrl}${decision.backendPath}`, {
      method: decision.method,
      redirect: "manual",
      headers,
      body,
    });
    const payload = Buffer.from(await upstream.arrayBuffer());
    for (const [name, value] of upstream.headers.entries()) if (SAFE_RESPONSE_HEADERS.has(name.toLowerCase())) res.setHeader(name, value);
    res.setHeader("cache-control", "no-store");
    res.setHeader("x-rentchain-api-proxy", "pr1525-attachments-qa");
    return res.status(upstream.status).send(payload);
  } catch (error) {
    const code = error instanceof PreviewAuthBridgeError && error.code.startsWith("STS_")
      ? "PR1525_QA_STS_FAILED"
      : error instanceof PreviewAuthBridgeError && error.code.startsWith("IAM_")
        ? "PR1525_QA_IDENTITY_FAILED"
        : "PR1525_QA_BACKEND_UNAVAILABLE";
    console.error("[pr1525-attachments-qa] request failed", { code });
    return fail(res, 502, code);
  }
}
