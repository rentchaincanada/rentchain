export const G1C_BOOTSTRAP = {
  branch: "feat/g1c-mandatory-tenant-government-id-workflow-v1",
  scope: "g1c-synthetic-identity-qa-v1",
  principalId: "qa-g1c-tenant",
} as const;

function fail(res: any, status: number, error: string) {
  res.setHeader("cache-control", "no-store");
  return res.status(status).json({ ok: false, error });
}

export function classifyG1cBootstrap(req: any) {
  const sha = String(process.env.VERCEL_GIT_COMMIT_SHA || "").trim();
  const allowed =
    String(req?.method || "GET").toUpperCase() === "GET" &&
    process.env.VERCEL_ENV === "preview" &&
    process.env.VERCEL_GIT_COMMIT_REF === G1C_BOOTSTRAP.branch &&
    /^[0-9a-f]{40}$/.test(sha);
  return allowed ? { allowed: true as const, sha } : { allowed: false as const };
}

export function handleG1cBrowserBootstrap(req: any, res: any) {
  const decision = classifyG1cBootstrap(req);
  if (!decision.allowed) return fail(res, 404, "G1C_BOOTSTRAP_NOT_AVAILABLE");
  res.setHeader("cache-control", "no-store");
  res.setHeader("x-rentchain-qa-bootstrap", "g1c-fixed-session");
  return res.status(200).json({
    ok: true,
    scope: G1C_BOOTSTRAP.scope,
    deploymentSha: decision.sha,
    session: { role: "tenant", principalId: G1C_BOOTSTRAP.principalId },
  });
}
