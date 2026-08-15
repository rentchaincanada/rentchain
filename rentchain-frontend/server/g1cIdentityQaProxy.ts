import {
  acquireVercelOidcToken,
  exchangeVercelToken,
  generateCloudRunIdToken,
  PreviewAuthBridgeError,
  type PreviewAuthConfig,
} from "./previewAuthBridge.js";

export const G1C_IDENTITY_QA = {
  branch: "feat/g1c-mandatory-tenant-government-id-workflow-v1",
  projectNumber: "501298948635",
  poolId: "vercel-preview-proxy",
  providerId: "vercel-preview",
  serviceAccount: "vercel-preview-proxy@rentchain-preview.iam.gserviceaccount.com",
  serviceUrl: "https://rentchain-g1c-identity-qa-v1-glistw4pya-nn.a.run.app",
  selector: "qa-g1c-tenant",
} as const;

const providerPath = `projects/${G1C_IDENTITY_QA.projectNumber}/locations/global/workloadIdentityPools/${G1C_IDENTITY_QA.poolId}/providers/${G1C_IDENTITY_QA.providerId}`;
const auth: PreviewAuthConfig = {
  vercelOidcTokenAudience: `https://iam.googleapis.com/${providerPath}`,
  googleStsAudience: `//iam.googleapis.com/${providerPath}`,
  cloudRunIdTokenAudience: G1C_IDENTITY_QA.serviceUrl,
  serviceAccountEmail: G1C_IDENTITY_QA.serviceAccount,
  cloudRunServiceUrl: G1C_IDENTITY_QA.serviceUrl,
  expectedSpikeCommit: "",
};

const DOCUMENT_ID = "[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}";
const LIST_OR_UPLOAD = /^\/api\/tenant\/identity-documents$/;
const STATUS = /^\/api\/tenant\/identity-documents\/status$/;
const CONSENT = /^\/api\/tenant\/identity-documents\/consent$/;
const ACCESS = new RegExp(`^/api/tenant/identity-documents/${DOCUMENT_ID}/access$`, "i");
const DELETE = new RegExp(`^/api/tenant/identity-documents/${DOCUMENT_ID}$`, "i");
const SAFE_RESPONSE_HEADERS = new Set(["cache-control", "content-type", "x-request-id", "x-route-source"]);

function fail(res: any, status: number, error: string) {
  res.setHeader("cache-control", "no-store");
  return res.status(status).json({ ok: false, error });
}

export function classifyG1cIdentityRequest(req: any) {
  const raw = String(req?.url || "").split("?", 1)[0];
  const prefix = "/api/g1c-identity/";
  if (!raw.startsWith(prefix) || /%2f|%5c|\\|\0/i.test(raw)) return { allowed: false as const, status: 404 };
  const backendPath = `/${raw.slice(prefix.length)}`;
  const method = String(req?.method || "GET").toUpperCase();
  const allowed =
    (method === "GET" && (LIST_OR_UPLOAD.test(backendPath) || STATUS.test(backendPath))) ||
    (method === "POST" && (LIST_OR_UPLOAD.test(backendPath) || CONSENT.test(backendPath) || ACCESS.test(backendPath))) ||
    (method === "DELETE" && DELETE.test(backendPath));
  return allowed ? { allowed: true as const, backendPath, method } : { allowed: false as const, status: 404 };
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

export async function handleG1cIdentityQaProxy(req: any, res: any, dependencies: any = {}) {
  if (process.env.VERCEL_ENV !== "preview" || process.env.VERCEL_GIT_COMMIT_REF !== G1C_IDENTITY_QA.branch) {
    return fail(res, 403, "G1C_QA_CONTEXT_REJECTED");
  }
  const decision = classifyG1cIdentityRequest(req);
  if (!decision.allowed) return fail(res, decision.status, "G1C_QA_ROUTE_NOT_ALLOWED");
  const fetchImpl = dependencies.fetchImpl ?? fetch;
  try {
    const oidc = await acquireVercelOidcToken(auth, dependencies.getVercelOidcToken);
    const access = await exchangeVercelToken(oidc, auth, fetchImpl);
    const identity = await generateCloudRunIdToken(access, auth, G1C_IDENTITY_QA.serviceUrl, fetchImpl);
    const body = await requestBody(req);
    const headers: Record<string, string> = {
      accept: "application/json",
      "X-Serverless-Authorization": `Bearer ${identity}`,
      "x-rentchain-preview-qa-identity": G1C_IDENTITY_QA.selector,
    };
    const contentType = String(req?.headers?.["content-type"] || "");
    if (body && contentType) headers["content-type"] = contentType;
    const upstream = await fetchImpl(`${G1C_IDENTITY_QA.serviceUrl}${decision.backendPath}`, {
      method: decision.method,
      redirect: "manual",
      headers,
      body,
    });
    const payload = Buffer.from(await upstream.arrayBuffer());
    for (const [name, value] of upstream.headers.entries()) if (SAFE_RESPONSE_HEADERS.has(name.toLowerCase())) res.setHeader(name, value);
    res.setHeader("cache-control", "no-store");
    res.setHeader("x-rentchain-api-proxy", "g1c-identity-qa");
    return res.status(upstream.status).send(payload);
  } catch (error) {
    const code = error instanceof PreviewAuthBridgeError && error.code.startsWith("STS_")
      ? "G1C_QA_STS_FAILED"
      : error instanceof PreviewAuthBridgeError && error.code.startsWith("IAM_")
        ? "G1C_QA_IDENTITY_FAILED"
        : "G1C_QA_BACKEND_UNAVAILABLE";
    console.error("[g1c-identity-qa] request failed", { code });
    return fail(res, 502, code);
  }
}
