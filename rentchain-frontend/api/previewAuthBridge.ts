const STS_URL = "https://sts.googleapis.com/v1/token";
const IAM_CREDENTIALS_BASE_URL = "https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts";

const TOKEN_EXCHANGE_GRANT_TYPE = "urn:ietf:params:oauth:grant-type:token-exchange";
const ACCESS_TOKEN_TYPE = "urn:ietf:params:oauth:token-type:access_token";
const ID_TOKEN_TYPE = "urn:ietf:params:oauth:token-type:id_token";
const CLOUD_PLATFORM_SCOPE = "https://www.googleapis.com/auth/cloud-platform";

export type PreviewAuthConfig = {
  gcpAudience: string;
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
  ) {
    super(code);
    this.name = "PreviewAuthBridgeError";
  }
}

export function readPreviewAuthConfig(env: NodeJS.ProcessEnv): PreviewAuthConfig {
  const required = {
    gcpAudience: env.GCP_AUDIENCE,
    serviceAccountEmail: env.GCP_SERVICE_ACCOUNT_EMAIL,
    cloudRunServiceUrl: env.CLOUD_RUN_SERVICE_URL,
    expectedSpikeCommit: env.EXPECTED_SPIKE_COMMIT,
  };

  for (const [name, value] of Object.entries(required)) {
    if (!value?.trim()) {
      throw new PreviewAuthBridgeError(`CONFIG_MISSING_${name.toUpperCase()}`, 500);
    }
  }

  return {
    gcpAudience: required.gcpAudience!.trim(),
    serviceAccountEmail: required.serviceAccountEmail!.trim(),
    cloudRunServiceUrl: required.cloudRunServiceUrl!.trim().replace(/\/$/, ""),
    expectedSpikeCommit: required.expectedSpikeCommit!.trim(),
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
      audience: config.gcpAudience,
      grant_type: TOKEN_EXCHANGE_GRANT_TYPE,
      requested_token_type: ACCESS_TOKEN_TYPE,
      scope: CLOUD_PLATFORM_SCOPE,
      subject_token: vercelOidcToken,
      subject_token_type: ID_TOKEN_TYPE,
    }),
  });

  if (!response.ok) {
    throw new PreviewAuthBridgeError("STS_EXCHANGE_DENIED", response.status);
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
    throw new PreviewAuthBridgeError("IAM_ID_TOKEN_DENIED", response.status);
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
    : input.config.cloudRunServiceUrl;
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
