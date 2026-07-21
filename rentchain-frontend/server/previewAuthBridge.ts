import { getVercelOidcToken } from "@vercel/oidc";

const STS_URL = "https://sts.googleapis.com/v1/token";
const IAM_CREDENTIALS_BASE_URL = "https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts";

const TOKEN_EXCHANGE_GRANT_TYPE = "urn:ietf:params:oauth:grant-type:token-exchange";
const ACCESS_TOKEN_TYPE = "urn:ietf:params:oauth:token-type:access_token";
const ID_TOKEN_TYPE = "urn:ietf:params:oauth:token-type:id_token";
const CLOUD_PLATFORM_SCOPE = "https://www.googleapis.com/auth/cloud-platform";

export type PreviewAuthConfig = {
  vercelOidcTokenAudience: string;
  googleStsAudience: string;
  cloudRunIdTokenAudience: string;
  serviceAccountEmail: string;
  cloudRunServiceUrl: string;
  expectedSpikeCommit: string;
};

export type HelloEvidence = {
  ok: true;
  service: "bounded-oidc-hello";
  commitSha: string;
  revision: string;
  timestamp: string;
};

export type WrongAudienceEvidence = {
  ok: true;
  test: "wrong-audience";
  denied: true;
  status: number;
};

type FetchLike = typeof fetch;

export class PreviewAuthBridgeError extends Error {
  constructor(
    readonly code: string,
    readonly status = 502,
    readonly googleErrorCode?: string,
    readonly safeDescription?: string,
    readonly deniedPermission?: string,
  ) {
    super(code);
    this.name = "PreviewAuthBridgeError";
  }
}

export function readPreviewAuthConfig(env: NodeJS.ProcessEnv): PreviewAuthConfig {
  const required = {
    projectNumber: env.GCP_PROJECT_NUMBER,
    workloadIdentityPoolId: env.GCP_WORKLOAD_IDENTITY_POOL_ID,
    workloadIdentityProviderId: env.GCP_WORKLOAD_IDENTITY_PROVIDER_ID,
    serviceAccountEmail: env.GCP_SERVICE_ACCOUNT_EMAIL,
    cloudRunServiceUrl: env.CLOUD_RUN_SERVICE_URL,
    expectedSpikeCommit: env.EXPECTED_SPIKE_COMMIT,
  };

  for (const [name, value] of Object.entries(required)) {
    if (!value?.trim()) {
      throw new PreviewAuthBridgeError(`CONFIG_MISSING_${name.toUpperCase()}`, 500);
    }
  }

  const projectNumber = required.projectNumber!.trim();
  const poolId = required.workloadIdentityPoolId!.trim();
  const providerId = required.workloadIdentityProviderId!.trim();
  const cloudRunServiceUrl = required.cloudRunServiceUrl!.trim().replace(/\/$/, "");

  if (!/^\d+$/.test(projectNumber) || !/^[a-z0-9-]+$/.test(poolId) || !/^[a-z0-9-]+$/.test(providerId)) {
    throw new PreviewAuthBridgeError("CONFIG_INVALID_WIF_RESOURCE", 500);
  }

  const providerPath = `projects/${projectNumber}/locations/global/workloadIdentityPools/${poolId}/providers/${providerId}`;

  return {
    vercelOidcTokenAudience: `https://iam.googleapis.com/${providerPath}`,
    googleStsAudience: `//iam.googleapis.com/${providerPath}`,
    cloudRunIdTokenAudience: cloudRunServiceUrl,
    serviceAccountEmail: required.serviceAccountEmail!.trim(),
    cloudRunServiceUrl,
    expectedSpikeCommit: required.expectedSpikeCommit!.trim(),
  };
}

type GetVercelOidcTokenLike = (options: { audience: string }) => Promise<string>;

export function acquireVercelOidcToken(
  config: PreviewAuthConfig,
  getToken: GetVercelOidcTokenLike = getVercelOidcToken,
): Promise<string> {
  return getToken({ audience: config.vercelOidcTokenAudience });
}

function readGoogleError(payload: unknown): {
  googleErrorCode: string;
  safeDescription: string;
  deniedPermission?: string;
} {
  const record = payload && typeof payload === "object" ? (payload as Record<string, unknown>) : {};
  const nested =
    record.error && typeof record.error === "object"
      ? (record.error as Record<string, unknown>)
      : undefined;
  const rawCode = typeof record.error === "string" ? record.error : nested?.status;
  const googleErrorCode =
    typeof rawCode === "string" && /^[A-Za-z0-9_.-]{1,64}$/.test(rawCode)
      ? rawCode
      : "GOOGLE_REQUEST_REJECTED";
  const rawDescription =
    typeof record.error_description === "string"
      ? record.error_description
      : typeof nested?.message === "string"
        ? nested.message
        : "";
  const description = rawDescription.toLowerCase();
  const permissionMatch = rawDescription.match(/permission ['"]?([A-Za-z0-9.]+)['"]? denied/i);
  const safeDescription = description.includes("audience")
    ? "Google rejected the configured audience."
    : description.includes("issuer")
      ? "Google rejected the configured issuer."
      : description.includes("subject token")
        ? "Google rejected the external subject token."
        : description.includes("attribute")
          ? "Google rejected the workload identity attributes."
          : description.includes("permission")
            ? "Google denied the requested permission."
            : "Google rejected the request.";
  return {
    googleErrorCode,
    safeDescription,
    ...(permissionMatch ? { deniedPermission: permissionMatch[1] } : {}),
  };
}

export async function exchangeVercelToken(
  vercelOidcToken: string,
  config: PreviewAuthConfig,
  fetchImpl: FetchLike = fetch,
): Promise<string> {
  const response = await fetchImpl(STS_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      audience: config.googleStsAudience,
      grant_type: TOKEN_EXCHANGE_GRANT_TYPE,
      requested_token_type: ACCESS_TOKEN_TYPE,
      scope: CLOUD_PLATFORM_SCOPE,
      subject_token: vercelOidcToken,
      subject_token_type: ID_TOKEN_TYPE,
    }),
  });

  if (!response.ok) {
    const diagnostic = readGoogleError(await response.json().catch(() => undefined));
    throw new PreviewAuthBridgeError(
      "STS_EXCHANGE_DENIED",
      response.status,
      diagnostic.googleErrorCode,
      diagnostic.safeDescription,
    );
  }

  const payload = (await response.json()) as { access_token?: unknown };
  if (typeof payload.access_token !== "string" || !payload.access_token) {
    throw new PreviewAuthBridgeError("STS_ACCESS_TOKEN_MISSING");
  }
  return payload.access_token;
}

export async function generateCloudRunIdToken(
  federatedAccessToken: string,
  config: PreviewAuthConfig,
  audience: string,
  fetchImpl: FetchLike = fetch,
): Promise<string> {
  const account = encodeURIComponent(config.serviceAccountEmail);
  const response = await fetchImpl(`${IAM_CREDENTIALS_BASE_URL}/${account}:generateIdToken`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${federatedAccessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ audience, includeEmail: false }),
  });

  if (!response.ok) {
    const diagnostic = readGoogleError(await response.json().catch(() => undefined));
    throw new PreviewAuthBridgeError(
      "IAM_ID_TOKEN_DENIED",
      response.status,
      diagnostic.googleErrorCode,
      diagnostic.safeDescription,
      diagnostic.deniedPermission,
    );
  }

  const payload = (await response.json()) as { token?: unknown };
  if (typeof payload.token !== "string" || !payload.token) {
    throw new PreviewAuthBridgeError("IAM_ID_TOKEN_MISSING");
  }
  return payload.token;
}

export async function callCloudRun(
  idToken: string,
  config: PreviewAuthConfig,
  fetchImpl: FetchLike = fetch,
): Promise<Response> {
  return fetchImpl(config.cloudRunServiceUrl, {
    method: "GET",
    headers: { Authorization: `Bearer ${idToken}` },
    redirect: "manual",
  });
}

export async function readHelloEvidence(
  response: Response,
  config: PreviewAuthConfig,
): Promise<HelloEvidence> {
  if (!response.ok) {
    throw new PreviewAuthBridgeError("CLOUD_RUN_CALL_DENIED", response.status);
  }

  const payload = (await response.json()) as Record<string, unknown>;
  if (
    payload.ok !== true ||
    payload.service !== "bounded-oidc-hello" ||
    payload.commitSha !== config.expectedSpikeCommit ||
    typeof payload.revision !== "string" ||
    !payload.revision ||
    typeof payload.timestamp !== "string" ||
    !payload.timestamp
  ) {
    throw new PreviewAuthBridgeError("CLOUD_RUN_EVIDENCE_MISMATCH");
  }

  return {
    ok: true,
    service: "bounded-oidc-hello",
    commitSha: payload.commitSha,
    revision: payload.revision,
    timestamp: payload.timestamp,
  };
}

export async function runPreviewAuthBridge(input: {
  config: PreviewAuthConfig;
  vercelOidcToken: string;
  wrongAudience?: boolean;
  fetchImpl?: FetchLike;
}): Promise<HelloEvidence | WrongAudienceEvidence> {
  const fetchImpl = input.fetchImpl ?? fetch;
  const federatedAccessToken = await exchangeVercelToken(
    input.vercelOidcToken,
    input.config,
    fetchImpl,
  );
  const audience = input.wrongAudience
    ? "https://wrong-audience.invalid"
    : input.config.cloudRunIdTokenAudience;
  const idToken = await generateCloudRunIdToken(
    federatedAccessToken,
    input.config,
    audience,
    fetchImpl,
  );
  const response = await callCloudRun(idToken, input.config, fetchImpl);

  if (input.wrongAudience) {
    if (response.status !== 401 && response.status !== 403) {
      throw new PreviewAuthBridgeError("WRONG_AUDIENCE_NOT_DENIED", response.status);
    }
    return { ok: true, test: "wrong-audience", denied: true, status: response.status };
  }

  return readHelloEvidence(response, input.config);
}
