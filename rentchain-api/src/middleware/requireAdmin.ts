import { requireAuth } from "./requireAuth";

export function requireAdmin(req: any, res: any, next: any) {
  return requireAuth(req, res, () => {
    const user = (req as any)?.user;
    if (!user) return res.status(401).json({ ok: false, code: "UNAUTHORIZED", error: "Unauthorized" });

    const role = String(user.role || "").toLowerCase();
    const email = String(user.email || "").toLowerCase();
    const sub = String((user as any).sub || user.id || "").toLowerCase();

    if (role === "admin") return next();

    const rawEmails = String(process.env.ADMIN_EMAIL_ALLOWLIST || "");
    const allowEmails = rawEmails
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);

    const rawSubs = String(process.env.ADMIN_SUB_ALLOWLIST || "");
    const allowSubs = rawSubs
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);

    if (email && allowEmails.includes(email)) return next();
    if (sub && allowSubs.includes(sub)) return next();

    return res.status(401).json({ ok: false, code: "UNAUTHORIZED", error: "Unauthorized" });
  });
}
