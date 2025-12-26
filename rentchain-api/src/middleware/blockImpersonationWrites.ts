export function blockImpersonationWrites(req: any, res: any, next: any) {
  const isImpersonation = req.user?.role === "tenant" && req.user?.actorRole === "landlord";
  if (isImpersonation) {
    res.setHeader("x-impersonation", "true");
    const method = String(req.method || "").toUpperCase();
    if (!["GET", "HEAD", "OPTIONS"].includes(method)) {
      return res.status(403).json({ error: "Writes blocked during impersonation" });
    }
  }
  return next();
}
