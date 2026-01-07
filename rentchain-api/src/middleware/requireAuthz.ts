import type { Permission, Role } from "../auth/rbac";
import { getEffectivePermissions } from "../auth/rbac";

export function requirePermission(required: Permission | Permission[]) {
  return (req: any, res: any, next: any) => {
    try {
      const u = req.user;
      if (!u?.role) {
        return res.status(401).json({ ok: false, error: "Unauthorized" });
      }

      const effective = getEffectivePermissions({
        role: u.role as Role,
        extraPermissions: u.permissions ?? [],
        revokedPermissions: u.revokedPermissions ?? [],
      });

      const needed = Array.isArray(required) ? required : [required];
      const allowed = needed.every((p) => effective.has(p));

      if (!allowed) {
        return res.status(403).json({ ok: false, error: "Forbidden" });
      }

      req.userEffectivePermissions = [...effective];
      next();
    } catch (err) {
      // If anything unexpected happens, default to forbidden rather than throw
      console.warn("[requirePermission] guard failed", err);
      return res.status(403).json({ ok: false, error: "Forbidden" });
    }
  };
}
