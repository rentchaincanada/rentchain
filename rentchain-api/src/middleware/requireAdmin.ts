import { requireAuth } from "./requireAuth";

export function requireAdmin(req: any, res: any, next: any) {
  return requireAuth(req, res, () => {
    const user = (req as any)?.user;
    if (!user) return res.status(401).json({ ok: false, code: "UNAUTHORIZED", error: "Unauthorized" });

    const role = String(user.role || "").toLowerCase();
    const email = String(user.email || "").toLowerCase();

    if (role === "admin") return next();

    const raw = String(process.env.ADMIN_EMAIL_ALLOWLIST || "");
    const allow = raw
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);

    if (allow.includes(email)) return next();

    return res.status(401).json({ ok: false, code: "UNAUTHORIZED", error: "Unauthorized" });
  });
}
