const BRANCH = "feat/multi-property-notices-v1";
const SHA_PATTERN = /^[a-f0-9]{40}$/;

export type Pr1516BootstrapRequest = { method?: string };
export type Pr1516BootstrapResponseWriter = {
  setHeader(name: string, value: string): void;
  status(code: number): Pr1516BootstrapResponseWriter;
  json(body: unknown): unknown;
};

export function handlePr1516BrowserQaBootstrap(req: Pr1516BootstrapRequest, res: Pr1516BootstrapResponseWriter) {
  if (String(req.method || "GET").toUpperCase() !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "METHOD_NOT_ALLOWED" });
  }
  const commitSha = String(process.env.VERCEL_GIT_COMMIT_SHA || "").trim().toLowerCase();
  if (process.env.VERCEL_ENV !== "preview" || process.env.VERCEL_GIT_COMMIT_REF !== BRANCH || !SHA_PATTERN.test(commitSha)) {
    return res.status(404).json({ error: "NOT_FOUND" });
  }
  res.setHeader("Cache-Control", "private, no-store");
  return res.status(200).json({
    ok: true,
    branch: BRANCH,
    commitSha,
    scope: "pr1516-multi-property-notices",
    selector: "pr1516-landlord",
    apiBase: "/api/pr1516-notices",
    landingPath: "/notices",
  });
}
