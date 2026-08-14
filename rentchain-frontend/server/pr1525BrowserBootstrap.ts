export const PR1525_BOOTSTRAP = {
  branch: "feat/tenant-maintenance-image-attachments-v1",
  requestId: "qa-pr1525-target-request",
  sessions: {
    tenant: {
      role: "tenant",
      principalId: "qa-pr1525-tenant",
      apiActor: "tenant",
    },
    landlord: {
      role: "landlord",
      principalId: "qa-pr1525-landlord",
      apiActor: "landlord",
    },
  },
} as const;

export type Pr1525BootstrapRole = keyof typeof PR1525_BOOTSTRAP.sessions;

function fail(res: any, status: number, error: string) {
  res.setHeader("cache-control", "no-store");
  return res.status(status).json({ ok: false, error });
}

export function classifyPr1525Bootstrap(req: any) {
  const role = String(req?.query?.role || "").trim() as Pr1525BootstrapRole;
  const session = PR1525_BOOTSTRAP.sessions[role];
  const sha = String(process.env.VERCEL_GIT_COMMIT_SHA || "").trim();
  const allowed =
    String(req?.method || "GET").toUpperCase() === "GET" &&
    process.env.VERCEL_ENV === "preview" &&
    process.env.VERCEL_GIT_COMMIT_REF === PR1525_BOOTSTRAP.branch &&
    /^[0-9a-f]{40}$/.test(sha) &&
    Boolean(session);
  return allowed ? { allowed: true as const, role, session, sha } : { allowed: false as const };
}

export function handlePr1525BrowserBootstrap(req: any, res: any) {
  const decision = classifyPr1525Bootstrap(req);
  if (!decision.allowed) return fail(res, 404, "PR1525_BOOTSTRAP_NOT_AVAILABLE");
  res.setHeader("cache-control", "no-store");
  res.setHeader("x-rentchain-qa-bootstrap", "pr1525-fixed-session");
  return res.status(200).json({
    ok: true,
    scope: "pr1525-maintenance-attachments",
    deploymentSha: decision.sha,
    session: decision.session,
    requestId: PR1525_BOOTSTRAP.requestId,
  });
}
