import type { NextFunction, Request, Response } from "express";

function asString(value: unknown): string {
  return String(value ?? "").trim();
}

export function isProductionDiagnosticRuntime(env: NodeJS.ProcessEnv = process.env): boolean {
  return asString(env.NODE_ENV).toLowerCase() === "production";
}

export function hasInternalDiagnosticAccess(req: Request, env: NodeJS.ProcessEnv = process.env): boolean {
  const expected = asString(env.INTERNAL_JOB_TOKEN);
  if (!expected) return false;
  const received =
    asString(req.headers["x-internal-job-token"]) ||
    asString(req.headers["x-internal-token"]);
  return received === expected;
}

export function requireDiagnosticAccess(routeSourceLabel: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    res.setHeader("x-route-source", routeSourceLabel);
    if (!isProductionDiagnosticRuntime() || hasInternalDiagnosticAccess(req)) return next();
    return res.status(404).json({
      ok: false,
      code: "NOT_FOUND",
      error: "Not Found",
    });
  };
}

export function safeDiagnosticBuildMetadata(env: NodeJS.ProcessEnv = process.env) {
  const commit = asString(env.GIT_SHA) || asString(env.COMMIT_SHA) || asString(env.VERCEL_GIT_COMMIT_SHA);

  return {
    service: asString(env.K_SERVICE) || "rentchain-api",
    revisionPresent: Boolean(asString(env.K_REVISION)),
    commitPresent: Boolean(commit),
  };
}
