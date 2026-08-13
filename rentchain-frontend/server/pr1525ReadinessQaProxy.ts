import {
  acquireVercelOidcToken,
  exchangeVercelToken,
  generateCloudRunIdToken,
  PreviewAuthBridgeError,
  type PreviewAuthConfig,
} from "./previewAuthBridge.js";

export const PR1525_READINESS_QA = {
  branch: "feat/tenant-maintenance-image-attachments-v1",
  projectNumber: "501298948635",
  poolId: "vercel-preview-proxy",
  providerId: "vercel-preview",
  serviceAccount: "vercel-preview-proxy@rentchain-preview.iam.gserviceaccount.com",
  serviceUrl: "https://rentchain-pr1525-attachments-qa-d4fe051b-glistw4pya-nn.a.run.app",
  backendPath: "/health",
} as const;

const providerPath =
  `projects/${PR1525_READINESS_QA.projectNumber}/locations/global/` +
  `workloadIdentityPools/${PR1525_READINESS_QA.poolId}/` +
  `providers/${PR1525_READINESS_QA.providerId}`;

export const PR1525_READINESS_AUTH: PreviewAuthConfig = {
  vercelOidcTokenAudience: `https://iam.googleapis.com/${providerPath}`,
  googleStsAudience: `//iam.googleapis.com/${providerPath}`,
  cloudRunIdTokenAudience: PR1525_READINESS_QA.serviceUrl,
  serviceAccountEmail: PR1525_READINESS_QA.serviceAccount,
  cloudRunServiceUrl: PR1525_READINESS_QA.serviceUrl,
  expectedSpikeCommit: "",
};

type FetchLike = typeof fetch;

export type Pr1525ReadinessDependencies = {
  fetchImpl?: FetchLike;
  getVercelOidcToken?: (options: { audience: string }) => Promise<string>;
};

function fail(res: any, status: number, error: string) {
  res.setHeader("cache-control", "no-store");
  return res.status(status).json({ ok: false, error });
}

export async function handlePr1525ReadinessQaProxy(
  req: any,
  res: any,
  dependencies: Pr1525ReadinessDependencies = {},
) {
  if (
    process.env.VERCEL_ENV !== "preview" ||
    process.env.VERCEL_GIT_COMMIT_REF !== PR1525_READINESS_QA.branch
  ) {
    return fail(res, 403, "PR1525_READINESS_CONTEXT_REJECTED");
  }

  if (String(req?.method || "GET").toUpperCase() !== "GET") {
    res.setHeader("allow", "GET");
    return fail(res, 405, "PR1525_READINESS_METHOD_NOT_ALLOWED");
  }

  const fetchImpl = dependencies.fetchImpl ?? fetch;
  try {
    const oidc = await acquireVercelOidcToken(
      PR1525_READINESS_AUTH,
      dependencies.getVercelOidcToken,
    );
    const access = await exchangeVercelToken(
      oidc,
      PR1525_READINESS_AUTH,
      fetchImpl,
    );
    const identity = await generateCloudRunIdToken(
      access,
      PR1525_READINESS_AUTH,
      PR1525_READINESS_QA.serviceUrl,
      fetchImpl,
    );
    const upstream = await fetchImpl(
      `${PR1525_READINESS_QA.serviceUrl}${PR1525_READINESS_QA.backendPath}`,
      {
        method: "GET",
        redirect: "manual",
        headers: {
          accept: "application/json",
          "X-Serverless-Authorization": `Bearer ${identity}`,
        },
      },
    );
    const payload = Buffer.from(await upstream.arrayBuffer());
    res.setHeader("cache-control", "no-store");
    res.setHeader("content-type", "application/json; charset=utf-8");
    res.setHeader("x-rentchain-api-proxy", "pr1525-readiness-qa");
    return res.status(upstream.status).send(payload);
  } catch (error) {
    const code =
      error instanceof PreviewAuthBridgeError && error.code.startsWith("STS_")
        ? "PR1525_READINESS_STS_FAILED"
        : error instanceof PreviewAuthBridgeError && error.code.startsWith("IAM_")
          ? "PR1525_READINESS_IDENTITY_FAILED"
          : "PR1525_READINESS_BACKEND_UNAVAILABLE";
    console.error("[pr1525-readiness-qa] request failed", { code });
    return fail(res, 502, code);
  }
}
